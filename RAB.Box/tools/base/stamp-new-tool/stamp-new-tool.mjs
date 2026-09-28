import { cp, mkdir, readFile, writeFile, rm, lstat, access } from 'node:fs/promises';
import path from 'node:path';


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
  if(typeof options.path!=='string'||!options.path.trim()||!safeAddress(options.name))throw Object.assign(new Error('Provide destination path and a lowercase hyphenated name.'),{code:'INPUT_REQUIRED'});
  const name=options.name;
  const parent=path.resolve(root,options.path);
  const target=path.join(parent,name);
  if(!(await lstat(parent)).isDirectory())throw new Error('Destination path must be an existing folder.');
  if(name.startsWith('stamp-'))throw new Error('Non-Stamp Tool names must not use a stamp- prefix.');
  if(await exists(target))throw Object.assign(new Error(`Tool already exists: ${target}`),{code:'ALREADY_EXISTS'});
  const toolsRoot=path.resolve(root,'tools');
  const relative=path.relative(toolsRoot,target);
  const inHouse=relative!== '..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);
  const relativeToolPath=inHouse?relative.split(path.sep).join('/'):target;
  const type=options.type??options.meta?.domain;
  let executor=path.join(target,`${name}.mjs`);
  if(options.inherit_executor===true){
    let current=parent;executor=null;
    while(true){const candidate=path.join(current,path.basename(current)+'.mjs');if(await exists(candidate)){executor=candidate;break;}const next=path.dirname(current);if(next===current)break;current=next;}
    if(!executor)throw new Error('No parent executor found.');
  }
  const address=options.address??name;
  if(!safeAddress(address))throw new Error('Invalid House address.');
  const pathsFile=path.join(root,'PATHS.json');
  let manifest=null;
  if(inHouse&&await exists(pathsFile)){manifest=JSON.parse(await readFile(pathsFile,'utf8'));if(manifest.tools?.[address])throw new Error(`PATHS address already exists: ${address}`);}
  const id=Date.now();
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

  let registered=false;
  if(manifest){manifest.tools??={};manifest.tools[address]={id,path:relativeToolPath};await writeFile(pathsFile,JSON.stringify(manifest,null,2)+'\n');registered=true;}
  return {status:'created',id,name,type,address,path:target,settings,registered,inherited_executor:options.inherit_executor===true,check:{executor,exists:await exists(executor)}};
};
