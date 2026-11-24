import { getIdTokenResult, reload } from 'firebase/auth';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { reserveCurrentEmailAlias } from './sparkEmailAliases';

async function requireVerifiedUser(user = auth.currentUser) {
  if (!user) throw new Error('Önce hesabınıza giriş yapın.');
  await reload(user);
  const token = await getIdTokenResult(user, true);
  if (token.claims.email_verified !== true) {
    throw new Error('Bu işlemden önce e-posta adresinizi doğrulayın.');
  }
  return { user, claims: token.claims };
}

export async function closeOwnAccount(user = auth.currentUser) {
  const verified = await requireVerifiedUser(user);
  user = verified.user;
  if (verified.claims.uygulamaSahibi === true) {
    throw new Error('Uygulama sahibi hesabı sahiplik yetkisi devredilmeden kapatılamaz.');
  }
  await reserveCurrentEmailAlias(user);

  const profileRef = doc(db, 'kullanicilar', user.uid);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) throw new Error('Kullanıcı profili bulunamadı.');
  if (profileSnap.get('hesapDurumu') === 'kapali') return { status: 'already_closed' };

  const retentionEnd = new Date();
  retentionEnd.setFullYear(retentionEnd.getFullYear() + 3);
  const auditRef = doc(db, 'hesapYasamDongusuDenetimi', user.uid);
  const batch = writeBatch(db);
  batch.update(profileRef, {
    hesapDurumu: 'kapali',
    hesapKapatmaTalepTarihi: serverTimestamp(),
    hesapSaklamaBaslangic: serverTimestamp(),
    hesapSaklamaSonu: Timestamp.fromDate(retentionEnd),
    hesapKapatmaTalepUid: user.uid,
  });
  batch.set(auditRef, {
    uid: user.uid,
    islem: 'hesap_kapatildi',
    rol: profileSnap.get('rol') || null,
    zaman: serverTimestamp(),
    sonuc: 'basarili',
  });
  await batch.commit();
  return { status: 'closed' };
}

export async function reactivateOwnAccount(user = auth.currentUser) {
  const verified = await requireVerifiedUser(user);
  user = verified.user;
  await reserveCurrentEmailAlias(user);

  const profileRef = doc(db, 'kullanicilar', user.uid);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) throw new Error('Kullanıcı profili bulunamadı.');
  if (profileSnap.get('hesapDurumu') !== 'kapali') return { status: 'already_active' };

  const retentionEnd = profileSnap.get('hesapSaklamaSonu')?.toDate?.();
  if (!retentionEnd || retentionEnd.getTime() <= Date.now()) {
    throw new Error('Hesabın üç yıllık saklama ve yeniden etkinleştirme süresi sona ermiş. Destekle iletişime geçin.');
  }

  const auditRef = doc(db, 'hesapYasamDongusuDenetimi', user.uid);
  const batch = writeBatch(db);
  batch.update(profileRef, {
    hesapDurumu: 'aktif',
    hesapSaklamaSonu: deleteField(),
    hesapYenidenEtkinlestirmeTarihi: serverTimestamp(),
  });
  batch.set(auditRef, {
    uid: user.uid,
    islem: 'hesap_yeniden_etkinlestirildi',
    rol: profileSnap.get('rol') || null,
    zaman: serverTimestamp(),
    sonuc: 'basarili',
  });
  await batch.commit();
  return { status: 'active' };
}
