import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewSyntax } from '../shared/syntax/index.mjs';
import { admit } from '../shared/admission.mjs';

const cases = [
  ['arrow-only', 'function work() {}', 'const work = () => {};'],
  ['handler-slots', 'const handleClick = (type, data) => {};', 'const handleClick = (data, type) => {};'],
  ['optional-slots', 'const handleSave = (data: string, type: string) => {};', 'const handleSave = (data?: string, type?: string) => {};'],
  ['recursive-wrapper', 'const handleClick = (data, type) => handleClick(data,type);', 'const handleClick = (data, type) => props?.handleClick?.(data,type);'],
  ['dom-only-on', 'const View=()=> <Next onClick={handleClick}/>;', 'const View=()=> <Next handleClick={handleClick}/>;'],
  ['dom-wire-name', 'const View=()=> <button onClick={pickThing}/>;', 'const View=()=> <button onClick={handleClick}/>;'],
  ['bag-on-dom', 'const View=()=> <button {...bag}/>;', 'const View=()=> <Next {...bag}/>;'],
  ['prop-rename', 'const View=({handleClick: pickThing})=> <Next/>;', 'const View=({handleClick})=> <Next/>;'],
  ['prop-rename', 'const View=()=> <Next pickThing={props?.handleClick}/>;', 'const View=()=> <Next handleClick={props?.handleClick}/>;'],
  ['wrapper-overwritten', 'const bag={handleClick,...props};', 'const bag={...props,handleClick};'],
];
for (const [rule, bad, good] of cases) test(`${rule}: defect and valid counterpart`, () => {
  assert.ok(reviewSyntax(bad).findings.some((finding) => finding.rule === rule));
  assert.equal(reviewSyntax(good).status, 'PASS');
});
test('comments and strings do not create findings', () => {
  assert.equal(reviewSyntax('const text = "function x() {}"; // <Next onClick={bad}/>').status, 'PASS');
});
test('null-safe direct key deletion on local object is not an unguarded read', () => {
  assert.equal(reviewSyntax('const bag = {}; delete bag.absent;').status, 'PASS');
});
test('invalid and empty source fail explicitly', () => {
  assert.equal(reviewSyntax('').status, 'FAIL');
  assert.equal(reviewSyntax('const =').status, 'FAIL');
});
test('uncertain or over-budget cases never receive a scoring verdict', () => {
  for (const request of [{checks:[]}, {checks:[{status:'CANNOT_CHECK'}]}, {checks:[{status:'PASS'}],corrections:4}]) {
    const result = admit(request);
    assert.equal(result.admitted, false);
    assert.equal('verdict' in result, false);
  }
  assert.equal(admit({checks:[{status:'FAIL'}]}).verdict, 'FAIL');
});
