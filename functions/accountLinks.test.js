const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');
if (!getApps().length) initializeApp({ projectId: 'demo-ogretmen-ajanda-functions' });
const { _test } = require('./accountLinks');

test('Eşleştirme kodu kriptografik rastgele 16 karakter hex üretir', () => {
  const code = _test.createPairingCode();
  assert.match(code, /^[A-F0-9]{16}$/);
});

test('Kod özeti ham kodu içermez ve sabit uzunluktadır', () => {
  const code = _test.createPairingCode();
  const digest = _test.sha256(code);
  assert.equal(digest.length, 64);
  assert.notEqual(digest, code);
});

test('Bağlantı kimliği öğretmen, öğrenci ve sınıfa göre ayrıdır', () => {
  const id = _test.createLinkId('teacher-a', 'student-a', 'class-a');
  assert.equal(id, 'teacher-a__student-a__class-a');
  assert.notEqual(id, _test.createLinkId('teacher-a', 'student-b', 'class-a'));
  assert.notEqual(id, _test.createLinkId('teacher-b', 'student-a', 'class-a'));
});

test('Eşleştirme kodu süresi tam 12 saattir', () => {
  assert.equal(_test.CODE_TTL_MS, 12 * 60 * 60 * 1000);
});

test('Paylaşım izinleri yalnızca bilinen altı anahtarı kabul eder', () => {
  const normalized = _test.normalizePermissions({
    dersProgrami: true,
    dersNotlari: false,
    konular: true,
    yoklama: true,
    odevler: false,
    kitaplar: true,
  });
  assert.deepEqual(Object.keys(normalized).sort(), [..._test.PERMISSION_KEYS].sort());
  assert.equal(normalized.dersNotlari, false);
});

test('Bilinmeyen paylaşım izni reddedilir', () => {
  assert.throws(() => _test.normalizePermissions({ tumVeriler: true }), { code: 'invalid-argument' });
});

test('Boolean olmayan paylaşım izni reddedilir', () => {
  assert.throws(() => _test.normalizePermissions({ odevler: 'true' }), { code: 'invalid-argument' });
});


test('Öğrenci eski dönem ödev işlemlerini 30 Haziran sonuna kadar yapabilir; 1 Temmuzda dönem salt okunur olur', () => {
  assert.equal(_test.isAcademicPeriodEditable(2026, new Date('2026-06-01T00:00:00+03:00')), true);
  assert.equal(_test.isAcademicPeriodEditable(2026, new Date('2027-06-30T23:59:59+03:00')), true);
  assert.equal(_test.isAcademicPeriodEditable(2026, new Date('2027-07-01T00:00:00+03:00')), false);
  assert.equal(_test.isAcademicPeriodEditable(2026, new Date('2026-05-31T23:59:59+03:00')), false);
});

test('Öğrenci eşleştirmesi doğrulanmış e-posta ve kayıtlı ad-soyadın ikisini de gerektirir', () => {
  const record = { adSoyad: 'Çağrı Öztürk', eposta: 'ogrenci@example.com' };
  assert.equal(_test.assertStudentIdentityMatches(record, 'ogrenci@example.com', 'Çağrı Öztürk', true), true);
  assert.throws(() => _test.assertStudentIdentityMatches(record, 'baska@example.com', 'Çağrı Öztürk', true), /e-posta/i);
  assert.throws(() => _test.assertStudentIdentityMatches(record, 'ogrenci@example.com', 'Başka Öğrenci', true), /ad-soyad/i);
  assert.throws(() => _test.assertStudentIdentityMatches(record, 'ogrenci@example.com', 'Çağrı Öztürk', false), /doğrulanmalıdır/i);
});

test('Ad-soyad karşılaştırması Türkçe harfleri ve biçim farklarını güvenli biçimde normalize eder', () => {
  const record = { adSoyad: 'Çağrı Öztürk', eposta: 'ogrenci@example.com' };
  assert.equal(_test.assertStudentIdentityMatches(record, ' Ogrenci@Example.com ', 'ÇAĞRI   ÖZTÜRK', true), true);
});

test('Eski kayıtta e-posta yoksa otomatik öğrenci hesabı eşleştirmesi yapılmaz', () => {
  assert.throws(
    () => _test.assertStudentIdentityMatches({ adSoyad: 'Çağrı Öztürk' }, 'ogrenci@example.com', 'Çağrı Öztürk', true),
    /e-posta/i,
  );
});

test('Aynı öğretmen öğrenci kaydı ikinci bir öğrenci hesabına bağlanamaz', () => {
  assert.throws(
    () => _test.assertStudentRecordAvailable({ durum: 'active', ogrenciUid: 'student-a' }, 'student-b'),
    { code: 'already-exists' },
  );
});

test('Aynı öğrenci hesabı için mevcut bağlantı yeniden etkinleştirilebilir', () => {
  assert.doesNotThrow(
    () => _test.assertStudentRecordAvailable({ durum: 'active', ogrenciUid: 'student-a' }, 'student-a'),
  );
});

test('İptal edilmiş öğrenci kaydı başka hesapla yeniden eşleştirilebilir', () => {
  assert.doesNotThrow(
    () => _test.assertStudentRecordAvailable({ durum: 'revoked', ogrenciUid: 'student-a' }, 'student-b'),
  );
});


test('Sınıfı değişen öğrenci kendi geçmiş sınıf bağlantısını korur', () => {
  const student = {
    sinifId: 'class-current',
    sinifGecmisiIds: ['class-old', 'class-older'],
  };
  assert.equal(_test.studentBelongsToLinkedClass(student, 'class-current'), true);
  assert.equal(_test.studentBelongsToLinkedClass(student, 'class-old'), true);
  assert.equal(_test.studentBelongsToLinkedClass(student, 'class-older'), true);
  assert.equal(_test.studentBelongsToLinkedClass(student, 'class-unrelated'), false);
});

test('Öğrenci eşleştirmesi yalnızca lise kademeleri için açıktır', () => {
  for (const grade of ['9', '10', '11', '12', 'TYT', 'AYT']) {
    assert.equal(_test.isAllowedStudentGrade(grade), true);
  }
  for (const grade of ['1', '2', '3', '4', '5', '6', '7', '8', '', null, undefined]) {
    assert.equal(_test.isAllowedStudentGrade(grade), false);
  }
});
