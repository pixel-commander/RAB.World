import { normalizeStates } from '../tools/css/_states.mjs';

// A bounded CSS construction; unrelated uses of "active" keep their usual meaning.
export const parseCssStateRequest = (text, context = {}) => {
  const match = /^(?:add|set|update|make)\s+(?:css\s+)?(?:states?\s+)?(.+?)\s+(?:match\s+)?(?:on|to|for)\s+(?:(this)\s+)?(atom|class)(?:\s+(?:called|named))?(?:\s+("[^"]+"|'[^']+'|[\w-]+))?(?:\s+(?:at|in)\s+("[^"]+"|'[^']+'))?[.!]?$/i.exec(text);
  if (!match) return null;
  let states;
  try { states = normalizeStates(match[1]); } catch { return null; }
  const clean = value => value ? value.replace(/^["']|["']$/g, '') : null;
  const current = typeof context.currentTarget === 'string' ? context.currentTarget : context.currentTarget?.name;
  const currentType = context.currentTargetType || context.currentTarget?.type;
  const compatible = !currentType || currentType === match[3].toLowerCase();
  const name = clean(match[4]) || (match[2] && compatible ? current : null);
  return { states, target_type: match[3].toLowerCase(), name, location: clean(match[5]), current: !!match[2] };
};
