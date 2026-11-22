const test = require('node:test');
const assert = require('node:assert/strict');
const { FIRST_CLEANUP_YEAR, RETENTION_COLLECTIONS, activePeriodStartYear,
  archivedPeriodStartYear, expiredPeriodStartYear, isEligiblePeriodRecord } = require('./retentionPolicy');
const d = value => new Date(value);
test('2026 is the first data year and no cleanup happens before July 2028', () => {
  assert.equal(FIRST_CLEANUP_YEAR, 2028);
  assert.equal(expiredPeriodStartYear(d('2026-07-01T03:20:00+03:00')), null);
  assert.equal(expiredPeriodStartYear(d('2027-07-01T03:20:00+03:00')), null);
  assert.equal(expiredPeriodStartYear(d('2028-06-30T23:59:59+03:00')), null);
});
test('July 2028 deletes only 2026; July 2029 deletes only 2027', () => {
  assert.equal(expiredPeriodStartYear(d('2028-07-01T03:20:00+03:00')), 2026);
  assert.equal(expiredPeriodStartYear(d('2029-07-01T03:20:00+03:00')), 2027);
  assert.equal(expiredPeriodStartYear(d('2030-07-01T03:20:00+03:00')), 2028);
});
test('existing academic period calculation remains aligned with June 1 start', () => {
  assert.equal(activePeriodStartYear(d('2026-05-31T12:00:00+03:00')), 2025);
  assert.equal(activePeriodStartYear(d('2026-06-01T00:00:00+03:00')), 2026);
  assert.equal(archivedPeriodStartYear(d('2026-07-01T00:00:00+03:00')), 2025);
});
test('only exact target year and owned records qualify', () => {
  assert.equal(isEligiblePeriodRecord({ donemYili: 2026, uid: 'teacher-1' }, 2026), true);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2025, uid: 'teacher-1' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2027, uid: 'teacher-1' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: '2026', uid: 'teacher-1' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2026 }, 2026), false);
});
test('only agreed activity collections are in the cleanup allowlist', () => {
  assert.deepEqual([...RETENTION_COLLECTIONS], [
    'dersNotlari', 'dersler', 'yoklamalar', 'odevler', 'kitaplar', 'konular',
  ]);
});
