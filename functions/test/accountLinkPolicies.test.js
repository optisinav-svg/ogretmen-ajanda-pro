const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) initializeApp({ projectId: 'demo-ogretmen-ajanda-policy-tests' });
const { _test } = require('../accountLinks');

test('account linking requires student, class and link periods to match', () => {
  assert.equal(_test.hasMatchingAcademicPeriod(
    { donemYili: 2026 },
    { donemYili: 2026 },
  ), true);
  assert.equal(_test.hasMatchingAcademicPeriod(
    { donemYili: 2025 },
    { donemYili: 2026 },
  ), false);
  assert.equal(_test.hasMatchingAcademicPeriod(
    { donemYili: null },
    { donemYili: 2026 },
  ), false);
  assert.equal(_test.hasMatchingAcademicPeriod(
    {},
    { donemYili: 2026 },
  ), false);
});
