import { enabled, seat } from '../core.mjs';

export const atoms = (ctx) => {
  const classes = [];
  const css = [];
  const add = (family, declaration) => {
    const name = `${family}-level-${ctx.level}`;
    const wrong = family === 'action' ? 'container' : 'action';
    const attribute = seat(ctx, `${family}-atom`, 'class-family', name, `${wrong}-level-${ctx.level}`);
    let body = declaration;
    if (enabled(ctx, 'css')) {
      body = seat(ctx, 'css', family, declaration, `${declaration} display: grid;`);
      ctx.seats.at(-1).file = 'specimen.css';
      css.push(`.${name} { ${body} }`);
    }
    return attribute;
  };
  if (enabled(ctx, 'classes')) classes.push(seat(ctx, 'classes', 'class-key', `class-level-${ctx.level}`, `unknown-level-${ctx.level}`));
  if (ctx.knobs.atomTypes >= 1 && enabled(ctx, 'container-atom')) classes.push(add('container', 'background: var(--surface-main);'));
  if (ctx.knobs.atomTypes >= 3 && enabled(ctx, 'effect-atom')) classes.push(add('effect', 'box-shadow: var(--elevation-md);'));
  const action = ctx.knobs.atomTypes >= 2 && enabled(ctx, 'action-atom') ? add('action', 'cursor: pointer;') : null;
  return { classes: classes.join(' '), action, css };
};
