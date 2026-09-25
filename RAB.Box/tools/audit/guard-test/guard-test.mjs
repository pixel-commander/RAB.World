import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const timeoutValue = value => {
  const n = Number(value ?? 3000);
  if (!Number.isFinite(n) || n < 250 || n > 15000) throw Object.assign(new Error('timeout_ms must be between 250 and 15000.'), { code:'BAD_REQUEST' });
  return Math.round(n);
};

const requireAuthorization = options => {
  if (options.authorized_target !== true) throw Object.assign(new Error('Live guard probes require authorized_target=true for a target you own or are permitted to test.'), { code:'AUTHORIZATION_REQUIRED' });
};

const explicitHost = value => {
  const host = String(value ?? '').trim();
  if (!host || /[\s,/*]/.test(host) || host.includes('://')) throw Object.assign(new Error('host must be one explicit hostname or IP address; ranges, lists, wildcards, and URLs are not accepted.'), { code:'BAD_REQUEST' });
  return host;
};

const explicitPort = value => {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error('port must be one integer from 1 to 65535.'), { code:'BAD_REQUEST' });
  return port;
};

const explicitUrl = value => {
  let url;
  try { url = new URL(String(value ?? '')); } catch { throw Object.assign(new Error('url must be one explicit http:// or https:// URL.'), { code:'BAD_REQUEST' }); }
  if (!['http:','https:'].includes(url.protocol)) throw Object.assign(new Error('Only http:// and https:// targets are supported.'), { code:'BAD_REQUEST' });
  if (url.username || url.password) throw Object.assign(new Error('Credentials must not be embedded in URLs.'), { code:'BAD_REQUEST' });
  return url;
};

const expectation = (actual, expected) => expected === undefined ? null : ({ expected, actual, pass:actual === expected });

const httpMethod = value => {
  const method=String(value ?? 'HEAD').trim().toUpperCase();
  if(!['HEAD','GET'].includes(method)) throw Object.assign(new Error('method must be HEAD or GET.'),{code:'BAD_REQUEST'});
  return method;
};

const socketConnect = ({ host, port, timeout }) => new Promise(resolve => {
  const started = performance.now();
  const socket = net.createConnection({ host, port });
  let done = false;
  const finish = result => {
    if (done) return;
    done = true;
    socket.destroy();
    resolve({ ...result, elapsed_ms:Math.round((performance.now()-started)*100)/100 });
  };
  socket.setTimeout(timeout, () => finish({ reachable:false, outcome:'timeout' }));
  socket.once('connect', () => finish({ reachable:true, outcome:'connected', local_address:socket.localAddress ?? null, remote_address:socket.remoteAddress ?? null, remote_family:socket.remoteFamily ?? null }));
  socket.once('error', error => finish({ reachable:false, outcome:'connect-error', error_code:error.code ?? 'ERROR' }));
});

const requestOnce = ({ url, timeout, headers = {}, captureBytes = 8192, method = 'GET' }) => new Promise(resolve => {
  const lib = url.protocol === 'https:' ? https : http;
  const started = performance.now();
  const request = lib.request(url, { method, headers, timeout, rejectUnauthorized:true }, response => {
    const chunks=[];
    let bytes=0, truncated=false, done=false;
    const finish=()=>{
      if(done)return; done=true;
      const body=Buffer.concat(chunks);
      resolve({
        ok:true,
        status:response.statusCode ?? null,
        headers:{
          content_type:response.headers['content-type'] ?? null,
          content_length:response.headers['content-length'] ?? null,
          location:response.headers.location ?? null,
          server:response.headers.server ?? null,
          www_authenticate:response.headers['www-authenticate'] ?? null
        },
        body,
        bytes_read:bytes,
        truncated,
        elapsed_ms:Math.round((performance.now()-started)*100)/100
      });
    };
    response.on('data', chunk => {
      if (captureBytes <= 0) return;
      const buffer=Buffer.from(chunk);
      const remain=captureBytes-bytes;
      if(remain<=0){truncated=true;return;}
      const take=buffer.subarray(0,remain);
      chunks.push(take);bytes+=take.length;
      if(buffer.length>take.length)truncated=true;
    });
    response.on('end',finish);
    response.on('error',error=>resolve({ok:false,error_code:error.code??'ERROR',error:error.message,elapsed_ms:Math.round((performance.now()-started)*100)/100}));
  });
  request.on('timeout',()=>request.destroy(Object.assign(new Error('request timeout'),{code:'ETIMEDOUT'})));
  request.on('error',error=>resolve({ok:false,error_code:error.code??'ERROR',error:error.message,elapsed_ms:Math.round((performance.now()-started)*100)/100}));
  request.end();
});

const publicHttpResult = result => {
  if (!result.ok) return { reachable:false, outcome:'request-error', error_code:result.error_code ?? 'ERROR', elapsed_ms:result.elapsed_ms };
  return {
    reachable:true,
    outcome:'http-response',
    status:result.status,
    headers:result.headers,
    bytes_read:result.bytes_read,
    truncated:result.truncated,
    elapsed_ms:result.elapsed_ms
  };
};

const authHeaders = options => {
  const name = String(options.auth_env ?? '').trim();
  if (!name) return { configured:false, available:false, headers:{} };
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw Object.assign(new Error('auth_env must be an environment-variable name, not a credential value.'), { code:'BAD_REQUEST' });
  const secret = process.env[name];
  if (!secret) return { configured:true, available:false, env:name, headers:{} };
  const header = String(options.auth_header ?? 'Authorization').trim() || 'Authorization';
  if (!/^[A-Za-z0-9-]+$/.test(header)) throw Object.assign(new Error('auth_header must be a simple HTTP header name.'), { code:'BAD_REQUEST' });
  const raw = options.auth_raw === true;
  const scheme = raw ? '' : String(options.auth_scheme ?? 'Bearer').trim();
  return { configured:true, available:true, env:name, raw, headers:{ [header]: scheme ? `${scheme} ${secret}` : secret } };
};

const authClass = status => {
  if (status === 401 || status === 403) return 'denied';
  if (status >= 200 && status < 300) return 'allowed';
  if (status >= 300 && status < 400) return 'redirected';
  if (status === 404) return 'not-found';
  return 'other';
};

const writeTree = async (root, files) => {
  for (const [name,content] of Object.entries(files)) {
    const file=path.join(root,name);
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,typeof content==='function'?content():content);
  }
};

const privateKeyFixture = () => [
  '-----BEGIN OPENSSH ' + 'PRIVATE KEY-----',
  'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0g=',
  '-----END OPENSSH ' + 'PRIVATE KEY-----',
  ''
].join('\n');

const profile = (key,bad,good,verifyBad,verifyGood = r => (r?.totals?.matches ?? r?.rows?.length ?? 0) === 0) => ({key,bad,good,verifyBad,verifyGood});

const guardProfiles = {
  network: [
    profile('audit/network/express-listen', {'server.js':`import express from 'express';\nconst app=express();\napp.listen(3456);\n`}, {'server.js':`import express from 'express';\nconst app=express();\napp.disable('x-powered-by');\n`}, r=>r.rows.some(x=>x.port?.resolved===3456)),
    profile('audit/network/node-http', {'server.js':`import http from 'node:http';\nconst server=http.createServer(()=>{});\nserver.listen(NATIVE_PORT);\n`}, {'server.js':`import http from 'node:http';\nhttp.createServer(()=>{});\n`}, r=>r.rows.some(x=>x.port?.expression==='NATIVE_PORT')),
    profile('audit/network/ws-servers', {'server.js':`import { WebSocketServer } from 'ws';\nnew WebSocketServer({ port: WS_PORT });\n`}, {'server.js':`import { WebSocketServer } from 'ws';\nnew WebSocketServer({ noServer:true });\n`}, r=>r.rows.some(x=>x.port?.expression==='WS_PORT')),
    profile('audit/network/docker-ports', {'compose.yml':`services:\n  app:\n    ports:\n      - "8123:3000"\n`}, {'compose.yml':`services:\n  app:\n    expose:\n      - "3000"\n`}, r=>r.rows.some(x=>x.host_port?.resolved===8123&&x.container_port?.resolved===3000)),
    profile('audit/network/interface-bindings', {'server.js':`server.listen(3000, '0.0.0.0');\n`}, {'server.js':`server.listen(3000, '127.0.0.1');\n`}, r=>r.rows.some(x=>x.host?.value==='0.0.0.0')),
    profile('audit/network/unencrypted-protocols', {'.env':`REMOTE=http://api.example.test:8080\n`}, {'.env':`REMOTE=https://api.example.test\nSOCKET=wss://socket.example.test\n`}, r=>r.rows.some(x=>x.endpoint?.startsWith('http://api.example.test'))),
    profile('audit/network/dev-cors-policies', {'server.js':`import cors from 'cors';\napp.use(cors({ origin: '*' }));\n`}, {'server.js':`import cors from 'cors';\napp.use(cors({ origin: 'https://safe.example.test' }));\n`}, r=>r.rows.some(x=>x.policy==='permissive-origin')),
    profile('audit/network/exposed-admin-routes', {'routes.js':`app.get('/debug', debugHandler);\n`}, {'routes.js':`app.get('/admin', requireAuth, adminHandler);\n`}, r=>r.rows.some(x=>x.route==='/debug'&&x.auth_evidence==='none-detected'), r=>r.rows.some(x=>x.route==='/admin'&&x.auth_evidence==='present'))
  ],
  security: [
    profile('audit/security/jwt-secrets', {'auth.js':`const jwt=require('jsonwebtoken');\njwt.sign(payload, 'guard-regression-secret');\n`}, {'auth.js':`const jwt=require('jsonwebtoken');\njwt.sign(payload, process.env.JWT_SECRET);\n`}, r=>r.rows.length===1&&r.rows[0].redacted===true),
    profile('audit/security/regex-dos', {'regex.js':`const bad=/([a-z]+)*/;\n`}, {'regex.js':`const safe=/^[a-z]+$/;\n`}, r=>r.rows.length===1),
    profile('audit/security/unsecure-tls', {'tls.js':()=>`const bad={reject${'Unauthorized'}:false};\n`}, {'tls.js':()=>`const safe={reject${'Unauthorized'}:true,minVersion:'TLSv1.3'};\n`}, r=>r.rows.length===1),
    profile('audit/security/sql-injection', {'db.js':"db.query(`SELECT * FROM users WHERE id = ${userId}`);\n"}, {'db.js':`db.query('SELECT * FROM users WHERE id = ?', [userId]);\n`}, r=>r.rows.length===1),
    profile('audit/security/shell-spawns', {'proc.js':"exec(`git show ${ref}`);\n"}, {'proc.js':`spawn('git',['show',ref]);\n`}, r=>r.rows.length===1),
    profile('audit/security/private-keys', {'key.txt':privateKeyFixture}, {'key.txt':`ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCpublic demo@example\n`}, r=>r.rows.length===1&&r.rows[0].redacted===true),
    profile('audit/security/cookies-unsecure', {'cookies.js':()=>`res.${'cookie'}('bad', token, {sameSite:'lax'});\n`}, {'cookies.js':()=>`res.${'cookie'}('safe', token, {httpOnly:true,secure:true});\n`}, r=>r.rows.length===1),
    profile('audit/security/prototype-pollution', {'merge.js':`const merge=(target,source)=>{for(const key in source){if(typeof source[key]==='object')merge(target[key]??={},source[key]);else target[key]=source[key];}return target;};\n`}, {'merge.js':`const mergeSafe=(target,source)=>{for(const key in source){if(key==='__proto__'||key==='constructor'||key==='prototype')continue;if(typeof source[key]==='object')mergeSafe(target[key]??={},source[key]);else target[key]=source[key];}return target;};\n`}, r=>r.rows.length===1)
  ],
  hosting: [
    profile('audit/hosting/exposed-sourcemaps', {'dist/app.js.map':JSON.stringify({version:3,sources:['../src/app.js'],sourcesContent:['export const x=1;']})}, {'src/app.js.map':JSON.stringify({version:3,sources:['app.js']})}, r=>r.rows.some(x=>x.file==='dist/app.js.map'&&x.embedded_sources===true)),
    profile('audit/hosting/lockfile-integrity', {'package.json':JSON.stringify({dependencies:{react:'^19.0.0'}}), 'package-lock.json':JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{react:'^18.0.0'}}}})}, {'package.json':JSON.stringify({dependencies:{react:'^19.0.0'}}), 'package-lock.json':JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{react:'^19.0.0'}}}})}, r=>r.rows.some(x=>x.package==='react')),
    profile('audit/hosting/sensitive-manifests', {'dist/.env.production':'SECRET=fixture'}, {'src/.env.production':'SOURCE_ONLY=fixture'}, r=>r.rows.some(x=>x.file==='dist/.env.production')),
    profile('audit/hosting/debug-endpoints', {'dist/app.js':`const disableProductionAuth=true;\n`}, {'dist/app.js':`const productionAuth=true;\n`}, r=>r.rows.some(x=>x.indicator==='disableProductionAuth')),
    profile('audit/hosting/unminified-bundles', {'dist/app.js':Array.from({length:1400},(_,i)=>`const value${i}=()=>{ return ${i}+${i+1}; };`).join('\n')}, {'dist/app.min.js':'var a=1;'.repeat(9000)}, r=>r.rows.some(x=>x.classification==='performance')),
    profile('audit/hosting/content-security-policy', {'server.js':`app.get('/', handler);\n`}, {'server.js':`import helmet from 'helmet';\napp.use(helmet());\n`}, r=>r.rows.some(x=>x.kind==='hosting-csp-not-detected'), r=>r.rows.some(x=>x.kind==='hosting-csp-evidence'))
  ]
};

const runFixture = async ({ key, files, helpers }) => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'rab-guard-fixture-'));
  try{
    await writeTree(dir,files);
    const run=await helpers.runTool({key,options:{folder:dir}});
    return run.result;
  } finally { await rm(dir,{recursive:true,force:true}); }
};

const runRegression = async ({ family, helpers }) => {
  const profiles=guardProfiles[family] ?? [];
  const rows=[];
  for(const item of profiles){
    try{
      const bad=await runFixture({key:item.key,files:item.bad,helpers});
      const good=await runFixture({key:item.key,files:item.good,helpers});
      const caught_bad=Boolean(item.verifyBad(bad));
      const accepted_good=Boolean(item.verifyGood(good));
      rows.push({
        tool:item.key,
        pass:caught_bad&&accepted_good,
        caught_bad,
        accepted_good,
        bad_matches:bad?.totals?.matches??bad?.rows?.length??null,
        good_matches:good?.totals?.matches??good?.rows?.length??null
      });
    }catch(error){
      rows.push({tool:item.key,pass:false,caught_bad:false,accepted_good:false,error_code:error.code??'ERROR',error:error.message});
    }
  }
  const failed=rows.filter(x=>!x.pass);
  return {status:failed.length?'failed':'ok',mode:'synthetic-guard-regression',family,totals:{checks:rows.length,passed:rows.length-failed.length,failed:failed.length},rows};
};

const runAllRegression = async helpers => {
  const families=[];
  for(const family of ['network','security','hosting']) families.push(await runRegression({family,helpers}));
  const rows=families.flatMap(group=>group.rows.map(row=>({family:group.family,...row})));
  const failed=rows.filter(row=>!row.pass);
  return {status:failed.length?'failed':'ok',mode:'synthetic-guard-regression-all',totals:{checks:rows.length,passed:rows.length-failed.length,failed:failed.length},families,rows};
};

const runTcp = async options => {
  requireAuthorization(options);
  const host=explicitHost(options.host), port=explicitPort(options.port), timeout=timeoutValue(options.timeout_ms);
  const result=await socketConnect({host,port,timeout});
  const check=expectation(result.reachable,options.expect_reachable);
  return {status:check&&!check.pass?'failed':'ok',mode:'live-tcp-reachability',source_machine:os.hostname(),target:{host,port},...result,...(check?{expectation:check}:{})};
};

const runHttp = async options => {
  requireAuthorization(options);
  const url=explicitUrl(options.url), timeout=timeoutValue(options.timeout_ms), auth=authHeaders(options), method=httpMethod(options.method);
  const unauth=await requestOnce({url,timeout,captureBytes:0,method});
  const unauthPublic=publicHttpResult(unauth);
  const unauthClass=unauthPublic.status?authClass(unauthPublic.status):'unreachable';
  const authenticated=auth.available ? publicHttpResult(await requestOnce({url,timeout,headers:auth.headers,captureBytes:0,method})) : null;
  const authClassified=authenticated ? (authenticated.status?authClass(authenticated.status):'unreachable') : null;
  const checks=[
    options.expect_unauthenticated ? expectation(unauthClass,String(options.expect_unauthenticated)) : null,
    options.expect_authenticated && authenticated ? expectation(authClassified,String(options.expect_authenticated)) : null
  ].filter(Boolean);
  const pass=checks.every(x=>x.pass);
  return {
    status:checks.length&&!pass?'failed':'ok',mode:'live-http-boundary',source_machine:os.hostname(),target:url.toString(),method,redirects_followed:false,
    unauthenticated:{...unauthPublic,classification:unauthClass},
    authentication:{configured:auth.configured,credential_available:auth.available,credential_source:auth.configured?`env:${auth.env}`:null,result:authenticated?{...authenticated,classification:authClassified}:null},
    ...(checks.length?{expectations:checks}: {})
  };
};

const runBrain = async options => {
  requireAuthorization(options);
  const url=explicitUrl(options.url), timeout=timeoutValue(options.timeout_ms), auth=authHeaders(options), marker=String(options.marker??'');
  const probe=async headers=>{
    const raw=await requestOnce({url,timeout,headers,captureBytes:65536,method:'GET'});
    const pub=publicHttpResult(raw);
    if(!raw.ok)return {...pub,classification:'unreachable',marker_found:null,body_sha256:null};
    const body=raw.body;
    return {...pub,classification:authClass(raw.status),marker_found:marker?body.includes(Buffer.from(marker)):null,body_sha256:createHash('sha256').update(body).digest('hex')};
  };
  const unauthenticated=await probe({});
  const authenticated=auth.available?await probe(auth.headers):null;
  let boundary='unknown';
  if(unauthenticated.classification==='allowed') boundary='exposed-without-auth';
  else if(['denied','redirected'].includes(unauthenticated.classification)&&authenticated?.classification==='allowed') boundary='protected-and-accessible';
  else if(['denied','redirected'].includes(unauthenticated.classification)&&auth.configured&&!auth.available) boundary='protected-credential-not-loaded';
  else if(['denied','redirected'].includes(unauthenticated.classification)&&!auth.configured) boundary='protected-or-gated';
  else if(authenticated&&authenticated.classification!=='allowed') boundary='auth-attempt-not-accepted';
  const checks=[
    options.expect_boundary ? expectation(boundary,String(options.expect_boundary)) : null,
    options.expect_marker !== undefined && authenticated ? expectation(Boolean(authenticated.marker_found),Boolean(options.expect_marker)) : null
  ].filter(Boolean);
  return {
    status:checks.length&&!checks.every(x=>x.pass)?'failed':'ok',mode:'live-brain-access',source_machine:os.hostname(),target:url.toString(),redirects_followed:false,boundary,
    unauthenticated,
    authentication:{configured:auth.configured,credential_available:auth.available,credential_source:auth.configured?`env:${auth.env}`:null,result:authenticated},
    ...(checks.length?{expectations:checks}:{}),
    note:'Response body is never returned. At most 64 KiB is read for marker/hash verification.'
  };
};

const runTls = async options => {
  requireAuthorization(options);
  const host=explicitHost(options.host), port=explicitPort(options.port), timeout=timeoutValue(options.timeout_ms);
  const servername=String(options.server_name??'').trim() || (net.isIP(host)?undefined:host);
  const started=performance.now();
  const result=await new Promise(resolve=>{
    const socket=tls.connect({host,port,servername,rejectUnauthorized:false});
    let done=false;
    const finish=value=>{if(done)return;done=true;socket.destroy();resolve(value);};
    socket.setTimeout(timeout,()=>finish({reachable:false,outcome:'timeout'}));
    socket.once('secureConnect',()=>{
      const cert=socket.getPeerCertificate();
      finish({reachable:true,outcome:'tls-handshake',authorized:socket.authorized,authorization_error:socket.authorizationError??null,protocol:socket.getProtocol()??null,cipher:socket.getCipher()?.name??null,certificate:cert&&Object.keys(cert).length?{subject_cn:cert.subject?.CN??null,issuer_cn:cert.issuer?.CN??null,valid_from:cert.valid_from??null,valid_to:cert.valid_to??null,fingerprint256:cert.fingerprint256??null}:null});
    });
    socket.once('error',error=>finish({reachable:false,outcome:'tls-error',error_code:error.code??'ERROR'}));
  });
  const elapsed_ms=Math.round((performance.now()-started)*100)/100;
  const checks=[
    options.expect_reachable !== undefined ? expectation(Boolean(result.reachable),Boolean(options.expect_reachable)) : null,
    options.expect_authorized !== undefined && result.reachable ? expectation(Boolean(result.authorized),Boolean(options.expect_authorized)) : null
  ].filter(Boolean);
  return {status:checks.length&&!checks.every(x=>x.pass)?'failed':'ok',mode:'live-tls-boundary',source_machine:os.hostname(),target:{host,port,server_name:servername??null},elapsed_ms,...result,...(checks.length?{expectations:checks}:{})};
};

export const run = async ({ options, tool, helpers }) => {
  const check=tool.meta.check;
  if(['network','security','hosting'].includes(check)) return runRegression({family:check,helpers});
  if(check==='all') return runAllRegression(helpers);
  if(check==='tcp-reachability') return runTcp(options);
  if(check==='http-boundary') return runHttp(options);
  if(check==='brain-access') return runBrain(options);
  if(check==='tls-boundary') return runTls(options);
  throw Object.assign(new Error(`${tool.key}: unknown guard-test check ${check}`),{code:'BAD_TOOL'});
};
