const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');
if (!getApps().length) initializeApp({ projectId: 'demo-ogretmen-ajanda-account-tests' });
const { _test } = require('../accountLifecycle');

test('person names are normalized and bounded', () => {
  assert.equal(_test.normalizePersonName('  Ahmet   Yılmaz ', 'Ad'), 'Ahmet Yılmaz');
  assert.throws(() => _test.normalizePersonName('', 'Ad'));
  assert.throws(() => _test.normalizePersonName('x'.repeat(61), 'Ad'));
});
test('only supported account roles are accepted', () => {
  assert.equal(_test.normalizeRole('ogrenci'), 'ogrenci');
  assert.equal(_test.normalizeRole('ogretmen'), 'ogretmen');
  assert.throws(() => _test.normalizeRole('admin'));
});
