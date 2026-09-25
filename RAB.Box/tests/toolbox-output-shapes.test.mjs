import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createRabMemory } from '../bridge/rab-memory.mjs';
import { createAuditOutputGuide } from '../tools/audit/_output-shapes.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const guide=createAuditOutputGuide({
  savedReport:JSON.parse(await readFile(new URL('../bridge/rab-memory.contract.json',import.meta.url),'utf8')).shape,
  tracking:JSON.parse(await readFile(new URL('../bridge/tool-tracking.contract.json',import.meta.url),'utf8')).shape
});
const catalog=await createToolHouse({root}).listTools();
const audits=catalog.items.filter(tool=>tool.domain==='audit');
const byKey=new Map(audits.map(tool=>[tool.key,tool]));
const conforms=(value,shape,where='result')=>{
  if(typeof shape==='string'){
    const types=shape.split(' | ');
    const accepts=type=>{
      if(type==='null')return value===null;
      if(['number','boolean','string','object'].includes(type))return value!==null&&typeof value===type;
      if(['absolute path','relative path','ISO date','JSON pointer'].includes(type))return typeof value==='string';
      if(type==='string[]')return Array.isArray(value)&&value.every(item=>typeof item==='string');
      if(type.startsWith('"'))return value===JSON.parse(type);
      return true;
    };
    assert.ok(types.some(accepts),`${where}: expected ${shape}`);return;
  }
  if(shape?.$nullable){if(value!==null)conforms(value,shape.$nullable,where);return;}
  if(Array.isArray(shape)){assert.ok(Array.isArray(value),`${where}: array`);value.forEach((item,i)=>conforms(item,shape[0],`${where}[${i}]`));return;}
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value),`${where}: object`);
  const entries=Object.entries(shape),dictionary=entries.find(([key])=>key.startsWith('['));
  if(dictionary){for(const [key,item]of Object.entries(value))conforms(item,dictionary[1],`${where}.${key}`);return;}
  for(const [key,item]of Object.entries(value)){
    assert.ok(Object.hasOwn(shape,key)||Object.hasOwn(shape,`${key}?`),`${where}.${key}: undocumented field`);
    conforms(item,shape[key]??shape[`${key}?`],`${where}.${key}`);
  }
  for(const [key]of entries)if(!key.endsWith('?'))assert.ok(Object.hasOwn(value,key),`${where}.${key}: preview claims an absent field`);
};
const fixture=async t=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'rab-output-shapes-')));
  t.after(async()=>{assert.equal(path.dirname(temp),await realpath(os.tmpdir()));assert.ok(path.basename(temp).startsWith('rab-output-shapes-'));await rm(temp,{recursive:true,force:true});});
  const folder=path.join(temp,'source');await mkdir(folder);
  const files={
    'app.jsx':`import express from 'express';\nimport React from 'react';\nimport {WebSocketServer} from 'ws';\nimport http from 'node:http';\n// TODO test fixture\nconst app=express(); app.listen(3000);\nconst server=http.createServer(()=>{});server.listen(HTTP_PORT);\nnew WebSocketServer({port:WS_PORT});\nserver.listen(3000,'0.0.0.0');\napp.use(cors({origin:'*'}));app.get('/debug',debugHandler);\nconst Remote='http://remote.example.test:8080';\nfunction Card(){const [a]=useState(0);const [b]=useState(1);return <div className="card active"><Child /></div>;}\nconst other=<div className={dynamic} />;\nconst renamed=props.original;\nconst raw=bag.value;\nconst jwt=require('jsonwebtoken');jwt.sign(data,'fixture-secret');\nconst weak={rejectUnauthorized:false};db.query(\`SELECT * FROM t WHERE id=\${input}\`);\nexec(\`git show \${ref}\`);res.cookie('test',token,{});\nconst re=/([a-z]+)*/;\ntry{}catch(error){}\nconst code=eval(source);fetch(url);\n`,
    'style.css':`:root {--ink:red;}\n.card.active {color:var(--ink);padding:15px;}\n.active:hover{color:red;color:blue;}\n.active:hover{color:blue;}\n`,
    'index.js':`export * from './app';`,
    'index.html':`<div id="same"><img><b id="same" title="x" title="y"></div><a href="missing.html">x</a>`,
    'icon.svg':`<svg><use href="#missing"/></svg>`,
    'compose.yml':`services:\n  app:\n    ports:\n      - "8123:3000"\n`,
    'package.json':JSON.stringify({dependencies:{react:'19'}}),
    'package-lock.json':JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{react:'18'}}}}),
    'dist/app.js.map':JSON.stringify({version:3,sources:['src.js'],sourcesContent:['const x=1;']}),
    'dist/app.js':'const disableProductionAuth=true;\n'+Array.from({length:1400},(_,i)=>`const value${i}=()=>{ return ${i}+${i+1}; };`).join('\n'),
    'dist/.env.production':'FIXTURE=test',
    'generated/file.txt':'fixture',
    'binary.bin':Buffer.from([0,1,2,0])
  };
  for(const [name,source]of Object.entries(files)){const file=path.join(folder,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,source);}
  return {temp,folder};
};
test('every installed audit capability has a shape; embed stays in sync and parses',async()=>{
  assert.ok(byKey.has('audit/count/classes'),'Known class audit must be discovered; an empty scan cannot pass.');
  assert.equal(new Set(audits.map(tool=>String(tool.id))).size,audits.length,'Audit identities must be unique.');
  assert.deepEqual(audits.filter(tool=>!guide.describe(tool)).map(tool=>tool.key),[]);
  assert.equal(guide.describe({key:'audit/new-unknown',name:'new-unknown'}),null);
  const html=await readFile(path.join(root,'magic-box/index.html'),'utf8');
  assert.ok(html.includes(`const auditOutputGuide = (${createAuditOutputGuide.toString()})();`));
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('passive scanner and composite shapes agree with real fixture outputs',async t=>{
  const {folder}=await fixture(t);
  const resolver=createToolHouse({root});
  const run=async(key,options={})=>{
    const tool=await resolver.getTool(key);
    assert.ok(tool,key);
    const module=await import(pathToFileURL(tool.scriptFile));
    const result=await module.run({root,tool,options:{folder,generated_root:'generated',graph:{one:['two'],two:['one']},...options},context:{},helpers:{runTool:async args=>({result:await run(args.key,args.options)})}});
    if(tool?.domain==='audit')conforms(JSON.parse(JSON.stringify(result)),guide.describe(tool).shape,tool.key);
    return result;
  };
  // Folder index/batch tools require a real project and persisted index; their
  // public wrapper and contract checks live in folder-public.test.mjs.
  const selected=audits.filter(tool=>!tool.key.startsWith('audit/guard-test/')&&tool.key!=='audit/stamp-new-project'&&tool.key!=='audit/check/stamps/visibility'&&tool.key!=='audit/inspect/class-impact'&&!['audit/index/folders','audit/run/folder-index'].includes(tool.key));
  for(const tool of selected)await run(tool.key);
  // Investigations need real execution identities, unlike the passive module stub.
  const investigation=await resolver.runTool({key:'audit/inspect/class-impact',options:{folder,class_name:'card'}});
  conforms(investigation.result,guide.describe(byKey.get('audit/inspect/class-impact')).shape,'class impact');
  assert.ok(investigation.result.conclusions[0].consumers.includes('app.jsx'));
  const classes=await run('audit/count/classes');
  assert.ok(classes.counts.length>0);assert.ok(classes.unresolved.length>0);assert.ok(classes.skipped.length>0);
  t.diagnostic(`Compared ${selected.length} passive audit capabilities, including composites, with fixture results.`);
});
test('saved report and separate tracking preview agree with the existing writer',async t=>{
  const {temp,folder}=await fixture(t),rabHome=path.join(temp,'.rab');
  const memory=createRabMemory({rabHome}),project={id:await memory.allocateId(),name:'Shape project',root:memory.newProjectPath('Shape project')};
  await mkdir(project.root,{recursive:true});
  await writeFile(path.join(project.root,'settings.json'),JSON.stringify({id:project.id,name:project.name,type:'audit',paths:{folder,results:'audit-results'}}));
  const house=createToolHouse({root});
  const out=await house.runTool({key:'audit/count/classes',context:{rab_home:rabHome,project}});
  const report=JSON.parse(await readFile(out.result_file,'utf8'));
  conforms(report,guide.savedReport,'saved report');
  conforms(report.result,guide.describe(byKey.get('audit/count/classes')).shape);
  for(const task of out.tasks)conforms(JSON.parse(await readFile(task.tracking_file,'utf8')),guide.tracking,'tracking');
  assert.equal(report.version,'audit-result/v1');assert.ok(out.tasks.length>1);
  assert.equal(report.tasks[0].result_ref.$ref,'#/result');
  assert.equal(out.execution.result_ref.file,out.result_file);
});
