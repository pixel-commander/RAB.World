import { pathToFileURL } from 'node:url';

const main = async () => {
  const [mode, file] = process.argv.slice(2);
  const module = await import(pathToFileURL(file).href);
  if (mode === 'settings') {
    process.stdout.write(JSON.stringify(module.default ?? module.settings));
    return;
  }
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1024 * 1024) throw new Error('Input too large.');
  }
  if (mode !== 'plan' || typeof module.plan !== 'function') throw new Error('Stamp must export plan(input).');
  const plan = await module.plan(JSON.parse(input));
  process.stdout.write(JSON.stringify(plan));
};

main().catch(error => { process.stderr.write(error.message); process.exitCode = 1; });
