import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const run=(key,options={})=>house.runTool({key,options});

const listen = server => new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>resolve(server.address()));
});
const close = server => new Promise(resolve=>server.close(()=>resolve()));

test('all 8 guard-test leaves are public inherited read-only Tools',async()=>{
  const listed=await house.listTools({fresh:true});
  const expected=[
    'audit/guard-test/all','audit/guard-test/network','audit/guard-test/security','audit/guard-test/hosting',
    'audit/guard-test/tcp-reachability','audit/guard-test/http-boundary','audit/guard-test/tls-boundary','audit/guard-test/brain-access'
  ];
  for(const key of expected){
    const tool=listed.items.find(x=>x.key===key);
    assert.ok(tool,key);
    assert.equal(tool.kind,'tool',key);
    assert.equal(tool.inheritedExecutor,true,key);
    assert.equal(tool.meta.authority,'read',key);
  }
  assert.deepEqual(listed.unavailable,[]);
});

test('guard-test/all cross-examines every defensive leaf with separate bad and good fixtures',async()=>{
  const out=(await run('audit/guard-test/all')).result;
  assert.equal(out.status,'ok');
  assert.equal(out.totals.checks,22);
  assert.equal(out.totals.passed,22);
  assert.equal(out.totals.failed,0);
  assert.equal(out.rows.length,22);
  assert.ok(out.rows.every(x=>x.caught_bad===true));
  assert.ok(out.rows.every(x=>x.accepted_good===true));
  assert.deepEqual([...new Set(out.rows.map(x=>x.family))].sort(),['hosting','network','security']);
});

test('guard family leaves independently cross-examine 8 network, 8 security, and 6 hosting guards',async()=>{
  const network=(await run('audit/guard-test/network')).result;
  const security=(await run('audit/guard-test/security')).result;
  const hosting=(await run('audit/guard-test/hosting')).result;
  assert.deepEqual([network.totals.checks,security.totals.checks,hosting.totals.checks],[8,8,6]);
  assert.ok([network,security,hosting].every(x=>x.status==='ok'&&x.totals.failed===0));
});

test('live probes refuse to run without explicit target authorization and reject broad targets',async()=>{
  await assert.rejects(()=>run('audit/guard-test/tcp-reachability',{host:'127.0.0.1',port:1}),error=>error.code==='INPUT_REQUIRED');
  await assert.rejects(()=>run('audit/guard-test/tcp-reachability',{host:'10.0.0.0/24',port:80,authorized_target:true}),error=>error.code==='BAD_REQUEST');
  await assert.rejects(()=>run('audit/guard-test/http-boundary',{url:'ftp://example.test/file',authorized_target:true}),error=>error.code==='BAD_REQUEST');
});

test('TCP reachability proves one explicit reachable port and supports expectation failure',async t=>{
  const server=net.createServer(socket=>socket.end());
  t.after(()=>close(server));
  const address=await listen(server);
  let out=(await run('audit/guard-test/tcp-reachability',{host:'127.0.0.1',port:address.port,authorized_target:true,expect_reachable:true})).result;
  assert.equal(out.status,'ok');
  assert.equal(out.reachable,true);
  assert.equal(out.expectation.pass,true);
  out=(await run('audit/guard-test/tcp-reachability',{host:'127.0.0.1',port:address.port,authorized_target:true,expect_reachable:false})).result;
  assert.equal(out.status,'failed');
  assert.equal(out.expectation.pass,false);
});

test('HTTP boundary checks unauthenticated and environment-backed authenticated behavior without returning credentials',async t=>{
  const old=process.env.RAB_GUARD_TEST_TOKEN;
  process.env.RAB_GUARD_TEST_TOKEN='fixture-token-never-return';
  t.after(()=>{ if(old===undefined) delete process.env.RAB_GUARD_TEST_TOKEN; else process.env.RAB_GUARD_TEST_TOKEN=old; });
  const server=http.createServer((req,res)=>{
    if(req.headers.authorization==='Bearer fixture-token-never-return'){res.statusCode=204;res.end();return;}
    res.statusCode=401;res.setHeader('WWW-Authenticate','Bearer');res.end();
  });
  t.after(()=>close(server));
  const address=await listen(server);
  const out=(await run('audit/guard-test/http-boundary',{
    url:`http://127.0.0.1:${address.port}/private`,authorized_target:true,auth_env:'RAB_GUARD_TEST_TOKEN',
    expect_unauthenticated:'denied',expect_authenticated:'allowed'
  })).result;
  assert.equal(out.status,'ok');
  assert.equal(out.unauthenticated.classification,'denied');
  assert.equal(out.authentication.result.classification,'allowed');
  assert.ok(out.expectations.every(x=>x.pass));
  assert.doesNotMatch(JSON.stringify(out),/fixture-token-never-return/);
});

test('Brain access proves unauth denial, authenticated access, and marker presence without returning Brain body',async t=>{
  const old=process.env.RAB_BRAIN_TEST_TOKEN;
  process.env.RAB_BRAIN_TEST_TOKEN='brain-fixture-token-never-return';
  t.after(()=>{ if(old===undefined) delete process.env.RAB_BRAIN_TEST_TOKEN; else process.env.RAB_BRAIN_TEST_TOKEN=old; });
  const server=http.createServer((req,res)=>{
    if(req.headers.authorization!=='Bearer brain-fixture-token-never-return'){res.statusCode=403;res.end('denied');return;}
    res.setHeader('Content-Type','text/plain');res.end('RAB_BRAIN_OK harmless marker payload');
  });
  t.after(()=>close(server));
  const address=await listen(server);
  const out=(await run('audit/guard-test/brain-access',{
    url:`http://127.0.0.1:${address.port}/brain`,authorized_target:true,auth_env:'RAB_BRAIN_TEST_TOKEN',marker:'RAB_BRAIN_OK',
    expect_boundary:'protected-and-accessible',expect_marker:true
  })).result;
  assert.equal(out.status,'ok');
  assert.equal(out.boundary,'protected-and-accessible');
  assert.equal(out.unauthenticated.classification,'denied');
  assert.equal(out.authentication.result.classification,'allowed');
  assert.equal(out.authentication.result.marker_found,true);
  assert.match(out.authentication.result.body_sha256,/^[a-f0-9]{64}$/);
  assert.equal('body' in out.authentication.result,false);
  assert.doesNotMatch(JSON.stringify(out),/brain-fixture-token-never-return|harmless marker payload/);
});

test('TLS boundary stays single-target and can assert an unreachable boundary without enumeration',async()=>{
  const reserve=net.createServer();
  const address=await listen(reserve);
  await close(reserve);
  const out=(await run('audit/guard-test/tls-boundary',{host:'127.0.0.1',port:address.port,authorized_target:true,expect_reachable:false,timeout_ms:1000})).result;
  assert.equal(out.status,'ok');
  assert.equal(out.reachable,false);
  assert.equal(out.expectations[0].pass,true);
});
