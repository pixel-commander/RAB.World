import path from 'node:path';
import {pathValue,pathValues} from './project-paths.mjs';
import { inventoryRequest } from './inventory-request.mjs';
import { readInventory } from '../tools/base/_inventory.mjs';
import { prepareComponentInputs, readComponentGrids } from '../tools/react/_component-inputs.mjs';
import { parseDeclarations } from '../tools/css/_stylesheet.mjs';
import { compactReceipt, reservedExecutionMemory } from './tool-tracking.mjs';
import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSeatParser } from './seat-parser.mjs';
import { createRabMemory } from './rab-memory.mjs';
import { createToolHouse } from './tool-house.mjs';
import { presentSession } from './session-view.mjs';
import { canEditStepInput } from './run-preparation.mjs';
import { cancelFlowTurn } from './session-flow.mjs';
import { legacyQuestionContract } from './human-resolver.mjs';
import { insist, record } from '../engine/src/core.mjs';

const uniq=xs=>[...new Set(xs.filter(Boolean))];
const posix=v=>String(v??'').replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
const now=()=>new Date().toISOString();
const safeId=v=>String(v??'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const pathToken = text => {
  const quoted=[...String(text).matchAll(/["']([^"']+)["']/g)].map(m=>m[1]).find(v=>/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(v));
  if(quoted)return quoted;
  const win=/(?:^|\s)([A-Za-z]:[\\/][^,;\n]+?)(?=\s+(?:and|then|project|called|named)\b|[.;]|$)/i.exec(text);
  if(win)return win[1].trim();
  const unix=/(?:^|\s)(\/(?:[^\s,;]+\/?)+)(?=\s|[.;]|$)/.exec(text);
  return unix?.[1]?.trim()??null;
};
const rawValue=text=>String(text).trim().replace(/^["']|["']$/g,'');
const isActionFrame=frame=>!!frame?.seats?.operation || !!frame?.seats?.target_type || frame?.negated;
const getEvidencePath=frame=>frame?.evidence?.find(e=>e.reason?.startsWith('path literal'))?.value??null;
const makeQuestion=(kind,field,question,extra={})=>({kind,field,question,...extra,contract:legacyQuestionContract({kind,field,question,...extra})});

const scanDirs=async(root,rel,type,marker=null)=>{
  const out=[]; const base=path.join(root,rel??'');
  try { for(const e of await readdir(base,{withFileTypes:true})){ if(!e.isDirectory())continue; const r=path.posix.join(posix(rel),e.name); if(marker){try{if(!(await lstat(path.join(base,e.name,marker))).isFile())continue;}catch{continue;}} out.push({name:e.name,type,path:r,source:'project-scan',verified:true}); } } catch{}
  return out;
};
const scanNestedComponents=async(root,componentsRel)=>{
  const out=[]; const start=path.join(root,componentsRel??'components');
  const walk=async(abs,rel,depth=0)=>{if(depth>10)return;let entries=[];try{entries=await readdir(abs,{withFileTypes:true});}catch{return;}for(const e of entries){if(!e.isDirectory())continue;const childAbs=path.join(abs,e.name),childRel=path.posix.join(rel,e.name);let resource={name:e.name,type:'component',path:childRel,source:'project-scan',verified:true};try{const s=JSON.parse(await readFile(path.join(childAbs,'settings.json'),'utf8'));if(s?.type==='component')resource={...resource,name:s.name??e.name,parent_path:s.parent_path??null};}catch{}out.push(resource);await walk(childAbs,childRel,depth+1);}};
  await walk(start,posix(componentsRel??'components')); return out;
};
const collectProjectEntities=async(projectRoot,settings)=>{
  const paths=pathValues(settings?.paths);
  return [
    ...await scanNestedComponents(projectRoot,paths.components??'components'),
    ...await scanDirs(projectRoot,paths.atoms??'atoms','atom','atom.css'),
    ...await scanDirs(projectRoot,paths.pages??'pages','page')
  ];
};

const optionRec=(value,status,source,required=true)=>({value,status,source,required});
const normalizeBool=text=>{const x=String(text).trim().toLowerCase();if(['true','yes','y','on'].includes(x))return true;if(['false','no','n','off'].includes(x))return false;return null;};

const stepGapCount=step=>Object.values(step.gaps??{}).reduce((n,x)=>n+(x?.length??0),0);
const frameSummary=frame=>({id:frame.id,text:frame.text,seats:frame.seats,data_types:frame.data_types,resources:frame.resources,evidence:frame.evidence,typedUnknowns:frame.typedUnknowns??[],composition:frame.composition??null,completeLanguage:frame.completeLanguage});

export const createSessionPlanner = async ({ root, projectRoot, project, languageRoot, rabHome, usageLedger = null }={}) => {
  const memory=createRabMemory({rabHome}); await memory.ensureHome();
  const meta={id:project.id,name:project.manifest?.project?.name??project.id,root:projectRoot};
  await memory.openProject(meta);
  const projectOverrideFile=path.join(memory.paths(meta).project,'language','type-overrides.json');
  let seatParser=await createSeatParser({languageRoot,projectOverrideFile});
  const registry={stamps:[]};
  const toolHouse=createToolHouse({root,usageLedger});
  const readProjectSettings=()=>memory.readProjectSettings(meta);
  const saveProjectPath=async(key,value,{session,description,types,expected}={})=>{
    const options={name:key,path:value};
    if(description!==undefined)options.description=description;
    if(types!==undefined)options.types=types;
    if(expected!==undefined)options.expected=expected;
    return toolHouse.runTool({key:'project/add/paths',options,context:{rab_home:memory.rabHome,project:meta,__rab_telemetry:{session_id:session?.id??null}}});
  };

  const refresh = async () => {
    const settings=await readProjectSettings();
    const scanned=await collectProjectEntities(projectRoot,settings);
    const existing=await memory.loadResources(meta);
    for(const entity of scanned){const bucket=entity.type==='component'?'components':entity.type==='atom'?'atoms':entity.type==='page'?'pages':'other';existing[bucket]??={};existing[bucket][entity.name]={...(existing[bucket][entity.name]??{}),...entity,updated_at:now()};}
    await memory.saveResources(meta,existing);
    return {settings,scanned};
  };
  // Resource scans run only for work that needs entity resolution. Inventory
  // lookup reads its saved manifest, including the first turn of a new session.

  const ensureAuditRoot=async session=>{
    if(session.bag.audit?.workingRoot)return session.bag.audit.workingRoot;
    if(!session.bag.audit?.projectName)return null;
    const p=memory.paths(meta).project;
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const dir=path.join(p,'audits',safeId(session.bag.audit.projectName),stamp);
    await mkdir(dir,{recursive:true});
    session.bag.audit.workingRoot=dir;
    return dir;
  };

  const syncBag=async session=>{
    const settings=await readProjectSettings();
    session.bag.projectSettings=settings;
    session.bag.paths={...(settings.paths??{})};
    const snap=await memory.openProject(meta); snap.projectSettings=settings;
    return settings;
  };

  const knownFor=async session=>{
    const persisted=await memory.knownEntities(meta);
    const live=session.bag?.sessionResources??{};
    return [...persisted,...Object.values(live)];
  };

  const emit=async event=>{if(!usageLedger)return null;try{return await usageLedger.append(meta,event);}catch{return null;}};
  const capabilitySubject=step=>step?.capability?{type:step.capability.kind==='stamp'?'stamp':'tool',id:step.capability.id??null,address:step.capability.house?.address??step.capability.name,path:step.capability.house?.path??null,name:step.capability.name}:null;
  const wordEvents=(frame,base)=>{
    const seen=new Set(),out=[];
    for(const evidence of frame?.evidence??[]){
      if(!['operation','target_type','predicate','relation','quantifier','domain'].includes(evidence.seat))continue;
      const raw=String(evidence.text??'').trim(); if(!raw||raw.startsWith('<'))continue;
      for(const form of raw.toLowerCase().match(/[a-z][a-z0-9_-]*/g)??[]){const key=`${form}:${evidence.seat}`;if(seen.has(key))continue;seen.add(key);out.push({...base,type:'word-use',subject:{type:'word',form},seat:evidence.seat,value:evidence.value,outcome:'success'});}
    }
    return out;
  };

  const newGroup=async(session,reason='new-root')=>{
    const group={id:await memory.allocateId(),created_at:now(),reason,stepIds:[],currentStepId:null,status:'open'};
    session.groups.push(group); session.bag.currentGroupId=group.id; return group;
  };
  const groupById=(session,id)=>session.groups.find(g=>g.id===id)??null;
  const stepById=(session,id)=>session.steps.find(s=>s.id===id)??null;
  const latestOpenStep=session=>[...session.steps].reverse().find(s=>s?.groupId===session?.bag?.currentGroupId&&['input-required','configuration-required'].includes(s?.status))??null;

  const chooseGroup=async(session,frame,index,priorStep)=>{
    if(!session.groups.length)return newGroup(session,'first-work');
    if(['completed','cancelled','superseded'].includes(groupById(session,session?.bag?.currentGroupId)?.status))return newGroup(session,'new-work-after-terminal-group');
    if(index>0 || frame.seats.reference || frame.seats.relation || frame.seats.target || priorStep)return groupById(session,session.bag.currentGroupId)??session.groups.at(-1);
    if(frame.seats.operation==='create' && ['component','page','atom','div','project'].includes(frame.seats.target_type))return newGroup(session,'new-root-artifact');
    return groupById(session,session.bag.currentGroupId)??session.groups.at(-1);
  };

  const resolveEntity=(name,known)=>known.find(e=>String(e.name).toLowerCase()===String(name).toLowerCase())??null;
  const pathSetting=(session,key)=>pathValue(session.bag.paths?.[key]);
  const classResource=frame=>frame.resources?.find(r=>['atom','class','style'].includes(r.type))?.name ?? (frame.seats.target_type==='atom'?frame.seats.name:null);
  const populationFor=(session,frame)=>session.bag.populationTarget&&((frame.seats.operation==='insert'&&frame.seats.target_type==='component-use')||(frame.seats.operation==='create'&&frame.seats.target_type==='div'&&!frame.seats.target))?session.bag.populationTarget:null;

  const explicitDomainFor=frame=>frame.evidence?.find(e=>e.seat==='domain'&&e.reason!=='Bag/context domain'&&(e.reason!=='build target/domain cue'||/\breact\b/i.test(e.text)))?.value??null;
  const houseMatchFrame=frame=>{
    const explicit=explicitDomainFor(frame);
    // A div is a native element. Keep the user's tag in the frame, and match
    // the shared element Tool rather than inventing a separate div Tool.
    return {...frame,seats:{...frame.seats,domain:explicit?frame.seats.domain:null,target_type:frame.seats.target_type==='div'?'element':frame.seats.target_type}};
  };
  const houseCandidates=async frame=>{
    if(!frame?.seats?.operation||!frame?.seats?.target_type)return [];
    const matchFrame=houseMatchFrame(frame);
    const explicitDomain=explicitDomainFor(frame);
    const found=await toolHouse.findTools({query:frame.text,domain:explicitDomain??undefined,includeStamps:true,requestFrame:matchFrame,context:{project:meta}});
    const packed=await toolHouse.pathsRegistry.pack({projectRoot});
    const entries=[...Object.entries(packed.tools),...Object.entries(packed.stamps)];
    return found.items.map(item=>{
      const hit=entries.find(([,entry])=>String(entry.id)===String(item.id)&&entry.path===item.path);
      const options=Object.fromEntries((item.settings??[]).map(field=>[field.name,{...field}]));
      return {
        id:`house:${item.id}`,kind:'house-tool',house_kind:item.kind,name:hit?.[0]??item.key,title:item.title,description:item.description,
        data_types:item.meta?.data_types??[],shape:{domain:item.meta?.domain??item.domain,operation:item.meta?.operation??item.inherited?.operation??null,target_type:item.meta?.target_type??item.inherited?.target_type??null,relation:item.meta?.relation??null,predicate:item.meta?.predicate??null,quantifier:item.meta?.quantifier??null,output:item.meta?.output??null},authority:item.meta?.authority??(item.kind==='stamp'?'write':'read'),executable:true,
        options,house:{address:hit?.[0]??null,key:item.key,path:item.path,id:item.id},score:item.score,path_score:item.path_score,shape_score:item.shape_score
      };
    });
  };
  const chooseCapability=async(frame,{parent,session})=>{
    const s=frame.seats;
    if(s.domain==='audit'){
      // Audit is an operator/session mode, not a capability species. Resolve ordinary READ Tools
      // across semantic domains so requests such as "audit state hooks" may lawfully use a React Tool.
      const auditFrame={...frame,seats:{...frame.seats,domain:null},evidence:(frame.evidence??[]).filter(e=>e.seat!=='domain')};
      const candidates=await houseCandidates(auditFrame),top=candidates.find(c=>String(c.authority??'read').toLowerCase()==='read')??null;
      if(top&&(top.shape_score>=16||top.path_score>=24))return top;
    }
    const cssState=frame.evidence?.some(e=>e.seat==='css_state');
    const candidates=(await houseCandidates(frame)).filter(c=>(!cssState||c.shape?.domain==='css'&&c.options?.state)&&(!c.shape?.relation||c.shape.relation===s.relation||(parent&&c.shape.relation==='child-of')));
    const exact=candidates.filter(c=>c.shape.operation===s.operation&&c.shape.target_type===(s.target_type==='div'?'element':s.target_type));
    const top=(s.operation==='create'&&parent&&s.target_type==='component'?exact.find(c=>c.shape.relation==='child-of'):null)??(s.operation==='create'?exact.find(c=>c.house_kind==='stamp'):exact[0])??candidates[0];
    if(top&&(exact.includes(top)||top.shape_score>=16||top.path_score>=24)){
      if(s.predicate!==null&&s.predicate!==undefined&&top.shape?.predicate!==s.predicate)return null;
      return top;
    }
    return null;
  };

  const optionsFor=(frame,capability,{session,parent,priorStep,answers={}})=>{
    const opts={}; const gaps={requiredInputs:[],configuration:[]}; const s=frame.seats;
    const population=populationFor(session,frame);
    const set=(key,val,status,source,required=true)=>opts[key]=optionRec(val,status,source,required);
    const spec=capability?.options??{};
    const answer=(key)=>answers[key];
    for(const [key,field] of Object.entries(spec)){
      if(answer(key)!==undefined){set(key,answer(key),'resolved','turn-answer',field.required);continue;}
      let value=null,source=null,status='unknown';
      if(key==='folder'&&(getEvidencePath(frame)||pathToken(frame.text))){value=getEvidencePath(frame)??pathToken(frame.text);source='request:path';status='resolved';}
      else if(key==='extension'&&frame.evidence?.some(e=>e.seat==='extension')){value=frame.evidence.find(e=>e.seat==='extension').value;source='request:extension';status='resolved';}
      else if(key==='folder'&&session.bag?.projectSettings?.type==='audit'){value=pathValue(session.bag.projectSettings.paths?.folder);source='project settings.json paths.folder';status='derived';}
      else if(key==='type'&&s.target_type==='inventory'){value=s.name;source='request:path-type';status='resolved';}
      else if(key==='name'&&s.name){value=s.name;source='request:name';status='resolved';}
      else if(key==='atom_name'&&s.target_type==='atom'&&s.name){value=s.name;source='request:atom';status='resolved';}
      else if(key==='state'&&frame.evidence?.some(e=>e.seat==='css_state')){value=frame.evidence.find(e=>e.seat==='css_state').value;source='request:css-state';status='resolved';}
      else if(key==='location'&&frame.evidence?.some(e=>e.seat==='css_location')){value=frame.evidence.find(e=>e.seat==='css_location').value;source='request:css-location';status='resolved';}
      else if(key==='class_name'&&s.target_type==='class'&&s.name){value=s.name;source='request:class';status='resolved';}
      else if(key==='class_name'&&classResource(frame)){value=classResource(frame);source='request:resource';status='resolved';}
      else if(key==='grid'&&frame.evidence?.some(e=>e.seat==='layout'||e.seat==='grid')){value=frame.evidence.find(e=>e.seat==='layout'||e.seat==='grid').value;source='request:grid';status='resolved';}
      else if(key==='component'&&s.target_type==='component-use'){value=frame.evidence?.find(e=>e.seat==='component')?.value??s.name;source='request:insert-component';status='resolved';}
      else if(population&&key==='file'){value=population.file;source='population:target-file';status='resolved';}
      else if(population&&['into_component','component'].includes(key)){value=population.name;source='population:target';status='resolved';}
      else if(key==='area'&&frame.evidence?.some(e=>['area','data_area'].includes(e.seat))){value=frame.evidence.find(e=>['area','data_area'].includes(e.seat)).value;source='request:data-area';status='resolved';}
      else if(key==='file'&&s.target_type==='div'&&parent?.path){value=parent.type==='div'?parent.path:path.join(path.resolve(projectRoot,parent.path),`${parent.name}.tsx`);source='parent:source-file';status='resolved';}
      else if(key==='seat_id'&&s.target_type==='div'&&parent?.seat_id){value=parent.seat_id;source='parent:construction-seat';status='resolved';}
      else if(key==='component'&&s.target&&parent?.type!=='div'){value=s.target;source='request:target';status='resolved';}
      else if(key==='data_area'&&frame.evidence?.some(e=>e.seat==='data_area')){value=frame.evidence.find(e=>e.seat==='data_area').value;source='request:data-area';status='resolved';}
      else if(key==='layout'&&s.target_type==='grid'&&s.name){value=s.name;source='request:layout';status='resolved';}
      else if(key==='tag'&&s.target_type==='div'){value='div';source='request:target-type';status='resolved';}
      else if(session.bag.seats&&Object.hasOwn(session.bag.seats,key)&&field.ask!==true&&!spec.atom_decisions&&!(population&&['file','path','seat_id','data_area','element','area','class_name','component','into_component'].includes(key))&&!(s.target&&['file','path','seat_id','data_area','element'].includes(key))){value=session.bag.seats[key];source=`Bag.seats.${key}`;status='resolved';}
      else if(key==='address'&&s.name&&['tool','stamp'].includes(s.target_type)){value=s.name;source='request:name/address';status='resolved';}
      else if(key==='destination'){
        const p=getEvidencePath(frame); if(p){value=p;source='request:path';status='resolved';}
      }
      else if(key==='folder'){
        value=session.bag.audit?.scanRoot??projectRoot; source=session.bag.audit?.scanRoot?'Bag.audit.scanRoot':'loaded project root'; status='derived';
      }
      else if(key==='location'){
        const houseType=capability.kind==='house-tool'?capability.shape?.target_type:null;
        const mapKey=capability.name==='new-component'||['component','navigation'].includes(houseType)?'components':capability.name==='new-page'||houseType==='page'?'pages':houseType==='atom'?'atoms':capability.name==='stamp-maker'?'generated_stamps':null;
        const mapped=mapKey&&pathSetting(session,mapKey); if(mapped){value=capability.kind==='house-tool'?path.resolve(projectRoot,mapped):mapped;source=`project settings.json paths.${mapKey}`;status='derived';}
        else if(capability.name==='react-project'){
          const p=getEvidencePath(frame); if(p){value=p;source='request:path';status='resolved';}
          else if(session.bag.project?.root){value='.';source='current host project root';status='derived';}
        }
      }
      else if(key==='parent_path'){
        if(parent?.path){value=path.resolve(projectRoot,parent.path);source=parent.verified?'verified parent resource':'planned parent result';status=parent.verified?'resolved':'pending-dependency';}
        else if(session.bag.currentTarget?.path){value=path.resolve(projectRoot,session.bag.currentTarget.path);source='Bag.currentTarget';status='resolved';}
      }
      else if(key==='class'){
        const c=classResource(frame); if(c){value=c;source='request/resource';status='resolved';}
      }
      else if(key==='content'&&s.value!==null){value=String(s.value);source='request:value';status='resolved';}
      else if(key==='save_as_text'){
        if(/\b(?:save as text|as text|text file)\b/i.test(frame.text)){value=true;source='request:test-output-mode';status='resolved';}
        else if(Object.hasOwn(field,'default')){value=field.default;source='contract:default';status='derived';}
      }
      else if(key==='layer'&&Object.hasOwn(field,'default')){value=field.default;source='contract:default';status='derived';}
      else if(key==='type'&&Array.isArray(field.enum)&&field.enum.length===1){value=field.enum[0];source='contract:single-enum';status='derived';}
      else if(Object.hasOwn(field,'default')){value=field.default;source='contract:default';status='derived';}
      if(value!==null&&value!==undefined)set(key,value,status,source,field.required);
      else if(field.try){set(key,null,'auto-resolver',`settings.try:${field.try}`,field.required);}
      else {set(key,null,field.required||field.ask?'unknown':'unbound',null,field.required); if(field.required||field.ask)gaps.requiredInputs.push(makeQuestion(field.ask&&!field.required?'optional-input':'required-input',key,field.question??field.description??`What is ${key}?`,{optionType:field.type,role:field.role??null,enum:field.enum}));}
    }
    // Edit tools accept alternative addresses. Ask for the owning component when
    // a DOM area was supplied without a file/component, rather than guessing.
    if(opts.data_area?.value&&!opts.component?.value&&!opts.file?.value&&!opts.path?.value){
      set('component',null,'unknown',null,true);
      gaps.requiredInputs.push(makeQuestion('required-input','component',`Which component or page contains data-area=${opts.data_area.value}?`,{optionType:'text'}));
    }
    // Project-path configuration gaps are more useful than generic stamp input questions.
    for(const [key,rec] of Object.entries(opts)){
      if(rec.status!=='unknown')continue;
      if(key==='location'&&['component','page','atom'].includes(capability.shape?.target_type)){
        const mapKey=({component:'components',page:'pages',atom:'atoms'})[capability.shape.target_type];
        gaps.requiredInputs=gaps.requiredInputs.filter(g=>g.field!==key);
        gaps.configuration.push(makeQuestion('project-path',`path:${mapKey}`,`What is the ${mapKey.replaceAll('_',' ')} path for this project?`,{pathKey:mapKey,saveTo:'project/settings.json'}));
      }
    }
    if(s.target_type==='inventory'&&!pathSetting(session,s.name)){
      if(answer('add_path')===true)gaps.configuration.push(makeQuestion('project-path',`path:${s.name}`,`What project-relative folder should I use for ${s.name}?`,{pathKey:s.name,saveTo:'saved project/settings.json'}));
      else gaps.configuration.push(makeQuestion('project-path-consent','add_path','Do you want to add a new path?',{requestedPathKey:s.name,optionType:'boolean'}));
    }
    return {options:opts,gaps};
  };


  const plannedResource=(step,frame,capability,parent,session)=>{
    const name=step.options?.name?.value??frame.seats.name;
    if(capability?.kind==='house-tool'&&capability.house_kind==='stamp'&&capability.shape?.operation==='create'&&['component','page','atom','navigation'].includes(capability.shape.target_type)&&name){
      const base=step.options.parent_path?.value??step.options.location?.value;
      return base?{type:capability.shape.target_type==='navigation'?'component':capability.shape.target_type,name,path:capability.shape.target_type==='atom'?path.join(base,`${name}.css`):path.join(base,name),verified:false,source:'planned'}:null;
    }
    if(capability?.house?.path==='react/add/element'&&step.options.file?.value){
      return {type:'div',name:'div',path:step.options.file.value,seat_id:step.options.new_seat_id.value,verified:false,source:'planned'};
    }
    if(capability?.name==='new-component'&&name){const base=step.options.location?.value;return base?{type:'component',name,path:path.posix.join(posix(base),name),verified:false,source:'planned'}:null;}
    if(capability?.name==='sub-component'&&name){const base=step.options.parent_path?.value;return base?{type:'component',name,path:path.posix.join(posix(base),name),parent:parent?.name??null,verified:false,source:'planned'}:null;}
    if(capability?.name==='new-page'&&name){const base=step.options.location?.value;return base?{type:'page',name,path:path.posix.join(posix(base),name),verified:false,source:'planned'}:null;}
    if(capability?.name==='sub-div'){const base=step.options.parent_path?.value;const divName=step.options.name?.value??'div';return base?{type:'div',name:divName,path:path.posix.join(posix(base),divName),parent:parent?.name??null,verified:false,source:'planned'}:null;}
    if(capability?.name==='atom-stamp'&&name){const base=pathValue(session.bag.paths?.atoms)??'atoms';return{type:'atom',name,path:path.posix.join(posix(base),name),verified:false,source:'planned'};}
    return null;
  };

  const buildStep=async({session,frame,turnId,index,priorStep,known,answers={},existingStep=null})=>{
    const explicitParent=frame.seats.relation==='child-of'&&frame.seats.target?resolveEntity(frame.seats.target,known):null;
    const refParent=frame.seats.reference==='current'?session.bag.currentTarget:frame.seats.reference==='previous-result'?priorStep?.plannedResult:null;
    const implicitPrior=priorStep && frame.seats.operation==='create' && ['component','div'].includes(frame.seats.target_type) && !frame.seats.target ? priorStep.plannedResult : null;
    const population=populationFor(session,frame);
    const parent=population?{...population,type:'component',verified:true}:explicitParent??refParent??implicitPrior??(frame.seats.relation==='child-of'?session.bag.currentTarget:null);
    const group=existingStep?groupById(session,existingStep.groupId):await chooseGroup(session,frame,index,priorStep);
    const step=existingStep??{id:await memory.allocateId(),groupId:group.id,created_at:now(),turnIds:[],parentStepId:priorStep?.id??null,ancestry:[...(session.bag.addressStack??[])],answers:{},status:'resolving'};
    if(!step.turnIds.includes(turnId))step.turnIds.push(turnId); step.answers={...(step.answers??{}),...answers}; step.frame=frameSummary(frame); step.gaps={language:[],capability:[],requiredInputs:[],configuration:[],conflicts:[]};
    if(!group.stepIds.includes(step.id))group.stepIds.push(step.id); group.currentStepId=step.id; session.bag.currentGroupId=group.id; session.bag.currentStepId=step.id;
    if(frame.unknownTokens.length||(frame.typedUnknowns??[]).length||frame.ambiguousSeats.length||frame.conflicts.length||frame.negated){
      step.gaps.language.push(...frame.unknownTokens.map(x=>({type:'unknown-word',...x})),...(frame.typedUnknowns??[]).map(x=>({gap_type:'typed-unknown',...x})),...frame.ambiguousSeats.map(x=>({type:'ambiguous-seat',...x})),...frame.conflicts.map(x=>({type:'conflict',...x})),...(frame.negated?[{type:'negation',text:frame.text}]:[]));
      step.status='language-gap'; step.capability=null; step.options={}; step.settings=[]; return step;
    }
    const capability=await chooseCapability(frame,{parent,session});
    if(!capability){
      const legacy=frame.seats.domain==='audit'?[]:registry.stamps.filter(c=>c.shape?.domain===frame.seats.domain).slice(0,8).map(c=>({name:c.name,kind:c.kind,score:0,ratio:0,matches:[],missing:[],conflicts:[],dataTypeMatches:[]}));
      const house=(await houseCandidates(frame)).slice(0,8).map(x=>({name:x.name,kind:x.kind,path:x.house.path,score:x.score,path_score:x.path_score,shape_score:x.shape_score}));
      step.gaps.capability.push({type:'missing-or-unresolved-capability',requestedShape:frame.seats,candidates:[...house,...legacy]}); step.status='capability-gap'; step.capability=null; step.options={}; step.settings=[]; return step;
    }
    step.capability={id:capability.id,name:capability.name,kind:capability.kind,title:capability.title??capability.name,description:capability.description,shape:capability.shape,data_types:capability.data_types,authority:capability.authority,house:capability.house??null,house_kind:capability.house_kind??null};
    step.settings=Object.values(capability.options??{});
    const bound=optionsFor(frame,capability,{session,parent,priorStep,answers:step.answers});
    step.options=bound.options; step.gaps.requiredInputs.push(...bound.gaps.requiredInputs); step.gaps.configuration.push(...bound.gaps.configuration);
    if(capability.options?.atom_decisions&&!stepGapCount(step)){
      const input=Object.fromEntries(Object.entries(step.options).filter(([,record])=>record.value!==null&&record.value!==undefined).map(([key,record])=>[key,record.value]));
      const prepared=await prepareComponentInputs({options:input,context:{rab_home:memory.rabHome,project:meta},helpers:{listTools:()=>toolHouse.listTools({context:{project:meta}}),getTool:ref=>toolHouse.getTool(ref,{context:{project:meta}}),bindSettings:toolHouse.bindSettings}});
      step.gaps.requiredInputs.push(...prepared.questions.map(q=>makeQuestion('component-atom',q.name,q.description??`What is ${q.title??q.name}?`,{optionType:q.type,enum:q.enum,options:q.options,atom:q.atom})));
      // The engine receives original class requests and explicit decisions so it
      // can revalidate dependencies immediately before writing.
    }
    if(capability.options?.atom_decisions){
      const gridGap=step.gaps.requiredInputs.find(gap=>gap.field==='grid');
      if(gridGap){gridGap.enum=['none',...Object.keys((await readComponentGrids()).layouts)];gridGap.question=`Which grid? Choose ${gridGap.enum.join(', ')}.`;gridGap.contract=legacyQuestionContract(gridGap);}
    }
    if(capability.house?.key==='base/find/inventory'&&pathSetting(session,frame.seats.name)&&step.answers.add_listener!==true){
      const inventory=await readInventory({rab_home:memory.rabHome,project:meta},frame.seats.name);
      if(inventory.status==='not-indexed')step.gaps.configuration.push(makeQuestion('project-listener-consent','add_listener',`Add the configured ${frame.seats.name} path to the listener and build its manifest?`,{requestedPathKey:frame.seats.name,optionType:'boolean'}));
    }
    if(capability.house?.path==='react/add/element')step.options.new_seat_id=optionRec(`element-${session.id}-${step.id}`,'derived','runner:construction-seat',false);
    const blockers=stepGapCount(step);
    step.status=blockers? (step.gaps.configuration.length?'configuration-required':'input-required') : 'ready';
    step.parentResource=parent?{name:parent.name,type:parent.type,path:parent.path,seat_id:parent.seat_id,verified:parent.verified??false}:null;
    step.plannedResult=plannedResource(step,frame,capability,parent,session);
    if(step.plannedResult){
      const parentNode=parent?{type:parent.type,name:parent.name,path:parent.path,verified:parent.verified??false}:null;
      const inheritedTrail=[...(parent?.addressStack??parent?.ancestry??[])].filter(Boolean);
      const trail=[...inheritedTrail];
      if(parentNode && !trail.some(x=>x.type===parentNode.type&&x.name===parentNode.name&&x.path===parentNode.path)) trail.push(parentNode);
      step.ancestry=trail;
      step.plannedResult={...step.plannedResult,addressStack:[...trail,{type:step.plannedResult.type,name:step.plannedResult.name,path:step.plannedResult.path,verified:false}]};
      session.bag.sessionResources??={}; session.bag.sessionResources[step.plannedResult.name]={...step.plannedResult,stepId:step.id};
      session.bag.currentTarget=step.plannedResult;
      session.bag.addressStack=step.plannedResult.addressStack;
    }
    return step;
  };

  const clearGaps=()=>({language:[],capability:[],requiredInputs:[],configuration:[],conflicts:[]});
  const storeAtomAnswer=(answers,gap,value)=>{
    const {class_name:token,field}=gap.atom;
    const decisions=structuredClone(answers.atom_decisions??{}),decision=decisions[token]??{};
    if(['create','kind'].includes(field))decision[field]=value;
    else decision.options={...(decision.options??{}),[field]:value};
    decisions[token]=decision;answers.atom_decisions=decisions;
  };
  const bindQuestion=(field,gap,value,{chat=false}={})=>{
    let v=value;
    const optional=field?.ask===true&&field.required!==true;
    if(optional&&(v===''||(chat&&/^(?:no|none|skip|undefined)$/i.test(String(v).trim()))))return '';
    const declaration={...field,name:gap?.field??field.name,type:gap?.optionType??field.type,required:!optional&&(!!gap||field.required),...(gap?.enum?{enum:gap.enum}:{})};
    if(chat&&declaration.type==='boolean')v=normalizeBool(v);
    if(chat&&declaration.type==='number')v=Number(v);
    insist(v!==undefined&&v!==null,'INVALID_INPUT',`${field?.title??declaration.name} needs a value.`);
    const bound=toolHouse.bindSettings({settings:[declaration]},{[declaration.name]:v});
    insist(!bound.missing.length,'INVALID_INPUT',`${field?.title??declaration.name} needs a value.`);
    return bound.options[declaration.name];
  };
  const answerPopulation=(session,step,accepted,turn)=>{
    step.answers.populate=accepted;step.options.populate=optionRec(accepted,'resolved','turn-answer',true);
    step.status='completed';step.completed_at=now();step.gaps=clearGaps();
    if(!step.turnIds.includes(turn.id))step.turnIds.push(turn.id);
    session.bag.populationTarget=accepted?step.continuation.target:null;
    if(accepted)session.bag.currentTarget={...step.continuation.target,type:'component',verified:true};
    const group=groupById(session,step.groupId);
    if(group.stepIds.every(id=>stepById(session,id)?.status==='completed'))group.status='completed';
    turn.mode='answer';turn.continuesStepId=step.id;
    turn.reply=accepted?`What would you like to add to ${step.continuation.target.name}?`:`${step.continuation.target.name} is ready.`;
  };
  const queuePopulation=async(session,group,source)=>{
    if(session.steps.some(step=>step.continuation?.sourceStepId===source.id))return;
    const result=source.receipt.steps.at(-1).result;
    if(!result.file||result.type!=='component')return;
    const target={name:result.name??source.options.name.value,file:result.file,path:result.folder??path.dirname(result.file)};
    const field={name:'populate',type:'boolean',title:'Populate Component',required:true};
    const step={id:await memory.allocateId(),groupId:group.id,created_at:now(),turnIds:[],answers:{},status:'input-required',settings:[field],options:{populate:optionRec(null,'unknown',null,true)},frame:{text:`Populate ${target.name}`},gaps:clearGaps(),continuation:{kind:'component-population',target,sourceStepId:source.id}};
    step.gaps.requiredInputs.push(makeQuestion('component-populate','populate',`Do you want to populate ${target.name}?`,{optionType:'boolean'}));
    session.steps.push(step);group.stepIds.push(step.id);group.currentStepId=step.id;group.status='open';session.bag.currentStepId=step.id;
  };

  const answerOpenStep=async(session,step,text,turn)=>{
    const gaps=[...(step.gaps?.configuration??[]),...(step.gaps?.requiredInputs??[])]; if(!gaps.length)return false;
    let gap=null,value=null;
    const p=pathToken(text);
    if(p)gap=gaps.find(g=>g.kind==='audit-root'||g.kind==='project-path'||/path|folder|location/i.test(g.field)),value=p;
    if(!gap&&(gaps.length===1||step.settings?.some(field=>field.name==='atom_decisions'))){gap=gaps[0];value=rawValue(text);}
    if(!gap){
      if(/\bproject\s+(?:is|name)\b/i.test(text)){gap=gaps.find(g=>g.kind==='audit-project-name'||/projectName/i.test(g.field));value=String(text).replace(/^.*?\bproject\s+(?:is|name)\s*/i,'').trim().replace(/^["']|["']$/g,'');}
      else if(gaps.find(g=>g.kind==='audit-project-name')&&/^[A-Za-z0-9_-]+$/.test(rawValue(text))){gap=gaps.find(g=>g.kind==='audit-project-name');value=rawValue(text);}
    }
    if(!gap)return false;
    if(gap.kind==='component-populate'){
      const accepted=normalizeBool(value);if(accepted===null)return false;
      answerPopulation(session,step,accepted,turn);return true;
    }
    if(gap.kind==='component-atom'){
      const v=bindQuestion({name:gap.field,type:gap.optionType},gap,value,{chat:true});
      storeAtomAnswer(step.answers,gap,v);
    }
    else if(gap.kind==='audit-root'){session.bag.audit??={};session.bag.audit.scanRoot=value;}
    else if(gap.kind==='audit-project-name'){session.bag.audit??={};session.bag.audit.projectName=value;await ensureAuditRoot(session);}
    else if(['project-path-consent','project-listener-consent'].includes(gap.kind)){
      const accepted=normalizeBool(value);
      if(accepted===null)return false;
      turn.mode='answer';turn.continuesStepId=step.id;step.turnIds.push(turn.id);
      if(!accepted){
        step.status='cancelled';step.gaps={language:[],capability:[],requiredInputs:[],configuration:[],conflicts:[]};
        const group=groupById(session,step.groupId);
        if(group)group.status='cancelled';
        turn.reply=gap.kind==='project-listener-consent'?'Okay. I did not add this path to the listener.':'Okay. I did not add a project path.';
        return true;
      }
      if(gap.kind==='project-listener-consent'){
        await saveProjectPath(gap.requestedPathKey,pathSetting(session,gap.requestedPathKey),{session});
        step.answers.add_listener=true;
      }else step.answers.add_path=true;
    }
    else if(gap.kind==='project-path'){
      const key=gap.pathKey;
      await saveProjectPath(key,String(value).trim(),{session});
      await syncBag(session);
    } else {
      let cap=null,field=null;
      if(step.capability?.kind==='house-tool'){const ref=step.capability.house?.address??step.capability.house?.path;cap=await toolHouse.getTool(ref,{context:{project:{id:meta.id,name:meta.name,root:projectRoot}}});field=(cap?.settings??[]).find(x=>x.name===gap.field);}
      else {cap=registry.stamps.find(c=>c.name===step.capability.name);field=cap?.options?.[gap.field];}
      step.answers[gap.field]=bindQuestion(field??{name:gap.field,type:gap.optionType},gap,value,{chat:true});
    }
    turn.mode='answer'; turn.continuesStepId=step.id; step.turnIds.push(turn.id);
    // Rebuild the same semantic Step against new Bag/settings/answers.
    const known=await knownFor(session); const frame={...step.frame,seats:step.frame.seats,data_types:step.frame.data_types??[],resources:step.frame.resources??[],unknownTokens:[],ambiguousSeats:[],conflicts:[],negated:false,completeLanguage:true};
    await buildStep({session,frame,turnId:turn.id,index:0,priorStep:step.parentStepId?stepById(session,step.parentStepId):null,known,answers:step.answers,existingStep:step});
    await emit({type:'correction',kind:'fill-seat',session_id:session.id,turn_id:turn.id,step_id:step.id,subject:capabilitySubject(step),seat:gap.field??gap.pathKey??null,value,scope:gap.kind==='project-path'?'project':'step',outcome:'success'});
    await emit({type:'loss-resolved',kind:gap.kind??'missing-seat',session_id:session.id,turn_id:turn.id,step_id:step.id,subject:capabilitySubject(step),seat:gap.field??gap.pathKey??null,resolved:true,resolved_by:'human-fill-seat'});
    return true;
  };

  const mergeParseResults=(input,frames)=>({
    version:'seat-parse/v0.8',input,mode:'request',frames,complete:frames.every(f=>f.completeLanguage),
    gaps:{
      unknownWords:frames.flatMap(f=>f.unknownTokens.map(g=>({frameId:f.id,...g}))),
      typedUnknowns:frames.flatMap(f=>(f.typedUnknowns??[]).map(g=>({frameId:f.id,...g}))),
      ambiguousSeats:frames.flatMap(f=>f.ambiguousSeats.map(g=>({frameId:f.id,...g}))),
      conflicts:frames.flatMap(f=>f.conflicts.map(g=>({frameId:f.id,...g}))),
      negation:frames.filter(f=>f.negated).map(f=>({frameId:f.id,text:f.text,type:'negation'}))
    }
  });

  const turn = async ({sessionId,text}) => {
    if(typeof text!=='string'||!text.trim())throw Object.assign(new Error('Turn text is required.'),{code:'BAD_REQUEST'});
    const session=sessionId?await memory.loadSession(meta,sessionId):await memory.createSession(meta);
    const cancelled=await cancelFlowTurn(session,text,{allocateId:memory.allocateId});
    if(cancelled){await memory.saveSession(meta,session);return publicSession(session,{turn:cancelled});}
    if(!inventoryRequest(text)&&latestOpenStep(session)?.frame?.seats?.target_type!=='inventory')await refresh();
    await syncBag(session);
    const turn={id:await memory.allocateId(),at:now(),text:text.trim(),mode:'request',stepIds:[]}; session.turns.push(turn);
    await emit({type:'turn',kind:'user-turn',session_id:session.id,turn_id:turn.id,status:'received',outcome:'received'});

    // A plain value may continue an open Step. A recognizable action starts new work instead.
    const initialKnown=await knownFor(session);
    const preview=seatParser.parse(text,{context:{...session.bag,domain:session.bag.domain,currentTarget:session.bag.currentTarget?.name??null,currentTargetType:session.bag.currentTarget?.type},knownEntities:initialKnown});
    const actionLike=preview.frames.some(frame=>isActionFrame(frame)&&!(frame.seats.operation===null&&frame.evidence?.some(e=>e.reason==='known entity type')));
    const open=latestOpenStep(session);
    const openQuestions=[...(open?.gaps?.configuration??[]),...(open?.gaps?.requiredInputs??[])];
    const consentAnswer=normalizeBool(text)!==null&&openQuestions.some(gap=>gap.optionType==='boolean');
    const componentAnswer=open?.settings?.some(field=>field.name==='atom_decisions')&&(openQuestions.some(gap=>gap.enum?.includes(rawValue(text)))||/^(?:no|none|skip|undefined)$/i.test(text.trim())||!preview.frames.some(frame=>frame.seats.operation));
    let styleAnswer=false;
    if(open?.gaps?.requiredInputs?.some(gap=>gap.field==='styles')){
      try { parseDeclarations(text); styleAnswer=true; } catch {}
    }
    if(open && (!actionLike||styleAnswer||consentAnswer||componentAnswer) && await answerOpenStep(session,open,text,turn)){
      turn.stepIds=[open.id]; await memory.saveSession(meta,session); return publicSession(session,{turn,parse:preview});
    }

    // Parse each clause against the context produced by the clause before it. This is what lets
    // "add TestOne then add Menu to it" and "SideBar then BootBar" resolve in one Enter press.
    const clauses=seatParser.split(text);
    const frames=[];
    let priorStep=null;
    let localKnown=[...initialKnown,...Object.values(session.bag.sessionResources??{})];
    for(let i=0;i<clauses.length;i++){
      const clause=clauses[i];
      const parsedClause=seatParser.parse(clause,{context:{...session.bag,domain:session.bag.domain,currentTarget:session.bag.currentTarget?.name??null,currentTargetType:session.bag.currentTarget?.type},knownEntities:localKnown});
      const frame=parsedClause.frames[0];
      if(!frame)continue;
      frame.id=`frame-${i+1}`; frame.index=i; frames.push(frame);
      if(frame.seats.operation==='create'&&frame.seats.target_type==='component')session.bag.populationTarget=null;

      if(frame.seats.domain) session.bag.domain=frame.seats.domain;
      const explicitPath=pathToken(clause);
      if(frame.seats.domain==='audit'||session.bag.domain==='audit'){
        session.bag.audit??={workingRoot:null,projectName:null,scanRoot:null};
        if(explicitPath)session.bag.audit.scanRoot=explicitPath;
        const m=/\bproject\s+(?:is|name(?:d)?|called)\s+["']?([A-Za-z0-9_-]+)["']?/i.exec(clause);
        if(m)session.bag.audit.projectName=m[1];
        if(session.bag.audit.projectName)await ensureAuditRoot(session);
      }

      const step=await buildStep({session,frame,turnId:turn.id,index:i,priorStep,known:localKnown});
      if(!session.steps.some(s=>s.id===step.id))session.steps.push(step);
      turn.stepIds.push(step.id); priorStep=step;
      if(step.plannedResult){
        localKnown=[...localKnown.filter(x=>String(x.name).toLowerCase()!==String(step.plannedResult.name).toLowerCase()),step.plannedResult];
      }
      await emit({type:'step',kind:'resolved-step',session_id:session.id,turn_id:turn.id,step_id:step.id,status:step.status,outcome:stepGapCount(step)?'blocked':'success',subject:capabilitySubject(step)});
      for(const event of wordEvents(frame,{session_id:session.id,turn_id:turn.id,step_id:step.id}))await emit(event);
      if(stepGapCount(step)){
        await memory.recordFailure(meta,{session_id:session.id,turn_id:turn.id,step_id:step.id,status:step.status,raw_input:text,clause,frame:step.frame,gaps:step.gaps,capability:step.capability??null});
        for(const [bucket,gaps] of Object.entries(step.gaps??{}))for(const gap of gaps??[]){
          const kind=gap.gap_type??gap.type??gap.kind??bucket; const seat=gap.seat??gap.field??gap.pathKey??null;
          await emit({type:'loss',kind,session_id:session.id,turn_id:turn.id,step_id:step.id,status:step.status,outcome:'blocked',subject:capabilitySubject(step),seat,details:{bucket,token:gap.token??gap.value??null,reason:gap.reason??gap.message??null}});
          if(gap.question||gap.contract?.prompt)await emit({type:'question',kind:gap.contract?.kind??'fill-seat',session_id:session.id,turn_id:turn.id,step_id:step.id,subject:capabilitySubject(step),seat,prompt:gap.contract?.prompt??gap.question,resolved:false});
        }
      }
    }
    const parsed=mergeParseResults(text,frames);
    await memory.saveSession(meta,session); return publicSession(session,{turn,parse:parsed});
  };

  const publicSession=(session,options={})=>presentSession(session,{memory,meta,...options});

  // Structured answers address exact Steps/fields. They never become chat
  // commands, never invoke a Tool, and never trigger YOLO execution.
  const answer = async ({sessionId,answers}) => {
    insist(Array.isArray(answers)&&answers?.length>0&&answers?.length<=128,'BAD_REQUEST','Supply answers for one or more pending steps.');
    const session=await memory.loadSession(meta,sessionId);
    const group=groupById(session,session.bag.currentGroupId);
    insist(group?.status==='open','PLAN_GAPS','There is no open action to answer.');
    insist(!session.steps.some(step=>step.groupId===group.id&&step.status==='running'),'BUSY','Wait for the current execution before editing inputs.');
    const prepared=[],seen=new Set(),pathAnswers=new Map(),listenerAnswers=new Set();
    await toolHouse.scan({fresh:true,context:{project:meta}});
    for(const entry of answers){
      insist(record(entry)&&Object.keys(entry).every(key=>['step_id','values'].includes(key)),'BAD_REQUEST','An answer needs step_id and values.');
      insist(Number.isSafeInteger(entry?.step_id)&&!seen.has(entry.step_id),'BAD_REQUEST','Use each numeric step ID once.');
      seen.add(entry.step_id);
      const step=stepById(session,entry.step_id);
      insist(step?.groupId===group?.id&&['ready','input-required','configuration-required'].includes(step?.status)&&!step?.projectAction,'PLAN_GAPS','Edit an unexecuted tool step in the current action.');
      insist(record(entry?.values)&&Object.keys(entry.values).length>0,'BAD_REQUEST','Supply a non-empty answer object.');
      const questions=[...(step.gaps?.requiredInputs??[]),...(step.gaps?.configuration??[])];
      const ref=step.capability?.house?.address??step.capability?.house?.path;
      insist(ref||step.continuation?.kind==='component-population','BAD_REQUEST','This step has no declared tool inputs.');
      const tool=ref?await toolHouse.getTool(ref,{context:{project:meta}}):{settings:step.settings};
      const values=Object.create(null);
      for(const [key,value] of Object.entries(entry.values)){
        insist(!['__proto__','prototype','constructor'].includes(key),'BAD_REQUEST','Invalid answer field.');
        const gap=questions.find(item=>item.field===key);
        const field=tool.settings.find(item=>item.name===key);
        insist(gap||field,'BAD_REQUEST',`${key} is not a declared input or pending question.`);
        insist(canEditStepInput(step,key),'BAD_REQUEST',`${key} is supplied by the runner or a preceding step.`);
        if(['component-atom','component-populate'].includes(gap?.kind)){
          const v=bindQuestion({name:key,type:gap.optionType},gap,value);
          if(gap.kind==='component-atom'){
            values.atom_decisions??=structuredClone(step.answers.atom_decisions??{});
            storeAtomAnswer(values,gap,v);
          }else values[key]=v;
        }else if(['project-path-consent','project-listener-consent'].includes(gap?.kind)){
          insist(typeof value==='boolean','INVALID_INPUT','Answer yes or no before adding a project path.');
          values[key]=value;
          if(gap.kind==='project-listener-consent'&&value)listenerAnswers.add(gap.requestedPathKey);
        }else if(gap?.kind==='project-path'){
          const pathKey=gap.pathKey;
          insist(typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(pathKey),'INVALID_INPUT','Supply a project path.');
          const raw=value.trim();
          insist(raw&&!raw.includes('\0')&&!path.isAbsolute(raw)&&!path.win32.isAbsolute(raw)&&!/^[A-Za-z]:/.test(raw),'INVALID_INPUT','Use a project-relative directory.');
          const rel=posix(raw);
          insist(rel&&rel!=='.'&&!rel.includes('..'),'INVALID_INPUT','Use a safe project-relative directory.');
          const relative=path.relative(projectRoot,path.resolve(projectRoot,rel));
          insist(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'INVALID_INPUT','The directory must remain inside this project.');
          insist(!pathAnswers.has(pathKey)||pathAnswers.get(pathKey)===rel,'INVALID_INPUT',`Conflicting answers for paths.${pathKey}.`);
          pathAnswers.set(pathKey,rel);
        }else{
          insist(field,'STALE_CONTRACT',`${key} is no longer a declared input. Re-plan this action.`);
          values[key]=bindQuestion(field,gap,value);
        }
      }
      prepared.push({step,values});
    }
    // All values are valid before any settings or session answer is saved.
    for(const [key,value] of pathAnswers)await saveProjectPath(key,value,{session});
    for(const key of listenerAnswers)await saveProjectPath(key,pathSetting(session,key),{session});
    await syncBag(session);
    const turn={id:await memory.allocateId(),at:now(),text:'Saved answers from the input panel.',mode:'answer',stepIds:prepared.map(item=>item.step.id),answers:structuredClone(answers)};
    session.turns.push(turn);
    for(const {step,values} of prepared){
      step.answers={...step.answers,...values};
      if(step.continuation?.kind==='component-population'){answerPopulation(session,step,values.populate,turn);continue;}
      if(values.add_path===false||values.add_listener===false){
        step.status='cancelled';
        step.gaps={language:[],capability:[],requiredInputs:[],configuration:[],conflicts:[]};
        turn.reply=values.add_listener===false?'Okay. I did not add this path to the listener.':'Okay. I did not add a project path.';
      }
    }
    if(group.stepIds.every(id=>['cancelled','completed'].includes(stepById(session,id)?.status))&&group.stepIds.some(id=>stepById(session,id)?.status==='cancelled'))group.status='cancelled';
    // Drop obsolete planned resources before rebuilding, including renamed
    // parents. Verified resources and completed steps are never removed.
    const replanned=session.steps.filter(step=>step.groupId===group.id&&['ready','input-required','configuration-required'].includes(step.status)&&!step.projectAction);
    const replannedIds=new Set(replanned.map(step=>step.id));
    for(const [name,resource] of Object.entries(session.bag.sessionResources??{})){
      if(!resource?.verified&&replannedIds.has(resource?.stepId))delete session.bag.sessionResources[name];
    }
    const target=session.bag.currentTarget;
    if(target&&!target.verified&&replanned.some(step=>step.plannedResult?.name===target.name&&step.plannedResult?.path===target.path)){
      session.bag.currentTarget=null;session.bag.addressStack=[];
    }
    // Re-resolve unexecuted steps in order, updating dependent planned parents.
    let known=await knownFor(session);
    for(const id of group.stepIds){
      const step=stepById(session,id);
      if(!step?.capability||step?.projectAction||!['ready','input-required','configuration-required'].includes(step?.status))continue;
      const frame={...step.frame,unknownTokens:[],ambiguousSeats:[],conflicts:[],negated:false,completeLanguage:true};
      await buildStep({session,frame,turnId:turn.id,index:step.frame?.index??0,priorStep:step.parentStepId?stepById(session,step.parentStepId):null,known,answers:step.answers,existingStep:step});
      if(step?.plannedResult)known=[...known.filter(item=>item.name!==step.plannedResult.name),step.plannedResult];
    }
    await memory.saveSession(meta,session);
    for(const {step,values} of prepared)for(const [key,value] of Object.entries(values))await emit({type:'correction',kind:'fill-seat',session_id:session.id,turn_id:turn.id,step_id:step.id,subject:capabilitySubject(step),seat:key,value,scope:'step',outcome:'success'});
    return publicSession(session,{turn});
  };

  const getSession=async id=>publicSession(await memory.loadSession(meta,id));
  const newSession=async options=>publicSession(await memory.createSession(meta,options));
  const newAction=async id=>{
    const session=await memory.loadSession(meta,id);
    const group=groupById(session,session.bag.currentGroupId);
    if(group){
      if(session.steps.some(step=>step.groupId===group.id&&step.status==='running'))throw Object.assign(new Error('Wait for the current execution before starting another action.'),{code:'BUSY'});
      if(group.status!=='completed')group.status='superseded';
      for(const step of session.steps.filter(step=>step.groupId===group.id&&!['completed','execution-failed','cancelled'].includes(step.status)))step.status='superseded';
    }
    session.bag=await memory.initialBag(meta);session.yolo=false;
    await newGroup(session,'new-action');await memory.saveSession(meta,session);return publicSession(session);
  };
  const resume=async id=>{
    const session=await memory.loadSession(meta,id);
    for(const step of session.steps.filter(step=>step.status==='running')){
      step.status='execution-interrupted';
      step.executionError={code:'EXECUTION_UNCERTAIN',message:'The previous execution did not save a final outcome. Inspect its results before starting a new action.'};
    }
    session.yolo=false;await syncBag(session);
    await memory.saveSession(meta,session);return publicSession(session);
  };
  const listSessions=async()=>memory.listSessions(meta);
  const setYolo=async(id,enabled)=>{const s=await memory.loadSession(meta,id);s.yolo=enabled===true;await memory.saveSession(meta,s);return publicSession(s);};


  const execute = async ({sessionId,confirm=false}) => {
    const session=await memory.loadSession(meta,sessionId); const group=groupById(session,session.bag.currentGroupId); if(!group)throw Object.assign(new Error('No active group.'),{code:'NO_PLAN'});
    const pending=group.stepIds.map(id=>stepById(session,id)).filter(s=>s&&s.status!=='completed');
    if(!pending.length)return publicSession(session);
    if(!pending.every(s=>s.status==='ready'))throw Object.assign(new Error('Every Step must be resolved before execution.'),{code:'PLAN_GAPS'});
    if(!(confirm===true||session.yolo===true)){
      for(const step of pending){
        await emit({type:'terminal',kind:step.capability?.house_kind??step.capability?.kind??'step',session_id:session.id,turn_id:step.turnIds?.at(-1)??null,step_id:step.id,subject:capabilitySubject(step),terminal_state:'user-opt-out',status:'user-opt-out',outcome:'cancelled',last_stage:'awaiting-confirmation',reason:{code:'USER_DECLINED_CONFIRMATION',detail:'Execution was ready but the operator did not confirm.'}});
      }
      throw Object.assign(new Error('Confirmation required unless YOLO is enabled.'),{code:'DENIED'});
    }
    for(const step of pending){
      try{
        const options=Object.fromEntries(Object.entries(step.options).filter(([,r])=>r.value!==null&&r.value!==undefined).map(([k,r])=>[k,r.value]));
        // Derived folder seats must go through the runner's fresh project binding.
        // Human-supplied paths remain explicit overrides.
        if(session.bag?.projectSettings?.type==='audit'&&['Bag.audit.scanRoot','Bag.seats.folder','loaded project root','project settings.json paths.folder'].includes(step.options?.folder?.source))delete options.folder;
        let receipt;
        if(step.capability.kind==='house-tool'){
          const ref=step.capability.house?.address??step.capability.house?.path;
          const executionBag={...session.bag,seats:{...session.bag.seats}};
          if(step.options.component?.source==='request:target'||step.options.file?.source==='population:target-file'){
            // An explicit new component target invalidates the prior target's
            // address bundle. Do not let the runner fill those stale defaults
            // back in after the planner deliberately left them unbound.
            for(const key of ['file','path','seat_id','data_area','element','area','class_name','component','into_component'])delete executionBag.seats[key];
          }
          step.execution_id=await memory.allocateId();step.status='running';step.started_at=now();
          await memory.saveSession(meta,session);
          const done=await toolHouse.runTool({key:ref,options,context:{rab_home:memory.rabHome,project:{id:meta.id,name:meta.name,root:projectRoot},bag:executionBag,__rab_run:{memory:reservedExecutionMemory(memory,step.execution_id),sessionId:session.id},__rab_telemetry:{session_id:session.id,turn_id:step.turnIds?.at(-1)??null,step_id:step.id}}});
          const returnedSeats=done.stored_seats??done.seats;
          if(returnedSeats&&Object.keys(returnedSeats).length){session.bag.seats={...(session.bag.seats??{}),...returnedSeats};}
          receipt={id:done.execution.execution_id,project_id:project.id,session_id:session.id,capability:step.capability.name,start_date:done.execution.start_date,end_date:done.execution.end_date,duration_ms:done.execution.duration_ms,steps:[{capability:step.capability.name,options:done.execution.options,result:done.result,seats:done.seats??{},tasks:done.tasks,tool:done.execution.tool,execution_id:done.execution.execution_id,tracking_file:done.tracking_file,result_ref:done.execution.result_ref,...(done.result_file?{result_file:done.result_file}:{})}]};
        }else{
          throw Object.assign(new Error('This saved Step uses a retired execution contract. Re-plan it through the Tool House.'),{code:'RETIRED_CONTRACT'});
        }
        step.status='completed'; step.completed_at=now(); step.receipt=receipt;
        if(step.capability.house?.key==='base/find/inventory'){
          const result=receipt.steps?.at(-1)?.result;
          const requestTurn=session.turns.find(turn=>turn.id===step.turnIds?.at(-1));
          if(requestTurn&&result){
            const items=result.items??[];
            requestTurn.reply=result.message??(items.length?`${result.count} ${result.type} entries:\n${items.slice(0,100).map(item=>item.path).join('\n')}${items.length>100?`\nMore entries are saved in ${result.manifest??'the project manifest'}.`:''}`:`No ${result.type} found.`);
            if(result.notice)requestTurn.reply=result.notice+'\n'+requestTurn.reply;
          }
        }
        await emit({type:'verification',kind:'step-completed',session_id:session.id,turn_id:step.turnIds?.at(-1)??null,step_id:step.id,status:'verified',outcome:'success',subject:capabilitySubject(step),receipt_id:receipt.id});
        await emit({type:'terminal',kind:step.capability?.house_kind??step.capability?.kind??'step',session_id:session.id,turn_id:step.turnIds?.at(-1)??null,step_id:step.id,subject:capabilitySubject(step),terminal_state:'completed',status:'completed',outcome:'success',last_stage:'verified',reason:{code:'COMPLETED'},receipt_id:receipt.id});
        if(step.plannedResult){
          const result=receipt.steps?.at(-1)?.result;
          const destination=result?.folder??result?.file??result?.path??step.plannedResult.path; const resource={...step.plannedResult,path:destination,verified:true,source:'receipt',receipt_id:receipt.id};
          step.result=resource; await memory.addResource(meta,resource); session.bag.currentTarget=resource; session.bag.sessionResources[resource.name]=resource;
          session.bag.addressStack=[...(step.ancestry??[]),{type:resource.type,name:resource.name,path:resource.path,verified:true}];
        }
        const receiptDir=path.join(memory.paths(meta).project,'receipts',String(session.id));await mkdir(receiptDir,{recursive:true});await writeFile(path.join(receiptDir,`${step.id}.json`),JSON.stringify(compactReceipt(receipt),null,2)+'\n');
        await memory.saveSession(meta,session);
      }catch(error){
        if(error.code==='INPUT_REQUIRED'&&error.details?.safe_to_resume===true&&error.details.missing?.length){
          step.status='input-required';
          step.gaps.requiredInputs=error.details.missing.map(field=>makeQuestion(field.atom?'component-atom':'required-input',field.name,field.description||`What is ${field.title??field.name}?`,{optionType:field.type,enum:field.enum,...(field.atom?{atom:field.atom}:{})}));
          for(const field of error.details.missing)step.options[field.name]=optionRec(null,'unknown',null,true);
          await memory.saveSession(meta,session);
          return publicSession(session);
        }
        step.status='execution-failed';step.executionError={code:error.code??'ERROR',message:error.message,details:error.details??null,...(error.execution?{execution_id:error.execution.execution_id,tracking_file:error.tracking_file}: {})};await memory.recordFailure(meta,{session_id:session.id,step_id:step.id,status:'execution-failed',frame:step.frame,capability:step.capability,options:step.options,error:step.executionError});await emit({type:'loss',kind:'execution-failure',session_id:session.id,turn_id:step.turnIds?.at(-1)??null,step_id:step.id,status:'execution-failed',outcome:'failure',subject:capabilitySubject(step),error:step.executionError});await emit({type:'terminal',kind:step.capability?.house_kind??step.capability?.kind??'step',session_id:session.id,turn_id:step.turnIds?.at(-1)??null,step_id:step.id,subject:capabilitySubject(step),terminal_state:'failed',status:'failed',outcome:'failure',last_stage:'execution',reason:{code:error.code??'ERROR',detail:error.message},error:step.executionError});await memory.saveSession(meta,session);throw error;
      }
    }
    group.status='completed';
    const component=pending.findLast(step=>step.settings?.some(field=>field.name==='atom_decisions')&&step.status==='completed');
    if(component)await queuePopulation(session,group,component);
    if(pending.some(step=>step.capability.house?.key!=='base/find/inventory'))await refresh(); await memory.saveSession(meta,session); return publicSession(session);
  };

  const setProjectPath=async({key,value,description,types,expected})=>{
    if(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key))throw Object.assign(new Error('Invalid path key.'),{code:'BAD_REQUEST'});
    if(['__proto__','constructor','prototype'].includes(key))throw Object.assign(new Error('Reserved path key.'),{code:'BAD_REQUEST'});
    const rel=posix(value); if(!rel||rel==='.'||rel.includes('..')||path.isAbsolute(value)||/^[A-Za-z]:/.test(value))throw Object.assign(new Error('Use a safe project-relative directory.'),{code:'BAD_REQUEST'});
    if(description!==undefined&&(typeof description!=='string'||description.length>4000))throw Object.assign(new Error('Description must be text, up to 4000 characters.'),{code:'BAD_REQUEST'});
    if(types!==undefined&&(!Array.isArray(types)||types.length>50||types.some(type=>typeof type!=='string'||!type.trim()||type.length>100)))throw Object.assign(new Error('Types must be a list of short nonempty names.'),{code:'BAD_REQUEST'});
    const settings=await readProjectSettings();
    if(expected!==undefined&&JSON.stringify(settings.paths?.[key]??null)!==JSON.stringify(expected))throw Object.assign(new Error('This path changed. Refresh settings before saving.'),{code:'STALE_REVISION'});
    await saveProjectPath(key,rel,{description,types:types===undefined?undefined:[...new Set(types.map(type=>type.trim()))],expected});
    await refresh();return readProjectSettings();
  };

  const allowedLexicalTypes=new Set(['adjective','adverb','auxiliary','binder','conjunction','determiner','domain-term','negation','noun','polite','preposition','pronoun','quantifier','question','reserved','verb']);
  const typeOverrideFile=path.join(languageRoot,'user','type-overrides.json');
  const readTypeOverrides=async()=>JSON.parse(await readFile(typeOverrideFile,'utf8'));
  const languageTypes=async()=>({
    ...(await readTypeOverrides()),
    allowed_types:[...allowedLexicalTypes],
    core_seats:seatParser.coreSeats,
    note:'These are lexical candidates, not direct seat assignments. Grammar/order/context still decide which seat an occurrence fills.'
  });
  const updateLanguageType=async body=>{
    const kind=body?.kind;
    if(!['entry','phrase'].includes(kind))throw Object.assign(new Error('kind must be entry or phrase.'),{code:'BAD_REQUEST'});
    const types=uniq(body.types??[]),senses=uniq(body.senses??[]);
    if(!types.length||types.some(x=>!allowedLexicalTypes.has(x)))throw Object.assign(new Error('Supply at least one supported lexical type.'),{code:'BAD_REQUEST'});
    if(senses.some(x=>typeof x!=='string'||!x.trim()||x.length>100))throw Object.assign(new Error('senses must be short non-empty strings.'),{code:'BAD_REQUEST'});
    const data=await readTypeOverrides(); data.entries??=[]; data.phrases??=[];
    if(kind==='entry'){
      const lemma=String(body.lemma??'').trim().toLowerCase();
      if(!/^[a-z][a-z0-9_-]{0,79}$/.test(lemma))throw Object.assign(new Error('lemma must be a simple lowercase word/id.'),{code:'BAD_REQUEST'});
      const forms=uniq([lemma,...(body.forms??[]).map(x=>String(x).trim().toLowerCase())]);
      if(forms.some(x=>!x||x.length>120))throw Object.assign(new Error('Invalid lexical form.'),{code:'BAD_REQUEST'});
      const next={lemma,forms,types,senses}; const at=data.entries.findIndex(x=>x.lemma===lemma);
      if(at>=0)data.entries[at]=next;else data.entries.push(next);
    }else{
      const text=String(body.text??'').trim().toLowerCase();
      if(!text||text.length>180)throw Object.assign(new Error('phrase text is required.'),{code:'BAD_REQUEST'});
      const next={text,types,senses}; const at=data.phrases.findIndex(x=>String(x.text).toLowerCase()===text);
      if(at>=0)data.phrases[at]=next;else data.phrases.push(next);
    }
    data.updated_at=now(); await writeFile(typeOverrideFile,JSON.stringify(data,null,2)+'\n','utf8');
    seatParser=await createSeatParser({languageRoot,projectOverrideFile});
    return languageTypes();
  };

  const repairLanguageStep=async({sessionId,text,token,checkId,receiptId})=>{
    if(!sessionId)return null;
    const session=await memory.loadSession(meta,sessionId); await syncBag(session);
    const step=[...session.steps].reverse().find(s=>s.status==='language-gap'&&String(s.frame?.text??'').trim()===String(text??'').trim()&&(s.frame?.typedUnknowns??[]).some(h=>String(h.value).toLowerCase()===String(token).toLowerCase()));
    if(!step)return null;
    const before={at:now(),status:step.status,frame:step.frame,gaps:step.gaps,capability:step.capability??null,options:step.options??{}};
    step.parseHistory??=[]; step.parseHistory.push(before);
    const correction={id:await memory.allocateId(),at:now(),text:`teach ${token}`,mode:'training-correction',stepIds:[step.id],continuesStepId:step.id,training:{check_id:checkId,receipt_id:receiptId,token}};
    session.turns.push(correction);
    const known=await knownFor(session);
    const parsed=seatParser.parse(text,{context:{...session.bag,domain:session.bag.domain,currentTarget:session.bag.currentTarget?.name??null},knownEntities:known});
    const frame=parsed.frames[0]; if(!frame)return null; frame.id=step.frame?.id??frame.id; frame.index=step.frame?.index??0;
    await buildStep({session,frame,turnId:correction.id,index:frame.index,priorStep:step.parentStepId?stepById(session,step.parentStepId):null,known,answers:step.answers??{},existingStep:step});
    step.training??=[]; step.training.push({at:correction.at,check_id:checkId,receipt_id:receiptId,token,status_before:before.status,status_after:step.status});
    await memory.saveSession(meta,session);
    return {session_id:session.id,step_id:step.id,status:step.status,capability:step.capability??null,parse_history_count:step.parseHistory.length,turn_id:correction.id};
  };

  const diagnostics=async()=>{const house=await toolHouse.listTools({fresh:true,context:{project:meta}});return {lexicon:seatParser.lexiconStats,coreSeats:seatParser.coreSeats,capabilities:{project_stamps:registry.stamps.map(c=>({name:c.name,shape:c.shape,data_types:c.data_types,descriptionComplete:c.descriptionParse.complete,error:c.error??null})),tools:house.items.map(c=>({id:c.id,name:c.name,path:c.path,kind:c.kind,authority:c.authorityClass,meta:c.meta})),unavailable:house.unavailable},rab:memory.paths(meta)};};

  return Object.freeze({turn,answer,getSession,newSession,newAction,resume,listSessions,setYolo,execute,setProjectPath,refresh,diagnostics,languageTypes,updateLanguageType,repairLanguageStep,memory,get seatParser(){return seatParser;}});
};
