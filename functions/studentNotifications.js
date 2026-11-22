const { createHash } = require('node:crypto');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');

const REGION = 'europe-west1';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const db = getFirestore();

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  return request.auth.uid;
}

function validateExpoPushToken(token) {
  return typeof token === 'string'
    && token.length <= 200
    && /^(Exponent|Expo)PushToken\\[[A-Za-z0-9_-]+\\]$/.test(token);
}

function makePushTokenId(uid, token) {
  return sha256(uid + ':' + token);
}

function makeHomeworkNotificationId(homeworkId, studentUid, linkId) {
  return sha256([homeworkId, studentUid, linkId].join(':'));
}

function isHomeworkTargeted(homework, studentRecordId) {
  return Array.isArray(homework?.hedefOgrenciIds)
    && homework.hedefOgrenciIds.includes(studentRecordId);
}

function buildHomeworkPushMessage(token, homework, homeworkId, notificationId, linkId) {
  const title = 'Yeni ödeviniz var';
  const description = String(homework?.aciklama || homework?.baslik || 'Öğretmeniniz yeni bir ödev verdi.')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 110);
  const due = typeof homework?.teslimTarihi === 'string' && homework.teslimTarihi
    ? ' Son teslim: ' + homework.teslimTarihi.slice(0, 10) + '.'
    : '';
  return {
    to: token,
    title,
    body: description + due,
    sound: 'default',
    priority: 'high',
    channelId: 'homework',
    data: {
      type: 'homework_assigned',
      homeworkId,
      notificationId,
      linkId,
    },
  };
}

async function requireStudent(uid) {
  const profile = await db.collection('kullanicilar').doc(uid).get();
  if (!profile.exists || profile.get('rol') !== 'ogrenci') {
    throw new HttpsError('permission-denied', 'Bu işlem yalnızca öğrenci hesapları içindir.');
  }
  return profile;
}

exports.ogrenciPushTokenKaydet = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  await requireStudent(uid);
  const token = request.data?.token;
  const platform = request.data?.platform;
  const deviceId = typeof request.data?.deviceId === 'string'
    ? request.data.deviceId.slice(0, 120)
    : '';
  if (!validateExpoPushToken(token)) {
    throw new HttpsError('invalid-argument', 'Geçerli bir Expo bildirim belirteci alınamadı.');
  }
  if (!['ios', 'android'].includes(platform)) {
    throw new HttpsError('invalid-argument', 'Desteklenmeyen cihaz platformu.');
  }
  const ref = db.collection('ogrenciPushTokenlari').doc(makePushTokenId(uid, token));
  await ref.set({
    ogrenciUid: uid,
    token,
    platform,
    deviceId,
    aktif: true,
    guncellenme: FieldValue.serverTimestamp(),
    olusturulma: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { durum: 'kaydedildi' };
});

exports.ogrenciPushTokenSil = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const token = request.data?.token;
  if (!validateExpoPushToken(token)) {
    throw new HttpsError('invalid-argument', 'Geçerli bir Expo bildirim belirteci gönderilmelidir.');
  }
  await db.collection('ogrenciPushTokenlari').doc(makePushTokenId(uid, token)).delete();
  return { durum: 'silindi' };
});

async function sendExpoMessages(messages, tokenRefs) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Expo Push servisi HTTP ' + response.status + ' yanıtı verdi.');
  const payload = await response.json();
  if (!Array.isArray(payload.data) || payload.data.length !== messages.length) {
    throw new Error('Expo Push servisinden beklenmeyen yanıt alındı.');
  }
  const invalidRefs = [];
  let sent = 0;
  payload.data.forEach((ticket, index) => {
    if (ticket?.status === 'ok') {
      sent += 1;
    } else if (ticket?.details?.error === 'DeviceNotRegistered') {
      invalidRefs.push(tokenRefs[index]);
    }
  });
  if (invalidRefs.length) {
    const batch = db.batch();
    invalidRefs.forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return { sent, failed: messages.length - sent };
}

async function processHomeworkChange(homeworkId, homework, newlyTargetedIds, removedIds = []) {
  const teacherUid = homework?.uid;
  const classId = homework?.sinifId;
  const period = homework?.donemYili;
  const allTargets = Array.isArray(homework?.hedefOgrenciIds)
    ? [...new Set(homework.hedefOgrenciIds.filter(x => typeof x === 'string' && x))]
    : [];
  if (typeof teacherUid !== 'string' || !teacherUid
    || typeof classId !== 'string' || !classId
    || !Number.isInteger(period) || (!allTargets.length && !removedIds.length)) return;

  const [teacherSnap, classSnap] = await Promise.all([
    db.collection('kullanicilar').doc(teacherUid).get(),
    db.collection('siniflar').doc(classId).get(),
  ]);
  if (!teacherSnap.exists || teacherSnap.get('rol') !== 'ogretmen'
    || !classSnap.exists || classSnap.get('uid') !== teacherUid
    || classSnap.get('donemYili') !== period) return;

  const linksSnap = await db.collection('ogretmenOgrenciBaglantilari')
    .where('ogretmenUid', '==', teacherUid)
    .get();
  const links = linksSnap.docs
    .map(snap => ({ id: snap.id, ...snap.data() }))
    .filter(link => link.sinifId === classId);

  for (const link of links) {
    const notificationId = makeHomeworkNotificationId(homeworkId, link.ogrenciUid, link.id);
    const notificationRef = db.collection('ogrenciYeniOdevBildirimleri').doc(notificationId);

    if (removedIds.includes(link.ogrenciKayitId)) {
      const existing = await notificationRef.get();
      if (existing.exists && existing.get('durum') !== 'iptal') {
        await notificationRef.update({
          durum: 'iptal',
          iptalTarihi: FieldValue.serverTimestamp(),
        });
      }
      continue;
    }

    if (!newlyTargetedIds.includes(link.ogrenciKayitId)
      || !allTargets.includes(link.ogrenciKayitId)
      || link.durum !== 'active'
      || link.izinler?.odevler !== true) continue;

    const [studentSnap, studentProfileSnap] = await Promise.all([
      db.collection('ogrenciler').doc(link.ogrenciKayitId).get(),
      db.collection('kullanicilar').doc(link.ogrenciUid).get(),
    ]);
    if (!studentSnap.exists || studentSnap.get('uid') !== teacherUid
      || studentSnap.get('sinifId') !== classId
      || studentSnap.get('donemYili') !== period
      || link.donemYili !== period
      || !studentProfileSnap.exists || studentProfileSnap.get('rol') !== 'ogrenci') continue;

    const shouldSend = await db.runTransaction(async tx => {
      const current = await tx.get(notificationRef);
      if (current.exists && current.get('durum') !== 'iptal'
        && current.get('pushDurumu') === 'gonderildi') return false;
      const notificationData = {
        ogrenciUid: link.ogrenciUid,
        ogretmenUid: teacherUid,
        baglantiId: link.id,
        ogrenciKayitId: link.ogrenciKayitId,
        sinifId: classId,
        donemYili: period,
        odevId: homeworkId,
        baslik: 'Yeni ödeviniz var',
        aciklama: String(homework.aciklama || homework.baslik || 'Öğretmeniniz yeni bir ödev verdi.').slice(0, 180),
        teslimTarihi: homework.teslimTarihi || '',
        durum: 'aktif',
        okundu: current.exists ? current.get('okundu') === true : false,
        bildirimTarihi: current.exists && current.get('bildirimTarihi')
          ? current.get('bildirimTarihi')
          : FieldValue.serverTimestamp(),
        pushDurumu: 'bekliyor',
      };
      tx.set(notificationRef, notificationData, { merge: true });
      return true;
    });
    if (!shouldSend) continue;

    const tokenSnap = await db.collection('ogrenciPushTokenlari')
      .where('ogrenciUid', '==', link.ogrenciUid)
      .get();
    const activeTokens = tokenSnap.docs.filter(x => x.get('aktif') === true
      && validateExpoPushToken(x.get('token')));
    if (!activeTokens.length) {
      await notificationRef.update({ pushDurumu: 'cihaz_kaydi_yok' });
      continue;
    }

    const messages = activeTokens.map(tokenDoc => buildHomeworkPushMessage(
      tokenDoc.get('token'), homework, homeworkId, notificationId, link.id,
    ));
    try {
      let sent = 0;
      let failed = 0;
      for (let offset = 0; offset < messages.length; offset += 100) {
        const messageChunk = messages.slice(offset, offset + 100);
        const refsChunk = activeTokens.slice(offset, offset + 100).map(x => x.ref);
        const result = await sendExpoMessages(messageChunk, refsChunk);
        sent += result.sent;
        failed += result.failed;
      }
      await notificationRef.update({
        pushDurumu: sent > 0 ? 'gonderildi' : 'basarisiz',
        pushGonderilenCihaz: sent,
        pushBasarisizCihaz: failed,
        pushGonderilmeTarihi: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      await notificationRef.update({
        pushDurumu: 'hata',
        pushHata: String(error?.message || error).slice(0, 300),
      });
      throw error;
    }
  }
}

exports.odevOlusturulduOgrenciBildirimleri = onDocumentCreated({
  document: 'odevler/{odevId}',
  region: REGION,
  retry: true,
}, async event => {
  const homework = event.data?.data();
  if (!homework) return;
  const targets = Array.isArray(homework.hedefOgrenciIds) ? homework.hedefOgrenciIds : [];
  await processHomeworkChange(event.params.odevId, homework, targets);
});

exports.odeveOgrenciEklendiBildirimleri = onDocumentUpdated({
  document: 'odevler/{odevId}',
  region: REGION,
  retry: true,
}, async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const oldTargets = Array.isArray(before.hedefOgrenciIds) ? before.hedefOgrenciIds : [];
  const newTargets = Array.isArray(after.hedefOgrenciIds) ? after.hedefOgrenciIds : [];
  const added = newTargets.filter(id => !oldTargets.includes(id));
  const removed = oldTargets.filter(id => !newTargets.includes(id));
  if (added.length || removed.length) {
    await processHomeworkChange(event.params.odevId, after, added, removed);
  }
});

module.exports._test = {
  validateExpoPushToken,
  makePushTokenId,
  makeHomeworkNotificationId,
  isHomeworkTargeted,
  buildHomeworkPushMessage,
};


exports.odevSilindiOgrenciBildirimleri = onDocumentDeleted({
  document: 'odevler/{odevId}',
  region: REGION,
  retry: true,
}, async event => {
  const homework = event.data?.data();
  if (!homework) return;
  const targets = Array.isArray(homework.hedefOgrenciIds) ? homework.hedefOgrenciIds : [];
  await processHomeworkChange(event.params.odevId, homework, [], targets);
});
