import { walk, name, finding } from './tree.mjs';

export const handlerFindings = (tree) => {
  const findings = [];
  walk(tree, (node, parent) => {
    if (['FunctionDeclaration', 'FunctionExpression', 'ObjectMethod', 'ClassMethod'].includes(node.type)) {
      findings.push(finding('arrow-only', node, 'House executable functions must be arrows.'));
    }
    if (node.type !== 'ArrowFunctionExpression') return;
    const id = parent?.type === 'VariableDeclarator' ? name(parent.id) : '';
    if (!/^handle[A-Z]/.test(id || '')) return;
    // Zero-argument DOM adapters are separate from two-slot data handlers.
    if (node.params.length) {
      const names = node.params.map((p) => name(p.type === 'AssignmentPattern' ? p.left : p));
      if (names.length !== 2 || names[0] !== 'data' || names[1] !== 'type') findings.push(finding('handler-slots', node, 'Data handlers use (data, type).'));
      for (const param of node.params) {
        if (param.typeAnnotation && !param.optional && param.type !== 'AssignmentPattern') findings.push(finding('optional-slots', param, 'Explicitly typed handler slots must be optional.'));
      }
    }
    walk(node.body, (child) => {
      if (child.type === 'CallExpression' && child.callee.type === 'Identifier' && child.callee.name === id) findings.push(finding('recursive-wrapper', child, 'Wrapper calls itself, not incoming callback.'));
    });
  });
  return findings;
};
