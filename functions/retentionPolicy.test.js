const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RETENTION_COLLECTIONS,
  activePeriodStartYear,
  archivedPeriodStartYear,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
} = require('./retentionPolicy');

const istanbulDate = value => new Date(value);

test('July 2026 keeps 2025/26 as archive and identifies only 2024/25 for cleanup', () => {
  const date = istanbulDate('2026-07-01T03:20:00+03:00');
  assert.equal(activePeriodStartYear(date), 2026);
  assert.equal(archivedPeriodStartYear(date), 2025);
  assert.equal(expiredPeriodStartYear(date), 2024);
});

test('the cleanup guard is closed outside July', () => {
  assert.equal(expiredPeriodStartYear(istanbulDate('2026-06-30T23:59:59+03:00')), null);
  assert.equal(expiredPeriodStartYear(istanbulDate('2026-08-01T03:20:00+03:00')), null);
  assert.equal(expiredPeriodStartYear(istanbulDate('2027-05-15T12:00:00+03:00')), null);
});

test('the next July advances the single-period cleanup target by one year', () => {
  assert.equal(expiredPeriodStartYear(istanbulDate('2027-07-01T03:20:00+03:00')), 2025);
});

test('only the exact expired period and an explicitly owned record are eligible', () => {
  assert.equal(isEligiblePeriodRecord({ donemYili: 2024, uid: 'teacher-1' }, 2024), true);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2023, uid: 'teacher-1' }, 2024), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2025, uid: 'teacher-1' }, 2024), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: '2024', uid: 'teacher-1' }, 2024), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2024 }, 2024), false);
});

test('cleanup allowlist contains only the agreed period activity categories', () => {
  assert.deepEqual([...RETENTION_COLLECTIONS], [
    'dersNotlari',
    'yoklamalar',
    'odevler',
    'kitaplar',
    'konular',
  ]);
});
