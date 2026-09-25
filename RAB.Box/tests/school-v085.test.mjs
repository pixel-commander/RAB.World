import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runLessonFile } from '../bridge/school-runtime.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const school=path.join(root,'training','school');
const files=[];
const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.json'))files.push(p);}};
await walk(school);

test('School lessons execute deterministically and all current lessons pass',async()=>{
  assert.ok(files.length>=12);
  for(const file of files.sort()){
    const result=await runLessonFile(file);
    assert.equal(result.pass,true,`${path.relative(school,file)} failed: ${JSON.stringify(result)}`);
  }
});

test('School is cold-repeatable: identical lessons return byte-equivalent verdicts',async()=>{
  const file=files.find(f=>f.endsWith('project-path.json'));
  const a=await runLessonFile(file); const b=await runLessonFile(file);
  assert.deepEqual(a,b);
});
