import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from './index.mjs';
import { review } from './review.mjs';

const families = ['classes', 'container-atom', 'action-atom', 'effect-atom', 'css', 'data-grid', 'grid-area', 'handler-order', 'handler-guard', 'bag-guard', 'bag-rename', 'bag-order', 'unguarded-loop', 'bad-nest', 'convention-arrow', 'convention-export'];
test('actual component nesting, deterministic files, all canonical depths', () => {
  for (const depth of [1, 4, 8, 16, 32]) {
    const result = generate({ depth });
    assert.equal(result.status, 'GENERATED');
    assert.equal(result.receipt.correctReview.status, 'PASS');
    assert.equal(Object.keys(result.canonical).filter((f) => f.endsWith('.tsx')).length, depth);
    for (let level = 0; level < depth - 1; level++) assert.ok(result.canonical[`Level${level}.tsx`].includes(`<Level${level + 1} {...bag} />`));
    assert.deepEqual(generate({ depth }), result);
  }
});
for (const family of families) test(`one planted ${family} violation is independently detected`, () => {
  const result = generate({ depth: 4, errors: { [family]: { amount: 1 } } });
  assert.equal(result.status, 'GENERATED', JSON.stringify(result.receipt));
  assert.equal(result.receipt.actualMutations, 1);
  assert.equal(result.receipt.specimenReview.status, 'FAIL');
});
test('50 seeded combinations plus clean controls', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const errors = seed % 5 ? { [families[seed % families.length]]: { amount: 1 }, [families[(seed + 1) % families.length]]: { amount: 1 } } : {};
    const result = generate({ seed, depth: 1 + seed % 8, width: 1 + seed % 3, areas: [2, 3, 5][seed % 3], errors });
    assert.equal(result.status, 'GENERATED', JSON.stringify(result.receipt));
  }
});
test('feature controls are not error controls', () => {
  const all = generate({ depth: 4 });
  const fewer = generate({ depth: 4, atomTypes: 1, features: { loops: { enabled: false } } });
  assert.equal(fewer.status, 'GENERATED');
  assert.ok(fewer.receipt.eligible < all.receipt.eligible);
  assert.equal(fewer.receipt.actualMutations, 0);
  assert.equal(fewer.receipt.eligibleByRule['unguarded-loop'], undefined);
  assert.equal(fewer.receipt.eligibleByRule['action-atom'], undefined);
  const impossible = generate({ features: { loops: { enabled: false } }, errors: { 'unguarded-loop': { amount: 1 } } });
  assert.equal(impossible.status, 'CANNOT_GENERATE_FAIL');
});
test('shared layout knob permits local overrides', () => {
  const result = generate({ groups: { layout: { enabled: false } }, features: { 'data-grid': { enabled: true } } });
  assert.ok(result.receipt.eligibleByRule['data-grid']);
  assert.equal(result.receipt.eligibleByRule.css, undefined);
});
test('rates count actual eligible rule seats', () => {
  const result = generate({ depth: 8, errors: { 'handler-order': { mode: 'rate', amount: 0.5 } } });
  assert.equal(result.receipt.actualMutations, 4);
});
test('review does not bless empty output and detects noncanonical source edits', () => {
  assert.equal(review({}).status, 'CANNOT_CHECK');
  const files = generate({ depth: 1, houseKeyCoverage: 0 }).canonical;
  files['Level0.tsx'] = files['Level0.tsx'].replace('props?.handleClick?.(data, type)', 'props?.handleClick?.(type, data)');
  assert.ok(review(files).findings.some((f) => f.rule === 'handler-order'));
});
test('authentic HouseKeys contracts are packed and selectable with seeded coverage', () => {
  const plain = generate({ depth: 8, houseKeyCoverage: 0 });
  const mixed = generate({ depth: 8, houseKeyCoverage: 1 });
  assert.ok(plain.receipt.houseKeys.usedHandlers.every((r) => r.key === 'handleClick'));
  assert.ok(mixed.receipt.houseKeys.usedHandlers.every((r) => r.key !== 'handleClick'));
  assert.ok(new Set(mixed.receipt.houseKeys.usedHandlers.map((r) => r.key)).size > 1);
  assert.ok(mixed.problem.includes('export type HandlerKey'));
  assert.equal(mixed.status, 'GENERATED');
  const bad = generate({ depth: 8, houseKeyCoverage: 1, errors: { 'handler-order': { amount: 2 }, 'handler-guard': { amount: 1 } } });
  assert.equal(bad.status, 'GENERATED');
  assert.equal(bad.receipt.actualMutations, 3);
});
test('local handlers are repacked after spreads, including when bag lessons are disabled', () => {
  for (const bagEnabled of [true, false]) {
    const result = generate({ depth: 3, houseKeyCoverage: 0, features: { bags: { enabled: bagEnabled } } });
    assert.equal(result.status, 'GENERATED');
    const source = result.canonical['Level0.tsx'];
    assert.ok(source.includes(bagEnabled ? 'const bag = { ...rest, title, handleClick };' : 'const bag = { ...props, handleClick };'));
    assert.ok(source.indexOf('const handleClick') < source.indexOf('const bag'));
    const files = { ...result.canonical, 'Level0.tsx': source.replace(', handleClick };', ' };') };
    assert.ok(review(files).findings.some((f) => f.rule === 'handler-repack'));
    files['Level0.tsx'] = source.replace('<Level1 {...bag}', '<Level1 {...props}');
    assert.ok(review(files).findings.some((f) => f.rule === 'handler-repack'));
  }
});
test('packing last is an explicit convention, including preparation after a valid handler', () => {
  const result = generate({ depth: 2, houseKeyCoverage: 0 });
  const source = result.canonical['Level0.tsx'];
  assert.match(source, /const bag = [^\n]+;\n  return/);
  const files = { ...result.canonical, 'Level0.tsx': source.replace('  return (', '  const extra = 1;\n  return (') };
  assert.ok(review(files).findings.some((f) => f.rule === 'bag-order'));
  const bad = generate({ depth: 2, errors: { 'bag-order': { amount: 1 }, 'handler-order': { amount: 1 } } });
  assert.equal(bad.status, 'GENERATED');
  assert.ok(!bad.problem.includes('__SEAT_'));
});
