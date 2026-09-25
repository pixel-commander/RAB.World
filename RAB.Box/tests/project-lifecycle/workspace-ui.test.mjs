import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../magic-box/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const extract = (start, end) => { const offset = script.indexOf(start); return script.slice(offset, script.indexOf(end, offset)); };
test('Chat keeps composer outside its shrinking message scroll area', () => {
  assert.match(html, /\.chat-conversation\{display:grid;grid-template-rows:auto 1fr auto/);
  assert.match(html, /#chat-messages\{grid-area:main;min-block-size:0;min-inline-size:0;overflow-y:auto;overflow-x:hidden\}/);
  assert.match(html, /#chat-form\{grid-area:footer/);
  assert.match(html, /body\.chat-view\{[^}]*block-size:100dvh;overflow:hidden/);
});
const toolboxFixture = (session={session_id:45,bag:{domain:'audit',project:{name:'Selected'}}}) => {
  const nodes=new Map(),calls=[];
  const inputs=[{name:'enabled',value:'false',dataset:{encoded:'true'}},{name:'limit',value:'0',dataset:{kind:'number'}},{name:'config',value:'{"color":"red"}',dataset:{json:'true'}},{name:'omitted',value:'',dataset:{}}];
  const state={session,toolbox:{selectedKey:'audit/probe'}};
  const context=vm.createContext({state,json:JSON.stringify,savedWindowSession:()=>null,acceptSession:value=>{state.session=value;},contextSnapshot:()=>({id:state.session?.session_id}),isCurrentContext:s=>s.id===state.session?.session_id,api:async(route,method,body)=>{calls.push({route,method,body});return {result:{ok:true}};},$:key=>{if(!nodes.has(key))nodes.set(key,{textContent:'old result',querySelectorAll:()=>inputs,setAttribute(name,value){this[name]=value;}});return nodes.get(key);}});
  vm.runInContext(extract('const selectToolboxTab =','const renderToolboxFields ='),context);
  return {context,nodes,calls,state};
};

test('Toolbox tabs toggle panels without clearing form values or output',()=>{
  const {context,nodes}=toolboxFixture();
  vm.runInContext("$('#toolbox-result');selectToolboxTab('details')",context);
  assert.equal(nodes.get('#toolbox-panel-fields').hidden,true);
  assert.equal(nodes.get('#toolbox-tab-details')['aria-selected'],'true');
  vm.runInContext("selectToolboxTab('fields')",context);
  assert.equal(nodes.get('#toolbox-panel-fields').hidden,false);
  assert.equal(nodes.get('#toolbox-tab-fields').tabIndex,0);
  assert.equal(nodes.get('#toolbox-result').textContent,'old result');
});

test('Toolbox run submits typed fields and selected session, retaining real output',async()=>{
  const {context,nodes,calls}=toolboxFixture();
  await vm.runInContext("runToolboxTool({key:'audit/probe'})",context);
  assert.equal(calls.length,1);assert.equal(calls[0].route,'/api/tools/run');
  assert.equal(calls[0].body.session_id,45);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body.options)),{enabled:false,limit:0,config:{color:'red'}});
  assert.deepEqual(JSON.parse(nodes.get('#toolbox-result').textContent),{result:{ok:true}});
});

test('Toolbox refuses implicit project creation and replaces old output on failure',async()=>{
  const {context,nodes,calls}=toolboxFixture(null);
  await assert.rejects(vm.runInContext("runToolboxTool({key:'audit/probe'})",context),/Select a project/);
  assert.equal(calls.length,0);
  assert.equal(JSON.parse(nodes.get('#toolbox-result').textContent).error,'RUN_FAILED');
});

test('Toolbox restores only an existing window session on explicit execution',async()=>{
  const {context,calls}=toolboxFixture(null);
  context.savedWindowSession=()=>81;
  context.api=async(route,method,body)=>{calls.push({route,method,body});return route==='/api/sessions/81'?{session_id:81,bag:{domain:'audit'}}:{result:'done'};};
  await vm.runInContext("runToolboxTool({key:'audit/probe'})",context);
  assert.equal(calls[0].route,'/api/sessions/81');assert.equal(calls[1].body.session_id,81);
});

test('Toolbox discards execution output after selected context changes',async()=>{
  const {context,nodes,state}=toolboxFixture();
  context.api=async()=>{state.session={session_id:99};return {result:'stale'};};
  await vm.runInContext("runToolboxTool({key:'audit/probe'})",context);
  assert.equal(nodes.get('#toolbox-result').textContent,'');
});
const makeContext = (extra = {}) => {
  const nodes = new Map(), storage = new Map();
  const context = vm.createContext({
    state: { session: null, project: null },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    $: key => { if (!nodes.has(key)) nodes.set(key, { hidden: false, textContent: '', value: '', reset() {} }); return nodes.get(key); },
    renderPlan() {}, ...extra
  });
  vm.runInContext(extract('const positiveId =', 'const addChatMessage ='), context);
  return { context, nodes, storage, run: code => vm.runInContext(code, context) };
};

test('complete inline UI compiles; fresh pages and numeric IDs are present', () => {
  assert.doesNotThrow(() => new vm.Script(script));
  for (const id of ['view-projects','view-requests','projects-resume','projects-new-action','projects-new-session','feature-request-form']) assert.ok(html.includes(`id="${id}"`));
  assert.doesNotMatch(script, /localStorage\.(?:getItem|setItem)\('rraabbiitt\.session'/);
  assert.doesNotMatch(script, /group\.id\.(?:toUpperCase|replace)/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('URL/storage ID conversion is strict, positive and safe', () => {
  const { run } = makeContext();
  assert.equal(run('positiveId("123")'), 123);
  for (const expression of ['"1e3"','" 12"','"01"','"12.0"','"old-id"','""','true','null','0','-1','9007199254740992']) assert.equal(run(`positiveId(${expression})`), null);
});

test('selection uses per-window storage and invalidates old context', () => {
  const { run, storage } = makeContext();
  run('globalThis.before = contextSnapshot(); acceptSession({session_id:123,revision:1});');
  assert.equal(run('isCurrentContext(before)'), false);
  assert.equal(storage.get('rraabbiitt.window.session'), '123');
  assert.equal(run('savedWindowSession()'), 123);
  assert.throws(() => run('acceptSession({session_id:"123"})'));
});

test('mutation captures numeric ID/revision and rejects a stale response', async () => {
  let resolve, sent;
  const { run } = makeContext({ api: (path, method, body) => { sent = { path, method, body }; return new Promise(done => { resolve = done; }); } });
  run('acceptSession({session_id:11,revision:3});');
  const pending = run('sessionMutation("/api/turn",{text:"hello"})');
  assert.equal(sent.body.session_id, 11);
  assert.equal(sent.body.expected_revision, 3);
  run('acceptSession({session_id:12,revision:1});');
  resolve({ session_id: 11, revision: 4 });
  assert.equal(await pending, null);
  assert.equal(run('state.session.session_id'), 12);
});

test('successful mutation adopts returned revision', async () => {
  const { run } = makeContext({ api: async () => ({ session_id: 11, revision: 4 }) });
  run('acceptSession({session_id:11,revision:3});');
  await run('sessionMutation("/api/session/yolo",{enabled:false})');
  assert.equal(run('state.session.revision'), 4);
});

test('request retry preserves nonce and submitted values; success clears them', async () => {
  let attempt = 0, nonceCalls = 0;
  const bodies = [];
  const { context, nodes, run } = makeContext({
    requestBrowser: { submission: null, detailSequence: 0 },
    crypto: { randomUUID: () => { nonceCalls++; return 'retry-token'; } },
    rememberSubmission() {}, syncRequestControls() {}, loadRequests: async () => {},
    requestTarget:()=>({scope:'global'}),
    json: value => JSON.stringify(value),
    api: async (path, method, body) => { bodies.push(JSON.stringify(body)); if (++attempt === 1) throw new Error('Response lost'); return { id: 99, ...body }; }
  });
  for (const name of ['name','title','description','type']) nodes.set(`#feature-request-${name}`, { value: name === 'type' ? 'feature' : name });
  vm.runInContext(extract('const saveFeatureRequest =', 'const loadContract ='), context);
  await assert.rejects(run('saveFeatureRequest()'), /Response lost/);
  nodes.get('#feature-request-name').value = 'changed after uncertain save';
  await run('saveFeatureRequest()');
  assert.equal(bodies[0], bodies[1]);
  assert.equal(nonceCalls, 1);
  assert.equal(run('requestBrowser.submission'), null);
});

test('request scope requires a selected project and pins uncertain retries to their original destination', () => {
  const {context,nodes,run}=makeContext({requestBrowser:{submission:null},URLSearchParams});
  nodes.set('#feature-request-scope',{value:'global'});nodes.set('#chat-project-select',{value:''});
  vm.runInContext(extract('const requestTarget =','const showRequest ='),context);
  assert.equal(JSON.stringify(run('requestTarget()')),'{"scope":"global"}');
  nodes.get('#feature-request-scope').value='project';assert.throws(()=>run('requestTarget()'),/Choose a project/);
  nodes.get('#chat-project-select').value='12';assert.equal(JSON.stringify(run('requestTarget()')),'{"scope":"project","project_id":12}');
  run("requestBrowser.submission={scope:'project',project_id:12}");
  nodes.get('#chat-project-select').value='99';nodes.get('#feature-request-scope').value='global';
  assert.equal(run('requestQuery(requestTarget())'),'scope=project&project_id=12');
});

test('request list ignores a response from the previously selected project', async () => {
  let finish;const requested=[];
  const {context,nodes,run}=makeContext({requestBrowser:{submission:null,sequence:0},URLSearchParams,json:JSON.stringify,syncRequestControls(){},api:route=>{requested.push(route);return new Promise(resolve=>{finish=resolve;});}});
  nodes.set('#feature-request-scope',{value:'project'});nodes.set('#chat-project-select',{value:'12'});
  nodes.set('#feature-request-destination',{textContent:'Current project'});
  vm.runInContext(extract('const requestTarget =','const saveFeatureRequest ='),context);
  const pending=run('loadRequests()');nodes.get('#chat-project-select').value='99';
  finish({directory:'old-project/feature-requests',items:[]});await pending;
  assert.equal(requested[0],'/api/requests?scope=project&project_id=12');
  assert.equal(nodes.get('#feature-request-destination').textContent,'Current project');
});

test('project/request direct entry is independent of workspace initialization', () => {
  const routing = extract('const openWorkspaceView =', "document.querySelectorAll('[data-view]').forEach");
  assert.ok(routing.indexOf("if(view==='projects')return loadProjects()") < routing.indexOf('await loadWorkspace()'));
  assert.ok(routing.indexOf("if(view==='requests')return loadRequests()") < routing.indexOf('await loadWorkspace()'));
  assert.match(script, /sequence !== projectBrowser\.sequence/);
  assert.match(script, /isCurrentContext\(snapshot\).*sequence!==projectReadSequence/);
});

test('manual work is enabled for a selected non-host project and disabled while busy',()=>{
  const nodes=new Map();
  const state={busy:false,project:{is_host_project:false},token:'fixture'};
  const context=vm.createContext({state,document:{querySelectorAll:()=>[]},$:key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);},syncChatSend(){},syncRephraseSend(){},investigations:{sync(){}},syncProjectControls(){},syncRequestControls(){}});
  vm.runInContext(extract('const syncButtons =','const task ='),context);
  vm.runInContext('syncButtons()',context);
  assert.equal(nodes.get('#manual-form button[type=submit]').disabled,false);
  state.busy=true;vm.runInContext('syncButtons()',context);assert.equal(nodes.get('#manual-form button[type=submit]').disabled,true);
  state.busy=false;state.project=null;vm.runInContext('syncButtons()',context);assert.equal(nodes.get('#manual-form button[type=submit]').disabled,true);
});

test('completed tool result remains visible after catalog refresh and refresh failure',async()=>{
  const output={textContent:'{}'},requests=[];
  const result={result:{reference:{id:123,kind:'index'},state:{status:'completed'}}};
  const context=vm.createContext({state:{selectedTool:{key:'audit/index/folders'},session:{session_id:45,bag:{domain:'audit'}}},$:key=>key==='#tool-result pre'?output:{querySelectorAll:()=>[{name:'folder',value:'C:/fixture',dataset:{}}]},json:JSON.stringify,api:async(route,method,body)=>{requests.push(body);return result;},loadTools:async()=>{output.textContent='{}';},loadHealth:async()=>{}});
  vm.runInContext(extract('const runSelectedTool =',"$('#tool-form').addEventListener"),context);
  await vm.runInContext('runSelectedTool()',context);
  assert.deepEqual(JSON.parse(output.textContent),result);assert.equal(requests[0].session_id,45);
  context.loadTools=async()=>{output.textContent='{}';throw new Error('catalog refresh failed');};
  await assert.rejects(vm.runInContext('runSelectedTool()',context),/catalog refresh failed/);
  assert.deepEqual(JSON.parse(output.textContent),result);
});

test('project preview is GET-only and ignores an older selection response', async () => {
  const pending = new Map(), nodes = new Map(), calls = [];
  const element = (tag, text = '') => ({ tag, textContent: text, value: '', hidden: false, children: [],
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    get firstChild() { return this.children[0]; }
  });
  const context = vm.createContext({
    state:{session:null},
    projectBrowser: { sequence: 0, preview: null, pending: false },
    positiveId: value => Number(value) || null,
    $: key => { if (!nodes.has(key)) nodes.set(key, element('div')); return nodes.get(key); },
    el: element, json: JSON.stringify, syncProjectControls() {}, sessionOptionLabel:session=>session.name,
    api: (path, method) => { calls.push({ path, method }); return new Promise(resolve => pending.set(path, resolve)); }
  });
  vm.runInContext(extract('const previewProject =', 'const loadProjects ='), context);
  vm.runInContext("$('#projects-select').value='11'", context);
  const first = vm.runInContext('previewProject()', context);
  vm.runInContext("$('#projects-select').value='12'", context);
  const second = vm.runInContext('previewProject()', context);
  const response = id => ({ project: { id, name: `Project ${id}`, type: 'audit' }, source_settings: { id }, sessions: [], settings_path: `project-${id}/settings.json` });
  pending.get('/api/projects/12')(response(12)); await second;
  pending.get('/api/projects/11')(response(11)); await first;
  assert.equal(vm.runInContext('projectBrowser.preview.project.id', context), 12);
  assert.equal(vm.runInContext('projectBrowser.pending', context), false);
  assert.ok(calls.every(call => call.method === undefined));
  assert.equal(nodes.get('#projects-settings-path').textContent, 'project-12/settings.json');
});

test('navigation project selection lists sessions without resuming or creating one', async () => {
  const nodes = new Map([['#projects-select', {value:'11'}]]), calls = [];
  const state = {session:{bag:{project:{id:11}}}};
  const projectBrowser = {preview:null};
  const context = vm.createContext({state,projectBrowser,
    $: key => {if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);}, syncProjectControls(){calls.push('sync');},
    previewProject:async()=>{projectBrowser.preview={project:{id:Number(nodes.get('#projects-select').value)}};},
    api:async(path,method,payload)=>{calls.push(payload.mode);assert.equal(path,'/api/projects/activate');assert.equal(payload.project_id,22);return{project:{id:22}};},
    clearActiveSession:()=>{state.session=null;}
  });
  vm.runInContext(extract('const activateChatProject =','const clearActiveSession ='),context);
  await vm.runInContext('activateChatProject(22)',context);
  assert.equal(state.session,null);
  assert.equal(projectBrowser.selectedId,22);
  assert.equal(nodes.get('#projects-select').value,'22');
  assert.deepEqual(calls,['select','sync']);
  context.previewProject=async()=>{projectBrowser.preview={project:{id:33},source_error:'missing'};};
  await assert.rejects(vm.runInContext('activateChatProject(33)',context),/unavailable/);
  assert.equal(projectBrowser.selectedId,22);
  assert.equal(nodes.get('#projects-select').value,'22');
  await vm.runInContext('activateChatProject(null)',context);
  assert.equal(calls.filter(value=>value==='select').length,1);
});

test('Chat selector is accessible and shares the project listing and active identity', () => {
  assert.match(html,/for="chat-project-select"/);
  assert.match(html,/id="chat-project-select" disabled/);
  const listing=extract('const loadProjects =','const activatePreviewProject =');
  assert.match(listing,/api\('\/api\/projects'\)/);
  assert.match(listing,/#chat-project-select/);
  assert.match(listing,/state\.session\?\.bag\?\.project\?\.id/);
  const nav=html.match(/<nav class="nav workspace-tabs"[\s\S]*?<\/nav>/)[0];
  assert.match(nav,/id="chat-project-select"/);
  assert.equal((html.match(/id="chat-project-select"/g)??[]).length,1);
});

test('session option labels show human names and turn counts, never legacy numeric names or timestamps',()=>{
  const context=vm.createContext({});
  vm.runInContext(extract('const sessionDisplayName =','const syncProjectControls ='),context);
  assert.equal(vm.runInContext("sessionDisplayName({id:123,name:'project start'})",context),'project start');
  assert.equal(vm.runInContext("sessionDisplayName({id:123})",context),'Unnamed session');
  assert.match(extract('const previewProject =','const loadProjects ='),/Active session: \$\{sessionDisplayName\(/);
  assert.equal(vm.runInContext("sessionOptionLabel({id:123,name:'Audit components',turns:2,updated_at:'DATE'})",context),'Audit components · 2 turns');
  assert.equal(vm.runInContext("sessionOptionLabel({id:123,name:'session-123',title:'New session',turns:1})",context),'Unnamed session · 1 turn');
  assert.equal(vm.runInContext("sessionOptionLabel({id:123})",context),'Unnamed session · 0 turns');
});

test('boot never creates a session and explicit New Project creates only a draft',()=>{
  const workspace=extract('const loadWorkspace =','const boot =');
  assert.doesNotMatch(workspace,/\/api\/session\/new/);
  assert.doesNotMatch(extract('const startFreshSession =',"$('#new-session')"),/api\(/);
  assert.match(script,/api\('\/api\/session\/new','POST',\{draft:true\}\)/);
  assert.match(html,/id="workspace-session-name" required/);
});

test('View reads a saved session without adopting it or posting commands',async()=>{
  const nodes=new Map(),calls=[];
  const node=(tag,text='')=>({textContent:text,children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});
  const state={session:{session_id:17}};
  const context=vm.createContext({state,projectBrowser:{preview:{project:{id:5},sessions:[{id:23}]},viewSequence:0},positiveId:Number,json:JSON.stringify,chatStepOutcome:()=>({text:'Completed'}),el:node,$:key=>{if(!nodes.has(key))nodes.set(key,node('div'));return nodes.get(key);},api:async(path,method)=>{calls.push({path,method});return{session_id:23,turns:[{text:'Saved request',reply:'Saved response'}],steps:[]};}});
  nodes.set('#workspace-session-select',{value:'23'});
  vm.runInContext(extract('const viewSavedSession =','const showNewSessionForm ='),context);
  await vm.runInContext('viewSavedSession()',context);
  assert.deepEqual(calls,[{path:'/api/sessions/23',method:undefined}]);
  assert.equal(state.session.session_id,17);
  assert.equal(nodes.get('#workspace-session-preview').hidden,false);
  assert.equal(nodes.get('#workspace-session-history').children.length,2);
});

test('named session form rejects blanks and defaults title without changing description',async()=>{
  const values={'#workspace-session-name':'   ','#workspace-session-title':'','#workspace-session-description':'An audit'};
  const calls=[];const context=vm.createContext({$:key=>({value:values[key],reset(){}}),activatePreviewProject:async(mode,meta)=>calls.push({mode,...meta})});
  vm.runInContext(extract('const createNamedSession =','const syncRequestControls ='),context);
  await assert.rejects(vm.runInContext('createNamedSession()',context),/session name/);
  assert.equal(calls.length,0);values['#workspace-session-name']=' Audit components ';
  await vm.runInContext('createNamedSession()',context);
  assert.deepEqual(calls,[{mode:'new-session',name:'Audit components',title:'Audit components',description:'An audit'}]);
});

test('ephemeral project draft is not remembered as a saved session',()=>{
  const {run,storage}=makeContext();
  run('acceptSession({session_id:null,draft_id:"draft-fixture",turns:[]})');
  assert.equal(storage.has('rraabbiitt.window.session'),false);
  assert.equal(run('state.session.draft_id'),'draft-fixture');
});

test('Continue targets the explicitly selected session and New session passes metadata',async()=>{
  const calls=[],nodes=new Map();
  const state={session:null},projectBrowser={preview:{project:{id:5,name:'Example'},sessions:[{id:20,revision:2},{id:21,revision:7}]},pending:false};
  const context=vm.createContext({state,projectBrowser,positiveId:Number,$:key=>{if(!nodes.has(key))nodes.set(key,{value:''});return nodes.get(key);},contextSnapshot:()=>({}),isCurrentContext:()=>true,api:async(path,method,body)=>{calls.push(body);return{session_id:body.session_id??30,bag:{project:{id:5}}};},acceptSession:s=>{state.session=s;},renderPlan(){},renderRun(){},restoreChatHistory(){},syncProjectControls(){},loadWorkspace:async()=>{},previewProject:async()=>{}});
  nodes.set('#projects-session',{value:'21'});
  vm.runInContext(extract('const activatePreviewProject =','const activateChatProject ='),context);
  await vm.runInContext("activatePreviewProject('resume')",context);
  assert.equal(calls[0].session_id,21);assert.equal(calls[0].expected_revision,7);
  assert.equal(state.session.session_id,21);
  await vm.runInContext("activatePreviewProject('new-session',{name:'Audit',title:'Audit',description:''})",context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])),{project_id:5,mode:'new-session',name:'Audit',title:'Audit',description:''});
  projectBrowser.preview.sessions=[];
  await assert.rejects(vm.runInContext("activatePreviewProject('resume')",context),/Choose a saved session/);
  assert.equal(calls.length,2);
});

test('compact request history preserves mixed outcomes and separates pending work', () => {
  const element=(tag,text='',className='')=>({tag,textContent:text,className,dataset:{},children:[],append(...children){this.children.push(...children);}});
  const context=vm.createContext({el:element});
  vm.runInContext(extract('const appendStepBindings =','const appendSessionGroups ='),context);
  vm.runInContext(extract('const chatStepOutcome =','const selectChatPanel ='),context);
  const body=element('div');
  const session={groups:[{id:1,stepIds:[10,11,12]},{id:2,stepIds:[13]}],steps:[
    {id:10,status:'completed',frame:{text:'Create project'},capability:{name:'Create'}},
    {id:11,status:'execution-failed',capability:{name:'Configure'}},
    {id:12,status:'cancelled',capability:{name:'Finish'}},
    {id:13,status:'input-required',frame:{text:'Next request'}}
  ]};
  const before=JSON.stringify(session);context.body=body;context.session=session;
  vm.runInContext('appendChatRequests(body,session)',context);
  const text=node=>[node.textContent,...node.children.map(text)].join(' ');
  const output=text(body);
  assert.ok(output.indexOf('Current work')<output.indexOf('Request history'));
  for(const label of ['Step 1: ✓ Completed','Step 2: ✕ Errored','Step 3: ■ Canceled','Step 4: ○ Pending','Seats & bound values'])assert.ok(output.includes(label),label);
  const descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
  const disclosures=descendants(body).filter(node=>node.tag==='details');
  assert.equal(disclosures.length,2,'One collapsed historical group and one pending step');
  for(const disclosure of disclosures){
    assert.equal(disclosure.children[0].tag,'summary');
    assert.equal(descendants(disclosure).filter(node=>node.tag==='details').length,0,'No nested disclosures');
  }
  const history=disclosures.find(node=>node.dataset.outcome==='failed');
  assert.equal(history.open??false,false);
  assert.equal(history.children[0].children[0].textContent,'Steps 1, 2, 3: ✕ Errored');
  assert.equal(history.children[0].children[1].textContent,'Create project');
  assert.ok(!output.includes('Request 1'));
  const projectPanel=html.split('<section id="chat-project-panel"')[1].split('</section>')[0];
  assert.match(projectPanel,/id="chat-tool-candidates"/);
  assert.match(projectPanel,/id="chat-health"/);
  assert.doesNotMatch(html,/<details id="chat-step-history"/);
  assert.equal(JSON.stringify(session),before,'Rendering must not change saved outcomes');
  assert.match(vm.runInContext("chatStepOutcome('execution-interrupted').text",context),/Interrupted/);
  assert.equal(vm.runInContext("chatStepOutcome('unknown').key",context),'pending');
});

test('completed and canceled groups collapse with session-wide numbers and retain error detail', () => {
  const element=(tag,text='',className='')=>({tag,textContent:text,className,dataset:{},children:[],append(...children){this.children.push(...children);}});
  const context=vm.createContext({el:element});
  vm.runInContext(extract('const appendStepBindings =','const appendSessionGroups ='),context);
  vm.runInContext(extract('const chatStepOutcome =','const selectChatPanel ='),context);
  const body=element('div');context.body=body;context.session={groups:[{id:1,status:'completed',stepIds:[10]},{id:2,status:'cancelled',stepIds:[11]},{id:3,status:'open',stepIds:[12,13]}],steps:[
    {id:10,status:'completed',frame:{text:'Create project'}},
    {id:11,status:'cancelled',frame:{text:'Create component'}},
    {id:12,status:'execution-failed',executionError:{message:'Destination exists'}},
    {id:13,status:'ready'}
  ]};
  vm.runInContext('appendChatRequests(body,session)',context);
  const cards=body.children.filter(node=>node.tag==='details');
  assert.equal(cards.length,3);assert.ok(cards.every(card=>!card.open));
  assert.equal(cards[0].children[0].children[0].textContent,'Step 1: ✓ Completed');
  assert.equal(cards[1].children[0].children[0].textContent,'Step 2: ■ Canceled');
  assert.equal(cards[2].children[0].children[0].textContent,'Steps 3, 4: ✕ Errored');
  const text=node=>[node.textContent,...node.children.map(text)].join(' ');
  assert.match(text(cards[2]),/Destination exists/);
  assert.ok(body.children.every(node=>node.textContent!=='Current work'));
});
test('Project path editor shows string and metadata paths and preserves unchanged drafts',()=>{
 const node=(tag,text='',className='')=>({tag,textContent:text,className,children:[],dataset:{},events:{},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(name,fn){this.events[name]=fn;}});
 const body=node('div');const context=vm.createContext({el:node,$:()=>body,contextSnapshot:()=>({session_id:123})});
 vm.runInContext(extract('const renderProjectPaths =','const renderChatProject ='),context);
 context.settings={paths:{pages:'src/pages',atoms:{path:'src/atoms',description:'Shared styles',types:['action','container']}}};
 vm.runInContext('renderProjectPaths(settings,true)',context);
 assert.equal(body.children.length,3);
 const fields=body.children[1].children[0];
 assert.equal(fields.children[2].children[0].value,'src/atoms');
 assert.equal(fields.children[3].children[0].value,'Shared styles');
 assert.equal(fields.children[4].children[0].value,'action, container');
 fields.children[3].children[0].value='Unsaved draft';
 vm.runInContext('renderProjectPaths(settings,true)',context);
 assert.equal(fields.children[3].children[0].value,'Unsaved draft');
 vm.runInContext('renderProjectPaths(null,false)',context);
 assert.match(body.children[0].textContent,/Load a project session/);
});
