const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) initializeApp({ projectId: 'demo-ogretmen-ajanda-student-notifications' });
const {
  validateExpoPushToken,
  makePushTokenId,
  makeHomeworkNotificationId,
  isHomeworkTargeted,
  isEligibleHomeworkLink,
  buildHomeworkPushMessage,
} = require('../studentNotifications')._test;

test('only valid Expo push tokens are accepted', () => {
  assert.equal(validateExpoPushToken('ExponentPushToken[abc_123-XYZ]'), true);
  assert.equal(validateExpoPushToken('ExpoPushToken[abc_123-XYZ]'), true);
  assert.equal(validateExpoPushToken('not-a-token'), false);
  assert.equal(validateExpoPushToken('ExponentPushToken[]'), false);
  assert.equal(validateExpoPushToken('ExponentPushToken[bad token]'), false);
  assert.equal(validateExpoPushToken('x'.repeat(201)), false);
});

test('push token storage IDs are deterministic and user-scoped', () => {
  const token = 'ExponentPushToken[abc_123]';
  assert.equal(makePushTokenId('student-a', token), makePushTokenId('student-a', token));
  assert.notEqual(makePushTokenId('student-a', token), makePushTokenId('student-b', token));
});

test('homework notification IDs are deterministic per student link', () => {
  const id = makeHomeworkNotificationId('homework-a', 'student-a', 'link-a');
  assert.equal(id, makeHomeworkNotificationId('homework-a', 'student-a', 'link-a'));
  assert.notEqual(id, makeHomeworkNotificationId('homework-a', 'student-b', 'link-a'));
  assert.notEqual(id, makeHomeworkNotificationId('homework-a', 'student-a', 'link-b'));
});

test('homework targeting uses explicit student record IDs only', () => {
  const homework = { hedefOgrenciIds: ['record-a', 'record-b'] };
  assert.equal(isHomeworkTargeted(homework, 'record-a'), true);
  assert.equal(isHomeworkTargeted(homework, 'record-c'), false);
  assert.equal(isHomeworkTargeted({}, 'record-a'), false);
});

test('push payload includes assignment and due date without exposing student identity', () => {
  const message = buildHomeworkPushMessage(
    'ExponentPushToken[abc_123]',
    { aciklama: 'Harita bilgisi testleri', teslimTarihi: '2026-11-30' },
    'homework-a',
    'notification-a',
  );
  assert.equal(message.to, 'ExponentPushToken[abc_123]');
  assert.equal(message.title, 'Yeni ödeviniz var');
  assert.match(message.body, /Harita bilgisi testleri/);
  assert.match(message.body, /2026-11-30/);
  assert.deepEqual(message.data, {
    type: 'homework_assigned',
    homeworkId: 'homework-a',
    notificationId: 'notification-a',
  });
  assert.equal(Object.hasOwn(message.data, 'ogrenciUid'), false);
});


test('only active, permissioned links with matching owner, class and period receive homework notices', () => {
  const link = {
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-a',
    ogrenciKayitId: 'record-a',
    sinifId: 'class-a',
    donemYili: 2026,
    durum: 'active',
    izinler: { odevler: true },
  };
  const student = { uid: 'teacher-a', sinifId: 'class-a', donemYili: 2026 };
  assert.equal(isEligibleHomeworkLink(link, student, 'teacher-a', 'class-a', 2026, ['record-a']), true);
  assert.equal(isEligibleHomeworkLink({ ...link, durum: 'revoked' }, student, 'teacher-a', 'class-a', 2026, ['record-a']), false);
  assert.equal(isEligibleHomeworkLink({ ...link, izinler: { odevler: false } }, student, 'teacher-a', 'class-a', 2026, ['record-a']), false);
  assert.equal(isEligibleHomeworkLink({ ...link, donemYili: 2025 }, student, 'teacher-a', 'class-a', 2026, ['record-a']), false);
  assert.equal(isEligibleHomeworkLink(link, { ...student, uid: 'teacher-b' }, 'teacher-a', 'class-a', 2026, ['record-a']), false);
  assert.equal(isEligibleHomeworkLink(link, student, 'teacher-a', 'class-a', 2026, ['record-b']), false);
});
