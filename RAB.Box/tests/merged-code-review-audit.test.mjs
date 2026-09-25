import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const fixture=async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'rab-review-'));t.after(()=>rm(dir,{recursive:true,force:true}));const put=async(file,text)=>{const target=path.join(dir,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);return target;};return{dir,put};};
const run=(key,options={},context={})=>house.runTool({key,options,context});

test('code-review and CSS mutation leaves are public and inherit their shared executors',async()=>{
  const listed=await house.listTools({fresh:true});
  const review=['state-ownership','conventions','prop-renames','bag-guards','house-key','css-states','css-tokens','grid-continuity'].map(x=>`audit/code-review/${x}`);
  const css=['css/add/style/atom','css/add/style/class','css/add/state/atom','css/add/state/class'];
  for(const key of [...review,...css]){const tool=listed.items.find(x=>x.key===key);assert.ok(tool,key);assert.equal(tool.kind,'tool');assert.equal(tool.inheritedExecutor,true,key);}
  assert.deepEqual(listed.unavailable,[]);
});

test('state ownership requires owner hook after more than one useState',async t=>{
  const {dir,put}=await fixture(t);
  await put('components/Card/Card.tsx',`import { useState } from 'react';\nexport const Card=()=>{ const [a,setA]=useState(0); const [b,setB]=useState(false); return <div>{a}</div>; };\n`);
  await put('components/Good/Good.tsx',`import { useState } from 'react';\nexport const Good=()=>{ const [a,setA]=useState(0); return <div>{a}</div>; };\n`);
  const out=(await run('audit/code-review/state-ownership',{folder:dir})).result;
  assert.equal(out.totals.matches,1);assert.equal(out.rows[0].rule,'owner-hook-required');assert.equal(out.rows[0].state_hooks,2);assert.match(out.rows[0].expected,/components\/Card\/hooks\/useCard\.ts$/);
});

test('component conventions catch misplaced CSS/hooks/types/demo without inventing taste rules',async t=>{
  const {dir,put}=await fixture(t);
  await put('components/Card/Card.tsx','export const Card=()=> <div/>;\n');
  await put('components/Card/Card.css','.card{}\n');
  await put('components/Card/useCard.ts','export const useCard=()=>({});\n');
  await put('components/Card/Wrong.types.ts','export type X={};\n');
  await put('components/Card/Card.stories.tsx','export default {};\n');
  const out=(await run('audit/code-review/conventions',{folder:dir})).result;
  const rules=new Set(out.rows.map(x=>x.rule));
  for(const expected of ['css-location','hook-location','types-file-name','demo-location'])assert.ok(rules.has(expected),expected);
});

test('prop rename audit distinguishes alias from transformation',async t=>{
  const {dir,put}=await fixture(t);
  await put('Card.tsx',`export const Card=(props)=>{\n const rename = props.oldName;\n const { title: heading } = props;\n const fullName = normalize(props.name);\n const { value } = props;\n return <div/>;\n};\n`);
  const out=(await run('audit/code-review/prop-renames',{folder:dir})).result;
  assert.equal(out.totals.matches,2);assert.deepEqual(new Set(out.rows.map(x=>x.alias)),new Set(['rename','heading']));
});

test('bag guards require optional collection/item access and mapped leaf fallback',async t=>{
  const {dir,put}=await fixture(t);
  await put('x.ts',`const a = bag.items;\nconst b = data.map(x => x.item);\nconst c = data?.map(x => x?.item);\nconst d = data?.map(x => x?.item ?? '');\nconst e = Object.entries(meta);\nconst f = Object.entries(meta ?? {});\n`);
  const out=(await run('audit/code-review/bag-guards',{folder:dir})).result;
  const rules=out.rows.map(x=>x.rule);
  assert.ok(rules.includes('bag-optional-guard'));
  assert.ok(rules.includes('collection-optional-guard'));
  assert.ok(rules.includes('mapped-item-optional-guard'));
  assert.ok(rules.filter(x=>x==='mapped-value-fallback').length>=2);
  assert.equal(rules.filter(x=>x==='object-collection-fallback').length,1);
  assert.ok(!out.rows.some(x=>x.expression?.includes("x?.item ?? ''")));
});

test('house-key audit enforces actual public Tool keys and leaf identity',async t=>{
  const {dir,put}=await fixture(t);
  await put('tools/demo/good/settings.json',JSON.stringify({id:1,name:'good',title:'Good',description:'Good.',settings:[],meta:{domain:'demo'}},null,2));
  await put('tools/demo/bad/settings.json',JSON.stringify({id:2,name:'wrong',title:'Bad',settings:{}},null,2));
  const out=(await run('audit/code-review/house-key',{folder:dir})).result;
  const bad=out.rows.filter(x=>x.file.includes('/bad/')||x.file.startsWith('tools/demo/bad/'));
  assert.ok(bad.some(x=>x.rule==='house-key-missing'&&x.house_key==='description'));
  assert.ok(bad.some(x=>x.rule==='house-key-missing'&&x.house_key==='meta'));
  assert.ok(bad.some(x=>x.rule==='house-key-name'));
  assert.ok(bad.some(x=>x.rule==='house-key-settings-shape'));
  assert.ok(!out.rows.some(x=>x.file.includes('/good/')&&x.rule.startsWith('house-key')));
});

test('CSS state audit catches duplicate state selectors and duplicate state properties',async t=>{
  const {dir,put}=await fixture(t);
  await put('Card.css',`.card:hover { color: var(--a); color: var(--b); }\n.card:hover { background: var(--surface); }\n.card { display:grid; }\n`);
  const out=(await run('audit/code-review/css-states',{folder:dir})).result;
  assert.ok(out.rows.some(x=>x.rule==='duplicate-css-state'));
  assert.ok(out.rows.some(x=>x.rule==='duplicate-css-state-property'));
});

test('CSS token audit flags raw visual values but ignores grid/layout and token definitions',async t=>{
  const {dir,put}=await fixture(t);
  await put('components/Card/css/Card.css',`.card { display:grid; grid-template-columns:1fr 2fr; color:#fff; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-card); }\n`);
  await put('theme/tokens.css',`:root { --surface-card:#111; --radius-md:8px; }\n`);
  const out=(await run('audit/code-review/css-tokens',{folder:dir})).result;
  const props=new Set(out.rows.map(x=>x.property));
  assert.ok(props.has('color'));assert.ok(props.has('border'));assert.ok(props.has('border-radius'));assert.ok(!props.has('display'));assert.ok(!props.has('grid-template-columns'));assert.ok(!out.rows.some(x=>x.file.includes('theme/tokens.css')));
});

test('grid continuity catches Grid -> wrapper -> Flex -> wrapper -> Grid and accepts Grid -> Grid',async t=>{
  const {dir,put}=await fixture(t);
  await put('layout.css',`.shell { display:grid; }\n.middle { display:flex; }\n.inner { display:grid; }\n`);
  await put('Bad.tsx',`export const Bad=()=> <div className="shell"><section><div className="middle"><aside><div className="inner"/></aside></div></section></div>;\n`);
  await put('Good.tsx',`export const Good=()=> <div data-grid><section><div data-grid /></section></div>;\n`);
  const out=(await run('audit/code-review/grid-continuity',{folder:dir})).result;
  assert.equal(out.totals.matches,1);assert.equal(out.rows[0].rule,'grid-flex-grid');assert.ok(out.rows[0].chain.some(x=>x.includes('[flex]')));
});

test('CSS writer updates Atom and state idempotently',async t=>{
  const {dir,put}=await fixture(t);
  const atom=await put('atoms/card/atom.css',`.card {\n  color: var(--text);\n}\n`);
  const context={project:{root:dir}};
  let out=(await run('css/add/style/atom',{atom_name:'card',styles:'background: var(--surface-card);'},context)).result;
  assert.equal(out.status,'updated');assert.equal(out.selector,'.card');
  out=(await run('css/add/state/atom',{atom_name:'card',state:'hover',styles:'background: var(--surface-hover);'},context)).result;
  assert.equal(out.created_selector,true);assert.equal(out.selector,'.card:hover');
  const again=(await run('css/add/state/atom',{atom_name:'card',state:'hover',styles:'background: var(--surface-hover);'},context)).result;
  assert.equal(again.status,'unchanged');
  const text=await readFile(atom,'utf8');assert.equal((text.match(/\.card:hover/g)||[]).length,1);assert.equal((text.match(/background: var\(--surface-hover\);/g)||[]).length,1);
});

test('CSS writer updates explicit class location and rejects unknown state',async t=>{
  const {dir,put}=await fixture(t);
  const css=await put('components/Card/css/Card.css',`.card { color: var(--text); }\n`);
  const out=(await run('css/add/style/class',{location:css,class_name:'card',styles:'color: var(--text-strong);\nborder-radius: var(--radius-md);'})).result;
  assert.equal(out.status,'updated');const text=await readFile(css,'utf8');assert.match(text,/color: var\(--text-strong\)/);assert.match(text,/border-radius: var\(--radius-md\)/);
  await assert.rejects(()=>run('css/add/state/class',{location:css,class_name:'card',state:'explode',styles:'color: var(--x);'}),error=>error.code==='BAD_REQUEST');
});
