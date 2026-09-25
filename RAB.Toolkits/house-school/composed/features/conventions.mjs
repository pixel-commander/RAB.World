import { seat } from '../core.mjs';
export const conventions = (ctx) => {
  const exported = seat(ctx, 'convention-export', 'named-export', 'export ', '');
  const declaration = seat(ctx, 'convention-arrow', 'component-function',
    `const Level${ctx.level} = (props?: Bag | null) => {`,
    `function Level${ctx.level}(props?: Bag | null) {`);
  return exported + declaration;
};
