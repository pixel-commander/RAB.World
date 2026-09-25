import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { runSecurityVerification } from '../tools/security/_verify.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=async t=>{
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-full-house-'));t.after(()=>rm(project,{recursive:true,force:true}));
  await mkdir(path.join(project,'src'),{recursive:true});
  await writeFile(path.join(project,'src','Panel.tsx'),`export const Panel = () => (\n  <main data-area="main" className="root">\n    <section data-area="left"><span id="a">A</span></section>\n    <section data-area="right"></section>\n  </main>\n);\n`);
  return project;
};

test('full House expansion is discoverable with no unavailable capabilities',async()=>{
  const house=createToolHouse({root});const scan=await house.listTools({fresh:true});
  assert.equal(scan.unavailable.length,0,JSON.stringify(scan.unavailable,null,2));
  assert.equal(new Set(scan.items.map(tool=>String(tool.id))).size,scan.items.length);
  for(const address of ['move-tool','move-stamp','add-attribute','change-attribute','remove-attribute','add-data-area','change-data-area','remove-data-area','remove-element','replace-element','wrap-element','move-element','inspect-generated-code','inspect-security-surface','check-generated-files','check-control-plane-move','check-dom-write-boundaries','check-local-network']){
    const found=await house.getTool(address);assert.ok(found,address);
  }
});

test('DOM mutation family composes attribute, data-area, replace, wrap, move and remove edits',async t=>{
  const project=await fixture(t);const house=createToolHouse({root});const context={project:{root:project}};
  const run=(key,options)=>house.runTool({key,options:{component:'Panel',...options},context});
  await run('add-attribute',{data_area:'left',attribute_name:'aria-label',attribute_value:'Left'});
  await run('change-attribute',{data_area:'left',attribute_name:'aria-label',attribute_value:'Side'});
  await run('add-data-area',{element:'span',new_data_area:'item'});
  await run('change-data-area',{data_area:'item',new_data_area:'item-renamed'});
  await run('remove-data-area',{data_area:'item-renamed'});
  await run('replace-element',{data_area:'left',replacement_tag:'aside'});
  await run('wrap-element',{data_area:'right',wrapper_tag:'div',class_name:'frame',new_data_area:'wrapped'});
  await run('move-element',{element:'span',to_data_area:'right'});
  await run('remove-element',{data_area:'left'});
  const text=await readFile(path.join(project,'src','Panel.tsx'),'utf8');
  assert.doesNotMatch(text,/data-area="left"/);
  assert.match(text,/<div className="frame" data-area="wrapped"><section data-area="right">/);
  assert.match(text,/<span id="a">A<\/span>/);
  assert.doesNotMatch(text,/aria-label=/);
});

test('generated-file and security-surface audits return deterministic evidence',async t=>{
  const project=await mkdtemp(path.join(os.tmpdir(),'rab-security-surface-'));t.after(()=>rm(project,{recursive:true,force:true}));
  await mkdir(path.join(project,'src'),{recursive:true});await mkdir(path.join(project,'generated'),{recursive:true});
  await writeFile(path.join(project,'src','server.js'),`import { exec } from 'node:child_process';\nimport path from 'node:path';\nimport { writeFile } from 'node:fs/promises';\nconst fd = new FormData(); const name = file.name;\nconst p = path.join('/tmp', file.name);\nawait writeFile('Widget.tsx', content);\nconst q = \`SELECT * FROM docs WHERE docs MATCH '\${term}'\`;\ndb.query(\`SELECT * FROM users WHERE id=\${id}\`);\nexec(\`convert \${file.name}\`);\napp.listen(8080, '0.0.0.0');\nconst lan='192.168.1.20';\napp.get('/admin', handler);\n`);
  await writeFile(path.join(project,'docker-compose.yml'),`services:\n  db:\n    privileged: true\n    network_mode: host\n    user: root\n    ports:\n      - "3306:3306"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n`);
  await writeFile(path.join(project,'generated','Good.tsx'),'/* @generated-by-dashboard */\nexport const Good=()=>null;\n');
  await writeFile(path.join(project,'generated','bad.php'),'<?php echo 1;');
  const house=createToolHouse({root});const context={project:{root:project}};
  for(const key of ['find-file-write-sinks','find-user-filename-usage','find-formdata-file-handling','find-executable-file-writes','find-path-input-joins','find-fts5-match-queries','find-fts5-raw-match-concatenation','find-mysql-query-calls','find-sql-string-interpolation','find-child-process-exec','find-command-string-composition','find-wildcard-bindings','find-lan-addresses','find-docker-socket-mounts','find-privileged-containers','find-host-network-mode','find-root-container-user','find-database-port-exposure','find-admin-routes']){
    const out=await house.runTool({key,options:{folder:project},context});assert.ok(out.result.totals.matches>=1,key);
  }
  const generated=await house.runTool({key:'check-generated-files',options:{generated_root:'generated',allowed_extensions:'.tsx,.css',provenance_marker:'@generated-by-dashboard'},context});
  assert.equal(generated.result.status,'violations');assert.equal(generated.result.totals.violations,2);
  assert.deepEqual(generated.result.rows.map(x=>x.kind),['generated-extension-violation','generated-provenance-missing']);
  const composite=await house.runTool({key:'inspect-security-surface',options:{folder:project},context});
  assert.equal(composite.result.status,'ok');assert.ok(composite.result.summary.total_matches>=10);assert.ok(composite.tasks.filter(x=>x.parentTaskId).length>=10);
});

test('active security suite pulls control-plane, DOM and local-network doors',async()=>{
  const result=await runSecurityVerification({root,check:'all'});
  assert.equal(result.status,'pass',JSON.stringify(result.rows.filter(x=>x.status==='fail'),null,2));
  assert.equal(result.totals.failed,0);assert.ok(result.totals.checks>=26);
  for(const check of ['move-tool-requires-confirmation','move-tool-blocks-traversal','move-tool-blocks-collision','move-tool-preserves-stable-id','move-stamp-preserves-stable-id','dom-edit-symlink-escape','workbench-loopback-binding']) assert.equal(result.rows.find(x=>x.check===check)?.status,'pass',check);
});
