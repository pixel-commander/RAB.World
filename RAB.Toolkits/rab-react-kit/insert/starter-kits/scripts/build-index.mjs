// build-index.mjs — walks components/ and pages/, writes app-manifest.json.
// Presence is registration: a folder holding <name>.html is a member; a
// demo/demo.html lands it in the style guide; a js/<name>.js is its module.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEATS = new Set(['css', 'js', 'demo', 'hooks']);

const entry = (dir, rel) => {
  const name = path.basename(dir);
  if (!fs.existsSync(path.join(dir, `${name}.html`))) {
    return [];
  }
  const record = {
    path: rel,
    name,
    js: fs.existsSync(path.join(dir, 'js', `${name}.js`)),
    demo: fs.existsSync(path.join(dir, 'demo', 'demo.html')),
  };
  const children = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SEATS.has(e.name))
    .flatMap((e) => entry(path.join(dir, e.name), `${rel}/${e.name}`));
  return [record, ...children];
};

const walk = (kind) => {
  const base = path.join(ROOT, kind);
  if (!fs.existsSync(base)) {
    return [];
  }
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => entry(path.join(base, e.name), e.name));
};

const manifest = { components: walk('components'), pages: walk('pages') };
fs.writeFileSync(
  path.join(ROOT, 'app-manifest.json'),
  JSON.stringify(manifest, null, 2),
);
console.log(
  `build-index -> app-manifest.json (${manifest.components.length} components, ${manifest.pages.length} pages)`,
);
