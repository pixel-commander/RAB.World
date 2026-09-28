import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir, open, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
const schemaVersion = 3;
const local = value => {
  if (/^(?:\\\\|\/\/)/.test(value)) throw new Error('Create SQLite on a local drive, not a network share. Run this scaffold on the database host.');
};
const inventory = db => db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
export const run = async ({ options = {}, context = {} } = {}) => {
  const world = options.world;
  if (typeof world !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(world)) throw new Error('A world folder name is required.');
  const rabHome = context.rab_home ?? path.join(homedir(), '.rab');
  await readFile(path.join(rabHome, 'worlds', world, 'settings.json'), 'utf8');
  if (options.path !== undefined && (typeof options.path !== 'string' || !options.path.trim())) throw new Error('path must be a destination folder.');
  const directory = path.resolve(options.path ?? path.join(rabHome, 'worlds', world, 'audits'));
  local(directory);
  await mkdir(directory, { recursive: true });
  local(await realpath(directory));
  const file = path.join(directory, 'audits.sqlite');
  const schema = await readFile(new URL('./template/schema.sql', import.meta.url), 'utf8');
  let created = false;
  try { const handle = await open(file, 'wx'); await handle.close(); created = true; }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  local(await realpath(file));
  const db = new DatabaseSync(file, { readOnly: !created });
  try {
    if (created) {
      db.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE;');
      try {
        db.exec(schema);
        db.prepare('INSERT INTO audit_meta(key,value) VALUES (?,?)').run('world', world);
        db.prepare('INSERT INTO audit_meta(key,value) VALUES (?,?)').run('date_added', String(Date.now()));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    if (db.prepare('PRAGMA user_version').get().user_version !== schemaVersion) throw new Error('Existing database has an unsupported schema version; no changes made.');
    const expected = new DatabaseSync(':memory:');
    try {
      expected.exec(schema);
      if (JSON.stringify(inventory(db)) !== JSON.stringify(inventory(expected))) throw new Error('Existing database schema does not match this scaffold; no changes made.');
    } finally { expected.close(); }
    if (db.prepare("SELECT value FROM audit_meta WHERE key='world'").get()?.value !== world) throw new Error('Database belongs to a different world; no changes made.');
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Database integrity check failed.');
    return { status: created ? 'created' : 'existing', world, path: file, schema_version: schemaVersion, tables: ['audit_meta', 'runs', 'folders', 'run_folders'] };
  } finally { db.close(); }
};
