// lint-rules.mjs — the checkable rules check themselves (external review
// round 1's proposal, 2026-09-03: "every rule a grep can check is obeyed" —
// so grep them all, every boot). Report-only by default; --strict exits 1
// on BREAK-tier findings. Zero deps.
//
//   node scripts/lint-rules.mjs [--strict]
//
// COVERAGE (law seat's note, updated after second pass 2026-09-03):
// RULES.txt now carries THREE tags — [LINT] a check here enforces it;
// [LINT-TODO] mechanical but not yet implemented (unenforced, not
// licensed); [JUDGE] a reviewer owns it. This script IS the [LINT]
// set: T3, G6, G2, S6 (with the enumerable instrument-suffix
// allow-list — the law's own exception, taught same-hour), N1-chain,
// C1-pad, F2, P1-seat, B1-mapping. A check graduating from
// [LINT-TODO] flips the tag in RULES.txt in the same landing.
//
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const findings = [];
const add = (rule, tier, file, line, text) =>
  findings.push({ rule, tier, file: path.relative(ROOT, file).replaceAll('\\', '/'), line, text: text.trim().slice(0, 100) });

const walk = (dir, exts, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
};

const read = (file) => fs.readFileSync(file, 'utf8');
const lines = (text) => text.split('\n');
const componentCss = [];
const pageCss = [];
const allCss = [];
const allHtml = [];
const allJs = [];
for (const seat of ['components', 'pages']) {
  const dir = path.join(ROOT, seat);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir, ['.css', '.html', '.js'])) {
    if (file.endsWith('.css')) (seat === 'components' ? componentCss : pageCss).push(file);
    if (file.endsWith('.html')) allHtml.push(file);
    if (file.endsWith('.js')) allJs.push(file);
  }
}
allCss.push(...componentCss, ...pageCss, ...walk(path.join(ROOT, 'css'), ['.css']), ...walk(path.join(ROOT, 'themes'), ['.css']), ...walk(path.join(ROOT, 'atoms'), ['.css']));
allJs.push(...walk(path.join(ROOT, 'js'), ['.js']));
// scripts ride the same law (round-2 GPT: a violation hid there unscanned)
allJs.push(...walk(path.join(ROOT, 'scripts'), ['.js', '.mjs']).filter((f) => !f.endsWith('lint-rules.mjs')));

/* T3 — raw colour outside the theme (a raw FALLBACK inside var(--x, …)
   is defensive, not a violation) */
for (const file of allCss) {
  if (path.basename(file) === 'colors.css' && path.dirname(path.dirname(file)) === path.join(ROOT, 'themes')) continue;
  lines(read(file)).forEach((text, i) => {
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text) && !/var\(--[a-z0-9-]+,\s*(rgb|#)/.test(text)) {
      add('T3 raw colour outside theme colors.css', 'FIX', file, i + 1, text);
    }
  });
}

/* G6 — topology-shaped template in component/page css (comments exempt) */
for (const file of [...componentCss, ...pageCss]) {
  lines(read(file)).forEach((text, i) => {
    if (/grid-template-areas/.test(text) && !/^\s*(\/\*|\*)/.test(text)) {
      add('G6 topology fork (areas in component/page css)', 'FIX', file, i + 1, text);
    }
  });
}

/* G2 — invented breakpoint widths */
for (const file of allCss) {
  lines(read(file)).forEach((text, i) => {
    const m = text.match(/@media[^{]*max-width:\s*([0-9.]+(?:px|rem))/);
    if (m && !['1024px', '768px', '480px'].includes(m[1])) {
      add('G2 invented breakpoint (not 1024/768/480px)', 'FIX', file, i + 1, text);
    }
  });
}

/* S6 — states outside the atoms layer. Instrument-chrome parts are the
   ENUMERABLE exception (round-2 second pass): exempt suffixes only —
   everything else with a state is a real fix */
const INSTRUMENT_SUFFIX = /__(handle|grip|[a-z-]*resize|box-header)[^ ,{:]*\s*(:|,|\{)/;
for (const file of [...componentCss, ...pageCss]) {
  lines(read(file)).forEach((text, i) => {
    if (/:hover|:active\b/.test(text)) {
      if (INSTRUMENT_SUFFIX.test(text)) return; // S6's named exception
      add('S6 state outside atoms layer (not instrument chrome)', 'FIX', file, i + 1, text);
    }
  });
}

/* N1 — body read without a visible ok check: the one-line chain AND the
   two-line shape (result read first, ok checked after or never) */
for (const file of allJs) {
  const fileLines = lines(read(file));
  fileLines.forEach((text, i) => {
    if (/\(await fetch\([^;]*\)\s*\.\s*(json|text)\(/.test(text)) {
      add('N1 body read before response.ok', 'FIX', file, i + 1, text);
      return;
    }
    const m = text.match(/(?:await\s+)?(\w+)\s*\.\s*(?:json|text)\(\)/);
    if (!m || m[1] === 'JSON') return;
    if (/\.catch\(/.test(text)) return; // the lawful read-error-body-then-check-ok shape
    const ident = m[1];
    if (new RegExp(`\\b${ident}\\.ok\\b`).test(text)) return;
    const lookback = fileLines.slice(Math.max(0, i - 6), i).join('\n');
    if (!new RegExp(`\\b${ident}\\.ok\\b`).test(lookback)) {
      add('N1 body read before response.ok', 'FIX', file, i + 1, text);
    }
  });
}

/* C1 — pad is cells-only (keeper's ruling, LAW): off-cell pad is a
   regression, not debt */
for (const file of allHtml) {
  lines(read(file)).forEach((text, i) => {
    const m = text.match(/class="([^"]*)"/);
    if (m && /\bpad\b/.test(m[1]) && !/\binner\b/.test(m[1])) {
      add('C1 pad off-cell (cells-only law)', 'FIX', file, i + 1, text);
    }
  });
}

/* F2 — a control without a name collects nothing */
for (const file of allHtml) {
  lines(read(file)).forEach((text, i) => {
    if (/<(input|select|textarea)\b/.test(text) && !/name=/.test(text) && !/type="(submit|button)"/.test(text)) {
      add('F2 nameless control (instrument or violation)', 'CHECK', file, i + 1, text);
    }
  });
}

/* P1 — every page root claims the shell cell */
const pagesDir = path.join(ROOT, 'pages');
for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const cssFile = path.join(pagesDir, entry.name, 'css', `${entry.name}.css`);
  if (!fs.existsSync(cssFile)) continue;
  const text = read(cssFile);
  if (!/flex:\s*1/.test(text) || !/min-block-size:\s*0/.test(text)) {
    add('P1 page root missing shell-cell seat (flex:1 + min-block-size:0)', 'BREAK', cssFile, 1, `${entry.name}-page`);
  }
}

/* G7 — a grid atom's areas must be placeable (born as review finding B1;
   seated in RULES as G7) */
const gridsDir = path.join(ROOT, 'atoms', 'grids');
if (fs.existsSync(gridsDir)) {
  for (const file of walk(gridsDir, ['.css'])) {
    const text = read(file);
    const areasMatch = text.match(/grid-template-areas:\s*([^;]+);/);
    if (!areasMatch) continue;
    const names = [...new Set([...areasMatch[1].matchAll(/'([^']*)'/g)].flatMap((m) => m[1].trim().split(/\s+/)))].filter((n) => n !== '.');
    for (const name of names) {
      if (!new RegExp(`grid-area:\\s*${name}\\b`).test(text)) {
        add('G7 grid atom area has no grid-area mapping', 'BREAK', file, 1, name);
      }
    }
  }
}

/* report */
const tiers = { BREAK: [], FIX: [], DEBT: [], CHECK: [] };
for (const f of findings) tiers[f.tier].push(f);
const order = ['BREAK', 'FIX', 'DEBT', 'CHECK'];
for (const tier of order) {
  if (!tiers[tier].length) continue;
  console.log(`\n== ${tier} (${tiers[tier].length}) ==`);
  const byRule = {};
  for (const f of tiers[tier]) (byRule[f.rule] = byRule[f.rule] || []).push(f);
  for (const [rule, list] of Object.entries(byRule)) {
    console.log(`  ${rule} — ${list.length}`);
    for (const f of list.slice(0, 8)) console.log(`    ${f.file}:${f.line}  ${f.text}`);
    if (list.length > 8) console.log(`    … +${list.length - 8} more`);
  }
}
console.log(`\nlint-rules: ${findings.length} findings (${order.map((t) => `${tiers[t].length} ${t}`).join(', ')})`);
/* strict fails on FIX too — "never ship the disagreement" means a known
   violation is a failure, not a warning (round-2 GPT). DEBT/CHECK stay
   nonfatal */
if (process.argv.includes('--strict') && (tiers.BREAK.length || tiers.FIX.length)) process.exit(1);
