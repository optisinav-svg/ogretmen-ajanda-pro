// Yıllık dönem arşiv politikası — Spark uyumlu saf yardımcılar.
// Firestore kayıtları fiziksel dosyalara taşınmaz; donemYili alanı aynı işi
// mantıksal yıl arşivi olarak görür. Bu modül kendiliğinden silme yapmaz.
const FIRST_CLEANUP_YEAR = 2029;
const RETENTION_COLLECTIONS = Object.freeze([
  'dersNotlari',
  'dersler',
  'yoklamalar',
  'odevler',
  'kitaplar',
  'konular',
]);
function istanbulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}
// Mevcut uygulamanın utils/donem.js dönem başlangıç mantığı korunur:
// 1 Haziran'da yeni dönem yılı başlar. Bu yardımcıya dokunulmaz.
function activePeriodStartYear(date = new Date()) {
  const { year, month } = istanbulDateParts(date);
  return month >= 6 ? year : year - 1;
}
function archivedPeriodStartYear(date = new Date()) {
  return activePeriodStartYear(date) - 1;
}
/**
 * İlk temizlik Temmuz 2029'da 2026 dönemini siler.
 * Sonraki yıllarda, başlangıç yılından itibaren üç yılını dolduran dönem temizlenir.
 * Yalnızca Temmuz ve 2028+ yıllarında tek bir dönem adayı döndürür.
 */
function expiredPeriodStartYear(date = new Date()) {
  const { year, month } = istanbulDateParts(date);
  if (month !== 7 || year < FIRST_CLEANUP_YEAR) return null;
  return year - 3;
}
function isEligiblePeriodRecord(data, targetYear) {
  return Boolean(data && Number.isInteger(targetYear)
    && typeof data.donemYili === 'number'
    && Number.isInteger(data.donemYili)
    && data.donemYili === targetYear);
}
module.exports = {
  FIRST_CLEANUP_YEAR, RETENTION_COLLECTIONS, istanbulDateParts,
  activePeriodStartYear, archivedPeriodStartYear, expiredPeriodStartYear,
  isEligiblePeriodRecord,
};
