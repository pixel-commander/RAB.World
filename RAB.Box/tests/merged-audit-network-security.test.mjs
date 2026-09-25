import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house = createToolHouse({root});
const fixture = async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'rab-audit-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const put=async(file,text)=>{const target=path.join(dir,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);};
  return {dir,put};
};
const run=(key,folder,context={})=>house.runTool({key,options:folder?{folder}:{},context});

test('all 16 advanced audit leaves are public Tools using inherited parent executors', async () => {
  const listed=await house.listTools({fresh:true});
  const expected=[
    'audit/network/express-listen','audit/network/node-http','audit/network/ws-servers','audit/network/docker-ports',
    'audit/network/interface-bindings','audit/network/unencrypted-protocols','audit/network/dev-cors-policies','audit/network/exposed-admin-routes',
    'audit/security/jwt-secrets','audit/security/regex-dos','audit/security/unsecure-tls','audit/security/sql-injection',
    'audit/security/shell-spawns','audit/security/private-keys','audit/security/cookies-unsecure','audit/security/prototype-pollution'
  ];
  for(const key of expected){const tool=listed.items.find(x=>x.key===key);assert.ok(tool,key);assert.equal(tool.kind,'tool');assert.equal(tool.inheritedExecutor,true,key);}
  assert.deepEqual(listed.unavailable,[]);
});

test('network audits find multiline/dynamic socket topology and ignore string/comment fakes', async t=>{
  const {dir,put}=await fixture(t);
  await put('server.mjs',`import express from 'express';\nconst app = express();\napp.listen(process.env.PORT);\nconsole.log("app.listen(9999)");\n// app.listen(8888);\n`);
  await put('native.mjs',`import http from 'node:http';\nconst server = http.createServer(app);\nserver.listen(API_PORT);\n`);
  await put('ws.mjs',`import { WebSocketServer } from 'ws';\nconst socket = new WebSocketServer({\n  port: process.env.WS_PORT\n});\n`);
  await put('compose.yml',`services:\n  api:\n    ports:\n      - "8080:3000"\n`);
  await put('Dockerfile',`FROM node:22\nEXPOSE 3000 8081/tcp\n`);

  const express=(await run('audit/network/express-listen',dir)).result;
  assert.equal(express.totals.matches,1);
  assert.ok(express.rows.some(x=>x.port.expression==='process.env.PORT'));
  assert.ok(!express.rows.some(x=>x.port.expression==='9999'||x.port.expression==='8888'));

  const native=(await run('audit/network/node-http',dir)).result;
  assert.equal(native.totals.matches,1);
  assert.equal(native.rows[0].port.expression,'API_PORT');

  const ws=(await run('audit/network/ws-servers',dir)).result;
  assert.equal(ws.totals.matches,1);
  assert.equal(ws.rows[0].port.expression,'process.env.WS_PORT');
  assert.equal(ws.rows[0].transport,'websocket');

  const docker=(await run('audit/network/docker-ports',dir)).result;
  assert.equal(docker.totals.matches,3);
  const map=docker.rows.find(x=>x.kind==='network-mapping');
  assert.equal(map.host_port.resolved,8080);
  assert.equal(map.container_port.resolved,3000);
  assert.equal(docker.rows.filter(x=>x.kind==='network-expose').length,2);
});

test('network audit accepts loaded project root when folder seat is omitted', async t=>{
  const {dir,put}=await fixture(t);
  await put('server.js',`const express = require('express');\nconst app = express();\napp.listen(4242);\n`);
  const out=(await run('audit/network/express-listen',null,{project:{root:dir}})).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].port.resolved,4242);
});

test('JWT audit reports inline secret without leaking the secret value', async t=>{
  const {dir,put}=await fixture(t);
  await put('auth.js', "const jwt = require('jsonwebtoken');\nconst token = jwt.sign(payload, 'super-secret-value');\nconst ok = jwt.verify(token, process.env.JWT_SECRET);\nconst fixture = `jwt.sign(payload, 'fake-secret-inside-string')`;\n");
  const out=(await run('audit/security/jwt-secrets',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].redacted,true);
  assert.doesNotMatch(JSON.stringify(out),/super-secret-value/);
});

test('ReDoS audit finds nested quantifiers but not ordinary bounded/simple regexes', async t=>{
  const {dir,put}=await fixture(t);
  await put('regex.js', "const dangerous = /([a-zA-Z]+)*/;\nconst fine = /^[a-z]+$/;\nconst bounded = /(ab){1,4}/;\nconst fixture = `const fake = /([x]+)*/;`;\n");
  const out=(await run('audit/security/regex-dos',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.match(out.rows[0].pattern,/\+/);
});

test('TLS audit finds explicit verification disablement and old minimum protocol', async t=>{
  const {dir,put}=await fixture(t);
  await put('tls.js', "const a = { rejectUnauthorized: false };\nconst b = { minVersion: 'TLSv1' };\nconst safe = { rejectUnauthorized: true, minVersion: 'TLSv1.3' };\nconst fixture = `rejectUnauthorized: false`;\n");
  const out=(await run('audit/security/unsecure-tls',dir)).result;
  assert.equal(out.totals.matches,2);
});

test('SQL audit flags dynamic text at execution sinks and leaves parameterized query alone', async t=>{
  const {dir,put}=await fixture(t);
  await put('db.js',`db.query(\`SELECT * FROM users WHERE id = \${userId}\`);\ndb.query('SELECT * FROM users WHERE id = ?', [userId]);\n`);
  const out=(await run('audit/security/sql-injection',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].dynamic,'template-interpolation');
});

test('shell audit distinguishes dynamic shell use from ordinary argument-array spawn', async t=>{
  const {dir,put}=await fixture(t);
  await put('proc.js',`exec(\`git show \${ref}\`);\nspawn('git', ['show', ref]);\nspawn(command, args, { shell: true });\n`);
  const out=(await run('audit/security/shell-spawns',dir)).result;
  assert.equal(out.totals.matches,2);
  assert.ok(out.rows.some(x=>x.confidence==='high'));
  assert.ok(out.rows.some(x=>x.confidence==='review'));
});

test('private key audit finds private PEM material but does not treat ssh-rsa public keys as private', async t=>{
  const {dir,put}=await fixture(t);
  await put('keys.txt',`ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCpublic demo@example\n-----BEGIN OPENSSH PRIVATE KEY-----\nQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0g=\n-----END OPENSSH PRIVATE KEY-----\n`);
  const out=(await run('audit/security/private-keys',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].redacted,true);
  assert.doesNotMatch(JSON.stringify(out),/QUJDREVGR0hJSktM/);
});

test('cookie audit reads multiline option objects and only reports missing hardening flags', async t=>{
  const {dir,put}=await fixture(t);
  await put('cookies.js',`res.cookie('safe', token, {\n  httpOnly: true,\n  secure: true\n});\nres.cookie('bad', token, {\n  sameSite: 'lax'\n});\n`);
  const out=(await run('audit/security/cookies-unsecure',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.deepEqual(out.rows[0].missing,['httpOnly','secure']);
});

test('prototype pollution audit flags recursive dynamic merge without guard and ignores guarded merge', async t=>{
  const {dir,put}=await fixture(t);
  await put('merge.js',`const deepMerge = (target, source) => {\n  for (const key in source) {\n    if (typeof source[key] === 'object') deepMerge(target[key] ??= {}, source[key]);\n    else target[key] = source[key];\n  }\n  return target;\n};\n`);
  await put('safe.js',`const mergeSafe = (target, source) => {\n  for (const key in source) {\n    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;\n    if (typeof source[key] === 'object') mergeSafe(target[key] ??= {}, source[key]);\n    else target[key] = source[key];\n  }\n  return target;\n};\n`);
  const out=(await run('audit/security/prototype-pollution',dir)).result;
  assert.equal(out.totals.matches,1);
  assert.equal(out.rows[0].file,'merge.js');
});


test('interface binding audit finds wildcard listeners and ignores loopback/comment/string fakes', async t=>{
  const {dir,put}=await fixture(t);
  await put('server.js',`server.listen(3000, '0.0.0.0');
server.listen(3001, '127.0.0.1');
fastify.listen({ port: API_PORT, host: '::' });
// server.listen(9999, '0.0.0.0');
const fixture = "server.listen(7777, '0.0.0.0')";
`);
  const out=(await run('audit/network/interface-bindings',dir)).result;
  assert.equal(out.totals.matches,2);
  assert.deepEqual(out.rows.map(x=>x.host.value).sort(),['0.0.0.0','::']);
  assert.ok(out.rows.some(x=>x.port?.resolved===3000));
  assert.ok(out.rows.some(x=>x.port?.expression==='API_PORT'));
});

test('cleartext protocol audit catalogs explicit endpoints with loopback/non-loopback scope', async t=>{
  const {dir,put}=await fixture(t);
  await put('.env',`LOCAL_API=http://127.0.0.1:3000
REMOTE_API=http://api.internal:8080
SOCKET=ws://realtime.internal/socket
SAFE=https://secure.example.test
`);
  await put('config.js',`const secure = 'wss://socket.example.test';
// const old = 'http://comment.example.test';
`);
  const out=(await run('audit/network/unencrypted-protocols',dir)).result;
  assert.equal(out.totals.matches,3);
  assert.ok(out.rows.some(x=>x.protocol==='http'&&x.scope==='loopback'));
  assert.equal(out.rows.filter(x=>x.scope==='non-loopback').length,2);
});

test('CORS audit reports permissive policy and records nearby dev guard evidence', async t=>{
  const {dir,put}=await fixture(t);
  await put('cors.js',`import cors from 'cors';
app.use(cors({ origin: '*' }));
if (process.env.NODE_ENV === 'development') {
  app.use(cors());
}
app.use(cors({ origin: 'https://example.test' }));
res.header('Access-Control-Allow-Origin', '*');
const fixture = "app.use(cors({ origin: '*' }))";
// app.use(cors({ origin: '*' }));
`);
  const out=(await run('audit/network/dev-cors-policies',dir)).result;
  assert.equal(out.totals.matches,3);
  assert.ok(out.rows.some(x=>x.policy==='permissive-origin'&&x.environment_guard==='none-detected'));
  assert.ok(out.rows.some(x=>x.policy==='permissive-origin'&&x.environment_guard==='nearby-dev-evidence'));
  assert.ok(out.rows.some(x=>x.policy==='wildcard-header'));
});

test('management route audit catalogs route protection evidence without claiming auth certainty', async t=>{
  const {dir,put}=await fixture(t);
  await put('routes.js',`app.get('/admin', requireAuth, adminPage);
app.get('/debug', debugPage);
app.get('/healthz', healthHandler);
app.get('/users', usersHandler);
const fixture = "app.get('/admin', handler)";
// app.get('/dashboard', handler);
`);
  const out=(await run('audit/network/exposed-admin-routes',dir)).result;
  assert.equal(out.totals.matches,3);
  const admin=out.rows.find(x=>x.route==='/admin');
  const debug=out.rows.find(x=>x.route==='/debug');
  const health=out.rows.find(x=>x.route==='/healthz');
  assert.equal(admin.auth_evidence,'present');
  assert.equal(admin.confidence,'informational');
  assert.equal(debug.auth_evidence,'none-detected');
  assert.equal(debug.confidence,'high');
  assert.equal(health.classification,'health-status');
  assert.equal(health.confidence,'review');
});
