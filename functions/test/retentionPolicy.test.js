const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  RETENTION_COLLECTIONS,
  istanbulDateParts,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
} = require('../retentionPolicy');

test('retention cutoff follows the June academic-year overlap in Istanbul', () => {
  assert.deepEqual(istanbulDateParts(new Date('2029-06-30T20:59:00.000Z')), {
    year: 2029, month: 6, day: 30,
  });
  assert.equal(expiredPeriodStartYear(new Date('2029-06-15T09:00:00.000Z')), null);
  assert.equal(expiredPeriodStartYear(new Date('2029-07-01T09:00:00.000Z')), 2026);
  assert.equal(expiredPeriodStartYear(new Date('2030-01-01T09:00:00.000Z')), 2026);
  assert.equal(expiredPeriodStartYear(new Date('2030-07-01T09:00:00.000Z')), 2027);
});

test('retention deletion fails closed for missing period, invalid period or missing owner', () => {
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a', donemYili: 2026 }, 2026), true);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a', donemYili: 2027 }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a', donemYili: '2025' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: '', donemYili: 2025 }, 2026), false);
  assert.equal(isEligiblePeriodRecord(null, 2026), false);
});

test('retention policy excludes user profiles and shared library definitions', () => {
  assert.equal(RETENTION_COLLECTIONS.includes('ogrenciYeniOdevBildirimleri'), true);
  assert.equal(RETENTION_COLLECTIONS.includes('kullanicilar'), false);
  assert.equal(RETENTION_COLLECTIONS.includes('kitapKutuphanesi'), false);
  assert.equal(RETENTION_COLLECTIONS.includes('kitapKutuphanesiKonulari'), false);
});
