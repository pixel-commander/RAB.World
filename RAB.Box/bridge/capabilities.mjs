import { loadProject, loadStamp } from '../engine/src/project.mjs';

const uniq = xs => [...new Set(xs.filter(Boolean))];
const shapeFromParse = parsed => {
  const frames=parsed.frames??[];
  if (!frames.length) return {shape:{},data_types:[],parse:parsed};
  const shape={}; const conflicts=[];
  for (const frame of frames) for (const [key,value] of Object.entries(frame.seats??{})) {
    if (value===null || value===undefined || value==='') continue;
    if (shape[key]===undefined) shape[key]=value;
    else if (JSON.stringify(shape[key])!==JSON.stringify(value)) conflicts.push({seat:key,a:shape[key],b:value});
  }
  return {shape,data_types:uniq(frames.flatMap(f=>f.data_types??[])),parse:parsed,conflicts};
};

export const createCapabilityRegistry = async ({ projectRoot, seatParser }) => {
  const project=await loadProject(projectRoot);
  const stamps=[];
  for (const name of Object.keys(project.manifest.stamps??{})) {
    try {
      const stamp=await loadStamp(project,name,{allowExecutableSettings:false});
      const parsed=seatParser.compileCapability(stamp.settings.description,{context:{}});
      const compiled=shapeFromParse(parsed);
      stamps.push({
        id:`stamp:${name}`, kind:'stamp', name, title:stamp.settings.title, description:stamp.settings.description,
        data_types:uniq([...(stamp.settings.data_types??[]),...compiled.data_types]),
        shape:compiled.shape, descriptionParse:compiled.parse, descriptionConflicts:compiled.conflicts,
        options:stamp.settings.options, binding:stamp.entry, authority:'write', executable:true,
      });
    } catch (error) {
      stamps.push({id:`stamp:${name}`,kind:'stamp',name,title:name,description:'',data_types:[],shape:{},authority:'write',executable:false,error:{code:error.code??'LOAD_FAILED',message:error.message}});
    }
  }
  return {project,stamps,all:[...stamps]};
};

export const DEFAULT_SEAT_WEIGHTS = Object.freeze({
  domain:10, operation:10, target_type:10, predicate:7, relation:7, quantifier:4, scope:5, output:5
});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const occupied = frame => Object.fromEntries(Object.entries(frame?.seats??frame??{}).filter(([,v])=>v!==null&&v!==undefined&&v!==''));

export const compareShape = (requestFrame, capability, weights=DEFAULT_SEAT_WEIGHTS) => {
  const req=occupied(requestFrame), cap=occupied(capability.shape??{});
  const matches=[],missing=[],conflicts=[]; let score=0,possible=0;
  const hard=new Set(['domain','operation','target_type']);
  for (const [seat,weight] of Object.entries(weights)) {
    const rv=req[seat]; if (rv===undefined) continue; possible+=weight;
    const cv=cap[seat];
    if (cv===undefined) { missing.push({seat,request:rv,weight}); continue; }
    if (equal(rv,cv)) { matches.push({seat,value:rv,weight}); score+=weight; }
    else conflicts.push({seat,request:rv,capability:cv,weight,hard:hard.has(seat)});
  }
  const reqTypes=requestFrame?.data_types??[]; const capTypes=capability.data_types??[];
  const typeMatches=reqTypes.filter(x=>capTypes.includes(x));
  score += typeMatches.length*3; possible += reqTypes.length*3;
  const rejected=conflicts.some(x=>x.hard);
  return {score,possible,ratio:possible?score/possible:0,matches,missing,conflicts,dataTypeMatches:typeMatches,rejected};
};

export const rankCapabilities = (frame, capabilities, {weights=DEFAULT_SEAT_WEIGHTS,domain}={}) => capabilities
  .filter(c=>!domain || c.shape?.domain===domain || c.domain===domain)
  .map(capability=>({capability,...compareShape(frame,capability,weights)}))
  .filter(x=>!x.rejected)
  .sort((a,b)=>b.score-a.score || b.ratio-a.ratio || a.capability.name.localeCompare(b.capability.name));
