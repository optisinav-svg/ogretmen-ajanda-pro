const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RETENTION_COLLECTIONS,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
} = require('./retentionPolicy');

const istanbulDate = value => new Date(value);

test('keeps the expiring period throughout June', () => {
  assert.equal(expiredPeriodStartYear(istanbulDate('2029-06-01T12:00:00+03:00')), null);
  assert.equal(expiredPeriodStartYear(istanbulDate('2029-06-30T23:59:59+03:00')), null);
});

test('expires 2026/27 from July 1, 2029', () => {
  assert.equal(expiredPeriodStartYear(istanbulDate('2029-07-01T00:00:00+03:00')), 2026);
  assert.equal(expiredPeriodStartYear(istanbulDate('2030-05-31T12:00:00+03:00')), 2026);
});

test('expires the next period only after its third year ends', () => {
  assert.equal(expiredPeriodStartYear(istanbulDate('2030-06-30T23:59:59+03:00')), null);
  assert.equal(expiredPeriodStartYear(istanbulDate('2030-07-01T00:00:00+03:00')), 2027);
});

test('only explicitly period-tagged, owned records are eligible', () => {
  assert.equal(isEligiblePeriodRecord({ donemYili: 2026, uid: 'teacher-1' }, 2026), true);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2027, uid: 'teacher-1' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: '2026', uid: 'teacher-1' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2026 }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-1' }, 2026), false);
});


test('student homework notifications are included in three-year retention', () => {
  assert.ok(RETENTION_COLLECTIONS.includes('ogrenciOdevBildirimleri'));
  assert.equal(isEligiblePeriodRecord({
    uid: 'teacher-1',
    donemYili: 2026,
    ogrenciUid: 'student-1',
    durum: 'tamamlandi_bildirildi',
  }, 2026), true);
});
