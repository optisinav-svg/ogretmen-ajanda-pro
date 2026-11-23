const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FIRST_CLEANUP_YEAR,
  RETENTION_COLLECTIONS,
  activePeriodStartYear,
  archivedPeriodStartYear,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
} = require('./retentionPolicy');
const d = value => new Date(value);

test('Üç yıllık saklama süresi ilk kez Temmuz 2029 döneminde 2026 kayıtlarını uygun kılar', () => {
  assert.equal(FIRST_CLEANUP_YEAR, 2029);
  assert.equal(expiredPeriodStartYear(d('2026-07-01T03:20:00+03:00')), null);
  assert.equal(expiredPeriodStartYear(d('2028-07-01T03:20:00+03:00')), null);
  assert.equal(expiredPeriodStartYear(d('2029-06-30T23:59:59+03:00')), null);
  assert.equal(expiredPeriodStartYear(d('2029-07-01T03:20:00+03:00')), 2026);
  assert.equal(expiredPeriodStartYear(d('2029-08-01T00:00:00+03:00')), null);
});

test('Sonraki Temmuzlarda yalnızca üç yıl önce başlayan tek akademik dönem seçilir', () => {
  assert.equal(expiredPeriodStartYear(d('2030-07-01T03:20:00+03:00')), 2027);
  assert.equal(expiredPeriodStartYear(d('2031-07-01T03:20:00+03:00')), 2028);
});

test('Mevcut akademik dönem hesaplaması 1 Haziran başlangıcıyla uyumlu kalır', () => {
  assert.equal(activePeriodStartYear(d('2026-05-31T12:00:00+03:00')), 2025);
  assert.equal(activePeriodStartYear(d('2026-06-01T00:00:00+03:00')), 2026);
  assert.equal(archivedPeriodStartYear(d('2026-07-01T00:00:00+03:00')), 2025);
});

test('Yalnızca hedef dönem yılıyla tam eşleşen sayısal kayıt uygun sayılır', () => {
  assert.equal(isEligiblePeriodRecord({ donemYili: 2026, uid: 'teacher-1' }, 2026), true);
  assert.equal(isEligiblePeriodRecord({ donemYili: 2025, uid: 'teacher-1' }, 2026), false);
  assert.equal(isEligiblePeriodRecord({ donemYili: '2026', uid: 'teacher-1' }, 2026), false);
});

test('Temizlik öğretmene ait yerel kayıtları ve bağlantıları kapsar; genel kullanıcı profillerini kapsamaz', () => {
  for (const name of [
    'ogrenciler', 'siniflar', 'okullar', 'bireyselEtkinlikler',
    'bireyselDersOturumlari', 'ogretmenOgrenciBaglantilari',
    'ogrenciKayitEslesmeleri', 'ogrenciEslesmeTalepleri',
    'ogrenciEslesmeKodlari', 'ogrenciOdevBildirimleri',
    'ogrenciYeniOdevBildirimleri',
  ]) assert.ok(RETENTION_COLLECTIONS.includes(name), name);
  assert.ok(!RETENTION_COLLECTIONS.includes('kullanicilar'));
  assert.ok(!RETENTION_COLLECTIONS.includes('ogrenciPushTokenlari'));
});
