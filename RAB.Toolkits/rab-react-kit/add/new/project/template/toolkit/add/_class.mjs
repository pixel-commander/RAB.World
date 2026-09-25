import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createSignalSettings } from './_signal.mjs';

export const scaffoldClass = async (kind, { options, helpers, context }) => {
  const fail = message => { throw Object.assign(new Error(message), { code: 'BAD_INPUT' }); };
  if (!['container', 'action', 'effect', 'grid'].includes(kind)) fail('Unknown class kind.');
  const { name, location } = options;
  if (typeof name !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
    fail('name must be a lowercase kebab-case suffix.');
  if (typeof location !== 'string' || !path.isAbsolute(location)
      || (process.platform === 'win32' && !/^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(location)))
    fail('location must be an absolute folder path.');
  const template = new URL(`./${kind}-class/template/${kind}-[name].css`, import.meta.url);
  const text = (await readFile(template, 'utf8')).replaceAll('[name]', name);
  const filename = `${kind}-${name}.css`;
  const destination = path.resolve(location, `${kind}-${name}`);
  const settings = await createSignalSettings({templateUrl:new URL(`./${kind}-class/template/settings.json`,import.meta.url),
    folder:destination,options,context,helpers,values:{name,title:name,type:'style'}});
  const verification = await helpers.writeArtifactPlan({ destination, allowedRoot: path.resolve(location),
    files: [{ path: filename, text },{path:'settings.json',text:JSON.stringify(settings,null,2)+'\n'}] });
  return { status: 'created', name, class_name: `${kind}-${name}`,
    id:settings.id,settings,folder:destination,file: path.join(destination, filename), verification };
};
