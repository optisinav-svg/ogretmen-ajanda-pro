const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../profileRegistration');

test('teacher profile input accepts normalized valid fields', () => {
  assert.deepEqual(_test.validateTeacherProfileInput({
    kullaniciAdi: '  Rıza Gökçe  ',
    brans: 'Coğrafya',
    sezon: '2026/2027',
  }), {
    kullaniciAdi: 'Rıza Gökçe',
    brans: 'Coğrafya',
    sezon: '2026/2027',
  });
});

test('teacher profile input rejects missing, oversized and malformed fields', () => {
  for (const input of [
    {},
    { kullaniciAdi: 'A', brans: 'Coğrafya', sezon: '2026/2027' },
    { kullaniciAdi: 'Öğretmen', brans: '', sezon: '2026/2027' },
    { kullaniciAdi: 'Öğretmen', brans: 'Coğrafya', sezon: '2026/2028' },
    { kullaniciAdi: 'x'.repeat(81), brans: 'Coğrafya', sezon: '2026/2027' },
  ]) {
    assert.throws(() => _test.validateTeacherProfileInput(input));
  }
});
