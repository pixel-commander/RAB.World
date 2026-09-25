import { readFile, writeFile } from 'node:fs/promises';
import { createAuditOutputGuide } from '../tools/audit/_output-shapes.mjs';

const file=new URL('../magic-box/index.html',import.meta.url);
const html=await readFile(file,'utf8');
const start=html.indexOf('const auditOutputGuide = ');
const end=html.indexOf('const renderToolboxOutputShape = ',start);
if (start < 0 || end < 0) throw new Error('Toolbox output-guide insertion points are missing.');
const next=html.slice(0,start)+`const auditOutputGuide = (${createAuditOutputGuide.toString()})();\n`+html.slice(end);
if (process.argv.includes('--check')) {
  if (next !== html) throw new Error('Run node scripts/sync-toolbox-output-shapes.mjs to update the embedded Toolbox guide.');
} else if (next !== html) await writeFile(file,next);
