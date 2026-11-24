const assert = require('node:assert/strict');
const { test } = require('node:test');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-academic-period-transfer' });
const { _test } = require('../academicPeriodTransfer');

test('transfer IDs are stable and separated by entity and target period', () => {
  assert.equal(_test.stableId('student', 2027, 'source-1'), _test.stableId('student', 2027, 'source-1'));
  assert.notEqual(_test.stableId('student', 2027, 'source-1'), _test.stableId('student', 2028, 'source-1'));
  assert.notEqual(_test.stableId('student', 2027, 'source-1'), _test.stableId('book', 2027, 'source-1'));
});

test('12th grade, TYT and AYT source classes always transfer as TYT', () => {
  assert.equal(_test.normalizedGrade('12', '11'), 'TYT');
  assert.equal(_test.normalizedGrade('TYT', '9'), 'TYT');
  assert.equal(_test.normalizedGrade('AYT', '10'), 'TYT');
});

test('other grades use the teacher-selected valid target grade', () => {
  assert.equal(_test.normalizedGrade('10', '11'), '11');
  assert.throws(() => _test.normalizedGrade('10', 'mezun'), error => error.code === 'invalid-argument');
});

test('topic transfer preserves page definitions but resets period progress', () => {
  const result = _test.resetTopicProgress({
    ad: 'Türkiye iklimi', baslangicSayfa: 20, bitisSayfa: 28,
    durum: 'yapildi', tamamlandi: true, tamamlanmaTarihi: '2026-11-01',
    ilerleme: 90, durumGecmisi: [{ durum: 'yapildi' }], kazanımKodu: '10.1.1',
  });
  assert.equal(result.ad, 'Türkiye iklimi');
  assert.equal(result.baslangicSayfa, 20);
  assert.equal(result.bitisSayfa, 28);
  assert.equal(result.kazanımKodu, '10.1.1');
  assert.equal('durum' in result, false);
  assert.equal('tamamlandi' in result, false);
  assert.equal('ilerleme' in result, false);
});

test('transferred school/class/student records do not inherit archive or old move state', () => {
  const school = _test.cleanSchoolOrClass({ ad: 'Okul', arsivlendi: true, arsivDurumu: 'tamamlandi', arsivTarihi: 'x' });
  assert.equal(school.ad, 'Okul');
  assert.equal('arsivlendi' in school, false);
  const student = _test.cleanStudent({ adSoyad: 'Öğrenci', sinifGecmisiIds: ['old'], sinifTasiIslemi: { hedef: 'x' }, kayitsizMi: true });
  assert.equal(student.adSoyad, 'Öğrenci');
  assert.equal('sinifGecmisiIds' in student, false);
  assert.equal('sinifTasiIslemi' in student, false);
  assert.equal('kayitsizMi' in student, false);
});

test('target period editing window follows June 1 through next June 30 in Istanbul time', () => {
  assert.equal(_test.isEditablePeriod(2027, new Date('2027-05-31T20:59:59Z')), false);
  assert.equal(_test.isEditablePeriod(2027, new Date('2027-05-31T21:00:00Z')), true);
  assert.equal(_test.isEditablePeriod(2027, new Date('2028-06-30T20:59:59Z')), true);
  assert.equal(_test.isEditablePeriod(2027, new Date('2028-06-30T21:00:00Z')), false);
});
