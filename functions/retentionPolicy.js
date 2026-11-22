// Dönem saklama politikası — Firebase Spark uyumlu, saf yardımcı fonksiyonlar.
// Bu modül kendi başına hiçbir veriyi silmez ve zamanlayıcı başlatmaz.
// Silme işlemi, uygulama içinde yetkili kullanıcı tarafından Temmuz ayında
// başlatılan, önce önizleme sunan ve açık onay gerektiren akıştan yürütülmelidir.

const RETENTION_COLLECTIONS = Object.freeze([
  // Kullanıcının tarif ettiği dönemsel çalışma verileri.
  // Ana kayıtlar (okullar/sınıflar/öğrenciler), kullanıcı profilleri,
  // bağlantı metadata'sı ve ortak kitap kütüphanesi burada bulunmaz.
  'dersNotlari',
  'yoklamalar',
  'odevler',
  'kitaplar',
  'konular',
]);

function istanbulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function activePeriodStartYear(date = new Date()) {
  const { year, month } = istanbulDateParts(date);
  return month >= 7 ? year : year - 1;
}

function archivedPeriodStartYear(date = new Date()) {
  return activePeriodStartYear(date) - 1;
}

/**
 * Returns the one academic period eligible for the current year's July cleanup.
 * The current period is untouched; the immediately previous period remains
 * readable as an archive; only the period before that is eligible.
 *
 * Example: July 2026 => 2024 (2024/25); 2025/26 remains archived and
 * 2026/27 remains the active period.
 *
 * Returns null outside July. This is not a scheduler: Spark cannot run
 * scheduled Cloud Functions. It is a guard for the in-app cleanup flow.
 */
function expiredPeriodStartYear(date = new Date()) {
  const { month } = istanbulDateParts(date);
  if (month !== 7) return null;
  return activePeriodStartYear(date) - 2;
}

function isEligiblePeriodRecord(data, cutoffYear) {
  return Boolean(
    data &&
    Number.isInteger(cutoffYear) &&
    typeof data.donemYili === 'number' &&
    Number.isInteger(data.donemYili) &&
    data.donemYili === cutoffYear &&
    typeof data.uid === 'string' &&
    data.uid.trim().length > 0
  );
}

module.exports = {
  RETENTION_COLLECTIONS,
  istanbulDateParts,
  activePeriodStartYear,
  archivedPeriodStartYear,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
};
