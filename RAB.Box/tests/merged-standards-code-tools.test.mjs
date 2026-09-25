import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const fixture=async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'rab-extra-'));t.after(()=>rm(dir,{recursive:true,force:true}));const put=async(file,text)=>{const target=path.join(dir,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);return target;};return{dir,put};};
const run=(key,options={},context={})=>house.runTool({key,options,context});

test('standards and code tools are public with the expected House shape',async()=>{
  const listed=await house.listTools({fresh:true});
  const keys=['audit/standards/html','audit/standards/css','audit/standards/svg','audit/standards/references','code/patch/managed-block','audit/code-review/form-contract','audit/code-review/dependency-topology','base/form/stamp-validator'];
  for(const key of keys)assert.ok(listed.items.find(x=>x.key===key),key);
  assert.equal(listed.unavailable.length,0);
});

test('HTML conformance catches structural errors and leaves a valid neighbor quiet',async t=>{
  const {dir,put}=await fixture(t);
  await put('bad.html',`<!doctype html><html><body><div id="x" id="y"><img src="a.png"><span id="dupe"></div><p id="dupe"></p></body></html>`);
  await put('good.html',`<!doctype html><html><body><main id="main"><img src="a.png" alt=""><span>ok</span></main></body></html>`);
  const out=(await run('audit/standards/html',{folder:dir})).result; const rules=new Set(out.rows.map(x=>x.rule));
  assert.ok(rules.has('HTML001'));assert.ok(rules.has('HTML002'));assert.ok(rules.has('HTML004'));assert.ok(rules.has('HTML006'));
  assert.ok(!out.rows.some(x=>x.file==='good.html'));
});

test('CSS conformance catches broken blocks/declarations and accepts valid CSS',async t=>{
  const {dir,put}=await fixture(t);await put('bad.css',`.a { color red;\n`);await put('good.css',`.b { color: var(--text); display: grid; }\n`);
  const out=(await run('audit/standards/css',{folder:dir})).result;const rules=new Set(out.rows.map(x=>x.rule));assert.ok(rules.has('CSS001'));assert.ok(!out.rows.some(x=>x.file==='good.css'));
});

test('SVG conformance catches duplicate IDs and broken local references',async t=>{
  const {dir,put}=await fixture(t);await put('bad.svg',`<svg><defs><linearGradient id="a"/></defs><rect id="a" fill="url(#missing)"/></svg>`);await put('good.svg',`<svg><defs><linearGradient id="a"/></defs><rect fill="url(#a)"/></svg>`);
  const out=(await run('audit/standards/svg',{folder:dir})).result;assert.ok(out.rows.some(x=>x.rule==='SVG002'));assert.ok(out.rows.some(x=>x.rule==='SVG003'));assert.ok(!out.rows.some(x=>x.file==='good.svg'));
});

test('local reference audit catches missing files and fragments but skips external URLs',async t=>{
  const {dir,put}=await fixture(t);await put('ok.css','.x{}');await put('page.html',`<div id="ok"></div><a href="#missing">x</a><link href="./ok.css"><img src="./missing.png"><a href="https://example.com">remote</a>`);
  const out=(await run('audit/standards/references',{folder:dir})).result;assert.ok(out.rows.some(x=>x.rule==='REF001'&&x.reference.includes('missing.png')));assert.ok(out.rows.some(x=>x.rule==='REF002'));assert.ok(!out.rows.some(x=>String(x.reference).includes('example.com')));
});

test('managed block patch preserves manual code, is idempotent, and rejects malformed ownership markers',async t=>{
  const {dir,put}=await fixture(t);const file=await put('x.mjs',`export const manual = 1;\n`);
  let out=(await run('code/patch/managed-block',{file,boundary_tag:'imports',content:`import x from './x.mjs';`})).result;assert.equal(out.status,'created-region');
  const first=await readFile(file,'utf8');assert.match(first,/manual = 1/);assert.match(first,/RAB:START imports/);
  out=(await run('code/patch/managed-block',{file,boundary_tag:'imports',content:`import x from './x.mjs';`})).result;assert.equal(out.status,'unchanged');
  await writeFile(file,`/* RAB:START broken */\nconst x=1;\n`);await assert.rejects(()=>run('code/patch/managed-block',{file,boundary_tag:'broken',content:'x'}),e=>e.code==='MALFORMED_BOUNDARY');
});

test('dependency topology audits without becoming a scheduler',async()=>{
  const graph={app:['ui','missing','ui'],ui:['data'],data:['app'],self:['self']};
  const out=(await run('audit/code-review/dependency-topology',{graph:JSON.stringify(graph)})).result;const rules=new Set(out.rows.map(x=>x.rule));
  assert.ok(rules.has('dependency-missing-node'));assert.ok(rules.has('dependency-duplicate-edge'));assert.ok(rules.has('dependency-cycle'));assert.ok(rules.has('dependency-self-edge'));assert.ok(!('executionQueue' in out));
});

test('form contract detects frontend/server/schema name drift',async t=>{
  const {dir,put}=await fixture(t);const front=await put('Form.tsx',`export const Form=()=> <form><input name="firstName"/><input name="email"/></form>;`);const server=await put('route.mjs',`export const x=async request=>{const formData=await request.formData();return {firstName:formData.get('firstName'),mail:formData.get('mail')};};`);const schema=await put('schema.json',JSON.stringify({fields:[{name:'firstName'},{name:'email'}]}));
  const out=(await run('audit/code-review/form-contract',{folder:dir,frontend_file:front,server_file:server,schema_file:schema})).result;assert.ok(out.rows.some(x=>x.rule==='form-contract-missing-server'&&x.field==='email'));assert.ok(out.rows.some(x=>x.rule==='form-contract-missing-frontend'&&x.field==='mail'));assert.ok(out.rows.some(x=>x.rule==='form-contract-missing-schema'&&x.field==='mail'));
});

test('form validator Stamp preserves missing/empty/invalid distinctions and validates supported types',async t=>{
  const {dir}=await fixture(t);const fields=[{name:'age',type:'integer',required:true},{name:'name',type:'string',required:true},{name:'role',type:'enum',values:['admin','user']},{name:'enabled',type:'boolean'}];
  const out=(await run('base/form/stamp-validator',{name:'processSubmission',location:dir,fields:JSON.stringify(fields)})).result;assert.equal(out.status,'created');const mod=await import(pathToFileURL(out.path).href+`?t=${Date.now()}`);
  const req=data=>({formData:async()=>({get:key=>data[key]??null,getAll:key=>Array.isArray(data[key])?data[key]:data[key]==null?[]:[data[key]]})});
  await assert.rejects(()=>mod.processSubmission(req({name:'A'})),/Required field age/);
  await assert.rejects(()=>mod.processSubmission(req({age:'nope',name:'A'})),/valid integer/);
  await assert.rejects(()=>mod.processSubmission(req({age:'2',name:'A',role:'owner'})),/unsupported value/);
  const good=await mod.processSubmission(req({age:'2',name:' A ',role:'admin',enabled:'true'}));assert.deepEqual(good,{age:2,name:'A',role:'admin',enabled:true});
});
