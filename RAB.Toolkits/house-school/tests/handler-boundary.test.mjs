import test from 'node:test';
import assert from 'node:assert/strict';
import { handlers } from '../shared/verification/handlers.mjs';

// Trusted, handwritten minimal reproductions; never execute model output here.
const specimen = (body) => `export const packBag = (props = {}) => ({
  ...props, handleClick: (data, type) => { ${body} }
});`;

const guardStatus = (source) => handlers(source).find((check) => check.rule === 'callback-guard').status;

for (const body of [
  'return props.handleClick?.(data, type);',
  'if (props.handleClick) return props.handleClick(data, type);',
]) {
  test(`reject null-bag access: ${body}`, () => {
    const checks = handlers(specimen(body));
    assert.equal(checks.find((check) => check.rule === 'callback-guard').status, 'FAIL');
    assert.equal(checks.find((check) => check.rule === 'argument-order').status, 'PASS');
    assert.equal(checks.find((check) => check.rule === 'handler-name').status, 'PASS');
  });
}

for (const body of [
  'return props?.handleClick?.(data, type);',
  'if (!props?.handleClick) return; return props.handleClick(data, type);',
  'props = props || {}; return props.handleClick?.(data, type);',
]) {
  test(`accept valid boundary guard: ${body}`, () => {
    assert.ok(handlers(specimen(body)).every((check) => check.status === 'PASS'));
  });
}

test('null-bag protection alone does not protect an absent callback', () => {
  assert.equal(guardStatus(specimen('return props?.handleClick(data, type);')), 'FAIL');
});

test('each receiving boundary is exercised independently', () => {
  for (const condition of [
    'props === undefined',
    'props === null',
    'props && !Object.hasOwn(props, "handleClick")',
    'props && Object.hasOwn(props, "handleClick") && props.handleClick === undefined',
  ]) {
    const source = `export const packBag = (props) => {
      if (${condition}) throw new Error('boundary reached');
      return { ...props, handleClick: (data, type) => props?.handleClick?.(data, type) };
    };`;
    assert.equal(guardStatus(source), 'FAIL', condition);
  }
});
