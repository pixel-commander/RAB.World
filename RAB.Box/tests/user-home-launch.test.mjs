import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('ordinary launcher saves only to the user home despite a stale preview override', async t => {
  const base = path.join(os.homedir(), '.rab', 'temp', 'test');
  await mkdir(base, {recursive:true});
  const fixture = path.join(base, String(Date.now()));
  await mkdir(fixture);
  const profile = path.join(fixture, 'profile');
  await mkdir(profile, {recursive:true});
  const child = spawn(process.execPath, ['server.mjs', '--port', '0'], {
    cwd:root, windowsHide:true,
    env:{...process.env, USERPROFILE:profile, HOME:profile, RAB_HOME:path.join(fixture,'wrong-preview')},
    stdio:['ignore','pipe','pipe']
  });
  t.after(() => { if(child.exitCode===null)child.kill(); });
  let output='', errors='';
  child.stderr.on('data', chunk => errors += chunk);
  const origin = await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error(`Launch timed out: ${errors}`)),20000);
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Launch exited ${code}: ${errors}`));});
    child.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(found){clearTimeout(timer);resolve(found[0]);}});
  });
  assert.ok(output.includes(`Saved work: ${path.join(profile,'.rab')}`));
  const home = JSON.parse(await readFile(path.join(profile,'.rab','settings.json'),'utf8'));
  assert.equal(home.version,'0.8');
  const handshake = await fetch(origin+'/api/session').then(r=>r.json());
  const projects = await fetch(origin+'/api/projects',{headers:{'x-magic-token':handshake.token}}).then(r=>r.json());
  assert.deepEqual(projects.items,[]);
  await assert.rejects(readFile(path.join(fixture,'wrong-preview','settings.json')), {code:'ENOENT'});
});
