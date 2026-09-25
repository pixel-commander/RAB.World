import { seat } from '../core.mjs';
export const markup = (ctx, attrs, children) => {
  const tag = seat(ctx, 'bad-nest', 'block-parent', 'section', 'p');
  return `<${tag}${attrs}>\n      ${children}\n    </${tag}>`;
};
