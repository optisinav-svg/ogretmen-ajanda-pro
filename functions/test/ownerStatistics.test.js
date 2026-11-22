const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../ownerStatistics');

test('owner statistics callable requires the trusted custom claim', () => {
  assert.equal(_test.isApplicationOwner({ auth: { token: { uygulamaSahibi: true } } }), true);
  assert.equal(_test.isApplicationOwner({ auth: { token: { uygulamaSahibi: false } } }), false);
  assert.equal(_test.isApplicationOwner({ auth: { token: {} } }), false);
  assert.equal(_test.isApplicationOwner({}), false);
});

test('statistics aggregate registered accounts and active links without returning student identity data', () => {
  const result = _test.buildStatistics([
    { id: 't1', kullaniciAdi: 'Öğretmen A', brans: 'Coğrafya' },
    { id: 't2', kullaniciAdi: 'Öğretmen B', brans: 'Tarih' },
  ], [
    { ogretmenUid: 't1', ogrenciUid: 's1', durum: 'active' },
    { ogretmenUid: 't1', ogrenciUid: 's1', durum: 'active' },
    { ogretmenUid: 't2', ogrenciUid: 's1', durum: 'active' },
    { ogretmenUid: 't1', ogrenciUid: 's2', durum: 'revoked' },
  ], [
    { ogretmenUid: 't1', durum: 'bekliyor' },
    { ogretmenUid: 'legacy', durum: 'bekliyor' },
  ], 1);

  assert.equal(result.teacherAccountCount, 2);
  assert.equal(result.studentAccountCount, 1);
  assert.equal(result.activeLinkCount, 3);
  assert.equal(result.uniqueLinkedStudentAccountCount, 1);
  assert.equal(result.pendingRequestCount, 1);
  assert.equal(result.revokedLinkCount, 1);
  assert.equal(result.teachers[0].linkedStudentAccounts, 1);
  assert.equal(JSON.stringify(result).includes('ogrenciUid'), false);
  assert.equal(JSON.stringify(result).includes('s1'), false);
});
