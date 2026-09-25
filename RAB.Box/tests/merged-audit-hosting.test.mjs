import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const fixture=async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rab-hosting-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const put=async(file,text)=>{const target=path.join(dir,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);};
  return {dir,put};
};
const run=(key,folder,context={})=>house.runTool({key,options:folder?{folder}:{},context});

test('all 6 hosting audit leaves are public read-only Tools using inherited parent executor',async()=>{
  const listed=await house.listTools({fresh:true});
  const expected=[
    'audit/hosting/exposed-sourcemaps','audit/hosting/lockfile-integrity','audit/hosting/sensitive-manifests',
    'audit/hosting/debug-endpoints','audit/hosting/unminified-bundles','audit/hosting/content-security-policy'
  ];
  for(const key of expected){
    const tool=listed.items.find(x=>x.key===key);
    assert.ok(tool,key); assert.equal(tool.kind,'tool'); assert.equal(tool.inheritedExecutor,true,key); assert.equal(tool.meta.authority,'read');
  }
  assert.deepEqual(listed.unavailable,[]);
});

test('source map audit only reports maps in deployment payloads and records embedded source evidence',async t=>{
  const {dir,put}=await fixture(t);
  await put('src/app.js.map',JSON.stringify({version:3,sources:['src/app.js'],sourcesContent:['secret source']}));
  await put('dist/app.js','console.log(1);');
  await put('dist/app.js.map',JSON.stringify({version:3,sources:['../src/app.js'],sourcesContent:['export const x = 1;']}));
  await put('build/style.css.map',JSON.stringify({version:3,sources:['style.scss']}));
  const out=(await run('audit/hosting/exposed-sourcemaps',dir)).result;
  assert.equal(out.totals.matches,2);
  assert.ok(out.rows.every(x=>x.source_scope==='deployment'));
  assert.equal(out.rows.find(x=>x.file==='dist/app.js.map').embedded_sources,true);
  assert.equal(out.rows.find(x=>x.file==='build/style.css.map').embedded_sources,false);
});

test('npm lockfile audit proves matching root specs and reports deterministic drift',async t=>{
  const {dir,put}=await fixture(t);
  await put('package.json',JSON.stringify({dependencies:{react:'^19.0.0'},devDependencies:{vite:'^7.0.0'}},null,2));
  await put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{react:'^19.0.0'},devDependencies:{vite:'^7.0.0'}}}},null,2));
  let out=(await run('audit/hosting/lockfile-integrity',dir)).result;
  assert.equal(out.totals.matches,0);
  assert.equal(out.verification,'package-lock-root-specs');
  await put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{react:'^18.0.0'}}}},null,2));
  out=(await run('audit/hosting/lockfile-integrity',dir)).result;
  assert.equal(out.totals.matches,2);
  assert.ok(out.rows.some(x=>x.package==='react'&&x.declared==='^19.0.0'&&x.locked==='^18.0.0'));
  assert.ok(out.rows.some(x=>x.package==='vite'&&x.locked===null));
});

test('pnpm lockfile audit compares root importer specifiers without running package manager commands',async t=>{
  const {dir,put}=await fixture(t);
  await put('package.json',JSON.stringify({dependencies:{react:'^19.0.0'},devDependencies:{vite:'^7.0.0'}},null,2));
  await put('pnpm-lock.yaml',`lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      react:\n        specifier: ^19.0.0\n        version: 19.0.0\n    devDependencies:\n      vite:\n        specifier: ^7.0.0\n        version: 7.0.0\n`);
  const out=(await run('audit/hosting/lockfile-integrity',dir)).result;
  assert.equal(out.totals.matches,0);
  assert.equal(out.verification,'pnpm-root-specifiers');
});

test('manifest audit distinguishes sensitive payload files from review-only hosting config',async t=>{
  const {dir,put}=await fixture(t);
  await put('dist/.env.production','SECRET=value');
  await put('dist/secrets.json','{"token":"x"}');
  await put('dist/serverless.yml','service: demo');
  await put('dist/web.config','<configuration/>');
  await put('src/.env.production','SOURCE_ONLY=value');
  const out=(await run('audit/hosting/sensitive-manifests',dir)).result;
  assert.equal(out.totals.matches,4);
  assert.equal(out.rows.find(x=>x.file==='dist/.env.production').confidence,'high');
  assert.equal(out.rows.find(x=>x.file==='dist/secrets.json').confidence,'high');
  assert.equal(out.rows.find(x=>x.file==='dist/serverless.yml').confidence,'review');
  assert.equal(out.rows.find(x=>x.file==='dist/web.config').confidence,'informational');
  assert.ok(!out.rows.some(x=>x.file==='src/.env.production'));
});

test('debug audit reports explicit deployment bypass controls and ignores source/comment/string-only evidence',async t=>{
  const {dir,put}=await fixture(t);
  await put('dist/app.js',`const disableProductionAuth = true;\n// mockAuthToken = 'fake';\nconst fixture = "allowInsecureHTTP";\n`);
  await put('src/source.js','const disableProductionAuth = true;');
  const out=(await run('audit/hosting/debug-endpoints',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].indicator,'disableProductionAuth');
  assert.equal(out.rows[0].source_scope,'deployment');
});

test('bundle audit only returns review findings for large likely-unminified deployment assets',async t=>{
  const {dir,put}=await fixture(t);
  const unminified=Array.from({length:1400},(_,i)=>`const value${i} = () => { return ${i} + ${i+1}; };`).join('\n');
  const minified='var a=1;'.repeat(9000);
  await put('dist/app.js',unminified);
  await put('dist/vendor.js',minified);
  await put('src/huge.js',unminified);
  const out=(await run('audit/hosting/unminified-bundles',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].file,'dist/app.js');
  assert.equal(out.rows[0].classification,'performance');
  assert.equal(out.rows[0].confidence,'review');
});

test('CSP audit reports local evidence, and absence is review-only because external hosts can inject policy',async t=>{
  const {dir,put}=await fixture(t);
  await put('server.js',`import helmet from 'helmet';\napp.use(helmet());\n`);
  let out=(await run('audit/hosting/content-security-policy',dir)).result;
  assert.ok(out.rows.some(x=>x.kind==='hosting-csp-evidence'&&x.mechanism==='helmet-defaults'));
  const second=await fixture(t);
  await second.put('server.js','app.get("/", handler);');
  out=(await run('audit/hosting/content-security-policy',second.dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].kind,'hosting-csp-not-detected');
  assert.equal(out.rows[0].confidence,'review');
  assert.match(out.rows[0].text,/CDN|reverse proxy|hosting control plane/i);
});

test('hosting audits accept loaded project root when folder seat is omitted',async t=>{
  const {dir,put}=await fixture(t);
  await put('dist/app.js.map',JSON.stringify({version:3,sources:[]}));
  const out=(await run('audit/hosting/exposed-sourcemaps',null,{project:{root:dir}})).result;
  assert.equal(out.totals.matches,1);
});
