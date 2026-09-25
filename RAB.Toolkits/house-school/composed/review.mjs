// Static checks for the generated subset. Never execute specimen code.
import { parseSource, walk } from '../shared/syntax/tree.mjs';

const layouts = { 'header-main': ['header', 'main'], shell: ['header', 'main', 'footer'],
  'holy-grail': ['header', 'left', 'main', 'right', 'footer'] };
const attr = (node, name) => node.openingElement.attributes.find((a) => a.name?.name === name)?.value?.value;
const tag = (node) => node.openingElement?.name?.name;
const property = (node) => node.property?.name;
export const review = (files) => {
  const findings = [];
  let unsupported = false;
  for (const [file, source] of Object.entries(files)) {
    const level = /^Level(\d+)\.tsx$/.exec(file)?.[1];
    const add = (rule, why) => findings.push({ file, level: Number(level), rule, why });
    if (level === undefined) continue;
    let tree;
    try { tree = parseSource(source); } catch (error) { add('syntax', error.message); continue; }
    const exportNode = tree.program.body.find((n) => n.type === 'ExportNamedDeclaration' &&
      (n.declaration?.id?.name === `Level${level}` || n.declaration?.declarations?.some((d) => d.id.name === `Level${level}`)));
    if (!exportNode) add('convention-export', 'Component requires a named export.');
    const localHandlers = [];
    let bagObject;
    const childSpreads = [];
    let destructuredTitle = false;
    walk(tree, (node) => {
      if (node.type === 'BlockStatement') {
        const packingIndex = node.body.findIndex((s) => s.type === 'VariableDeclaration' && s.declarations.some((d) => d.id.name === 'bag'));
        if (packingIndex >= 0) {
          const returnIndex = node.body.findIndex((s) => s.type === 'ReturnStatement');
          if (returnIndex !== packingIndex + 1) add('bag-order', 'Pack the outgoing bag last, immediately before return.');
        }
      }
      if (node.type === 'VariableDeclarator') {
        if (/^handle[A-Z]/.test(node.id.name || '') && node.init?.type === 'ArrowFunctionExpression') localHandlers.push(node.id.name);
        if (node.id.name === 'bag') bagObject = node.init;
        if (node.id.type === 'ObjectPattern' && node.id.properties.some((p) => p.key?.name === 'title')) destructuredTitle = true;
      }
      if (node.type === 'JSXOpeningElement' && /^Level\d+$/.test(node.name?.name || '')) childSpreads.push(node.attributes);
    });
    for (const key of localHandlers) {
      const props = bagObject?.type === 'ObjectExpression' ? bagObject.properties : [];
      const index = props.findLastIndex((p) => p.type === 'ObjectProperty' && p.key.name === key && p.value.name === key);
      const lastSpread = props.findLastIndex((p) => p.type === 'SpreadElement');
      if (childSpreads.length && (index < 0 || index < lastSpread || childSpreads.some((attrs) => !attrs.some((a) => a.type === 'JSXSpreadAttribute' && a.argument.name === 'bag')))) add('handler-repack', 'Local handler must replace the caller handler in the forwarded bag after spreads.');
    }
    walk(tree, (node) => {
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') add('convention-arrow', 'Use arrow functions.');
      if (node.type === 'VariableDeclarator' && node.id.name === 'bag' && node.init?.type === 'ObjectExpression') {
        const keys = node.init.properties.filter((p) => p.type === 'ObjectProperty').map((p) => p.key.name);
        if ((destructuredTitle && !keys.includes('title')) || keys.includes('heading')) add('bag-rename', 'The bag must preserve title under title.');
      }
      if (node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern' && node.init?.type === 'Identifier' && node.init.name === 'props') add('bag-guard', 'Nullable props destructured without fallback.');
      if (['CallExpression', 'OptionalCallExpression'].includes(node.type) && /^handle[A-Z]/.test(property(node.callee) || '')) {
        if (node.arguments[0]?.name !== 'data' || node.arguments[1]?.name !== 'type') add('handler-order', 'Callback arguments must be data, type.');
        if (!node.optional) add('handler-guard', 'Absent callback is not guarded.');
      }
      if (['CallExpression', 'OptionalCallExpression'].includes(node.type) && property(node.callee) === 'map' && node.callee.object?.name === 'items' && !node.callee.optional) add('unguarded-loop', 'Nullable items mapped without guard.');
      if (node.type !== 'JSXElement') return;
      const element = tag(node);
      const classes = (attr(node, 'className') || '').split(/\s+/).filter(Boolean);
      for (const name of classes) {
        const family = name.split('-')[0];
        if (!['class', 'container', 'action', 'effect'].includes(family)) add('classes', `Unknown class family ${family}.`);
        if (family === 'action' && element !== 'button') {
          add('atom-placement', 'Action atom on structural element.');
        }
        if (family === 'container' && element === 'button') add('atom-placement', 'Container atom on button.');
      }
      if (element === 'p' && node.children.some((c) => c.type === 'JSXElement' && ['div', 'section'].includes(tag(c)))) add('bad-nest', 'Paragraph contains a block element.');
      const grid = attr(node, 'data-grid');
      const area = attr(node, 'data-area');
      if (area && !['header', 'main', 'footer', 'left', 'right'].includes(area)) add('grid-area', 'Unknown area key.');
      if (grid) {
        const expected = layouts[grid];
        if (!expected) add('data-grid', 'Unknown named grid.');
        else {
          const actual = node.children.filter((c) => c.type === 'JSXElement').map((c) => attr(c, 'data-area'));
          if (JSON.stringify(actual) !== JSON.stringify(expected)) add('grid-area', 'Direct area children do not match named layout.');
        }
      }
    });
  }
  const css = files['specimen.css'] ?? '';
  for (const match of css.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    if (/\bdisplay\s*:\s*grid\b/.test(match[2])) findings.push({ file: 'specimen.css', level: Number(/level-(\d+)/.exec(match[1])?.[1]), rule: 'css', why: 'Grid authority placed on a class.' });
  }
  if (!Object.keys(files).some((f) => /^Level\d+\.tsx$/.test(f))) unsupported = true;
  return { status: findings.length ? 'FAIL' : unsupported ? 'CANNOT_CHECK' : 'PASS', findings,
    scope: 'Generated subset only; not a general House reviewer or runtime equivalence proof.' };
};
