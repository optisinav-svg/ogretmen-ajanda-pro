'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { exactKeys, samePeriod, sumCounts } = require('../scripts/audit-rules-compatibility');

test('exactKeys accepts the exact field set independent of key order', () => {
  assert.equal(exactKeys({ uid: 'u', ad: 'A' }, ['ad', 'uid']), true);
  assert.equal(exactKeys({ ad: 'A', uid: 'u', extra: true }, ['ad', 'uid']), false);
  assert.equal(exactKeys({ ad: 'A' }, ['ad', 'uid']), false);
});

test('samePeriod requires two matching integer period values', () => {
  assert.equal(samePeriod({ donemYili: 2026 }, { donemYili: 2026 }), true);
  assert.equal(samePeriod({ donemYili: 2026 }, { donemYili: 2025 }), false);
  assert.equal(samePeriod({ donemYili: '2026' }, { donemYili: 2026 }), false);
});

test('sumCounts aggregates numeric collection counts', () => {
  assert.equal(sumCounts({ okullar: 2, siniflar: 4, ogrenciler: 8 }), 14);
  assert.equal(sumCounts({}), 0);
});
