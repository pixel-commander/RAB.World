import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const projectContext=async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'rab-kitchen-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const projectRoot=path.join(temp,'project'); await mkdir(projectRoot,{recursive:true});
  return {rab_home:path.join(temp,'.rab'),project:{id:'kitchen-demo',name:'Kitchen Demo',root:projectRoot}};
};

test('Kitchen and Food Process are ordinary Tool domains with no Sensor/Hand species',async()=>{
  const scan=await house.scan({fresh:true});
  assert.equal(scan.unavailable.length,0);
  assert.ok(scan.items.some(x=>x.key==='kitchen/project/start'&&x.kind==='tool'));
  assert.ok(scan.items.some(x=>x.key==='food-process/math/belt-speed'&&x.kind==='tool'));
  assert.ok(!scan.items.some(x=>/sensor|hand/i.test(x.kind)));
  const domains=JSON.parse(await readFile(path.join(root,'domains.json'),'utf8'));
  assert.equal(domains.domains.audit.kind,'toolset');
  assert.equal(domains.domains.audit.tool_root,'tools/audit');
  assert.equal(Object.hasOwn(domains.domains.audit,'sensor_root'),false);
});

test('Kitchen startup blocks on the smallest unresolved safety seat',async t=>{
  const context=await projectContext(t);
  let out=await house.runTool({key:'start-kitchen-project',options:{},context});
  assert.equal(out.result.status,'input-required');
  assert.deepEqual(out.result.missing,['people']);
  out=await house.runTool({key:'start-kitchen-project',options:{people:'me, Sarah'},context});
  assert.equal(out.result.status,'input-required');
  assert.deepEqual(out.result.missing,['allergy_status']);
  assert.deepEqual(out.result.unresolved_people,['me','Sarah']);
});

test('human allergy teaching is scoped durable memory and conflicts block recipe candidates',async t=>{
  const context=await projectContext(t);
  await house.runTool({key:'start-kitchen-project',options:{people:'me, Sarah'},context});
  await house.runTool({key:'set-kitchen-allergy-status',options:{person:'me',status:'none'},context});
  await house.runTool({key:'teach-kitchen-allergy',options:{person:'Sarah',allergen:'peanut'},context});
  const resumed=await house.runTool({key:'start-kitchen-project',options:{},context});
  assert.equal(resumed.result.status,'ready');
  assert.ok(resumed.result.allergies.some(x=>x.person==='Sarah'&&x.allergen==='peanuts'));
  const check=await house.runTool({key:'check-kitchen-recipe-allergy',options:{recipe:'peanut-butter-cookies'},context});
  assert.equal(check.result.status,'conflict');
  assert.equal(check.result.authority,0);
});

test('unknown/unauthored recipe composition never becomes a safe claim',async t=>{
  const context=await projectContext(t);
  await house.runTool({key:'start-kitchen-project',options:{people:'me'},context});
  await house.runTool({key:'set-kitchen-allergy-status',options:{person:'me',status:'none'},context});
  const check=await house.runTool({key:'check-kitchen-recipe-allergy',options:{recipe:'chocolate-chip-cookies'},context});
  assert.equal(check.result.status,'unresolved');
  assert.equal(check.result.authority,0);
  assert.match(check.result.reason,/not authored ingredient-level safety evidence/i);
});

test('removing an allergy requires explicit status review instead of silently declaring none',async t=>{
  const context=await projectContext(t);
  await house.runTool({key:'start-kitchen-project',options:{people:'Sarah'},context});
  await house.runTool({key:'teach-kitchen-allergy',options:{person:'Sarah',allergen:'peanuts'},context});
  await house.runTool({key:'remove-kitchen-allergy',options:{person:'Sarah',allergen:'peanut'},context});
  const out=await house.runTool({key:'start-kitchen-project',options:{},context});
  assert.equal(out.result.status,'input-required');
  assert.deepEqual(out.result.unresolved_people,['Sarah']);
});

test('one-empty-seat conveyor math is exact and underdetermined math remains unresolved',async()=>{
  const speed=await house.runTool({key:'solve-kitchen-one-seat',options:{length:30,residence_time:8,length_unit:'ft',time_unit:'min',speed_unit:'ft/min'}});
  assert.equal(speed.result.status,'completed');
  assert.equal(speed.result.solved,'belt_speed');
  assert.equal(speed.result.value,3.75);
  const unresolved=await house.runTool({key:'solve-kitchen-one-seat',options:{length:40,length_unit:'ft',time_unit:'min',speed_unit:'ft/min'}});
  assert.equal(unresolved.result.status,'unresolved');
  assert.equal(unresolved.result.reason,'underdetermined');
  assert.deepEqual(unresolved.result.missing.sort(),['belt_speed','residence_time']);
});

test('Food Process math delegates through Runner and exposes child task trace',async()=>{
  const out=await house.runTool({key:'calculate-food-process-belt-speed',options:{length:40,residence_time:7.5,length_unit:'ft',time_unit:'min',output_speed_unit:'ft/min'}});
  assert.equal(out.result.belt_speed,5.33333333333);
  assert.equal(out.tasks.length,2);
  assert.equal(out.tasks[1].parentTaskId,out.tasks[0].id);
  assert.equal(out.tasks[1].tool.path,'kitchen/math/belt-speed');
});

test('industrial process authority refuses incomplete support and requires revalidation after changes',async()=>{
  let out=await house.runTool({key:'check-food-process-authority',options:{has_scientific_support:true,has_in_plant_data:false,process_changed:false}});
  assert.equal(out.result.status,'unresolved');
  assert.ok(out.result.missing.includes('practical in-plant data'));
  out=await house.runTool({key:'check-food-process-authority',options:{has_scientific_support:true,has_in_plant_data:true,process_changed:true}});
  assert.equal(out.result.status,'blocked');
  assert.equal(out.result.reason,'process-change-revalidation-required');
});

test('consumer safety target check is scope-limited and measured evidence stays distinct',async()=>{
  const low=await house.runTool({key:'check-kitchen-measured-temperature',options:{food:'chicken',temperature_f:160}});
  assert.equal(low.result.status,'not-verified');
  assert.equal(low.result.verified,false);
  const ok=await house.runTool({key:'check-kitchen-measured-temperature',options:{food:'chicken',temperature_f:165,measurement_source:'thermometer'}});
  assert.equal(ok.result.status,'verified');
  assert.equal(ok.result.verified,true);
  const industrial=await house.runTool({key:'check-kitchen-measured-temperature',options:{food:'chicken',temperature_f:165,scope:'industrial'}});
  assert.equal(industrial.result.status,'lookup-failed');
  assert.equal(industrial.result.verified,false);
});

test('starter recipe inventory and readiness remain unresolved until recipes are authored',async t=>{
  const context=await projectContext(t);
  await house.runTool({key:'start-kitchen-project',options:{people:'me'},context});
  await house.runTool({key:'set-kitchen-allergy-status',options:{person:'me',status:'none'},context});
  await house.runTool({key:'add-kitchen-inventory',options:{items:'flour, butter, sugar, eggs, chocolate chips'},context});
  const inv=await house.runTool({key:'check-kitchen-recipe-inventory',options:{recipe:'chocolate-chip-cookies'},context});
  assert.equal(inv.result.status,'unresolved');
  const ready=await house.runTool({key:'verify-kitchen-recipe-ready',options:{recipe:'chocolate-chip-cookies'},context});
  assert.equal(ready.result.status,'unresolved');
  assert.equal(ready.result.verified,false);
});
