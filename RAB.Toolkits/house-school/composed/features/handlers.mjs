import { enabled, seat } from '../core.mjs';
import { selectHandler } from './house-keys.mjs';
export const handlers = (ctx) => {
  if (!enabled(ctx, 'house-handlers')) return { body: '', dom: '' };
  const args = seat(ctx, 'handler-order', 'arguments', 'data, type', 'type, data');
  const guard = seat(ctx, 'handler-guard', 'callback', '?.', '');
  const key = selectHandler(ctx);
  return { key, body: `  // ${key}: HouseKeys contract; data first, dispatch type last.\n  const ${key} = (data?: Payload, type?: string) => props?.${key}${guard}(${args});\n`,
    dom: ` onClick={() => ${key}({ id: 'level-${ctx.level}' }, '${key.slice(6).toLowerCase()}')}` };
};
