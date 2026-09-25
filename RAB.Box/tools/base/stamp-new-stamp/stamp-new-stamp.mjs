import { cp, mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';

const slug = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
const replaceAll = (text, values) => Object.entries(values).reduce((out,[key,value]) => out.replaceAll(`__${key}__`, String(value)), text);

export const run = async ({ options, root, tool, helpers }) => {
  const type = slug(options.type);
  const domainRoot = path.join(root, 'tools', type);
  try { const stat = await lstat(domainRoot); if (!stat.isDirectory()) throw new Error(); }
  catch { throw Object.assign(new Error(`Unknown Tool type: ${type}`), { code:'UNKNOWN_TOOL_TYPE' }); }
  let name = slug(options.name);
  if (!name.startsWith('stamp-')) name = `stamp-${name.replace(/^new-/, 'new-')}`;
  const target = path.join(root, 'tools', type, name);
  const source = path.join(tool.root, 'template');
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, errorOnExist: true, force: false });

  const tmpl = path.join(target, 'tmpl.mjs');
  const script = path.join(target, `${name}.mjs`);
  const scriptText = replaceAll(await readFile(tmpl, 'utf8'), { STAMP_NAME:name, STAMP_TITLE:options.title, STAMP_DESCRIPTION:options.description });
  await writeFile(script, scriptText, { flag:'wx' });
  await import('node:fs/promises').then(({rm}) => rm(tmpl));

  const settingsFile = path.join(target, 'settings.json');
  const stampSettings = JSON.parse(await readFile(settingsFile, 'utf8'));
  stampSettings.id = Date.now();
  stampSettings.name = name;
  stampSettings.title = options.title;
  stampSettings.description = options.description;
  stampSettings.settings = Array.isArray(options.settings) ? options.settings : [];
  stampSettings.meta = options.meta && typeof options.meta === 'object' && !Array.isArray(options.meta) ? options.meta : {};
  await writeFile(settingsFile, JSON.stringify(stampSettings, null, 2) + '\n');
  const refreshed = await helpers.listTools({ domain:type, fresh:true });
  const visible = refreshed.items.find(item => item.key === `${type}/${name}`) ?? null;
  let relation = null, relationError = null;
  if (visible) {
    try { relation = await helpers.findTools({ query:visible.description, domain:type, includeStamps:true }); }
    catch (error) { relationError = { code:error.code ?? 'CHECK_FAILED', message:error.message }; }
  }
  const selfRank = relation ? relation.items.findIndex(item => item.key === `${type}/${name}`) : -1;
  return { status:'created', type, name, path:path.relative(root,target).replaceAll('\\','/'), settings:stampSettings,
    check:{ visible:Boolean(visible), key:visible?.key??null, rank:selfRank>=0?selfRank+1:null, request_shape:relation?.request_shape??null, relation_error:relationError } };
};
