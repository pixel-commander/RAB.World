import { mkdtemp, cp, rm, writeFile, readFile, mkdir, symlink } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../../server.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';
import { createSeatParser } from '../../bridge/seat-parser.mjs';

const copyFixture = async root => {
  const temp = await mkdtemp(path.join(os.tmpdir(),'rab-security-verify-'));
  for (const file of ['HOST.json','PATHS.json','mock-project','magic-box','language','runs','tools','bridge','engine']) {
    await cp(path.join(root,file),path.join(temp,file),{recursive:true});
  }
  return temp;
};

const requestJson = async ({origin,token},url,method='GET',body,headers={}) => {
  const response = await fetch(origin+url,{
    method,
    headers:{'X-Magic-Token':token,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let data=null; try{data=await response.json();}catch{}
  return {status:response.status,data};
};

const badHostRequest = origin => new Promise((resolve,reject)=>{
  const req=httpRequest(origin+'/api/project',{headers:{Host:'evil.test'}},res=>{
    let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{let data=null;try{data=JSON.parse(text)}catch{}resolve({status:res.statusCode,data});});
  });
  req.on('error',reject);req.end();
});

const row=(check,pass,observed,expected,details={})=>({check,status:pass?'pass':'fail',expected,observed,details});

const verifyHttpBoundaries = async root => {
  const fixture=await copyFixture(root); let app;
  try{
    app=await startServer({root:fixture,port:0,rabHome:path.join(fixture,'.rab')});
    const session=await fetch(app.origin+'/api/session').then(r=>r.json());
    const client={origin:app.origin,token:session.token};
    const rows=[];
    const unauth=await fetch(app.origin+'/api/project');
    rows.push(row('missing-session-token',unauth.status===403,unauth.status,403));
    const origin=await requestJson(client,'/api/project','GET',undefined,{Origin:'https://example.com'});
    rows.push(row('cross-origin',origin.status===403,origin.status,403));
    const host=await badHostRequest(app.origin);
    rows.push(row('host-mismatch',host.status===403&&host.data?.code==='BAD_HOST',{status:host.status,code:host.data?.code},{status:403,code:'BAD_HOST'}));
    const shell=await requestJson(client,'/api/shell','POST',{command:'echo no'});
    rows.push(row('unexposed-shell-route',shell.status===404,shell.status,404));
    const direct=await requestJson(client,'/mock-project/PATHS.json');
    rows.push(row('direct-project-file-route',direct.status===404,direct.status,404));
    const traversal=await requestJson(client,'/api/project/path','POST',{key:'components',value:'../outside'});
    rows.push(row('project-path-traversal',traversal.status>=400&&traversal.status<500,traversal.status,'4xx reject'));
    const malformed=await fetch(app.origin+'/api/tools/run',{method:'POST',headers:{'X-Magic-Token':session.token,'Content-Type':'application/json'},body:'{"tool":'});
    rows.push(row('malformed-json',malformed.status===400,malformed.status,400));
    const workSession=(await requestJson(client,'/api/session/new','POST',{})).data;
    const forgedProject=await requestJson(client,'/api/tools/run','POST',{tool:'base/re-phrase-check',options:{text:'re-phrase "works"'},session_id:workSession.session_id,context:{project:{root:'/tmp'}}});
    rows.push(row('tool-context-project-forgery',forgedProject.status===400,forgedProject.status,400));
    const forgedRab=await requestJson(client,'/api/tools/run','POST',{tool:'base/re-phrase-check',options:{text:'re-phrase "works"'},session_id:workSession.session_id,context:{rab_home:'/tmp'}});
    rows.push(row('tool-context-rab-home-forgery',forgedRab.status===400,forgedRab.status,400));

    // Receipt/revision guards need an actual current Tool House ticket. A
    // rejected legacy text request must not turn later checks into /undefined.
    const location=await mkdtemp(path.join(fixture,'mock-project','security-probe-'));
    const prepared=await requestJson(client,'/api/runs','POST',{request:{mode:'command',capability:'react/add/new/component',options:{location}}});
    let run=prepared.data;
    const preparedOk=prepared.status===200&&Number.isSafeInteger(run?.id)&&run.status==='input-required'&&run.ticket?.questions?.some(question=>question.stamp==='react/add/new/component'&&question.key==='name');
    rows.push(row('receipt-probe-prepared',Boolean(preparedOk),{http_status:prepared.status,run_status:run?.status??null},{http_status:200,run_status:'input-required'}));
    if(!preparedOk)return rows;
    const runId=run.id;
    const oldRevision=run.revision;
    const answered=await requestJson(client,`/api/runs/${runId}/answer`,'POST',{revision:run.revision,stamp:'react/add/new/component',key:'name',value:'BoundaryProbe'});
    run=answered.data;
    const ready=answered.status===200&&run?.id===runId&&run.status==='ready'&&run.revision>oldRevision;
    rows.push(row('receipt-probe-ready',ready,{http_status:answered.status,run_status:run?.status??null},{http_status:200,run_status:'ready'}));
    if(!ready)return rows;
    const stale=await requestJson(client,`/api/runs/${runId}/execute`,'POST',{revision:oldRevision,confirm:true});
    rows.push(row('stale-revision',stale.status===409,stale.status,409));
    const executed=await requestJson(client,`/api/runs/${runId}/execute`,'POST',{revision:run.revision,confirm:true});
    run=executed.data;
    const completed=executed.status===200&&run?.id===runId&&run.status==='completed'&&run.result?.receipt?.steps?.some(step=>step.files?.length>0);
    rows.push(row('receipt-probe-completed',Boolean(completed),{http_status:executed.status,run_status:run?.status??null},{http_status:200,run_status:'completed'}));
    if(!completed)return rows;
    const replay=await requestJson(client,`/api/runs/${runId}/execute`,'POST',{revision:run.revision,confirm:true});
    rows.push(row('completed-run-replay',replay.status===409,replay.status,409));
    const unreceipted=await requestJson(client,`/api/runs/${runId}/file?path=${encodeURIComponent('PATHS.json')}`);
    rows.push(row('unreceipted-file',unreceipted.status===403,unreceipted.status,403));
    const escaped=await requestJson(client,`/api/runs/${runId}/file?path=${encodeURIComponent('../HOST.json')}`);
    rows.push(row('receipt-path-traversal',escaped.status===403,escaped.status,403));
    return rows;
  } finally { if(app) await app.close(); await rm(fixture,{recursive:true,force:true}); }
};

const verifyProjectOverrideContainment = async root => {
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-security-project-'));
  const outside=await mkdtemp(path.join(os.tmpdir(),'rab-security-outside-'));
  try{
    const externalRoot=path.join(outside,'external-tools');
    const external=path.join(externalRoot,'evil'); await mkdir(external,{recursive:true});
    const id=1999999999001;
    await writeFile(path.join(external,'settings.json'),JSON.stringify({id,name:'evil',title:'Outside Tool',description:'Security fixture only.',settings:[],meta:{}},null,2));
    await writeFile(path.join(external,'evil.mjs'),'export const run=async()=>({status:"should-not-run"});\n');
    const linkType=process.platform==='win32'?'junction':'dir';
    await symlink(externalRoot,path.join(project,'overrides'),linkType);
    await writeFile(path.join(project,'PATHS.json'),JSON.stringify({stamps:{},tools:{'find-hooks':{id,path:'overrides/evil'}}},null,2));
    const house=createToolHouse({root});
    let code=null;
    try{await house.getTool('find-hooks',{context:{project:{root:project}}});}
    catch(error){code=error.code??'ERROR';}
    return [row('project-override-symlink-escape',code==='INVALID_PATH',code,'INVALID_PATH',{link_type:linkType,probe_variant:linkType==='junction'?'directory-junction-escape':'directory-symlink-escape'})];
  } finally { await rm(project,{recursive:true,force:true}); await rm(outside,{recursive:true,force:true}); }
};

const verifyRegistryPathGuards = async root => {
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-security-registry-'));
  try{
    await writeFile(path.join(project,'PATHS.json'),JSON.stringify({stamps:{},tools:{'find-hooks':{id:123,path:'../outside'}}},null,2));
    const house=createToolHouse({root}); let code=null;
    try{await house.getTool('find-hooks',{context:{project:{root:project}}});}catch(error){code=error.code??'ERROR';}
    return [row('paths-dot-segment',code==='BAD_PATHS',code,'BAD_PATHS')];
  } finally { await rm(project,{recursive:true,force:true}); }
};

const verifyControlPlaneLanguage = async root => {
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  const direct=(await parser.parse('change stamp path for add-component to react/foo',{})).frames[0];
  const mention=(await parser.parse('write documentation explaining how to move add-component to another folder',{})).frames[0];
  const negated=(await parser.parse('do not move add-component to base/foo',{})).frames[0];
  const house=createToolHouse({root});
  const ranked=await house.findTools({query:'change stamp path for add-component to react/foo',includeStamps:true,requestFrame:direct});
  const executableControl=ranked.items.some(item=>item.meta?.authority==='write' && ['stamp','tool'].includes(item.meta?.target_type) && ['update','move'].includes(item.meta?.operation));
  return [
    row('control-direct-intent-shaped',direct.seats.operation==='update'&&direct.seats.target_type==='stamp',{operation:direct.seats.operation,target_type:direct.seats.target_type},{operation:'update',target_type:'stamp'}),
    row('control-mentioned-not-promoted',mention.seats.operation!=='move'&&mention.seats.operation!=='update',mention.seats.operation,'not move/update'),
    row('control-negation-preserved',negated.negated===true,negated.negated,true),
    row('control-no-ambient-write-capability',!executableControl,executableControl,false,{note:'A future path-move capability must replace this with explicit control-plane confirmation tests.'})
  ];
};


const verifyControlPlaneMove = async root => {
  const fixture=await copyFixture(root);
  try{
    const house=createToolHouse({root:fixture}); const rows=[];
    let code=null;
    try{await house.runTool({key:'move-tool',options:{address:'check-tool',scope:'house',destination:'base/security/check-tool',confirm:false}});}catch(error){code=error.code??'ERROR';}
    rows.push(row('move-tool-requires-confirmation',code==='DENIED',code,'DENIED'));
    code=null;
    try{await house.runTool({key:'move-tool',options:{address:'check-tool',scope:'house',destination:'../check-tool',confirm:true}});}catch(error){code=error.code??'ERROR';}
    rows.push(row('move-tool-blocks-traversal',code==='BAD_REQUEST'||code==='INVALID_PATH',code,'BAD_REQUEST/INVALID_PATH'));
    await mkdir(path.join(fixture,'tools','base','collision','check-tool'),{recursive:true});
    code=null;
    try{await house.runTool({key:'move-tool',options:{address:'check-tool',scope:'house',destination:'base/collision/check-tool',confirm:true}});}catch(error){code=error.code??'ERROR';}
    rows.push(row('move-tool-blocks-collision',code==='PATH_EXISTS',code,'PATH_EXISTS'));
    await rm(path.join(fixture,'tools','base','collision'),{recursive:true,force:true});
    const before=await house.getTool('check-tool');
    const moved=await house.runTool({key:'move-tool',options:{address:'check-tool',scope:'house',destination:'base/security/check-tool',confirm:true}});
    const after=createToolHouse({root:fixture}); const resolved=await after.getTool('check-tool');
    rows.push(row('move-tool-preserves-stable-id',moved.result.status==='moved'&&Number(resolved.id)===Number(before.id)&&resolved.path==='base/security/check-tool',{status:moved.result.status,id:resolved.id,path:resolved.path},{status:'moved',id:before.id,path:'base/security/check-tool'}));
    const stampBefore=await after.getTool('add-atom');
    const stampMove=await after.runTool({key:'move-stamp',options:{address:'add-atom',scope:'house',destination:'css/moved/stamp-new-atom',confirm:true}});
    const stampResolved=await createToolHouse({root:fixture}).getTool('add-atom');
    rows.push(row('move-stamp-preserves-stable-id',stampMove.result.status==='moved'&&stampResolved.kind==='stamp'&&Number(stampResolved.id)===Number(stampBefore.id)&&stampResolved.path==='css/moved/stamp-new-atom',{status:stampMove.result.status,id:stampResolved.id,path:stampResolved.path,kind:stampResolved.kind},{status:'moved',id:stampBefore.id,path:'css/moved/stamp-new-atom',kind:'stamp'}));
    return rows;
  } finally { await rm(fixture,{recursive:true,force:true}); }
};

const verifyDomWriteBoundaries = async root => {
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-security-dom-'));
  const outside=await mkdtemp(path.join(os.tmpdir(),'rab-security-dom-out-'));
  try{
    await mkdir(path.join(project,'src'),{recursive:true});
    const external=path.join(outside,'Outside.tsx');
    const original='export const Outside=()=> <main className="root"></main>;\n';
    await writeFile(external,original);
    const windows=process.platform==='win32';
    let file='src/Escape.tsx';
    if(windows){
      // A directory junction needs no symlink privilege. This tests an ancestor
      // escape to the same outside file; it is not a file-symlink probe.
      await symlink(outside,path.join(project,'src','escape-parent'),'junction');
      file='src/escape-parent/Outside.tsx';
    }else await symlink(external,path.join(project,'src','Escape.tsx'),'file');
    const house=createToolHouse({root}); let code=null;
    try{await house.runTool({key:'add-class',options:{file,class_name:'owned'},context:{project:{root:project}}});}catch(error){code=error.code??'ERROR';}
    const unchanged=await readFile(external,'utf8')===original;
    return [row('dom-edit-symlink-escape',code==='BAD_REQUEST'&&unchanged,code,'BAD_REQUEST',{
      probe_variant:windows?'parent-directory-junction-escape':'file-symlink-escape',
      link_type:windows?'junction':'file',file_symlink_exercised:!windows,external_file_unchanged:unchanged
    })];
  } finally { await rm(project,{recursive:true,force:true}); await rm(outside,{recursive:true,force:true}); }
};

const verifyLocalNetwork = async root => {
  let app;
  try{
    app=await startServer({root,port:0});
    const address=app.server.address();
    const local=address?.address==='127.0.0.1' && new URL(app.origin).hostname==='127.0.0.1';
    return [row('workbench-loopback-binding',local,{address:address?.address,origin:app.origin},{address:'127.0.0.1',origin_host:'127.0.0.1'})];
  } finally { if(app) await app.close(); }
};

export const runSecurityVerification = async ({root,check='all'}={}) => {
  const groups={
    'http-boundaries':()=>verifyHttpBoundaries(root),
    'project-override':()=>verifyProjectOverrideContainment(root),
    'paths-registry':()=>verifyRegistryPathGuards(root),
    'control-plane-language':()=>verifyControlPlaneLanguage(root),
    'control-plane-move':()=>verifyControlPlaneMove(root),
    'dom-write-boundaries':()=>verifyDomWriteBoundaries(root),
    'local-network':()=>verifyLocalNetwork(root)
  };
  const names=check==='all'?Object.keys(groups):[check];
  const rows=[];
  for(const name of names){if(!groups[name])throw Object.assign(new Error(`Unknown security check: ${name}`),{code:'BAD_REQUEST'});rows.push(...await groups[name]());}
  const failed=rows.filter(x=>x.status==='fail');
  return {status:failed.length?'fail':'pass',scan:`security-${check}`,totals:{checks:rows.length,passed:rows.length-failed.length,failed:failed.length},rows};
};
