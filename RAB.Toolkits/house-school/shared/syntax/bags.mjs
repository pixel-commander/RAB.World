import { walk, name, finding } from './tree.mjs';

export const bagFindings = (tree) => {
  const findings = [];
  walk(tree, (node, parent) => {
    if (node.type === 'ObjectPattern') {
      const incoming = parent?.type === 'VariableDeclarator'
        ? ['props', 'bag'].includes(name(parent.init)) || parent.init?.type === 'LogicalExpression' && ['props', 'bag'].includes(name(parent.init.left))
        : parent?.type === 'ArrowFunctionExpression';
      if (incoming) for (const property of node.properties) {
        if (property.type !== 'ObjectProperty') continue;
        const value = property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
        if (value.type === 'Identifier' && name(property.key) !== value.name) findings.push(finding('prop-rename', property, 'Preserve the incoming key name.'));
      }
    }
    if (node.type === 'JSXAttribute') {
      const expression = node.value?.expression;
      if (['MemberExpression', 'OptionalMemberExpression'].includes(expression?.type) && ['props', 'bag'].includes(name(expression.object)) && name(node.name) !== name(expression.property)) findings.push(finding('prop-rename', node, 'Forward under the same prop key.'));
    }
    if (node.type === 'ObjectExpression' || node.type === 'JSXOpeningElement') {
      const entries = node.properties || node.attributes;
      let handlerSeen = false;
      for (const entry of entries) {
        if (/^handle[A-Z]/.test(name(entry.key || entry.name) || '')) handlerSeen = true;
        if (handlerSeen && ['SpreadElement', 'JSXSpreadAttribute'].includes(entry.type) && name(entry.argument) === 'props') findings.push(finding('wrapper-overwritten', entry, 'Incoming props overwrite the explicitly forwarded handler.'));
      }
    }
  });
  return findings;
};
