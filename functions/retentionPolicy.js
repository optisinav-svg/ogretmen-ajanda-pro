const RETENTION_COLLECTIONS = Object.freeze([
  // Period-owned records. Shared book-library definitions and user profiles
  // are intentionally excluded because they are not owned by one school year.
  'bireyselDersOturumlari',
  'ogrenciOdevBildirimleri',
  'ogrenciEslesmeTalepleri',
  'ogrenciEslesmeKodlari',
  'ogretmenOgrenciBaglantilari',
  'ogrenciKayitEslesmeleri',
  'bireyselEtkinlikler',
  'dersNotlari',
  'yoklamalar',
  'odevler',
  'konular',
  'kitaplar',
  'dersler',
  'ogrenciler',
  'siniflar',
  'okullar',
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

/**
 * Returns the academic-period start year that has completed its third
 * academic year, or null throughout June.
 *
 * Example: 2029-07-01 in Europe/Istanbul => 2026 (2026/27 is now expired).
 * June is deliberately skipped so the period ending on June 30 is retained
 * through its final day.
 */
function expiredPeriodStartYear(date = new Date()) {
  const { year, month } = istanbulDateParts(date);

  if (month === 6) return null;

  const activePeriodStartYear = month >= 7 ? year : year - 1;
  return activePeriodStartYear - 3;
}

/**
 * Fail closed: only records with an explicit numeric period and a non-empty
 * owner UID can be deleted. Legacy records without donemYili are not inferred
 * from timestamps because June overlap makes that inference unsafe.
 */
function isEligiblePeriodRecord(data, cutoffYear) {
  return Boolean(
    data &&
    typeof data.donemYili === 'number' &&
    Number.isInteger(data.donemYili) &&
    data.donemYili <= cutoffYear &&
    typeof data.uid === 'string' &&
    data.uid.trim().length > 0
  );
}

module.exports = {
  RETENTION_COLLECTIONS,
  istanbulDateParts,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
};
