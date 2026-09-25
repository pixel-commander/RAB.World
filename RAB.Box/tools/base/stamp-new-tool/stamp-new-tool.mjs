import { cp, mkdir, readFile, writeFile, rm, lstat, access } from 'node:fs/promises';
import path from 'node:path';
import { createRabMemory } from '../../../bridge/rab-memory.mjs';

const slug = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
const safeAddress = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value ?? ''));
const replaceAll = (text, values) => Object.entries(values).reduce((out,[k,v]) => out.replaceAll(`__${k}__`,String(v)),text);
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const semanticPath = value => {
  const raw = String(value ?? '').trim().replaceAll('\\','/').replace(/^tools\//,'').replace(/^\/+|\/+$/g,'');
  const parts = raw.split('/').filter(Boolean).map(slug);
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..')) return null;
  return parts;
};

export const run = async ({ options, root, tool, helpers, context={} }) => {
  const requested = semanticPath(options.path);
  const type = requested?.[0] ?? slug(options.type);
  const name = requested?.at(-1) ?? slug(options.name);
  const parts = requested ?? (type && name ? [type,name] : null);
  if (!parts || !type || !name) throw Object.assign(new Error('Provide semantic path or both type and name.'),{code:'INPUT_REQUIRED'});

  const domainRoot = path.join(root,'tools',type);
  try { const stat = await lstat(domainRoot); if (!stat.isDirectory()) throw new Error(); }
  catch { throw Object.assign(new Error(`Unknown Tool type: ${type}`),{code:'UNKNOWN_TOOL_TYPE'}); }
  if (name.startsWith('stamp-')) throw Object.assign(new Error('Non-Stamp Tool names must not use a stamp- prefix.'),{code:'BAD_REQUEST'});

  const relativeToolPath = parts.join('/');
  const target = path.join(root,'tools',...parts);
  const toolsRoot = path.join(root,'tools');
  if (!target.startsWith(toolsRoot + path.sep)) throw Object.assign(new Error('Tool path escapes tools root.'),{code:'BAD_REQUEST'});
  if (await exists(target)) throw Object.assign(new Error(`Tool already exists: ${relativeToolPath}`),{code:'ALREADY_EXISTS'});

  const before = await helpers.listTools({fresh:true});
  const ids = before.items.map(item=>Number(item.id)).filter(Number.isSafeInteger);
  const memory=createRabMemory({rabHome:context.rab_home});
  await memory.allocateId();
  if(ids.length)await memory.enrollId(Math.max(...ids));
  const id=await memory.allocateId();
  const source = path.join(tool.root,'template');
  await mkdir(path.dirname(target),{recursive:true});
  await cp(source,target,{recursive:true,errorOnExist:true,force:false});

  const tmpl = path.join(target,'tmpl.mjs');
  if (options.inherit_executor === true) {
    await rm(tmpl,{force:true});
  } else {
    const script = path.join(target,`${name}.mjs`);
    await writeFile(script,replaceAll(await readFile(tmpl,'utf8'),{TOOL_NAME:name,TOOL_TITLE:options.title,TOOL_DESCRIPTION:options.description}),{flag:'wx'});
    await rm(tmpl);
  }

  const file = path.join(target,'settings.json');
  const settings = JSON.parse(await readFile(file,'utf8'));
  Object.assign(settings,{
    id,
    name,
    title:options.title,
    description:options.description,
    settings:Array.isArray(options.settings)?options.settings:[],
    meta:options.meta&&typeof options.meta==='object'&&!Array.isArray(options.meta)?options.meta:{}
  });
  await writeFile(file,JSON.stringify(settings,null,2)+'\n');

  const refreshed = await helpers.listTools({domain:type,fresh:true});
  const visible = refreshed.items.find(item=>item.key===relativeToolPath) ?? null;
  if (!visible) {
    const unavailable = refreshed.unavailable.find(item=>item.key===relativeToolPath) ?? null;
    await rm(target,{recursive:true,force:true});
    throw Object.assign(new Error(unavailable?.message ?? `New Tool is not executable: ${relativeToolPath}`),{code:unavailable?.code ?? 'BAD_TOOL'});
  }

  const defaultAddress = parts.length > 1 ? parts.slice(1).join('-') : name;
  const address = slug(options.address || defaultAddress);
  if (!safeAddress(address)) throw Object.assign(new Error(`Invalid PATHS address: ${address}`),{code:'BAD_REQUEST'});

  let registered = false;
  const pathsFile = path.join(root,'PATHS.json');
  if (await exists(pathsFile)) {
    const manifest = JSON.parse(await readFile(pathsFile,'utf8'));
    manifest.tools ??= {};
    const prior = manifest.tools[address] ?? null;
    if (prior && (Number(prior.id)!==id || prior.path!==relativeToolPath)) {
      await rm(target,{recursive:true,force:true});
      throw Object.assign(new Error(`PATHS address already exists: ${address}`),{code:'PATH_EXISTS'});
    }
    manifest.tools[address] = {id,path:relativeToolPath};
    await writeFile(pathsFile,JSON.stringify(manifest,null,2)+'\n');
    registered = true;
  }

  let relation=null, relationError=null;
  try { relation=await helpers.findTools({query:visible.description,domain:type,includeStamps:true}); }
  catch(error){ relationError={code:error.code??'CHECK_FAILED',message:error.message}; }
  const selfRank=relation?relation.items.findIndex(item=>item.key===relativeToolPath):-1;

  return {
    status:'created',
    type,
    name,
    address,
    id,
    path:relativeToolPath,
    settings,
    inherited_executor:Boolean(visible.inheritedExecutor),
    registered,
    check:{visible:true,key:visible.key,rank:selfRank>=0?selfRank+1:null,request_shape:relation?.request_shape??null,relation_error:relationError}
  };
};
