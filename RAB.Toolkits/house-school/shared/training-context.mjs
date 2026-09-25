// Context variation is synthetic rehearsal, not a claim of new rule families.
const domains = ['dialog', 'menu', 'canvas', 'editor', 'list', 'gallery', 'calendar', 'table', 'picker', 'panel'];
export const contextualize = (files, index, heldOut = false) => {
  const domain = domains[index % domains.length];
  const data = {
    title: `${heldOut ? 'Archive' : 'Workspace'} ${domain} ${index + 1}`,
    items: Array.from({ length: 1 + index % 4 }, (_, at) => ({ label: `${domain} entry ${index + at + 1}` })),
    selected: index % 3 === 0 ? undefined : `${domain}-${index % 7}`,
    options: { multiple: Boolean(index % 2), limit: 1 + index % 11 },
  };
  const suffix = `\n// fixtureData: unrelated exported data; preserve its keys and values.\nexport const fixtureData = ${JSON.stringify(data, null, 2)};\n`;
  return files.map((file) => file.path === 'mechanics.mjs' ? { ...file, text: file.text + suffix } : file);
};
