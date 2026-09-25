import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stderr as output } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunner, createToolWorkbench } from './index.mjs';
import { loadProject } from './src/project.mjs';

const help = `Tool House runner\n\nnode engine/cli.mjs --project PATH --inspect\nnode engine/cli.mjs --project PATH --canonical request.json [--ask] [--execute]\nnode engine/cli.mjs --project PATH --resume ticket.json [--reply VALUE] [--execute]\n\nRequests: {"mode":"command","capability":"react/stamp-new-component","options":{...}}\nProject must contain PATHS.json. Text requests belong in session Turns.\n--execute is required for execution. --ticket-out and --result-out never overwrite.\n--rab-home PATH selects local tracking storage.\n`;

const main = async () => {
  const flags = new Set(['--ask', '--execute', '--inspect', '--help']);
  const valued = new Set(['--project', '--rab-home', '--canonical', '--resume', '--reply', '--answers', '--ticket-out', '--result-out']);
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (Object.hasOwn(args, key)) throw new Error(`Repeated argument ${key}.`);
    if (flags.has(key)) args[key] = true;
    else if (valued.has(key) && process.argv[i + 1] !== undefined) args[key] = process.argv[++i];
    else throw new Error(`Unknown or incomplete argument ${key}.`);
  }
  if (args['--help'] || !args['--project']) { console.log(help); return; }
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const project=await loadProject(path.resolve(args['--project']));
  const context={rab_home:args['--rab-home'],project:{id:project.id,name:project.manifest.project.name??project.id,root:project.root}};
  const box=createToolWorkbench({toolHouse:createRunner({root}),project,context});
  if (args['--inspect']) { console.log(JSON.stringify(await box.inspect(), null, 2)); return; }
  if (['--canonical', '--resume'].filter(key => args[key] !== undefined).length !== 1) throw new Error('Choose exactly one of --canonical or --resume.');
  if (!args['--resume'] && (args['--reply'] || args['--answers'])) throw new Error('--reply/--answers requires --resume.');
  if (args['--reply'] && args['--answers']) throw new Error('Choose either --reply or --answers.');
  let result;
  if (args['--resume']) {
    const ticket = JSON.parse(await readFile(args['--resume'], 'utf8'));
    if (args['--answers']) result = await box.answer(ticket, JSON.parse(await readFile(args['--answers'], 'utf8')));
    else if (args['--reply']) result = await box.answerText(ticket, args['--reply'], ticket.questions?.length===1 ? {stamp:ticket.questions[0].stamp,key:ticket.questions[0].key} : {});
    else result = await box.resume(ticket);
  } else result = await box.prepare(JSON.parse(await readFile(args['--canonical'], 'utf8')));
  if (args['--ask']) {
    const terminal = createInterface({ input, output });
    try {
      while (result.status === 'input-required') {
        const q = result.questions[0];
        output.write(`\n${q.stamp}.${q.key}\n${q.question}\n${q.choices ? `Choices: ${q.choices.join(', ')}\n` : ''}`);
        const text = await terminal.question('Value (or /stop): ');
        if (text.trim() === '/stop') break;
        const next = await box.answerText(result.ticket, text, { stamp: q.stamp, key: q.key });
        if (['invalid-input', 'unsupported-language', 'ambiguous', 'conflict'].includes(next.status)) {
          output.write(`${next.message}\n`);
          continue;
        }
        result = next;
      }
    } finally { terminal.close(); }
  }
  if (args['--ticket-out'] && result.ticket) await writeFile(args['--ticket-out'], JSON.stringify(result.ticket, null, 2) + '\n', { flag: 'wx' });
  if (args['--execute'] && result.status === 'ready') result = await box.execute(result.ticket);
  if (args['--result-out']) await writeFile(args['--result-out'], JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
  if (!['ready', 'input-required', 'query-result', 'completed'].includes(result.status)) process.exitCode = 1;
};

main().catch(error => { console.error(error.message); process.exitCode = 1; });
