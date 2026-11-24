const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cyclicIndex, rowIndexFromOffset, centeredRowIndex, shouldRecenter, hourValues, minuteValues } = require('../../utils/cyclicTime');

test('hour wheel wraps 23 to 00 to 01 in both directions', () => {
  assert.equal(hourValues[cyclicIndex(23,24)], '23');
  assert.equal(hourValues[cyclicIndex(24,24)], '00');
  assert.equal(hourValues[cyclicIndex(25,24)], '01');
  assert.equal(hourValues[cyclicIndex(-1,24)], '23');
});

test('minute wheel wraps in five-minute steps from 55 to 00', () => {
  assert.equal(minuteValues[cyclicIndex(11,12)], '55');
  assert.equal(minuteValues[cyclicIndex(12,12)], '00');
  assert.equal(minuteValues[cyclicIndex(13,12)], '05');
  assert.equal(minuteValues[cyclicIndex(-1,12)], '55');
});

test('wheel scroll offset maps to the nearest row and recenters only at outer copies', () => {
  assert.equal(rowIndexFromOffset(23 * 40,40),23);
  assert.equal(centeredRowIndex(23,24),71);
  assert.equal(shouldRecenter(23,24),true);
  assert.equal(shouldRecenter(24,24),false);
  assert.equal(shouldRecenter(95,24),false);
  assert.equal(shouldRecenter(96,24),true);
});

const appConfig = require('../../app.json');
test('Android resizes the layout when the software keyboard opens', () => {
  assert.equal(appConfig.expo.android.softwareKeyboardLayoutMode, 'resize');
});
