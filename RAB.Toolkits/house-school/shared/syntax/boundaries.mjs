import { walk, name, finding } from './tree.mjs';

export const boundaryFindings = (tree) => {
  const findings = [];
  walk(tree, (node) => {
    if (node.type !== 'JSXOpeningElement') return;
    const tag = name(node.name);
    const native = typeof tag === 'string' && /^[a-z]/.test(tag);
    for (const attribute of node.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        if (native && ['props', 'bag'].includes(name(attribute.argument))) findings.push(finding('bag-on-dom', attribute, 'Forward internal bags to components, not native DOM.'));
        continue;
      }
      const key = name(attribute.name);
      if (/^on[A-Z]/.test(key || '') && !native) findings.push(finding('dom-only-on', attribute, 'on* is reserved for native DOM sockets.'));
      if (native && /^handle[A-Z]/.test(key || '')) findings.push(finding('dom-handler-socket', attribute, 'Native DOM needs its on* socket.'));
      const expression = attribute.value?.expression;
      if (native && /^on[A-Z]/.test(key || '') && expression?.type === 'Identifier') {
        const expected = `handle${key.slice(2)}`;
        if (expression.name !== expected) findings.push(finding('dom-wire-name', attribute, `Expected ${expected}.`));
      }
    }
  });
  return findings;
};
