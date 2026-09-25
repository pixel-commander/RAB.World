import { parse } from '@babel/parser';

export const parseSource = (source) => parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
export const walk = (node, visit, parent = null) => {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node));
    else if (value && typeof value === 'object') walk(value, visit, node);
  }
};
export const name = (node) => node?.name || node?.value;
export const finding = (rule, node, why) => ({ rule, line: node.loc?.start.line || 1, why });
