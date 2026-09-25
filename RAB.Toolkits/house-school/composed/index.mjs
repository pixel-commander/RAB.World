import { normalize, hash } from './core.mjs';
import { atoms } from './features/atoms.mjs';
import { handlers } from './features/handlers.mjs';
import { bags } from './features/bags.mjs';
import { loops } from './features/loops.mjs';
import { grids } from './features/grids.mjs';
import { markup } from './features/markup.mjs';
import { conventions } from './features/conventions.mjs';
import { packingOrder } from './features/packing-order.mjs';
import { houseKeysSource, houseKeysHash, handlerKeys } from './features/house-keys.mjs';
import { selectMutations } from './mutate.mjs';
import { review } from './review.mjs';

const types = `import type { HandlerKey } from './SharedHouseKeys.types';\nexport interface Payload { id?: string }\nexport interface Item { label?: string }\nexport interface Bag { title?: string; items?: (Item | null | undefined)[] | null; ${handlerKeys.map((key) => `${key}?: HandlerKey<Payload>;`).join(' ')} }\n`;
const rules = 'Return all supplied files. Repair only actual House violations; preserve valid code and content. Each Level accepts undefined, null, or Bag props independently. Preserve title and other bag keys. Handler calls guard absent callbacks and forward (data, type). Missing collections return an empty labels array. onClick belongs only on DOM elements. Grid/area authority and CSS tokens are supplied in authority.txt and system.css; do not chase external definitions. Never put display:grid on an atom class. Containers belong on structural tags; action atoms on buttons; effects on supported structural/action tags. Paragraphs must not contain block sections/divs. Keep the component nesting and all levels.\n';
export const generate = (input = {}) => {
  const knobs = normalize(input);
  const seats = [];
  const templates = { 'HouseKeys.types.ts': types, 'SharedHouseKeys.types.ts': houseKeysSource, 'css.d.ts': "declare module '*.css';\n" };
  const usedHandlers = [];
  const css = [];
  for (let level = 0; level < knobs.depth; level++) {
    const ctx = { knobs, level, seats, file: `Level${level}.tsx` };
    const atom = atoms(ctx), handler = handlers(ctx), bag = bags(ctx, handler.key), loop = loops(ctx);
    if (handler.key) usedHandlers.push({ level, key: handler.key });
    css.push(...atom.css);
    const action = atom.action ? `<button type="button" className="${atom.action}"${handler.dom}>Select ${level}</button>` : '';
    const siblings = Array.from({ length: knobs.width }, (_, index) => `<div>Content ${level}:${index}</div>`).join('\n      ');
    const child = level + 1 < knobs.depth ? `<Level${level + 1} {...${bag.spread}} />` : '<div>End of branch</div>';
    const grid = grids(ctx, `${siblings}\n      ${action}\n      ${loop.markup}\n      ${child}`);
    const jsx = markup(ctx, `${atom.classes ? ` className="${atom.classes}"` : ''}${grid.attribute}`, grid.children);
    templates[ctx.file] = `import type { Bag, Payload } from './HouseKeys.types';\n${level + 1 < knobs.depth ? `import { Level${level + 1} } from './Level${level + 1}';\n` : ''}${level === 0 ? "import './system.css';\nimport './specimen.css';\n" : ''}\n${conventions(ctx)}\n${packingOrder(ctx, handler, loop, bag)}  return (\n    ${jsx}\n  );\n};\n`;
  }
  templates['specimen.css'] = css.join('\n') + '\n';
  templates['system.css'] = ':root { --surface-main: #f5f7fa; --elevation-md: 0 2px 6px #0003; }\n[data-grid] { display: grid; }\n[data-grid="header-main"] { grid-template-areas: "header" "main"; }\n[data-grid="shell"] { grid-template-areas: "header" "main" "footer"; }\n[data-grid="holy-grail"] { grid-template-areas: "header header header" "left main right" "footer footer footer"; }\n' + ['header', 'main', 'footer', 'left', 'right'].map((area) => `[data-area="${area}"] { grid-area: ${area}; }`).join('\n');
  templates['authority.txt'] = 'Grid authority: header-main=[header,main]; shell=[header,main,footer]; holy-grail=[header,left,main,right,footer]. Every grid has exactly those direct area children. Class prefixes: class (plain), container, action, effect. Container CSS: background. Action CSS: cursor. Effect CSS: box-shadow. Grid declarations belong only in system.css attribute rules.\n';
  const mutation = selectMutations(seats, knobs);
  if (mutation.status !== 'GENERATED') return { ...mutation, knobs };
  const selected = new Set(mutation.selected.map((s) => s.id));
  const render = (wrong) => Object.fromEntries(Object.entries(templates).map(([file, template]) => {
    let text = template;
    // Outer composition seats contain inner feature seats: expand outermost first.
    for (const s of [...seats].reverse()) text = text.replaceAll(s.token, wrong && selected.has(s.id) ? s.bad : s.good);
    return [file, text];
  }));
  const canonical = render(false), specimen = render(true);
  const correctReview = review(canonical), specimenReview = review(specimen);
  const expected = selected.size ? 'FAIL' : 'PASS';
  const detected = new Set(specimenReview.findings.map((f) => `${f.level}:${f.rule}`));
  const covered = mutation.selected.every((s) => detected.has(`${s.level}:${s.family.endsWith('-atom') ? 'atom-placement' : s.family}`));
  const validated = correctReview.status === 'PASS' && specimenReview.status === expected && covered;
  const pack = (files) => Object.entries(files).map(([name, text]) => `FILE: ${name}\n${text}`).join('\n');
  return { status: validated ? 'GENERATED' : 'QUARANTINED', knobs, canonical, specimen,
    problem: rules + 'Conventions: all functions are arrows; each Level component has a named export. Finish preparation and local handlers first, then pack the outgoing bag as the final statement immediately before return. Local handlers replace their caller keys after spreads.\n\n' + pack(specimen), solution: pack(canonical),
    receipt: { seed: knobs.seed, depth: knobs.depth, width: knobs.width, eligible: seats.length,
      eligibleByRule: Object.fromEntries([...new Set(seats.map((s) => s.family))].map((f) => [f, seats.filter((s) => s.family === f).length])),
      mutations: mutation.selected.map(({ token, ...s }) => s), requests: mutation.requests, actualMutations: selected.size,
      houseKeys: { source: 'RAB.Toolkits/HouseKeys.types.ts', sha256: houseKeysHash, usedHandlers, implementation: 'Generated forwarding wrappers using authentic shared type contracts; not production function bodies.' },
      correctReview, specimenReview, covered, trainingApproved: false,
      scope: 'Composed linear component branch with sibling content; bounded static review, not full runtime/TypeScript validation.',
      canonicalHash: hash(pack(canonical)), specimenHash: hash(pack(specimen)) } };
};
