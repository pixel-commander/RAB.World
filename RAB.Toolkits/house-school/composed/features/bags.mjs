import { enabled, seat } from '../core.mjs';
export const bags = (ctx, handlerKey) => {
  const handler = handlerKey ? `, ${handlerKey}` : '';
  if (!enabled(ctx, 'bags')) return handlerKey
    ? { body: `  // ${handlerKey}: repack the local wrapper under the same House key.\n  const bag = { ...props${handler} };\n`, spread: 'bag' }
    : { body: '', spread: 'props' };
  const source = seat(ctx, 'bag-guard', 'props', 'props ?? {}', 'props');
  const key = seat(ctx, 'bag-rename', 'title', 'title', 'heading: title');
  return { body: `  // title: preserve the caller's key; repack any local handler after rest.\n  const { title, ...rest } = ${source};\n  const bag = { ...rest, ${key}${handler} };\n`, spread: 'bag' };
};
