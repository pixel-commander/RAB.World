import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createMagicBox } from './fixtures/runtime-reference.mjs';

export const fixtures = fileURLToPath(new URL('../examples/', import.meta.url));
let time = 1789385000000;
export const clock = () => ++time;
export const fixture = async (t, variant = 'a', config = {}) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rraabbiitt-test-'));
  const root = path.join(temp, 'house');
  await cp(path.join(fixtures, `project-${variant}`), root, { recursive: true });
  t.after(() => rm(temp, { recursive: true, force: true }));
  return { root, temp, box: createMagicBox({ projectRoot: root, clock, ...config }) };
};
export const json = async file => JSON.parse(await readFile(file, 'utf8'));
export const update = async (file, change) => {
  const data = await json(file);
  await writeFile(file, JSON.stringify(change(data) ?? data, null, 2));
};
export const sentence = 'stamp a new react project named "test-project" into the current project folder';
export const readySentence = `${sentence} type app`;
export const respond = (prepared, stamp, values) => ({ request_id: prepared.ticket.id, stamp, values });
