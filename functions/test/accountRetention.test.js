const assert = require('node:assert/strict');
const { test } = require('node:test');
const { initializeApp, getApps } = require('firebase-admin/app');
if (!getApps().length) initializeApp({ projectId: 'demo-account-retention-tests' });
const { _test } = require('../accountRetention');

test('closed-account expiry accepts Firestore timestamps and dates', () => {
  const date = new Date('2029-01-01T00:00:00.000Z');
  assert.equal(_test.expiryMillis({ hesapSaklamaSonu: date }), date.getTime());
  assert.equal(_test.expiryMillis({ hesapSaklamaSonu: null }), 0);
});

test('deletion confirmation requires the exact preview counts', () => {
  const expected = { okullar: 2, ogrenciler: 10, firebaseAuth: 1, kullanicilar: 1 };
  assert.equal(_test.countsMatch(expected, { okullar: 2, ogrenciler: 10, firebaseAuth: 1, kullanicilar: 1 }), true);
  assert.equal(_test.countsMatch(expected, { okullar: 2, ogrenciler: 9, firebaseAuth: 1, kullanicilar: 1 }), false);
  assert.equal(_test.countsMatch(expected, { okullar: 2, ogrenciler: 10, firebaseAuth: 0, kullanicilar: 1 }), false);
});

test('teacher and student cleanup scopes remain separated', () => {
  assert.ok(_test.OWNER_COLLECTIONS.ogretmen.okullar.includes('uid'));
  assert.ok(_test.OWNER_COLLECTIONS.ogretmen.ogrenciler.includes('uid'));
  assert.ok(_test.OWNER_COLLECTIONS.ogrenci.ogretmenOgrenciBaglantilari.includes('ogrenciUid'));
  assert.equal(_test.OWNER_COLLECTIONS.ogrenci.ogrenciler, undefined);
  assert.equal(_test.OWNER_COLLECTIONS.ogretmen.kullanicilar, undefined);
});
