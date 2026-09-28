import { appendHistory } from './history.mjs';
import { readFile, readdir, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const toolkit = fileURLToPath(new URL('../', import.meta.url));
const defaultHome = String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab`;
const missing = value => value === undefined || value === null || value === '';
const inside = (root, file) => { const relative = path.relative(root, file); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const field = (name, title) => ({ name, title, type: 'text', required: true });
export const run = async ({ options = {}, context = {} } = {}) => {
  const gaps = [field('world', 'World Name'), field('audit_type', 'Audit Type')].filter(input => missing(options[input.name]));
  if (gaps.length) return { status: 'input-required', missing: gaps, options };
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(options.world)) throw new Error('World must be a simple folder name.');
  const root = await realpath(toolkit);
  const matches = [];
  const scan = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || ['audit-runner', 'node_modules', '.git', 'template'].includes(entry.name)) continue;
      const folder = path.join(dir, entry.name);
      let settings;
      try { settings = JSON.parse(await readFile(path.join(folder, 'settings.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (settings?.type === 'tool' && settings.name === options.audit_type && settings.signal !== false && settings.transmitting !== false) matches.push({ folder, settings });
      await scan(folder);
    }
  };
  await scan(root);
  if (matches.length !== 1) throw new Error(matches.length ? 'Audit type is ambiguous.' : 'Audit type not found.');
  const { folder, settings } = matches[0];
  const supplied = options.options ?? {};
  if (!supplied || Array.isArray(supplied) || typeof supplied !== 'object') throw new Error('options must be an object.');
  const rabHome = context.rab_home ?? defaultHome;
  await readFile(path.join(rabHome, 'worlds', options.world, 'settings.json'), 'utf8');
  const saveFile = options.save_path ?? path.join(rabHome, 'worlds', options.world, 'audits', 'report.json');
  if (typeof saveFile !== 'string' || !saveFile.trim()) throw new Error('save_path must be a report file path.');
  const known = { ...options, ...supplied, world: options.world, save_file: saveFile };
  const bound = {};
  for (const input of settings.settings ?? []) {
    const value = known[input.name] === undefined ? input.default : known[input.name];
    if (value !== undefined) bound[input.name] = value;
  }
  const needed = (settings.settings ?? []).filter(input => input.required && missing(bound[input.name]));
  if (needed.length) return { status: 'input-required', tool: settings.name, missing: needed, options: { ...options, options: bound } };
  const executor = await realpath(path.resolve(folder, settings.path ?? `${settings.name}.mjs`));
  if (!inside(await realpath(folder), executor)) throw new Error('Executor leaves the tool folder.');
  const execution = { id: randomUUID(), tool: settings.name, world: options.world, project_name: options.project_name ?? null, options: bound, start_date: new Date().toISOString(), end_date: null, duration_ms: null, status: 'running', report_file: path.resolve(saveFile), error: null };
  const started = performance.now();
  let result;
  try {
    const tool = await import(pathToFileURL(executor).href);
    if (typeof tool.run !== 'function') throw new Error('Audit tool must export run.');
    result = await tool.run({ options: bound, context: { ...context, rab_home: rabHome } });
    execution.status = 'completed';
  } catch (error) { execution.status = 'failed'; execution.error = { message: error.message, code: error.code ?? null }; }
  finally {
    execution.end_date = new Date().toISOString(); execution.duration_ms = Math.max(0, performance.now() - started);
    const report = { ...(result ?? {}), execution_id: execution.id, world: execution.world, project_name: execution.project_name, options: bound, start_date: execution.start_date, end_date: execution.end_date, duration_ms: execution.duration_ms, status: execution.status, error: execution.error };
    delete report.save_file;
    try {
      await mkdir(path.dirname(saveFile), { recursive: true });
      await writeFile(saveFile, JSON.stringify(report, null, 2) + '\n');
    } catch(error) {
      execution.status='failed';execution.error={message:error.message,code:error.code??null};throw error;
    } finally {
      const errors=[...(result?.errors ?? []),...(execution.error ? [execution.error] : [])];
      await appendHistory(path.join(rabHome,'worlds',options.world,'audits','history.jsonl'),{
        id:execution.id,name:settings.name,world:options.world,options:bound,
        date_start:Date.parse(execution.start_date),date_end:Date.now(),duration_ms:Math.max(0,performance.now()-started),
        status:execution.status==='failed'?'failed':errors.length?'partial':'completed',errors
      });
    }
  }
  context.onExecution?.({...execution,errors:result?.errors??[]});
  return { status: execution.status, result, execution, report_file: path.resolve(saveFile) };
};

export const runBatch=async({jobs,execute,saveRun=async()=>{},onSummary=()=>{}})=>{
 const started=performance.now();const summary={id:randomUUID(),name:'audit-jobs',world:'laptop',date_start:Date.now(),date_end:null,duration_ms:null,success_count:0,fail_count:0,partial_count:0,tools:[...new Set(jobs.map(()=>'folder-scan'))],options:{paths:jobs.map(job=>job.folder)},errors:[]};
 onSummary(summary);
 try{for(const job of jobs){
  if(job.status!=='pending')continue;job.status='running';job.date_start=Date.now();
  try{const result=await execute(job,stats=>{job.stats={...job.stats,...stats};},execution=>{(job.executions??=[]).push(execution);});
   if(result?.status==='input-required'){job.status='input-required';job.missing=result.missing;break;}
   job.status=result?.errors?.length?'partial':'completed';job.errors=result?.errors??[];
  }catch(error){job.status='failed';job.errors=[{message:error.message}];}
  finally{job.error_count=(job.errors??[]).length;job.date_end=Date.now();job.duration_ms=job.date_end-job.date_start;}
  summary.success_count=jobs.filter(job=>job.status==='completed').length;summary.fail_count=jobs.filter(job=>job.status==='failed').length;summary.partial_count=jobs.filter(job=>job.status==='partial').length;
 }}finally{
  summary.steps=jobs.map(job=>({id:job.id,path:job.path??job.folder,name:job.action,status:job.status,date_start:job.date_start??null,date_end:job.date_end??null,duration_ms:job.duration_ms??0,error_count:job.error_count??0,stats:job.stats??{},errors:job.errors??[],tools:(job.executions??[]).map(execution=>({id:execution.id,name:execution.tool,status:execution.status,date_start:Date.parse(execution.start_date),date_end:Date.parse(execution.end_date),duration_ms:execution.duration_ms,options:execution.options,errors:execution.errors,error:execution.error}))}));
  summary.date_end=Date.now();summary.duration_ms=performance.now()-started;summary.errors=jobs.flatMap(job=>job.errors??[]);
  summary.status=jobs.some(job=>job.status==='input-required')?'input-required':summary.fail_count?'failed':summary.partial_count?'partial':'completed';
  try{await saveRun(summary);}catch(error){summary.error=error.message;}
 }
 return summary;
};
