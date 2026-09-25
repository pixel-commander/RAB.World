import path from 'node:path';
import { scanFiles, read, rel, isCodeFile, maskComments, maskCommentsAndStrings, allMatches, lineOf, compactSnippet, expressionPort, extractBalancedCall, splitTopLevelArgs, isCodePosition } from '../_scan-helpers.mjs';

const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const literalValue = value => {
  const text = String(value ?? '').trim();
  const match = text.match(/^(['"`])([\s\S]*)\1$/);
  return match ? match[2] : text;
};
const wildcardHost = value => {
  const raw = literalValue(value).trim();
  return raw === '0.0.0.0' || raw === '::' || raw === '[::]' || /^(?:INADDR_ANY|in6addr_any)$/i.test(raw);
};
const loopbackHost = host => /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?|0\.0\.0\.0)$/i.test(host);
const configFile = file => /(?:\.ya?ml|\.json|\.toml|\.ini|\.conf|\.env(?:\..+)?|nginx\.conf|caddyfile)$/i.test(path.basename(file)) || /\.(?:ya?ml|json|toml|ini|conf)$/i.test(file);
const eligibleText = file => isCodeFile(file) || configFile(file);
const sourceScope = (root,file) => {
  const name=rel(root,file);
  if (/(?:^|\/)(?:verification)(?:\/|$)/i.test(name)) return 'verification';
  if (/(?:^|\/)(?:tests?|__tests__|fixtures?|mocks?)(?:\/|$)/i.test(name)) return 'test';
  return 'runtime';
};

const row = ({ source, file, root, signature, index, kind = 'network-finding', ...extra }) => ({
  file: rel(root, file),
  line: lineOf(source, index),
  kind,
  signature,
  text: compactSnippet(source, index),
  source_scope: sourceScope(root,file),
  ...extra
});

const codeRows = ({ source, masked, commentsOnly, file, root, signature }) => {
  const rows = [];
  const push = ({ match, implementation, transport = 'tcp', portGroup = 1, host = null }) => {
    const port = expressionPort(match[portGroup]);
    rows.push({ file:rel(root,file), line:lineOf(source,match.index), kind:'network-binding', signature, transport, implementation, host, port, text:compactSnippet(source,match.index) });
  };

  if (signature === 'express-listen') {
    const factories = new Set();
    for (const match of allMatches(/\bimport\s+([A-Za-z_$][\w$]*)\s+from\s*['"]express['"]/g, source)) factories.add(match[1]);
    for (const match of allMatches(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*['"]express['"]\s*\)/g, source)) factories.add(match[1]);
    if (!factories.size) return rows;
    const apps = new Set();
    for (const factory of factories) {
      const re = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${esc(factory)}\\s*\\(\\s*\\)`, 'g');
      for (const match of allMatches(re, masked)) apps.add(match[1]);
    }
    for (const name of apps) {
      const re = new RegExp(`\\b${esc(name)}\\s*\\.\\s*listen\\s*\\(\\s*([^,\\)\\n]+)`, 'g');
      for (const match of allMatches(re, masked)) push({ match, implementation:'express', transport:'http', portGroup:1 });
    }
  }

  if (signature === 'node-http') {
    const hasNativeHttp = /(?:from\s*['"](?:node:)?(?:http|https|http2)['"]|require\s*\(\s*['"](?:node:)?(?:http|https|http2)['"]\s*\))/i.test(source);
    if (!hasNativeHttp) return rows;
    const vars = new Set();
    for (const match of allMatches(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:https?|http2)\s*\.\s*)?createServer\s*\(/g, masked)) vars.add(match[1]);
    for (const name of vars) {
      const re = new RegExp(`\\b${esc(name)}\\s*\\.\\s*listen\\s*\\(\\s*([^,\\)\\n]+)`, 'g');
      for (const match of allMatches(re, masked)) push({ match, implementation:'node-http', transport:'http', portGroup:1 });
    }
    for (const match of allMatches(/\b(?:(?:https?|http2)\s*\.\s*)?createServer\s*\([\s\S]{0,1200}?\)\s*\.\s*listen\s*\(\s*([^,\)\n]+)/g, masked)) {
      push({ match, implementation:'node-http', transport:'http', portGroup:1 });
    }
  }

  if (signature === 'ws-servers') {
    const packageEvidence = /(?:from\s*['"](?:ws|socket\.io)['"]|require\s*\(\s*['"](?:ws|socket\.io)['"]\s*\))/i.test(source);
    if (!packageEvidence) return rows;
    for (const match of allMatches(/\bnew\s+(?:WebSocketServer|Server)\s*\(\s*\{[\s\S]{0,1000}?\bport\s*:\s*([^,}\n]+)/g, masked)) {
      push({ match, implementation:/WebSocketServer/.test(match[0])?'ws':'socket.io', transport:'websocket', portGroup:1 });
    }
    for (const match of allMatches(/\bnew\s+Server\s*\(\s*(\d+|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*[,)]/g, masked)) {
      push({ match, implementation:'socket.io', transport:'websocket', portGroup:1 });
    }
  }

  if (signature === 'interface-bindings') {
    // Positional server.listen(port, host) style bindings.
    for (const match of allMatches(/\.\s*listen\s*\(\s*([^,\n\)]+)\s*,\s*([^,\n\)]+)/g, commentsOnly)) {
      if (!isCodePosition(masked, match.index) || !wildcardHost(match[2])) continue;
      rows.push(row({ source,file,root,signature,index:match.index,kind:'network-interface-binding',host:{expression:match[2].trim(),value:literalValue(match[2]),scope:'wildcard'},port:expressionPort(match[1]),confidence:'high' }));
    }
    // Object form: listen({ port, host }) / listen({ host, port }).
    for (const match of allMatches(/\.\s*listen\s*\(\s*\{[\s\S]{0,800}?\}\s*\)/g, commentsOnly)) {
      if (!isCodePosition(masked, match.index)) continue;
      const host = match[0].match(/\bhost\s*:\s*([^,}\n]+)/i)?.[1];
      if (!host || !wildcardHost(host)) continue;
      const port = match[0].match(/\bport\s*:\s*([^,}\n]+)/i)?.[1] ?? null;
      rows.push(row({ source,file,root,signature,index:match.index,kind:'network-interface-binding',host:{expression:host.trim(),value:literalValue(host),scope:'wildcard'},port:port?expressionPort(port):null,confidence:'high' }));
    }
  }

  if (signature === 'dev-cors-policies') {
    const corsNames = new Set();
    for (const match of allMatches(/\bimport\s+([A-Za-z_$][\w$]*)\s+from\s*['"]cors['"]/g, commentsOnly)) if (isCodePosition(masked, match.index)) corsNames.add(match[1]);
    for (const match of allMatches(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*['"]cors['"]\s*\)/g, commentsOnly)) if (isCodePosition(masked, match.index)) corsNames.add(match[1]);
    const envEvidence = index => {
      const start = Math.max(0,index-1200);
      const before = commentsOnly.slice(start,index);
      const guards = allMatches(/\bif\s*\([^)]*(?:NODE_ENV|MODE|ENV)[^)]*(?:development|dev|local)[^)]*\)\s*\{/gi, before);
      for (let i=guards.length-1;i>=0;i--) {
        const guard=guards[i], brace=start+guard.index+guard[0].lastIndexOf('{');
        const structural=masked.slice(brace,index);
        let depth=0;
        for (const ch of structural) { if (ch==='{') depth++; else if (ch==='}') depth--; }
        if (depth>0) return true;
      }
      return false;
    };
    for (const name of corsNames) {
      const startRe = new RegExp(`\\b${esc(name)}\\s*\\(`,'g');
      for (const match of allMatches(startRe, commentsOnly)) {
        if (!isCodePosition(masked, match.index)) continue;
        const open = commentsOnly.indexOf('(', match.index);
        const call = extractBalancedCall(commentsOnly, open);
        if (!call) continue;
        const args = splitTopLevelArgs(call);
        const permissive = !args[0] || /\borigin\s*:\s*['"]\*['"]/i.test(args[0]);
        if (!permissive) continue;
        const guarded = envEvidence(match.index);
        rows.push(row({ source,file,root,signature,index:match.index,kind:'network-cors-policy',policy:'permissive-origin',environment_guard:guarded?'nearby-dev-evidence':'none-detected',confidence:guarded?'review':'high' }));
      }
    }
    for (const match of allMatches(/(?:\.\s*(?:set|header)\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]|['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"])/gi, commentsOnly)) {
      if (!isCodePosition(masked, match.index)) continue;
      const guarded = envEvidence(match.index);
      rows.push(row({ source,file,root,signature,index:match.index,kind:'network-cors-policy',policy:'wildcard-header',environment_guard:guarded?'nearby-dev-evidence':'none-detected',confidence:guarded?'review':'high' }));
    }
  }

  if (signature === 'exposed-admin-routes') {
    const routeRe = /\.\s*(get|post|put|patch|delete|all|use|route)\s*\(\s*(['"])(\/(?:admin|debug|dashboard|status|healthz|health|metrics|manage|management|internal)(?:\/[^'"\s]*)?)\2/gi;
    const authRe = /\b(?:auth|authenticate|authenticated|authorization|authorize|requireAuth|requireAdmin|isAdmin|adminOnly|ensureAuthenticated|verifyToken|verifyJwt|guard|acl|rbac)\b/i;
    for (const match of allMatches(routeRe, commentsOnly)) {
      if (!isCodePosition(masked, match.index)) continue;
      const open = commentsOnly.indexOf('(', match.index);
      const call = open >= 0 ? extractBalancedCall(commentsOnly, open) : null;
      const args = call ? splitTopLevelArgs(call) : [];
      const remainder = args.slice(1).join(', ');
      const hasAuth = authRe.test(remainder);
      const endpoint = match[3];
      const informational = /^\/(?:status|healthz|health)(?:\/|$)/i.test(endpoint);
      rows.push(row({ source,file,root,signature,index:match.index,kind:'network-management-route',method:match[1].toUpperCase(),route:endpoint,auth_evidence:hasAuth?'present':'none-detected',classification:informational?'health-status':'management',confidence:hasAuth?'informational':informational?'review':'high' }));
    }
  }

  return rows;
};

const cleartextRows = ({ source, file, root }) => {
  const rows = [];
  const searchable = configFile(file) ? source : maskComments(source);
  const regex = /\b(http|ws):\/\/([^\s'"`<>\)\]}]+)/gi;
  for (const match of allMatches(regex, searchable)) {
    const lineStart=source.lastIndexOf('\n',match.index-1)+1;
    const lineEnd=source.indexOf('\n',match.index);
    const fullLine=source.slice(lineStart,lineEnd<0?source.length:lineEnd);
    if (configFile(file) && /^\s*(?:#|;|\/\/)/.test(fullLine)) continue;
    const protocol = match[1].toLowerCase();
    const authority = match[2];
    const host = authority.replace(/^.*@/,'').split('/')[0].split(':')[0].replace(/^\[/,'').replace(/\]$/,'');
    const scope = /^(?:0\.0\.0\.0|\[?::\]?)$/i.test(host) ? 'wildcard' : loopbackHost(host) ? 'loopback' : /\$\{/.test(host) ? 'dynamic' : 'non-loopback';
    const source_scope=sourceScope(root,file);
    rows.push(row({ source,file,root,signature:'unencrypted-protocols',index:match.index,kind:'network-cleartext-endpoint',protocol,endpoint:match[0],host,scope,confidence:source_scope==='runtime'&&scope!=='loopback'?'review':'informational' }));
  }
  return rows;
};

const dockerRows = ({ source, file, root }) => {
  const rows = [];
  const name = path.basename(file).toLowerCase();
  const add = ({ index, implementation, hostPort = null, containerPort, protocol = 'tcp' }) => rows.push({
    file:rel(root,file), line:lineOf(source,index), kind:implementation==='dockerfile'?'network-expose':'network-mapping', signature:'docker-ports', transport:protocol,
    implementation, host_port:hostPort ? expressionPort(hostPort) : null, container_port:expressionPort(containerPort), text:compactSnippet(source,index)
  });

  if (name === 'dockerfile' || name.startsWith('dockerfile.')) {
    for (const match of allMatches(/^\s*EXPOSE\s+([^#\r\n]+)/gmi, source)) {
      const tokens = match[1].trim().split(/\s+/);
      for (const token of tokens) {
        const [port, protocol = 'tcp'] = token.split('/');
        if (port) add({ index:match.index, implementation:'dockerfile', containerPort:port, protocol });
      }
    }
    return rows;
  }

  if (!/^(?:docker-)?compose(?:\.[^.]+)?\.ya?ml$/.test(name) && !/^docker-compose\.ya?ml$/.test(name) && !/compose\.ya?ml$/.test(name)) return rows;
  for (const match of allMatches(/^\s*-\s*["']?([^\s"']+):([^\s"']+)["']?\s*(?:#.*)?$/gm, source)) {
    const host = match[1], container = match[2];
    const [containerPort, protocol = 'tcp'] = container.split('/');
    add({ index:match.index, implementation:'docker-compose', hostPort:host, containerPort, protocol });
  }
  for (const match of allMatches(/\btarget\s*:\s*([^\s#]+)[\s\S]{0,300}?\bpublished\s*:\s*([^\s#]+)/g, source)) {
    add({ index:match.index, implementation:'docker-compose', hostPort:match[2], containerPort:match[1] });
  }
  return rows;
};

export const run = async ({ options, context, tool }) => {
  const sourceFolder = options.folder ?? context?.project?.root;
  if (!sourceFolder) throw Object.assign(new Error(`${tool.key}: folder or loaded project is required.`), { code:'INPUT_REQUIRED' });
  const root = path.resolve(sourceFolder), signature = tool.meta.signature;
  const rows = [];
  let filesScanned = 0;
  for (const file of await scanFiles(root)) {
    const name = path.basename(file).toLowerCase();
    const eligible = signature === 'docker-ports'
      ? (name === 'dockerfile' || name.startsWith('dockerfile.') || name.endsWith('.yml') || name.endsWith('.yaml'))
      : signature === 'unencrypted-protocols'
        ? eligibleText(file)
        : isCodeFile(file);
    if (!eligible) continue;
    filesScanned++;
    const source = await read(file);
    if (signature === 'docker-ports') rows.push(...dockerRows({source,file,root}));
    else if (signature === 'unencrypted-protocols') rows.push(...cleartextRows({source,file,root}));
    else rows.push(...codeRows({source,masked:maskCommentsAndStrings(source),commentsOnly:maskComments(source),file,root,signature}));
  }
  rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
  return { status:'ok', scan:`network-${signature}`, root, totals:{files_scanned:filesScanned,matches:rows.length}, rows };
};
