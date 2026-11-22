const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  FIRST_CLEANUP_YEAR,
  RETENTION_COLLECTIONS,
  istanbulDateParts,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
} = require('../retentionPolicy');

test('retention follows the exact July-only annual rule in Istanbul', () => {
  assert.equal(FIRST_CLEANUP_YEAR, 2028);
  assert.deepEqual(istanbulDateParts(new Date('2029-06-30T20:59:00.000Z')), {
    year: 2029, month: 6, day: 30,
  });
  assert.equal(expiredPeriodStartYear(new Date('2026-07-01T09:00:00.000Z')), null);
  assert.equal(expiredPeriodStartYear(new Date('2027-07-01T09:00:00.000Z')), null);
  assert.equal(expiredPeriodStartYear(new Date('2028-06-30T20:59:00.000Z')), null);
  assert.equal(expiredPeriodStartYear(new Date('2028-07-01T09:00:00.000Z')), 2026);
  assert.equal(expiredPeriodStartYear(new Date('2029-01-01T09:00:00.000Z')), null);
  assert.equal(expiredPeriodStartYear(new Date('2029-07-01T09:00:00.000Z')), 2027);
  assert.equal(expiredPeriodStartYear(new Date('2030-07-01T09:00:00.000Z')), 2028);
});

test('retention deletion fails closed for missing or invalid period label', () => {
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a', donemYili: 2026 }, 2026), true);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a', donemYili: 2027 }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: 'teacher-a', donemYili: '2026' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ uid: '', donemYili: 2026 }, 2026), true);
  assert.equal(isEligiblePeriodRecord(null, 2026), false);
});

test('retention includes only the six agreed activity collections', () => {
  assert.deepEqual([...RETENTION_COLLECTIONS], [
    'dersNotlari', 'dersler', 'yoklamalar', 'odevler', 'kitaplar', 'konular',
  ]);
  for (const excluded of ['ogrenciler', 'siniflar', 'okullar', 'kullanicilar',
    'ogrenciYeniOdevBildirimleri', 'kitapKutuphanesi', 'kitapKutuphanesiKonulari']) {
    assert.equal(RETENTION_COLLECTIONS.includes(excluded), false);
  }
});
