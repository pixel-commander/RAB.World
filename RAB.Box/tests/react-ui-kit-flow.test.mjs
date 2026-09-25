import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createToolHouse} from '../bridge/tool-house.mjs';
import {run as seedUiKit} from '../tools/react/seed/stamp-ui-kit/stamp-ui-kit.mjs';
import {run as finalizeUiKit,finalizeKitText} from '../tools/react/seed/finalize-ui-kit/finalize-ui-kit.mjs';
import {run as createReactProject} from '../tools/react/stamp-new-project/stamp-new-project.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-react-kit-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const project=path.join(temp,'project'),template=path.join(temp,'template');
  await mkdir(path.join(project,'src','components'),{recursive:true});
  await mkdir(template,{recursive:true});
  await writeFile(path.join(project,'settings.json'),JSON.stringify({type:'react',paths:{components:'src/components'}}));
  return {temp,project,template,context:{project:{root:project}}};
};

test('UI-kit finalizer resolves only kit class markers and preserves grid addresses',async t=>{
  const f=await fixture(t),file=path.join(f.project,'src','App.tsx');
  const original='export const App=()=> <div data-area="main" data-rab-seat="area-main:a1" data-rab-kit-class="container-main" className="existing"></div>;';
  await writeFile(file,original);
  const seeded=await finalizeUiKit({options:{seeded:true},context:f.context});
  assert.equal(seeded.markers_removed,1);
  const text=await readFile(file,'utf8');
  assert.match(text,/data-area="main"/);assert.match(text,/data-rab-seat="area-main:a1"/);
  assert.match(text,/className="existing container-main"/);assert.doesNotMatch(text,/data-rab-kit-/);
  await writeFile(file,original);
  const skipped=await finalizeUiKit({options:{seeded:false},context:f.context});
  assert.equal(skipped.markers_removed,1);
  const without=await readFile(file,'utf8');
  assert.match(without,/className="existing"/);assert.match(without,/data-area="main"/);
  assert.doesNotMatch(without,/container-main|data-rab-kit-/);
  assert.throws(()=>finalizeKitText('<div data-rab-kit-unknown="x"></div>',false),{code:'UNKNOWN_KIT_MARKER'});
});

test('UI-kit seed copies arbitrary files and empty folders without replacing existing source',async t=>{
  const f=await fixture(t);
  await mkdir(path.join(f.template,'src','dashboards','Empty'),{recursive:true});
  await mkdir(path.join(f.template,'src','components','Card'),{recursive:true});
  await writeFile(path.join(f.template,'src','components','Card','Card.tsx'),'export const Card=()=>null;');
  const tool={root:path.dirname(f.template),template:f.template};
  const seeded=await seedUiKit({context:f.context,tool});
  assert.equal(seeded.status,'seeded');
  assert.deepEqual(seeded.files,['src/components/Card/Card.tsx']);
  assert.equal((await lstat(path.join(f.project,'src','dashboards','Empty'))).isDirectory(),true);
  assert.equal(await readFile(path.join(f.project,'src','components','Card','Card.tsx'),'utf8'),'export const Card=()=>null;');
  await assert.rejects(seedUiKit({context:f.context,tool}),{code:'EEXIST'});
});

test('React project stamp refuses an empty UI-kit template before creating a project',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-react-kit-stamp-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const template=path.join(temp,'empty-kit');await mkdir(template);
  const tool={root:path.join(root,'tools','react','stamp-new-project')};
  const helpers={getTool:async()=>({template})};
  await assert.rejects(createReactProject({options:{name:'KitPending',folder:temp,add_ui_kit:true},context:{rab_home:path.join(temp,'.rab')},tool,helpers}),{code:'UI_KIT_TEMPLATE_EMPTY'});
  await assert.rejects(lstat(path.join(temp,'KitPending')),{code:'ENOENT'});
  assert.deepEqual(await readdir(template),[]);
});

test('React project stamp rejects a UI-kit folder that would replace a starter file',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-react-kit-conflict-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const template=path.join(temp,'kit-template');await mkdir(path.join(template,'src','main.tsx','nested'),{recursive:true});
  const helpers={getTool:async()=>({template})};
  await assert.rejects(createReactProject({options:{name:'Conflict',folder:temp,add_ui_kit:true},context:{rab_home:path.join(temp,'.rab')},tool:{root:path.join(root,'tools','react','stamp-new-project')},helpers}),{code:'UI_KIT_CONFLICT'});
  await assert.rejects(lstat(path.join(temp,'Conflict')),{code:'ENOENT'});
});

test('React project stamp composes seed then final pass through child tools',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-react-kit-compose-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const template=path.join(temp,'kit-template');await mkdir(path.join(template,'src','dashboards'),{recursive:true});
  await writeFile(path.join(template,'src','dashboards','Home.tsx'),'export const Home=()=> <div data-area="main" data-rab-seat="area-main:a1" data-rab-kit-class="container-main"></div>;');
  const calls=[],kitTool={root:path.dirname(template),template};
  const helpers={
    getTool:async()=>kitTool,
    runTool:async({key,options,context})=>{
      calls.push(key);
      if(key==='react/seed/stamp-ui-kit')return {result:await seedUiKit({context,tool:kitTool})};
      if(key==='react/seed/finalize-ui-kit')return {result:await finalizeUiKit({options,context})};
      throw new Error(`Unexpected child ${key}`);
    }
  };
  const result=await createReactProject({options:{name:'Composed',folder:temp,add_ui_kit:true},context:{rab_home:path.join(temp,'.rab')},tool:{root:path.join(root,'tools','react','stamp-new-project')},helpers});
  assert.deepEqual(calls,['react/seed/stamp-ui-kit','react/seed/finalize-ui-kit']);
  assert.equal(result.ui_kit.status,'seeded');assert.equal(result.finalization.status,'finalized');
  const output=await readFile(path.join(temp,'Composed','src','dashboards','Home.tsx'),'utf8');
  assert.match(output,/className="container-main"/);assert.match(output,/data-area="main"/);
  assert.match(output,/data-rab-seat="area-main:a1"/);assert.doesNotMatch(output,/data-rab-kit-/);
});

test('React project stamp skips seed but still runs final pass when UI kit is declined',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-react-kit-declined-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const calls=[];
  const helpers={runTool:async({key,options,context})=>{calls.push(key);return {result:await finalizeUiKit({options,context})};}};
  const result=await createReactProject({options:{name:'Declined',folder:temp,add_ui_kit:false},context:{rab_home:path.join(temp,'.rab')},tool:{root:path.join(root,'tools','react','stamp-new-project')},helpers});
  assert.deepEqual(calls,['react/seed/finalize-ui-kit']);
  assert.equal(result.ui_kit,null);
  assert.equal(result.finalization.status,'unchanged');
});
