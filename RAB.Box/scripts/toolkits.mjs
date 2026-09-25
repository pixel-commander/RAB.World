import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { updateToolkitLink } from '../bridge/toolkit-links.mjs';

const args=process.argv.slice(2), command=args.shift();
const rootIndex=args.indexOf('--root');
const root=rootIndex<0?path.dirname(path.dirname(fileURLToPath(import.meta.url))):path.resolve(args.splice(rootIndex,2)[1]);
try {
  if (!['list','link','disable','unlink'].includes(command) || args.length !== (command==='list'?0:1)) throw new Error('Usage: node scripts/toolkits.mjs list|link|disable|unlink [absolute-folder] [--root box-folder]');
  if (command!=='list') await updateToolkitLink({root,directory:args[0],remove:command==='unlink',enabled:command!=='disable'});
  const catalog=await createToolHouse({root}).listTools({fresh:true});
  console.log(JSON.stringify({toolkits:catalog.toolkits,tools:catalog.items.filter(tool=>tool.toolkit).map(tool=>({id:tool.id,path:tool.path,title:tool.title,toolkit:tool.toolkit.id})),unavailable:catalog.unavailable},null,2));
  if(catalog.unavailable.length)process.exitCode=1;
} catch (error) { console.error(JSON.stringify({code:error.code??'ERROR',message:error.message})); process.exitCode=1; }
