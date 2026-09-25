import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [command, ...args] = process.argv.slice(2);
const parsed = {};
for (let i=0; i<args.length; i+=2) {
  if (!/^--[a-z_]+$/.test(args[i]) || args[i+1] === undefined || args[i+1].startsWith('--')) throw new Error('Use --name value pairs.');
  const key = args[i].slice(2);
  if (Object.hasOwn(parsed,key)) throw new Error('Duplicate option: '+key);
  parsed[key]=args[i+1];
}
const allowed=command==='session'?['box','folder','original_source','title','source_access']:command==='round'?['box','session','title','focus']:command==='capture'?['box','session','action','round','reason','source_turns','renames']:null;
if (!allowed || Object.keys(parsed).some(key=>!allowed.includes(key)) || !parsed.box || !path.isAbsolute(parsed.box)) throw new Error('Use session, round or capture with --box <absolute Box folder> and the documented inputs.');
const {box, ...options}=parsed;
for(const key of ['source_turns','renames'])if(options[key]!==undefined)options[key]=JSON.parse(options[key]);
const {createToolHouse}=await import(pathToFileURL(path.join(box,'bridge','tool-house.mjs')).href);
const here=path.dirname(fileURLToPath(import.meta.url));
const house=createToolHouse({root:box,toolsRoot:path.resolve(here,'../../..')});
const key='model-kit/training/code-reviews'+(command==='round'?'/new-training-round':command==='capture'?'/capture-change':'');
try { const output=await house.runTool({key,options}); console.log(JSON.stringify(output.result,null,2)); }
catch(error) { console.error(JSON.stringify({code:error.code??'ERROR',message:error.message,details:error.details},null,2)); process.exitCode=1; }
