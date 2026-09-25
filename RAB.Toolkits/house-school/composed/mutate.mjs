import { rank } from './core.mjs';
export const selectMutations = (seats, knobs) => {
  const supported = ['classes', 'container-atom', 'action-atom', 'effect-atom', 'css', 'data-grid', 'grid-area', 'handler-order', 'handler-guard', 'bag-guard', 'bag-rename', 'bag-order', 'unguarded-loop', 'bad-nest', 'convention-arrow', 'convention-export'];
  const selected = [];
  const requests = [];
  for (const [family, config] of Object.entries(knobs.errors)) {
    if (!supported.includes(family)) throw new Error(`Unknown mutation family ${family}`);
    const eligible = seats.filter((s) => s.family === family);
    const active = config.enabled !== false;
    const mode = config.mode ?? 'count';
    const amount = config.amount ?? 0;
    if (!['count', 'rate'].includes(mode) || !Number.isFinite(amount) || amount < 0 ||
      (mode === 'count' && !Number.isInteger(amount)) || (mode === 'rate' && amount > 1)) throw new Error(`Invalid error knob: ${family}`);
    const count = active ? (mode === 'rate' ? Math.round(eligible.length * amount) : amount) : 0;
    requests.push({ family, eligible: eligible.length, requested: count });
    if (count > eligible.length || (active && amount > 0 && eligible.length === 0)) return { status: 'CANNOT_GENERATE_FAIL', selected: [], requests, reason: `${family}: insufficient eligible seats` };
    selected.push(...eligible.sort((a, b) => rank(config.seed ?? knobs.seed, a.id) - rank(config.seed ?? knobs.seed, b.id)).slice(0, count));
  }
  return { status: 'GENERATED', selected, requests };
};
