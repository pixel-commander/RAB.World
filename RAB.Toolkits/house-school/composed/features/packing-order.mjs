import { seat } from '../core.mjs';

export const packingOrder = (ctx, handler, loop, bag) => {
  const correct = handler.body + loop.body + bag.body;
  // Without a bag or other preparation, there is no meaningful ordering error.
  if (!bag.body || !(handler.body || loop.body)) return correct;
  return seat(ctx, 'bag-order', 'pack-last', correct, bag.body + handler.body + loop.body);
};
