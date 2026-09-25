import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDepth } from '../curricula/handlers/depth.mjs';
import { verify } from '../shared/verification/index.mjs';

for (const depth of [1, 2, 4, 8, 16, 32]) {
  test(`handler depth ${depth}: clean and every mutation boundary`, () => {
    const clean = generateDepth({ depth });
    assert.equal(verify('handlers', clean.source).status, 'PASS');
    assert.deepEqual(generateDepth({ depth }), clean);
    for (let brokenAt = 0; brokenAt < depth; brokenAt++) {
      for (const defect of ['argument-order', 'handler-name', 'callback-guard']) {
        const sample = generateDepth({ depth, brokenAt, defect });
        const result = verify('handlers', sample.source);
        // A previously installed wrapper masks missing optional chaining downstream.
        // Check each independently optional boundary as well as the composed chain.
        const masked = defect === 'callback-guard' && brokenAt > 0;
        assert.equal(result.status, masked ? 'PASS' : 'FAIL', `${depth}/${brokenAt}/${defect}`);
        const boundaries = sample.boundarySources.map((source) => verify('handlers', source));
        assert.equal(boundaries[brokenAt].status, 'FAIL');
        assert.equal(boundaries.filter((result) => result.status === 'FAIL').length, 1);
        assert.equal(sample.manifest.brokenAt, brokenAt);
      }
    }
  });
}
test('depth generator rejects an uncheckable boundary', () => {
  assert.throws(() => generateDepth({ depth: 2, brokenAt: 2 }));
  assert.throws(() => generateDepth({ depth: 0 }));
});
