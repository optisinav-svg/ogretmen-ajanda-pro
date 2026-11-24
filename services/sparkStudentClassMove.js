import { auth, db } from '../firebaseConfig';
import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { donemDuzenlemeyeAcik, donemUygun } from '../utils/donem';

const MOVE_BATCH_SIZE = 400;

function requireTeacher() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Oturum bulunamadı. Yeniden giriş yapın.');
  return uid;
}

function isWritableClass(data, uid, periodYear) {
  return data
    && data.uid === uid
    && Number(data.donemYili) === Number(periodYear)
    && data.arsivlendi !== true
    && data.arsivDurumu !== 'isleniyor';
}

function classFields(target, current = {}) {
  return {
    sinifId: target.id,
    sinifAd: target.ad || '',
    okulId: target.okulId || '',
    okulAd: target.okulAd || '',
    kademe: target.kademe || current.kademe || '',
    brans: target.ders || current.brans || '',
  };
}

async function ensureSchoolWritable(classData, uid) {
  if (!classData.okulId) return;
  const schoolSnap = await getDoc(doc(db, 'okullar', classData.okulId));
  if (!schoolSnap.exists()
    || schoolSnap.data().uid !== uid
    || schoolSnap.data().arsivlendi === true
    || schoolSnap.data().arsivDurumu === 'isleniyor') {
    throw new Error('Hedef okul yeni kayıt kabul etmiyor.');
  }
}

function fieldsDiffer(data, fields) {
  return Object.keys(fields).some(key => (data?.[key] ?? '') !== (fields[key] ?? ''));
}

async function getActiveLinkForStudent(uid, studentId) {
  const indexRef = doc(db, 'ogrenciKayitEslesmeleri', `${uid}__${studentId}`);
  const [linksSnapshot, indexSnap] = await Promise.all([
    getDocs(query(collection(db, 'ogretmenOgrenciBaglantilari'), where('ogretmenUid', '==', uid))),
    getDoc(indexRef),
  ]);
  const hasActiveLink = linksSnapshot.docs.some(item => {
    const data = item.data();
    return data.ogrenciKayitId === studentId && data.durum === 'active';
  });
  if (indexSnap.exists() && indexSnap.data().durum === 'active') {
    const index = indexSnap.data();
    if (index.ogretmenUid !== uid || index.ogrenciKayitId !== studentId) {
      throw new Error('Öğrenci bağlantı indeksi başka bir kayda ait görünüyor; taşıma başlamadan durduruldu.');
    }
    return true;
  }
  return hasActiveLink;
}

async function getOrCreateUnregisteredClass({ uid, sourceClass, periodYear }) {
  const schoolId = sourceClass.okulId;
  if (!schoolId) throw new Error('Öğrencinin bağlı olduğu okul bulunamadı; kayıtsız sınıf oluşturulmadı.');

  const classes = await getDocs(query(collection(db, 'siniflar'), where('uid', '==', uid)));
  const existing = classes.docs.find(item => {
    const data = item.data();
    return data.ozelTur === 'kayitsiz'
      && data.okulId === schoolId
      && Number(data.donemYili) === Number(periodYear)
      && data.arsivlendi !== true
      && data.arsivDurumu !== 'isleniyor';
  });
  if (existing) return { id: existing.id, ...existing.data() };

  const deterministicId = `${uid}__${schoolId}__${Number(periodYear)}__kayitsiz`;
  const targetRef = doc(db, 'siniflar', deterministicId);
  await runTransaction(db, async transaction => {
    const current = await transaction.get(targetRef);
    if (current.exists()) {
      const data = current.data();
      if (data.uid !== uid || data.okulId !== schoolId
        || Number(data.donemYili) !== Number(periodYear)
        || data.ozelTur !== 'kayitsiz'
        || data.arsivlendi === true
        || data.arsivDurumu === 'isleniyor') {
        throw new Error('Kayıtsız öğrenci sınıfı için aynı kimlikte uyumsuz bir kayıt bulundu.');
      }
      return;
    }
    transaction.set(targetRef, {
      ad: 'Kayıtsız Öğrenciler',
      kademe: '',
      ders: '',
      okulId: schoolId,
      okulAd: sourceClass.okulAd || '',
      uid,
      donemYili: Number(periodYear),
      ozelTur: 'kayitsiz',
      olusturulma: new Date().toISOString(),
    });
  });
  const created = await getDoc(targetRef);
  if (!created.exists()) throw new Error('Kayıtsız öğrenci sınıfı oluşturulamadı.');
  return { id: created.id, ...created.data() };
}

async function markTransfer(studentRef, student, markerField, marker) {
  const existing = student?.[markerField];
  if (existing) {
    if (existing.kaynakSinifId !== marker.kaynakSinifId
      || existing.hedefSinifId !== marker.hedefSinifId
      || Number(existing.donemYili) !== Number(marker.donemYili)) {
      throw new Error('Bu öğrenci için farklı hedefli, yarım kalmış bir taşıma var. Önce aynı taşıma tamamlanmalı.');
    }
    return existing;
  }
  const otherMarker = markerField === 'sinifTasiIslemi' ? 'kayitsizTasiIslemi' : 'sinifTasiIslemi';
  if (student?.[otherMarker]) {
    throw new Error('Öğrenci için başka bir taşıma işlemi devam ediyor.');
  }
  await updateDoc(studentRef, { [markerField]: marker });
  return marker;
}

async function moveCurrentPeriodProgress({ uid, studentId, periodYear, targetClass }) {
  const [booksSnapshot, topicsSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, 'kitaplar'),
      where('uid', '==', uid),
      where('ogrenciId', '==', studentId),
    )),
    getDocs(query(
      collection(db, 'konular'),
      where('uid', '==', uid),
      where('ogrenciId', '==', studentId),
    )),
  ]);

  const books = booksSnapshot.docs.filter(item => donemUygun(item.data(), periodYear));
  const topics = topicsSnapshot.docs.filter(item => donemUygun(item.data(), periodYear));
  const bookById = new Map(books.map(item => [item.id, item]));

  for (const topic of topics) {
    const bookId = topic.data().kitapId;
    if (typeof bookId !== 'string' || !bookById.has(bookId)) {
      throw new Error('Öğrencinin bazı konu kayıtları atanmış kitap kaydıyla eşleşmiyor. Veri bütünlüğü korunması için taşıma durduruldu.');
    }
  }

  let changed = false;
  for (let offset = 0; offset < books.length; offset += MOVE_BATCH_SIZE) {
    const chunk = books.slice(offset, offset + MOVE_BATCH_SIZE);
    const batch = writeBatch(db);
    let writes = 0;
    for (const item of chunk) {
      const fields = classFields(targetClass, item.data());
      if (fieldsDiffer(item.data(), fields)) {
        batch.update(item.ref, fields);
        writes += 1;
      }
    }
    if (writes) {
      await batch.commit();
      changed = true;
    }
  }

  const topicsByBook = new Map();
  for (const item of topics) {
    const bookId = item.data().kitapId;
    if (!topicsByBook.has(bookId)) topicsByBook.set(bookId, []);
    topicsByBook.get(bookId).push(item);
  }

  for (const items of topicsByBook.values()) {
    for (let offset = 0; offset < items.length; offset += MOVE_BATCH_SIZE) {
      const chunk = items.slice(offset, offset + MOVE_BATCH_SIZE);
      const batch = writeBatch(db);
      let writes = 0;
      for (const item of chunk) {
        const fields = classFields(targetClass, item.data());
        if (fieldsDiffer(item.data(), fields)) {
          batch.update(item.ref, fields);
          writes += 1;
        }
      }
      if (writes) {
        await batch.commit();
        changed = true;
      }
    }
  }
  return changed;
}

async function finalizeStudentMove({
  uid,
  studentId,
  sourceClassId,
  targetClass,
  periodYear,
  markerField,
  marker,
  reason,
  unregistered,
  hasActiveLink,
}) {
  const studentRef = doc(db, 'ogrenciler', studentId);
  const sourceRef = doc(db, 'siniflar', sourceClassId);
  const targetRef = doc(db, 'siniflar', targetClass.id);
  const indexRef = doc(db, 'ogrenciKayitEslesmeleri', `${uid}__${studentId}`);

  return runTransaction(db, async transaction => {
    const [studentSnap, sourceSnap, targetSnap, indexSnap] = await Promise.all([
      transaction.get(studentRef),
      transaction.get(sourceRef),
      transaction.get(targetRef),
      transaction.get(indexRef),
    ]);
    if (!studentSnap.exists() || !sourceSnap.exists() || !targetSnap.exists()) {
      throw new Error('Öğrenci veya sınıf kaydı bulunamadı; taşıma tamamlanmadı.');
    }

    const student = studentSnap.data();
    const source = sourceSnap.data();
    const target = targetSnap.data();
    if (student.uid !== uid || student.sinifId !== sourceClassId
      || Number(student.donemYili) !== Number(periodYear)) {
      throw new Error('Öğrencinin kaynak sınıfı veya dönemi değişmiş. Taşıma güvenlik için durduruldu.');
    }
    if (!isWritableClass(source, uid, periodYear) || !isWritableClass(target, uid, periodYear)) {
      throw new Error('Kaynak veya hedef sınıf bu dönemde düzenlenebilir değil.');
    }
    const targetFieldsChangedDuringMove = ['ad', 'okulId', 'okulAd', 'kademe', 'ders']
      .some(key => (target[key] ?? '') !== (targetClass[key] ?? ''));
    if (targetFieldsChangedDuringMove) {
      throw new Error('Hedef sınıf bilgileri taşıma sırasında değişti. Aynı hedef sınıfı yeniden seçerek taşıma işlemine devam edin.');
    }
    const activeMarker = student[markerField];
    if (!activeMarker
      || activeMarker.kaynakSinifId !== sourceClassId
      || activeMarker.hedefSinifId !== targetClass.id
      || Number(activeMarker.donemYili) !== Number(periodYear)) {
      throw new Error('Taşıma kilidi doğrulanamadı. Hiçbir son kayıt değişikliği yapılmadı.');
    }

    if (target.okulId) {
      const schoolSnap = await transaction.get(doc(db, 'okullar', target.okulId));
      if (!schoolSnap.exists()
        || schoolSnap.data().uid !== uid
        || schoolSnap.data().arsivlendi === true
        || schoolSnap.data().arsivDurumu === 'isleniyor') {
        throw new Error('Hedef okul yeni kayıt kabul etmiyor.');
      }
    }
    if (unregistered && (target.ozelTur !== 'kayitsiz' || target.okulId !== source.okulId)) {
      throw new Error('Kayıtsız sınıf aynı okula ait değil.');
    }
    if (!unregistered && target.ozelTur === 'kayitsiz') {
      throw new Error('Normal sınıf taşıma işleminde kayıtsız sınıf hedef seçilemez.');
    }

    let indexActive = false;
    if (indexSnap.exists() && indexSnap.data().durum === 'active') {
      const index = indexSnap.data();
      if (index.ogretmenUid !== uid || index.ogrenciKayitId !== studentId) {
        throw new Error('Öğrenci bağlantı indeksi başka bir kayda ait görünüyor; taşıma durduruldu.');
      }
      transaction.update(indexRef, {
        durum: 'revoked',
        iptalTarihi: serverTimestamp(),
      });
      indexActive = true;
    }

    const movedAt = activeMarker.tarih || marker.tarih;
    const historyEntry = {
      sinifId: sourceClassId,
      sinifAd: student.sinifAd || source.ad || '',
      okulId: student.okulId || source.okulId || '',
      okulAd: student.okulAd || source.okulAd || '',
      donemYili: Number(periodYear),
      tarih: movedAt,
      neden: reason,
    };
    const updates = {
      sinifGecmisiIds: arrayUnion(sourceClassId),
      sinifGecmisi: arrayUnion(historyEntry),
      sinifId: targetClass.id,
      sinifAd: target.ad || '',
      okulId: target.okulId || '',
      okulAd: target.okulAd || '',
      kademe: target.kademe || '',
      brans: target.ders || '',
      kayitsizMi: unregistered,
      sinifTasiIslemi: deleteField(),
      kayitsizTasiIslemi: deleteField(),
    };
    if (unregistered) updates.kayitsizTarihi = movedAt;
    else updates.kayitsizTarihi = deleteField();
    transaction.update(studentRef, updates);
    return { needsRelink: hasActiveLink || indexActive };
  });
}

export async function moveStudentToClass({ studentId, sourceClass, targetClass, periodYear }) {
  const uid = requireTeacher();
  const period = Number(periodYear);
  if (!donemDuzenlemeyeAcik(period)) {
    throw new Error('Bu dönem artık düzenlenemez. Eski dönem kayıtları salt okunurdur.');
  }
  if (!studentId || !sourceClass?.id || !targetClass?.id) {
    throw new Error('Öğrenci veya hedef sınıf bilgisi eksik.');
  }
  if (targetClass.ozelTur) {
    throw new Error('Öğrenci yalnızca normal bir sınıfa taşınabilir.');
  }

  const studentRef = doc(db, 'ogrenciler', studentId);
  const [studentSnap, sourceSnap, targetSnap, hasActiveLink] = await Promise.all([
    getDoc(studentRef),
    getDoc(doc(db, 'siniflar', sourceClass.id)),
    getDoc(doc(db, 'siniflar', targetClass.id)),
    getActiveLinkForStudent(uid, studentId),
  ]);
  if (!studentSnap.exists() || !sourceSnap.exists() || !targetSnap.exists()) {
    throw new Error('Öğrenci veya sınıf kaydı bulunamadı.');
  }
  const student = studentSnap.data();
  const source = { id: sourceSnap.id, ...sourceSnap.data() };
  const target = { id: targetSnap.id, ...targetSnap.data() };
  if (!isWritableClass(source, uid, period) || !isWritableClass(target, uid, period)) {
    throw new Error('Kaynak veya hedef sınıf bu dönem için düzenlenebilir değil.');
  }
  if (target.ozelTur === 'kayitsiz') {
    throw new Error('Kayıtsız sınıfa taşıma için ayrı işlem kullanılmalı.');
  }
  await ensureSchoolWritable(target, uid);
  if (student.uid !== uid || Number(student.donemYili) !== period) {
    throw new Error('Öğrenci seçilen öğretmene veya döneme ait değil.');
  }
  if (student.sinifId === target.id && !student.sinifTasiIslemi) {
    return { alreadyMoved: true, needsRelink: hasActiveLink };
  }
  if (student.sinifId !== source.id) {
    throw new Error('Öğrenci seçilen kaynak sınıfta değil.');
  }
  if (student.sinifTasiIslemi
    && (student.sinifTasiIslemi.hedefSinifId !== target.id
      || student.sinifTasiIslemi.kaynakSinifId !== source.id
      || Number(student.sinifTasiIslemi.donemYili) !== period)) {
    throw new Error('Öğrencinin başka hedefli yarım kalmış taşıması var; önce onu tamamlayın.');
  }

  const marker = {
    kaynakSinifId: source.id,
    hedefSinifId: target.id,
    donemYili: period,
    tarih: student.sinifTasiIslemi?.tarih || new Date().toISOString(),
    neden: 'sinif_degisikligi',
  };
  const marked = await markTransfer(studentRef, student, 'sinifTasiIslemi', marker);
  try {
    await moveCurrentPeriodProgress({
      uid,
      studentId,
      periodYear: period,
      targetClass: target,
    });
    const result = await finalizeStudentMove({
      uid,
      studentId,
      sourceClassId: source.id,
      targetClass: target,
      periodYear: period,
      markerField: 'sinifTasiIslemi',
      marker: marked,
      reason: 'sinif_degisikligi',
      unregistered: false,
      hasActiveLink,
    });
    return { ...result, alreadyMoved: false };
  } catch (error) {
    // Keep the transfer marker. Repeating the same target resumes idempotently;
    // clearing it after a partial batch could orphan moved progress records.
    throw error;
  }
}

export async function moveStudentToUnregistered({ studentId, sourceClass, periodYear }) {
  const uid = requireTeacher();
  const period = Number(periodYear);
  if (!donemDuzenlemeyeAcik(period)) {
    throw new Error('Bu dönem artık düzenlenemez. Eski dönem kayıtları salt okunurdur.');
  }
  if (!studentId || !sourceClass?.id) throw new Error('Öğrenci veya kaynak sınıf bilgisi eksik.');

  const studentRef = doc(db, 'ogrenciler', studentId);
  const [studentSnap, sourceSnap, hasActiveLink] = await Promise.all([
    getDoc(studentRef),
    getDoc(doc(db, 'siniflar', sourceClass.id)),
    getActiveLinkForStudent(uid, studentId),
  ]);
  if (!studentSnap.exists() || !sourceSnap.exists()) throw new Error('Öğrenci veya kaynak sınıf bulunamadı.');
  const student = studentSnap.data();
  const source = { id: sourceSnap.id, ...sourceSnap.data() };
  if (student.uid !== uid || student.sinifId !== source.id || Number(student.donemYili) !== period) {
    throw new Error('Öğrenci seçilen kaynak sınıfta veya dönemde değil.');
  }
  if (!isWritableClass(source, uid, period)) throw new Error('Kaynak sınıf düzenlenebilir değil.');
  if (student.kayitsizMi === true && source.ozelTur === 'kayitsiz') {
    return { alreadyMoved: true, needsRelink: hasActiveLink };
  }
  if (student.sinifTasiIslemi) throw new Error('Öğrenci için normal sınıf taşıma işlemi devam ediyor.');

  let target;
  const oldMarker = student.kayitsizTasiIslemi;
  if (oldMarker) {
    if (oldMarker.kaynakSinifId !== source.id || Number(oldMarker.donemYili) !== period) {
      throw new Error('Öğrencinin farklı kaynaklı yarım kalmış kayıtsız taşıması var.');
    }
    const targetSnap = await getDoc(doc(db, 'siniflar', oldMarker.hedefSinifId));
    if (!targetSnap.exists()) throw new Error('Yarım kalmış taşımanın hedef kayıtsız sınıfı bulunamadı.');
    target = { id: targetSnap.id, ...targetSnap.data() };
  } else {
    target = await getOrCreateUnregisteredClass({ uid, sourceClass: source, periodYear: period });
  }
  if (target.ozelTur !== 'kayitsiz' || target.okulId !== source.okulId) {
    throw new Error('Aynı okula ait kayıtsız öğrenci sınıfı bulunamadı.');
  }
  await ensureSchoolWritable(target, uid);

  const marker = {
    kaynakSinifId: source.id,
    hedefSinifId: target.id,
    donemYili: period,
    tarih: oldMarker?.tarih || new Date().toISOString(),
    neden: 'kayitsizlara_tasima',
  };
  const marked = await markTransfer(studentRef, student, 'kayitsizTasiIslemi', marker);
  try {
    const result = await finalizeStudentMove({
      uid,
      studentId,
      sourceClassId: source.id,
      targetClass: target,
      periodYear: period,
      markerField: 'kayitsizTasiIslemi',
      marker: marked,
      reason: 'kayitsizlara_tasima',
      unregistered: true,
      hasActiveLink,
    });
    return { ...result, alreadyMoved: false };
  } catch (error) {
    // The marker is a resumable lock; retrying the same operation completes it.
    throw error;
  }
}
