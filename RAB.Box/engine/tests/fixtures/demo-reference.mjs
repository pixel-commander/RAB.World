import { mkdtemp, cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createMagicBox } from './runtime-reference.mjs';

const main = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rraabbiitt-demo-'));
  const examples = fileURLToPath(new URL('../../examples/', import.meta.url));
  for (const name of ['project-a', 'project-b']) await cp(path.join(examples, name), path.join(directory, name), { recursive: true });
  const receipts = path.join(directory, 'receipts');
  await mkdir(receipts);
  let id = Date.now();
  const runClock = () => {
    const now = Date.now();
    if (now === id) throw new Error('Demo timestamp collision; rerun rather than salt the ID.');
    id = now;
    return now;
  };
  const a = createMagicBox({ projectRoot: path.join(directory, 'project-a'), allowWrites: true, clock: runClock });
  const b = createMagicBox({ projectRoot: path.join(directory, 'project-b'), allowWrites: true, clock: runClock });
  const show = async (name, result) => {
    if (!['input-required', 'ready', 'completed'].includes(result.status)) throw new Error(JSON.stringify(result));
    console.log(`\n${name}: ${result.status}`);
    for (const frame of result.frames ?? []) console.log(`  ${frame.capability}: ${JSON.stringify(frame.options)}`);
    for (const q of result.questions ?? []) console.log(`  needs ${q.stamp}.${q.key}${q.returnTo ? ` → return to ${q.returnTo.stamp}.${q.returnTo.key}` : ''}`);
    for (const step of result.receipt?.steps ?? []) console.log(`  verified ${step.capability}: ${step.files.length} files → ${step.destination}`);
    await writeFile(path.join(receipts, `${name}.json`), JSON.stringify(result, null, 2) + '\n');
  };
  console.log('MAGIC BOX v0.2 — actual offline execution in a temporary demo workspace');
  console.log(directory);
  const text = 'stamp a new react project named "test-project" into the current project folder';
  const first = await a.prepare(text);
  await show('01-project-a-pending', first);
  const ready = await a.answerText(first.ticket, 'app');
  await show('02-project-a-resolved', ready);
  await show('03-project-a-executed', await a.execute(ready.ticket));
  const other = await b.prepare(text);
  await show('04-project-b-extra-requirements', other);
  const otherReady = await b.answerText(other.ticket, 'type app theme dark');
  await show('05-project-b-executed', await b.execute(otherReady.ticket));
  const div = await a.prepare('make a div with class x');
  await show('06-div-waits-for-atom', div);
  const divReady = await a.answerText(div.ticket, '--surface-main');
  await show('07-atom-then-div-executed', await a.execute(divReady.ticket));
  const component = await a.prepare('make a component named "DatePicker" with class "container-main"');
  await show('08-existing-class-no-new-atom', await a.execute(component.ticket));
  console.log(`\nFull request/answer/receipt records: ${receipts}`);
  console.log('No cloud calls. No package install. No writes to your existing project.');
  console.log('Generated React npm dependencies are not installed by this demo.');
};

main().catch(error => { console.error(error); process.exitCode = 1; });
