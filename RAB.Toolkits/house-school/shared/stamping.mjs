import { fileURLToPath } from 'node:url';
import { stamp } from '../runtime.mjs';

const template = (name) => fileURLToPath(new URL(`../templates/${name}/`, import.meta.url));
export const renderSpecimen = async (family, flags, packaging, variant = 'original') => {
  const parameters = `/**\n * @param {import('./HouseKeys.types').Bag | null} [props]\n${family.name === 'selection-ownership' ? " * @param {[import('./HouseKeys.types').Selection, import('./HouseKeys.types').SelectionSetter]} [internal_selected]\n" : ''} */\n`;
  const files = await stamp.renderTemplateTree(template('mechanics'), {
    CONTRACT: family.contract, SOURCE: parameters + (variant === 'alternate' ? family.renderAlternate(flags) : family.render(flags)),
  });
  if (packaging === 'component') {
    const body = family.name === 'collections'
      ? '  const labels = readLabels(props);\n  return <section className="fixture">{labels?.map((label, index) => <span key={index}>{label}</span>)}</section>;'
      : family.name === 'selection-ownership'
        ? '  const internal_selected = useState<string>();\n  const bag = packBag(props, internal_selected);\n  return <Next {...bag} />;'
        : '  const bag = packBag(props);\n  return <Next {...bag} />;';
    const parts = await stamp.renderTemplateTree(template('parts'));
    files.push(...await stamp.renderTemplateTree(template('component'), {
      ENTRY: family.entry, BODY: body,
      HOOK_IMPORT: family.name === 'selection-ownership' ? "import { useState } from 'react';" : '',
      NEXT: family.name === 'collections' ? '' : parts.find((file) => file.path === 'next.txt').text,
    }));
  }
  return files;
};
export const bundle = (files) => files.map((file) => `FILE: ${file.path}\n${file.text}`).join('\n');
