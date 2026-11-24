import * as Crypto from 'expo-crypto';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc,
  runTransaction, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { donemDuzenlemeyeAcik } from '../utils/donem';

const PERMISSION_KEYS = ['dersProgrami', 'dersNotlari', 'konular', 'yoklama', 'odevler', 'kitaplar'];
const EMPTY_PERMISSIONS = Object.freeze(Object.fromEntries(PERMISSION_KEYS.map(key => [key, false])));
const CODE_TTL_MS = 12 * 60 * 60 * 1000;

const normalizeEmail = value => String(value || '').trim().toLocaleLowerCase('en-US');
const normalizeName = value => String(value || '').normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
const recordName = record => record?.adSoyad || [record?.ad, record?.soyad].filter(Boolean).join(' ') || record?.ad || '';
const randomCode = async () => Array.from(await Crypto.getRandomBytesAsync(8))
  .map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
const hashCode = async value => (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)).toUpperCase();

function currentUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Oturum açmanız gerekiyor.');
  return uid;
}

function validatePermissions(value = {}) {
  const unknown = Object.keys(value || {}).filter(key => !PERMISSION_KEYS.includes(key));
  if (unknown.length) throw new Error('Bilinmeyen öğrenci paylaşım izni.');
  return Object.fromEntries(PERMISSION_KEYS.map(key => [key, value?.[key] === true]));
}

export async function createStudentPairingCode(studentRecord) {
  const teacherUid = currentUid();
  if (!donemDuzenlemeyeAcik(studentRecord?.donemYili)) {
    throw new Error('Bu öğrenci kaydının dönemi yeni hesap bağlantısı için kapalı.');
  }
  const [teacherSnap, studentSnap, classSnap] = await Promise.all([
    getDoc(doc(db, 'kullanicilar', teacherUid)),
    getDoc(doc(db, 'ogrenciler', studentRecord.id)),
    getDoc(doc(db, 'siniflar', studentRecord.sinifId)),
  ]);
  if (!teacherSnap.exists() || teacherSnap.get('rol') !== 'ogretmen') throw new Error('Öğretmen hesabı doğrulanamadı.');
  if (!studentSnap.exists() || studentSnap.get('uid') !== teacherUid) throw new Error('Öğrenci kaydı size ait değil.');
  const student = studentSnap.data();
  if (!student.eposta || !String(student.eposta).trim()) throw new Error('Öğrenci kaydına e-posta adresi eklenmelidir.');
  if (!classSnap.exists() || classSnap.get('uid') !== teacherUid
    || classSnap.get('donemYili') !== student.donemYili
    || student.sinifId !== classSnap.id) throw new Error('Öğrencinin sınıfı veya eğitim dönemi doğrulanamadı.');
  if (!['9', '10', '11', '12', 'TYT', 'AYT'].includes(String(classSnap.get('kademe') || '').trim().toUpperCase())) {
    throw new Error('Öğrenci hesabı yalnızca lise düzeyi sınıflar için açılabilir.');
  }
  const linkIndexSnap = await getDoc(doc(db, 'ogrenciKayitEslesmeleri', [teacherUid, studentRecord.id].join('__')));
  if (linkIndexSnap.exists() && linkIndexSnap.get('durum') === 'active') {
    throw new Error('Bu öğrenci kaydı zaten bir öğrenci hesabına bağlı. Yeni eşleştirme kodu oluşturulamaz.');
  }
  const normalizedStudentEmail = normalizeEmail(student.eposta);
  if (student.epostaEslesme !== normalizedStudentEmail) {
    await updateDoc(doc(db, 'ogrenciler', studentRecord.id), { epostaEslesme: normalizedStudentEmail });
  }
  const code = await randomCode();
  const codeHash = await hashCode(code);
  const now = Date.now();
  const expiresAt = now + CODE_TTL_MS;
  await setDoc(doc(db, 'ogrenciEslesmeKodlari', codeHash), {
    uid: teacherUid,
    ogretmenUid: teacherUid,
    ogretmenHesapAdi: teacherSnap.get('kullaniciAdi') || '',
    ogrenciKayitId: studentRecord.id,
    ogrenciAdSoyad: recordName(student),
    eposta: normalizedStudentEmail,
    sinifId: student.sinifId,
    sinifAd: classSnap.get('ad') || '',
    okulAd: student.okulAd || classSnap.get('okulAd') || '',
    donemYili: student.donemYili,
    kademe: classSnap.get('kademe') || '',
    ders: classSnap.get('ders') || student.brans || '',
    kullanildi: false,
    olusturulma: serverTimestamp(),
    sonaErme: Timestamp.fromMillis(expiresAt),
  });
  return { kod: code, sonaErme: new Date(expiresAt).toISOString() };
}

export async function submitStudentPairingRequest(codeValue, displayNameValue) {
  const user = auth.currentUser;
  const studentUid = currentUid();
  if (!user.emailVerified) throw new Error('E-posta adresinizi doğruladıktan sonra eşleştirme isteği gönderebilirsiniz.');
  const code = String(codeValue || '').trim().toUpperCase();
  if (!/^[A-F0-9]{16}$/.test(code)) throw new Error('16 karakterli eşleştirme kodunu kontrol edin.');
  const displayName = String(displayNameValue || user.displayName || '').normalize('NFKC').trim();
  if (displayName.length < 2) throw new Error('Ad ve soyad bilgisi gereklidir.');
  const email = normalizeEmail(user.email);
  const codeHash = await hashCode(code);
  const codeRef = doc(db, 'ogrenciEslesmeKodlari', codeHash);
  const profileRef = doc(db, 'kullanicilar', studentUid);
  const requestRef = doc(collection(db, 'ogrenciEslesmeTalepleri'));

  await runTransaction(db, async transaction => {
    const [codeSnap, profileSnap] = await Promise.all([
      transaction.get(codeRef),
      transaction.get(profileRef),
    ]);
    if (!codeSnap.exists()) throw new Error('Eşleştirme kodu geçersiz veya bulunamadı.');
    const invite = codeSnap.data();
    if (invite.kullanildi || !invite.sonaErme || invite.sonaErme.toMillis() <= Date.now()) {
      throw new Error('Eşleştirme kodunun süresi dolmuş veya daha önce kullanılmış.');
    }
    if (normalizeEmail(invite.eposta) !== email) {
      throw new Error('Hesabınızın e-posta adresi öğretmeninizin öğrenci kaydındaki e-posta ile eşleşmiyor.');
    }
    if (normalizeName(invite.ogrenciAdSoyad) !== normalizeName(displayName)) {
      throw new Error('Ad-soyad bilginiz öğretmeninizin öğrenci kaydındaki ad-soyad ile eşleşmiyor.');
    }
    if (profileSnap.exists()) {
      if (profileSnap.get('rol') !== 'ogrenci') throw new Error('Bu hesap öğrenci hesabı olarak tanımlanmamış.');
      if (normalizeEmail(profileSnap.get('eposta')) !== email) throw new Error('Öğrenci profilinizin e-posta bilgisi hesapla eşleşmiyor.');
      const existingName = profileSnap.get('kullaniciAdi') || user.displayName || '';
      if (normalizeName(existingName) !== normalizeName(invite.ogrenciAdSoyad)) {
        throw new Error('Öğrenci profilinizdeki ad-soyad öğretmeninizin kaydıyla eşleşmiyor.');
      }
      if (existingName !== invite.ogrenciAdSoyad) {
        transaction.update(profileRef, { kullaniciAdi: invite.ogrenciAdSoyad });
      }
    } else {
      transaction.set(profileRef, {
        rol: 'ogrenci',
        eposta: email,
        kullaniciAdi: invite.ogrenciAdSoyad || displayName,
        ilkEslesmeTalepId: requestRef.id,
        olusturulmaTarihi: new Date().toISOString(),
      });
    }
    transaction.set(requestRef, {
      uid: invite.ogretmenUid,
      ogretmenUid: invite.ogretmenUid,
      ogrenciUid: studentUid,
      ogrenciKayitId: invite.ogrenciKayitId,
      sinifId: invite.sinifId,
      sinifAd: invite.sinifAd || '',
      okulAd: invite.okulAd || '',
      donemYili: invite.donemYili,
      kademe: invite.kademe || '',
      ders: invite.ders || '',
      ogretmenHesapAdi: invite.ogretmenHesapAdi || '',
      ogrenciAdSoyad: invite.ogrenciAdSoyad || displayName,
      ogrenciHesapAdi: invite.ogrenciAdSoyad || displayName,
      ogrenciEposta: email,
      kodId: codeHash,
      durum: 'bekliyor',
      olusturulma: serverTimestamp(),
    });
    transaction.update(codeRef, {
      kullanildi: true,
      kullanilma: serverTimestamp(),
      talepId: requestRef.id,
    });
  });
  return { talepId: requestRef.id, durum: 'bekliyor' };
}

export async function approveStudentPairingRequest(requestItem, permissionValues) {
  const teacherUid = currentUid();
  const permissions = validatePermissions(permissionValues);
  const requestRef = doc(db, 'ogrenciEslesmeTalepleri', requestItem.id);
  return runTransaction(db, async transaction => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists() || requestSnap.get('ogretmenUid') !== teacherUid) throw new Error('Eşleştirme talebi bulunamadı.');
    if (requestSnap.get('durum') !== 'bekliyor') throw new Error('Bu talep daha önce işlenmiş.');
    const data = requestSnap.data();
    const linkId = [teacherUid, data.ogrenciUid, data.sinifId].join('__');
    const linkRef = doc(db, 'ogretmenOgrenciBaglantilari', linkId);
    const indexRef = doc(db, 'ogrenciKayitEslesmeleri', [teacherUid, data.ogrenciKayitId].join('__'));
    const [linkSnap, indexSnap] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(indexRef),
    ]);
    if (linkSnap.exists() && linkSnap.get('durum') === 'active') throw new Error('Bu öğrenciyle etkin bağlantı zaten bulunuyor.');
    if (indexSnap.exists() && indexSnap.get('durum') === 'active'
      && indexSnap.get('ogrenciUid') !== data.ogrenciUid) {
      throw new Error('Bu öğrenci kaydı başka bir öğrenci hesabına bağlı.');
    }
    transaction.set(linkRef, {
      talepId: requestItem.id,
      uid: teacherUid,
      ogretmenUid: teacherUid,
      ogretmenHesapAdi: data.ogretmenHesapAdi || '',
      ogrenciAd: data.ogrenciAdSoyad || '',
      sinifAd: data.sinifAd || '',
      okulAd: data.okulAd || '',
      donemYili: data.donemYili,
      kademe: data.kademe || '',
      ders: data.ders || '',
      ogrenciUid: data.ogrenciUid,
      ogrenciKayitId: data.ogrenciKayitId,
      ogrenciHesapAdi: data.ogrenciHesapAdi || '',
      ogrenciEposta: data.ogrenciEposta || '',
      sinifId: data.sinifId,
      izinler: permissions,
      durum: 'active',
      olusturulma: serverTimestamp(),
      iptalTarihi: null,
    });
    transaction.set(indexRef, {
      uid: teacherUid,
      donemYili: data.donemYili,
      ogretmenUid: teacherUid,
      ogrenciKayitId: data.ogrenciKayitId,
      ogrenciUid: data.ogrenciUid,
      sinifId: data.sinifId,
      baglantiId: linkId,
      durum: 'active',
      guncellenme: serverTimestamp(),
    });
    transaction.update(requestRef, {
      durum: 'onaylandi',
      baglantiId: linkId,
      yanitTarihi: serverTimestamp(),
    });
    return { baglantiId: linkId, durum: 'active' };
  });
}

export async function rejectStudentPairingRequest(requestId) {
  const teacherUid = currentUid();
  const ref = doc(db, 'ogrenciEslesmeTalepleri', requestId);
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists() || snap.get('ogretmenUid') !== teacherUid || snap.get('durum') !== 'bekliyor') {
      throw new Error('Onay bekleyen eşleştirme talebi bulunamadı.');
    }
    transaction.update(ref, { durum: 'reddedildi', yanitTarihi: serverTimestamp() });
  });
}

export async function updateStudentLinkPermissions(linkId, permissionValues) {
  const teacherUid = currentUid();
  await updateDoc(doc(db, 'ogretmenOgrenciBaglantilari', linkId), {
    izinler: validatePermissions(permissionValues),
    izinGuncelleme: serverTimestamp(),
  });
}

export async function revokeStudentLink(linkItem) {
  const teacherUid = currentUid();
  const linkRef = doc(db, 'ogretmenOgrenciBaglantilari', linkItem.id);
  const indexRef = doc(db, 'ogrenciKayitEslesmeleri', [teacherUid, linkItem.ogrenciKayitId].join('__'));
  await runTransaction(db, async transaction => {
    const [linkSnap, indexSnap] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(indexRef),
    ]);
    if (!linkSnap.exists() || linkSnap.get('ogretmenUid') !== teacherUid) throw new Error('Öğrenci bağlantısı bulunamadı.');
    if (linkSnap.get('durum') === 'revoked') return;
    transaction.update(linkRef, { durum: 'revoked', iptalTarihi: serverTimestamp() });
    if (indexSnap.exists() && indexSnap.get('baglantiId') === linkItem.id) {
      transaction.update(indexRef, { durum: 'revoked', iptalTarihi: serverTimestamp() });
    }
  });
}

export async function cancelHomeworkNotifications(homeworkId) {
  const teacherUid = currentUid();
  const snapshot = await getDocs(query(
    collection(db, 'ogrenciYeniOdevBildirimleri'),
    where('ogretmenUid', '==', teacherUid),
  ));
  const targets = snapshot.docs.filter(item =>
    item.get('odevId') === homeworkId && item.get('durum') === 'aktif'
  );
  for (let offset = 0; offset < targets.length; offset += 450) {
    const batch = writeBatch(db);
    targets.slice(offset, offset + 450).forEach(item => {
      batch.update(item.ref, { durum: 'iptal', iptalTarihi: serverTimestamp() });
    });
    await batch.commit();
  }
  return targets.length;
}

export async function notifyHomeworkCompleted(linkItem, homeworkItem) {
  const studentUid = currentUid();
  const notificationId = [studentUid, linkItem.id, homeworkItem.id].join('__');
  const notificationRef = doc(db, 'ogrenciOdevBildirimleri', notificationId);
  await runTransaction(db, async transaction => {
    const [linkSnap, homeworkSnap, existingSnap] = await Promise.all([
      transaction.get(doc(db, 'ogretmenOgrenciBaglantilari', linkItem.id)),
      transaction.get(doc(db, 'odevler', homeworkItem.id)),
      transaction.get(notificationRef),
    ]);
    if (!linkSnap.exists() || linkSnap.get('ogrenciUid') !== studentUid
      || linkSnap.get('durum') !== 'active' || linkSnap.get('izinler.odevler') !== true) {
      throw new Error('Bu öğretmenin ödev paylaşım izni bulunmuyor.');
    }
    const link = linkSnap.data();
    if (!homeworkSnap.exists() || homeworkSnap.get('uid') !== link.ogretmenUid
      || homeworkSnap.get('sinifId') !== link.sinifId
      || homeworkSnap.get('donemYili') !== link.donemYili
      || !(homeworkSnap.get('hedefOgrenciIds') || []).includes(link.ogrenciKayitId)) {
      throw new Error('Bu ödev öğrenci hesabınıza atanmış değil.');
    }
    if (existingSnap.exists()) return;
    transaction.set(notificationRef, {
      uid: link.ogretmenUid,
      ogrenciUid: studentUid,
      ogretmenUid: link.ogretmenUid,
      donemYili: link.donemYili,
      ogrenciKayitId: link.ogrenciKayitId,
      sinifId: link.sinifId,
      baglantiId: linkItem.id,
      odevId: homeworkItem.id,
      odevAciklama: homeworkSnap.get('aciklama') || homeworkSnap.get('baslik') || 'Ödev',
      teslimTarihi: homeworkSnap.get('teslimTarihi') || '',
      kitapAd: homeworkSnap.get('kitapAd') || '',
      sinifAd: link.sinifAd || '',
      ogrenciHesapAdi: link.ogrenciHesapAdi || '',
      durum: 'tamamlandi_bildirildi',
      bildirimTarihi: serverTimestamp(),
    });
  });
}

export async function syncNewHomeworkNotifications(homeworkId, homework, previousTargetIds = []) {
  const teacherUid = currentUid();
  const targets = Array.isArray(homework?.hedefOgrenciIds) ? homework.hedefOgrenciIds : [];
  if (!homework?.sinifId || !Number.isInteger(homework?.donemYili)) return;
  const linkSnap = await getDocs(query(
    collection(db, 'ogretmenOgrenciBaglantilari'),
    where('ogretmenUid', '==', teacherUid),
  ));
  const links = linkSnap.docs.map(item => ({ id: item.id, ...item.data() }))
    .filter(link => link.sinifId === homework.sinifId && link.durum === 'active' && link.izinler?.odevler === true);
  const operations = [];
  for (const link of links) {
    const wasTargeted = previousTargetIds.includes(link.ogrenciKayitId);
    const isTargeted = targets.includes(link.ogrenciKayitId);
    if (wasTargeted === isTargeted) continue;
    const notificationRef = doc(db, 'ogrenciYeniOdevBildirimleri', [homeworkId, link.ogrenciUid, link.id].join('__'));
    const existing = await getDoc(notificationRef);
    if (wasTargeted && !isTargeted) {
      if (existing.exists()) operations.push({ type: 'update', ref: notificationRef, data: {
        durum: 'iptal',
        iptalTarihi: serverTimestamp(),
      }});
      continue;
    }
    if (isTargeted && !existing.exists()) {
      operations.push({ type: 'set', ref: notificationRef, data: {
        uid: teacherUid,
        ogrenciUid: link.ogrenciUid,
        ogretmenUid: teacherUid,
        baglantiId: link.id,
        ogrenciKayitId: link.ogrenciKayitId,
        sinifId: link.sinifId,
        donemYili: homework.donemYili,
        odevId: homeworkId,
        baslik: 'Yeni ödeviniz var',
        aciklama: String(homework.aciklama || homework.baslik || 'Öğretmeniniz yeni bir ödev verdi.').slice(0, 180),
        teslimTarihi: homework.teslimTarihi || '',
        durum: 'aktif',
        okundu: false,
        bildirimTarihi: serverTimestamp(),
      }});
    }
  }
  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(db);
    operations.slice(offset, offset + 450).forEach(operation => {
      if (operation.type === 'update') batch.update(operation.ref, operation.data);
      else batch.set(operation.ref, operation.data);
    });
    await batch.commit();
  }
}
