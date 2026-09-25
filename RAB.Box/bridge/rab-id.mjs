import {setTimeout as delay} from 'node:timers/promises';
export const MAX_ID_BATCH=10_000;
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export const assertNumericId=value=>{
  if(!Number.isSafeInteger(value)||value<=0)fail('BAD_ID','ID must be a positive safe integer number.');
  return value;
};
export const validateIdState=state=>{
  if(state?.version==='rab-ids/v1')fail('ID_MIGRATION_REQUIRED','Legacy ID ledger requires explicit backed-up conversion to v2 with known IDs. No IDs allocated.');
  if(state?.version!=='rab-ids/v2'||!Array.isArray(state.reserved))fail('BAD_ID_STATE','Invalid v2 ID reservation state.');
  let end=0;
  for(const range of state.reserved){
    if(!Array.isArray(range)||range.length!==2||!Number.isSafeInteger(range[0])||!Number.isSafeInteger(range[1])||range[0]<=end||range[1]<range[0])fail('BAD_ID_STATE','Reservation intervals must be sorted, positive and disjoint.');
    end=range[1];
  }
  return state;
};
const add=(ranges,id)=>{
  let i=0;while(i<ranges.length&&ranges[i][1]<id-1)i++;
  if(i===ranges.length){ranges.push([id,id]);return;}
  if(ranges[i][0]>id+1){ranges.splice(i,0,[id,id]);return;}
  ranges[i][0]=Math.min(ranges[i][0],id);ranges[i][1]=Math.max(ranges[i][1],id);
  while(i+1<ranges.length&&ranges[i+1][0]-ranges[i][1]<=1){ranges[i][1]=Math.max(ranges[i][1],ranges[i+1][1]);ranges.splice(i+1,1);}
};
export const enrollNumericIds=(state,ids)=>{
  validateIdState(state);if(!Array.isArray(ids))fail('BAD_ID_STATE','Supply exact IDs as an array.');
  const next={...state,reserved:state.reserved.map(range=>[...range])};
  for(const id of ids)add(next.reserved,assertNumericId(id));
  return next;
};
// Pure conversion: caller must retain the named v1 backup, inventory known
// record/catalog IDs, and atomically publish the resulting ledger.
export const convertLegacyIdState=({legacy,knownIds,backupPath}={})=>{
  if(legacy?.version!=='rab-ids/v1'||!Number.isSafeInteger(legacy.highWater)||legacy.highWater<0||!Array.isArray(knownIds)||typeof backupPath!=='string'||!backupPath.trim())fail('BAD_ID_STATE','Explicit v1 state, known IDs and retained backup path are required.');
  return enrollNumericIds({version:'rab-ids/v2',reserved:[],legacy_highWater:legacy.highWater,legacy_backup:backupPath,legacy_limitation:'v1 did not record exact reservations; unmaterialized historical reservations cannot be reconstructed.'},[...knownIds,...(legacy.highWater?[legacy.highWater]:[])]);
};
// Caller holds the memory ID lock and persists state before exposing any ID.
// Each allocation is an observed clock value; no synthetic increment or range.
export const reserveObservedIds=async({state,count=1,clock=Date.now,sleep=delay,timeoutMs=30000}={})=>{
  validateIdState(state);
  if(!Number.isSafeInteger(count)||count<1||count>MAX_ID_BATCH)fail('BAD_ID_RANGE','Invalid batch count.');
  if(!Number.isFinite(timeoutMs)||timeoutMs<0||timeoutMs>30000)fail('BAD_ID_RANGE','timeoutMs must be between 0 and 30000.');
  const next=enrollNumericIds(state,[]),ids=[],started=performance.now();
  while(ids.length<count){
    const id=assertNumericId(clock());
    if(!next.reserved.some(([start,end])=>id>=start&&id<=end)){add(next.reserved,id);ids.push(id);}
    if(ids.length===count)break;
    if(performance.now()-started>=timeoutMs)fail('ID_CLOCK_BUSY','Clock did not provide enough unreserved millisecond IDs within the deadline. No batch was published.');
    await sleep(1);
  }
  return {ids,state:next};
};
