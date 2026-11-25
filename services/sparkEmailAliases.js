import { getIdTokenResult, reload } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { auth, db } from '../firebaseConfig';

const ALIAS_COLLECTION = 'epostaAliaslari';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function reserveCurrentEmailAlias(user = auth.currentUser) {
  if (!user) throw new Error('E-posta kaydını oluşturmak için önce giriş yapın.');

  await reload(user);
  const token = await getIdTokenResult(user, true);
  if (token.claims.email_verified !== true) {
    return { status: 'verification_pending' };
  }

  const email = normalizeEmail(token.claims.email);
  if (!email) throw new Error('Hesabınızda doğrulanmış e-posta adresi bulunamadı.');

  const emailHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    email,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  // Firestore Rules Bytes.toHexString() returns uppercase hexadecimal.
  // Keep the client document ID identical to the rules-side SHA-256 value.
  const normalizedEmailHash = emailHash.toUpperCase();
  const aliasRef = doc(db, ALIAS_COLLECTION, normalizedEmailHash);

  let aliasStep = 'Alias belgesini okuma';
  try {
    await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(aliasRef);
    if (snapshot.exists()) {
      aliasStep = 'Mevcut alias kaydını güncelleme';
      const data = snapshot.data();
      if (data.ownerUid !== user.uid) {
        const error = new Error(
          'Bu e-posta adresi daha önce başka bir hesaba ait olarak rezerve edilmiş. Eski hesabınıza giriş yapın veya hesap kurtarma adımlarını izleyin.',
        );
        error.code = 'alias/already-reserved';
        throw error;
      }
      if (data.emailHash !== normalizedEmailHash) {
        throw new Error('E-posta alias kaydı doğrulanamadı. Güvenlik nedeniyle işlem durduruldu.');
      }
      transaction.update(aliasRef, { sonKullanim: serverTimestamp() });
      return;
    }

    aliasStep = 'Yeni alias kaydı oluşturma';
    transaction.set(aliasRef, {
      ownerUid: user.uid,
      emailHash: normalizedEmailHash,
      rezerveEdilme: serverTimestamp(),
      sonKullanim: serverTimestamp(),
    });
    });
  } catch (error) {
    error.aliasStep = aliasStep;
    throw error;
  }

  return { status: 'reserved' };
}
