import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createSeatParser } from '../bridge/seat-parser.mjs';
import { createSessionPlanner } from '../bridge/session-planner.mjs';
import { loadProject } from '../engine/src/project.mjs';
import { readCssRules } from '../tools/css/_stylesheet.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const fixture=async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rab-active-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'atoms','actions.css'); await mkdir(path.dirname(file),{recursive:true});
  const put=source=>writeFile(file,source);
  const run=(state,styles='--action-bg: var(--selected);')=>house.runTool({key:'css/add/state/atom',options:{atom_name:'ui-action',state,styles},context:{project:{root:dir},rab_home:path.join(dir,'.rab')}});
  return{dir,file,put,run};
};

test('paired active states consolidate root selectors and repeat without duplication',async t=>{
  const {file,put,run}=await fixture(t);
  await put('.ui-action { color: var(--ink); }\n.ui-action:active { --action-bg: var(--pressed); outline: var(--ring); }\n.ui-action.is-active { --action-bg: var(--selected); }\n');
  const first=(await run(':active and .is-active')).result;
  assert.equal(first.selector,'.ui-action:active,\n.ui-action.is-active');
  const source=await readFile(file,'utf8'),rules=readCssRules(source);
  assert.equal(rules.length,2); assert.match(rules[1].body,/outline: var\(--ring\)/);
  const repeated=(await run('is-active, active')).result;
  assert.equal(repeated.status,'unchanged');assert.equal(await readFile(file,'utf8'),source);
});

test('group edits retain unrelated selectors, comments, quoted values and responsive scopes',async t=>{
  const {file,put,run}=await fixture(t);
  const responsive='@media (width < 600px) { .ui-action.is-active { color: var(--mobile); } }';
  await put(`/* action family */\n.ui-action {}\n.ui-action:active, .ui-other:hover { content: "a;b}c"; color: var(--ink); }\n${responsive}\n`);
  await run('active, is-active');
  const source=await readFile(file,'utf8'),rules=readCssRules(source);
  assert.ok(source.includes(responsive));assert.match(source,/\/\* action family \*\//);
  const other=rules.find(rule=>rule.selector==='.ui-other:hover');assert.match(other.body,/content: "a;b}c"/);assert.doesNotMatch(other.body,/--action-bg/);
  const paired=rules.find(rule=>rule.selectors.length===2);assert.match(paired.body,/content: "a;b}c"/);
});

test('a pressed-only edit can split a pair without changing selected styling',async t=>{
  const {file,put,run}=await fixture(t);await put('.ui-action {}');
  await run('active, is-active');await run(':active','--action-bg: var(--pressed);');
  const rules=readCssRules(await readFile(file,'utf8'));
  assert.match(rules.find(rule=>rule.selector==='.ui-action.is-active').body,/var\(--selected\)/);
  assert.match(rules.find(rule=>rule.selector==='.ui-action:active').body,/var\(--pressed\)/);
});

test('explicit class leaf accepts is-active and rejects injected states before writing',async t=>{
  const {dir,file,put}=await fixture(t);await put('.ui-action {}');
  const run=state=>house.runTool({key:'css/add/state/class',options:{location:file,class_name:'ui-action',state,styles:'color: var(--ink);'},context:{rab_home:path.join(dir,'.rab')}});
  assert.equal((await run('.is-active')).result.selector,'.ui-action.is-active');
  const before=await readFile(file,'utf8');
  for(const state of ['is-active:hover','is-active { color:red; }','.hover',':is-active','explode'])await assert.rejects(()=>run(state),error=>error.code==='BAD_REQUEST');
  assert.equal(await readFile(file,'utf8'),before);
});

test('state audit catches grouped class-state duplicates without mixing media scopes',async t=>{
  const {dir,put}=await fixture(t);
  await put('.ui-action:active, .ui-action.is-active { color:var(--a); color:var(--b); }\n.ui-action.is-active { color:var(--c); }\n@media (width < 600px) { .ui-action.is-active { color:var(--mobile); } }\n.is-active-extra { color:red; color:blue; }');
  const result=(await house.runTool({key:'audit/code-review/css-states',options:{folder:dir},context:{rab_home:path.join(dir,'.rab')}})).result;
  assert.equal(result.rows.filter(row=>row.rule==='duplicate-css-state').length,1);
  assert.equal(result.rows.filter(row=>row.rule==='duplicate-css-state-property').length,1);
});

test('Box parses CSS states separately from general active predicates and class attachment',async()=>{
  const parser=await createSeatParser({languageRoot:path.join(root,'language')});
  for(const text of ['make active and is-active match on atom ui-action','add css state :active and .is-active to atom "ui-action"','update is-active on atom ui-action']){
    const parsed=parser.parse(text,{context:{domain:'audit'}}),frame=parsed.frames[0];
    assert.equal(parsed.complete,true,text);assert.equal(frame.seats.domain,'css');assert.equal(frame.seats.name,'ui-action');assert.ok(frame.evidence.some(item=>item.seat==='css_state'));
  }
  const current=parser.parse('make active and is-active match on this atom',{context:{currentTarget:'ui-action'}});
  assert.equal(current.frames[0].seats.name,'ui-action');
  assert.equal(parser.parse('make active and is-active match on this atom').complete,false);
  assert.equal(parser.parse('make active and is-active match on this atom',{context:{currentTarget:'SomeComponent',currentTargetType:'component'}}).complete,false);
  for(const text of ['find active projects','add class is-active to component Foo','do not add active to atom ui-action'])assert.ok(!parser.parse(text).frames[0].evidence.some(item=>item.seat==='css_state'),text);
});

test('Box asks for styles, executes the paired update and preserves it on a repeat turn',async t=>{
  const {dir,file,put}=await fixture(t);
  const rabHome=path.join(dir,'.rab');
  const made=await house.runTool({key:'react/stamp-new-project',options:{name:'ActiveDemo',folder:dir},context:{rab_home:rabHome}}),meta=made.result.project;
  await put('.ui-action {}');
  const atom=path.join(meta.root,'src/atoms/ui-action.css');await writeFile(atom,'.ui-action { color: var(--ink); }');
  const planner=await createSessionPlanner({root,projectRoot:meta.root,project:await loadProject(meta.root),languageRoot:path.join(root,'language'),rabHome});
  const {session_id:sessionId}=await planner.newSession();
  for(const text of ['make active and is-active match on atom ui-action','add css state :active and .is-active to atom ui-action']){
    let result=await planner.turn({sessionId,text});
    const step=result.current_steps.at(-1);
    assert.equal(step.capability?.house?.path,'css/add/state/atom',JSON.stringify(step));
    assert.deepEqual(step.gaps.requiredInputs.map(gap=>gap.field),['styles']);
    result=await planner.turn({sessionId,text:'--action-bg: var(--selected);'});assert.equal(result.ready_to_confirm,true,JSON.stringify(result.current_steps));
    result=await planner.execute({sessionId,confirm:true});assert.ok(result.current_steps.every(item=>item.status==='completed'));
  }
  const source=await readFile(atom,'utf8');assert.equal(readCssRules(source).filter(rule=>rule.selectors.includes('.ui-action.is-active')).length,1);
  assert.equal(await readFile(file,'utf8'),'.ui-action {}');
});

test('fresh nav stamp composes link atoms and derives selected class plus ARIA from one comparison',async t=>{
  const {dir}=await fixture(t);
  const made=await house.runTool({key:'react/stamp-new-nav',options:{name:'StateNav',location:dir,links:[{label:'One',href:'/?page=one'},{label:'Two',href:'/?page=two'}]},context:{rab_home:path.join(dir,'.rab')}});
  const source=await readFile(made.result.path,'utf8');
  assert.match(source,/linkClassName\?: string/);assert.match(source,/const is_active = activeHref === link.href/);
  assert.match(source,/\[linkClassName, is_active && 'is-active'\]/);assert.match(source,/aria-current=\{is_active \? 'page' : undefined\}/);
});
