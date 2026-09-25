import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { scanTheme } from '../../tools/audit/_engines/theme.mjs';
import { walkFiles } from '../../tools/audit/_shared.mjs';
import { run as count } from '../../tools/audit/count/count.mjs';
import { findAssignedClasses } from '../../tools/audit/_engines/class-search.mjs';

const fixture = async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'rab-evidence-scan-'));
  t.after(async () => { assert.equal(path.dirname(folder), os.tmpdir()); assert.ok(path.basename(folder).startsWith('rab-evidence-scan-')); await rm(folder, { recursive:true, force:true }); });
  return folder;
};
test('canonical trimmed template keeps complete static class tokens and dynamic caller classes stay unresolved',()=>{
  const source='const Button=({className})=><button className={`button action-main ${className}`.trim()} />;';
  const rows=findAssignedClasses(source,'Button.tsx',{javascript:true});
  assert.deepEqual(rows.filter(x=>x.className).map(x=>x.className),['button','action-main']);
  assert.equal(rows.filter(x=>x.kind==='dynamic-class-expression').length,1);
  const unknown=findAssignedClasses('<b className={`action-main ${x}`.replaceAll("action", "other")} />','Unknown.tsx',{javascript:true});
  assert.equal(unknown.filter(x=>x.className).length,0);
});
test('captured hashes match exact input bytes, excluded storage is reported and unreadable traversal is visible', async t => {
  const folder = await fixture(t); const css = '.action { color:var(--ink); }';
  await writeFile(path.join(folder, 'a.css'), css); await mkdir(path.join(folder, '.rab')); await writeFile(path.join(folder, '.rab', 'ignored.css'), '.hidden {}');
  const result = await scanTheme({ sourceFolder:folder, type:'class-definitions' });
  assert.deepEqual(result.source_snapshot.files, [{file:'a.css',sha256:createHash('sha256').update(css).digest('hex')}]);
  assert.ok(result.scope.excluded.some(x => x.file === '.rab'));
  assert.equal(await readFile(path.join(folder, 'a.css'), 'utf8'), css);
  const failures = []; assert.deepEqual(await walkFiles(path.join(folder,'missing'), {onSkipped:item=>failures.push(item)}), []);
  assert.equal(failures[0].reason, 'directory-read-error'); assert.equal(failures[0].code, 'ENOENT');
});
test('binary stylesheet input is skipped rather than claimed successfully scanned', async t => {
  const folder = await fixture(t); await writeFile(path.join(folder,'broken.css'), Buffer.from([0,1,2]));
  const result = await scanTheme({ sourceFolder:folder, type:'class-definitions' });
  assert.equal(result.totals.files_scanned, 0); assert.equal(result.skipped[0].reason, 'binary-or-non-utf8');
});
test('changed stylesheet between child scans is explicitly inconsistent', async t => {
  const folder = await fixture(t); await writeFile(path.join(folder,'a.css'), '.before {}');
  const result = await count({ options:{folder}, tool:{meta:{target_type:'class'}}, helpers:{runTool:async({key})=>{
    const result = await scanTheme({sourceFolder:folder,type:key==='find-class-definitions'?'class-definitions':'class-names'});
    if(key==='find-class-definitions') await writeFile(path.join(folder,'a.css'),'.after {}');
    return {result};
  }}});
  assert.equal(result.source_snapshot.consistent, false);
});
test('large token lines retain bounded per-match excerpts', async t => {
  const folder = await fixture(t); await writeFile(path.join(folder,'tokens.css'), ':root{'+Array.from({length:1000},(_,i)=>`--t-${i}:var(--ink);`).join('')+'}');
  const result = await scanTheme({sourceFolder:folder,type:'theme-tokens'});
  assert.equal(result.rows.length,2000); assert.ok(result.rows.every(row=>row.text.length<=180));
  assert.ok(Buffer.byteLength(JSON.stringify(result))<800000);
});
