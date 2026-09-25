import { createToolHouse } from '../bridge/tool-house.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const folderSetting=[{type:'folder',name:'folder',title:'Folder',description:'Optional folder to scan. Uses the loaded project root when omitted.',required:false}];
const line=(name,title,description,pattern,{scope='all',kind=name,heuristic=false,flags='i'}={})=>({name,title,description,meta:{domain:'audit',operation:'find',target_type:name,output:'report',authority:'read',engine:'line',config:{pattern,scope,kind,heuristic,flags}}});
const specs=[
line('file-write-sinks','Find File Write Sinks','Finds filesystem write APIs that can create or replace local files.','\\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\\s*\\(',{scope:'code',kind:'file-write-sink',flags:''}),
line('user-filename-usage','Find User Filename Usage','Finds common request/upload filename properties that may require sanitization before filesystem use.','\\b(?:file|upload|image)\\.name\\b|\\boriginalname\\b',{scope:'code',kind:'user-filename-candidate',heuristic:true}),
line('formdata-file-handling','Find FormData File Handling','Finds FormData construction and file/image/upload field access in application code.','\\bFormData\\s*\\(|\\.(?:get|getAll)\\s*\\(\\s*[\\\"\\\'][^\\\"\\\']*(?:file|image|upload)[^\\\"\\\']*[\\\"\\\']',{scope:'code',kind:'formdata-file-handling',heuristic:true}),
line('executable-file-writes','Find Executable File Writes','Finds candidate write calls whose same-line destination names JavaScript or TypeScript executable source extensions.','(?:writeFile|writeFileSync|appendFile|appendFileSync)[^\\n]*(?:\\.tsx?|\\.jsx?|\\.mjs|\\.cjs)',{scope:'code',kind:'executable-file-write-candidate',heuristic:true}),
line('svg-upload-handling','Find SVG Handling','Finds SVG MIME/extension handling that deserves active-content review in upload or rendering paths.','(?:image/svg\\+xml|\\.svg\\b)',{scope:'all',kind:'svg-handling-candidate',heuristic:true}),
line('public-upload-serving','Find Public Upload Serving','Finds candidate static/public serving configuration mentioning upload directories.','(?:express\\.static|serveStatic|static\\s*\\()[^\\n]*(?:upload|uploads)',{scope:'code',kind:'public-upload-serving-candidate',heuristic:true}),
line('generated-directory-usage','Find Generated Directory Usage','Finds explicit generated component/style directory paths so generated-code boundaries can be reviewed.','(?:components|styles)[/\\\\]generated|generated[/\\\\](?:components|styles)',{scope:'all',kind:'generated-directory'}),
line('generated-provenance-markers','Find Generated Provenance Markers','Finds explicit generated-code provenance comments/markers.','@generated(?:-by)?(?:[-_:a-z0-9]*)',{scope:'all',kind:'generated-provenance-marker'}),
line('path-input-joins','Find Input-Derived Path Joins','Finds path.join/path.resolve calls that reference common request/upload-controlled values on the same line.','path\\.(?:join|resolve)\\s*\\([^\\n]*(?:file\\.name|originalname|req\\.|body\\.|params\\.|query\\.)',{scope:'code',kind:'input-path-join-candidate',heuristic:true}),
line('fts5-match-queries','Find FTS5 MATCH Queries','Finds SQL/text occurrences of the FTS MATCH operator for FTS5 input-boundary review.','\\bMATCH\\b',{scope:'all',kind:'fts5-match'}),
line('fts5-raw-match-concatenation','Find FTS5 Raw MATCH Composition','Finds candidate MATCH expressions composed with interpolation or string concatenation rather than a fixed query shape.','MATCH[^\\n]*(?:\\$\\{|[\\\"\\\']\\s*\\+|\\+\\s*[A-Za-z_$])',{scope:'code',kind:'fts5-raw-composition-candidate',heuristic:true}),
line('sqlite-open','Find SQLite Opens','Finds common SQLite database-open constructors.','(?:new\\s+)?(?:sqlite3\\.)?Database\\s*\\(|betterSqlite3\\s*\\(',{scope:'code',kind:'sqlite-open'}),
line('sqlite-extension-loading','Find SQLite Extension Loading','Finds SQLite extension-loading calls.','\\bloadExtension\\s*\\(',{scope:'code',kind:'sqlite-extension-load'}),
line('mysql-query-calls','Find MySQL Query Calls','Finds common MySQL-style query/execute call sites for parameterization review.','\\b(?:mysql|pool|connection|conn|db)\\.(?:query|execute)\\s*\\(',{scope:'code',kind:'mysql-query-candidate',heuristic:true}),
line('sql-string-interpolation','Find SQL String Interpolation','Finds candidate SQL template strings containing runtime interpolation.','`\\s*(?:SELECT|INSERT|UPDATE|DELETE|REPLACE)[^`]*\\$\\{',{scope:'code',kind:'sql-interpolation-candidate',heuristic:true}),
line('child-process-exec','Find Shell Exec Calls','Finds Node child-process exec/execSync call sites.','\\b(?:exec|execSync)\\s*\\(',{scope:'code',kind:'child-process-exec'}),
line('child-process-spawn','Find Process Spawn Calls','Finds spawn/spawnSync/execFile call sites for argument-boundary review.','\\b(?:spawn|spawnSync|execFile|execFileSync)\\s*\\(',{scope:'code',kind:'child-process-spawn'}),
line('shell-true','Find Shell-Enabled Spawns','Finds process-launch options enabling shell interpretation.','\\bshell\\s*:\\s*true\\b',{scope:'code',kind:'shell-enabled-process'}),
line('command-string-composition','Find Command String Composition','Finds candidate exec calls whose command text is assembled with interpolation or concatenation.','\\b(?:exec|execSync)\\s*\\([^\\n]*(?:\\$\\{|\\+) ',{scope:'code',kind:'command-composition-candidate',heuristic:true}),
line('wildcard-bindings','Find Wildcard Network Bindings','Finds wildcard listen/bind addresses such as 0.0.0.0 or :: in source/config.','(?:0\\.0\\.0\\.0|[\\\"\\\']::[\\\"\\\'])',{scope:'all',kind:'wildcard-binding'}),
line('lan-addresses','Find Private LAN Addresses','Finds RFC1918 IPv4 literals used in source/config so local network dependencies are visible.','\\b(?:10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3})\\b',{scope:'all',kind:'private-lan-address'}),
line('docker-socket-mounts','Find Docker Socket Mounts','Finds Docker daemon socket references/mounts that can grant host-level container control.','/var/run/docker\\.sock|\\\\\\\\\\.\\\\pipe\\\\docker_engine',{scope:'all',kind:'docker-socket'}),
line('privileged-containers','Find Privileged Containers','Finds container configuration enabling privileged mode.','\\bprivileged\\s*:\\s*true\\b',{scope:'config',kind:'privileged-container'}),
line('host-network-mode','Find Host Network Mode','Finds container/process configuration using host network mode.','network_mode\\s*:\\s*[\\\"\\\']?host\\b|--network(?:=|\\s+)host\\b',{scope:'all',kind:'host-network-mode'}),
line('root-container-user','Find Root Container Users','Finds Docker/container declarations explicitly running as root/UID 0.','(?:^|\\s)USER\\s+root\\b|\\buser\\s*:\\s*[\\\"\\\']?(?:0|root)\\b',{scope:'all',kind:'root-container-user'}),
line('database-port-exposure','Find Database Port Publishing','Finds common database ports published through container/config mappings.','(?:3306|5432|6379)\\s*:\\s*(?:3306|5432|6379)',{scope:'config',kind:'database-port-exposure-candidate',heuristic:true}),
line('cleartext-local-protocols','Find Cleartext Local Protocols','Finds HTTP/WS URLs targeting loopback or private-LAN addresses.','\\b(?:http|ws)://(?:localhost|127\\.0\\.0\\.1|10\\.|192\\.168\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.)',{scope:'all',kind:'cleartext-local-protocol-candidate',heuristic:true}),
line('admin-routes','Find Admin/Internal Routes','Finds route/path literals that look like admin, debug, internal, status, or health surfaces.','[\\\"\\\']/(?:admin|debug|internal|status|healthz?)(?:[/\\\"\\\'])',{scope:'code',kind:'admin-route-candidate',heuristic:true})
];
for(const spec of specs){
  const address=`find-${spec.name}`;
  const scan=await house.listTools({fresh:true});
  if(scan.items.some(x=>x.address===address||x.key===`audit/find/${spec.name}`)){console.log('exists',address);continue;}
  const result=await house.runTool({key:'new-tool',options:{path:`audit/find/${spec.name}`,address,inherit_executor:true,title:spec.title,description:spec.description,settings:folderSetting,meta:spec.meta}});
  console.log(result.result.status,address,result.result.id);
}
