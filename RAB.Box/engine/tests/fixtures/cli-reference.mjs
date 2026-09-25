import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stderr as output } from 'node:process';
import { createMagicBox } from './runtime-reference.mjs';

const help = `Magic Box / project-local stamps v0.2

node cli.mjs --project examples/project-a --text "stamp a new react project named test-project into the current project folder" --ask
node cli.mjs --project examples/project-a --text "make div with class x" --ask --execute
node cli.mjs --project examples/project-a --inspect

Inputs: --text STRING | --canonical FILE | --resume TICKET_FILE
Resume: --reply STRING | --answers ANSWER_JSON_FILE | --ask
Outputs: --ticket-out FILE | --result-out FILE (create only; no overwrite)
Authority: --execute permits trusted project stamp scripts and validated mutation writes.
Settings: --trust-js-settings allows executable settings.js/.mjs/.cjs.
Without --execute, mutation plans never write. --inspect only discovers metadata.
JSON settings are the default. The selected project must contain PATHS.json.
`;

const main = async () => {
  const flags = new Set(['--ask', '--execute', '--inspect', '--trust-js-settings', '--help']);
  const valued = new Set(['--project', '--text', '--canonical', '--resume', '--reply', '--answers', '--ticket-out', '--result-out']);
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (Object.hasOwn(args, key)) throw new Error(`Repeated argument ${key}.`);
    if (flags.has(key)) args[key] = true;
    else if (valued.has(key) && process.argv[i + 1] !== undefined) args[key] = process.argv[++i];
    else throw new Error(`Unknown or incomplete argument ${key}.`);
  }
  if (args['--help'] || !args['--project']) { console.log(help); return; }
  const box = createMagicBox({ projectRoot: args['--project'], allowWrites: args['--execute'] === true, allowExecutableSettings: args['--trust-js-settings'] === true });
  if (args['--inspect']) { console.log(JSON.stringify(await box.inspect(), null, 2)); return; }
  if (['--text', '--canonical', '--resume'].filter(key => args[key] !== undefined).length !== 1) throw new Error('Choose exactly one of --text, --canonical, or --resume.');
  if (!args['--resume'] && (args['--reply'] || args['--answers'])) throw new Error('--reply/--answers requires --resume.');
  if (args['--reply'] && args['--answers']) throw new Error('Choose either --reply or --answers.');
  let result;
  if (args['--resume']) {
    const ticket = JSON.parse(await readFile(args['--resume'], 'utf8'));
    if (args['--answers']) result = await box.answer(ticket, JSON.parse(await readFile(args['--answers'], 'utf8')));
    else if (args['--reply']) result = await box.answerText(ticket, args['--reply']);
    else result = await box.resume(ticket);
  } else result = await box.prepare(args['--canonical'] ? JSON.parse(await readFile(args['--canonical'], 'utf8')) : args['--text']);
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
