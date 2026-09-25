import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { absolute, separate, readJson, fail, text, materialize } from '../_review.mjs';
export const run = async ({ options, tool, helpers }) => {
  const session = await absolute(options.session, 'Session folder', true);
  separate(path.resolve(tool.root, '..'), session);
  const settings = await readJson(path.join(session, 'settings.json'));
  if (settings.schema_version !== 1 || settings.kind !== 'code-review-session' || !Number.isSafeInteger(settings.id) || settings.id <= 0 || settings.rounds?.path !== 'rounds' || settings.rounds?.number_padding !== 3 || settings.rounds?.first_number !== 1 || settings.rounds?.folder_pattern !== 'round-NNN' || settings.original_source?.access !== 'read-only') fail('INVALID_SESSION', 'Expected a version 1 code-review session with the standard rounds contract.');
  if (typeof settings.original_source.path !== 'string' || !path.isAbsolute(settings.original_source.path)) fail('INVALID_SESSION', 'Original source reference must be an absolute path.');
  separate(path.resolve(settings.original_source.path), session);
  // The external original is reference-only. Adding a round never opens it.
  const rounds = await absolute(path.join(session, 'rounds'), 'Rounds folder', true);
  let maximum = 0;
  for (const entry of await readdir(rounds, { withFileTypes: true })) {
    if (!entry.name.startsWith('round-')) continue;
    const match = /^round-(\d{3,})$/.exec(entry.name);
    const number = match ? Number(match[1]) : NaN;
    if (!entry.isDirectory() || entry.isSymbolicLink() || !Number.isSafeInteger(number) || number < 1 || entry.name !== 'round-' + String(number).padStart(3, '0')) fail('INVALID_ROUND', 'Invalid existing round entry: ' + entry.name);
    maximum = Math.max(maximum, number);
  }
  const number = maximum + 1;
  if (!Number.isSafeInteger(number)) fail('INVALID_ROUND', 'Round number exceeds the supported range.');
  const name = 'round-' + String(number).padStart(3, '0');
  const title = text(options.title ?? name, 'Title');
  const focus = text(options.focus ?? '', 'Focus', true);
  const folder = path.join(rounds, name);
  return materialize({tool, helpers, destination: folder, allowedRoot: rounds,
    values: { ROUND_NAME: name, ROUND_TITLE: title, ROUND_FOCUS: focus },
    enrich: record => ({...record, session_id: settings.id, number, created_at: new Date().toISOString()}) });
};
