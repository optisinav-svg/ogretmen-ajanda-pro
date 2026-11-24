#!/usr/bin/env node
'use strict';

// One-time, explicit academic-period migration for legacy records.
// Safe default is dry-run. Only documents missing donemYili are updated;
// existing period values are never overwritten.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const TARGET_PERIOD = 2026;
const PAGE_SIZE = 400;
const COLLECTIONS = Object.freeze([
  'okullar',
  'siniflar',
  'ogrenciler',
  'dersler',
  'dersNotlari',
  'odevler',
  'yoklamalar',
  'kitaplar',
  'konular',
]);

function hasApplyFlag(argv) {
  return argv.includes('--apply');
}

function hasTargetConfirmation(argv) {
  return argv.includes('--confirm-period=' + TARGET_PERIOD)
    && argv.includes('--confirm-all-missing-are-2026');
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('data', chunk => hash.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifyBackup() {
  const root = path.resolve(__dirname, '../..');
  const backupDir = path.join(root, 'firestore-backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('firestore-backups klasörü bulunamadı. Önce doğrulanmış yedeği kontrol edin.');
  }
  const manifests = fs.readdirSync(backupDir)
    .filter(name => name.endsWith('.manifest.json'))
    .sort()
    .reverse();
  let unhashedCandidate = null;
  for (const name of manifests) {
    const manifestPath = path.join(backupDir, name);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const archiveName = name.replace(/\.manifest\.json$/, '.jsonl.gz');
    const archivePath = path.join(backupDir, archiveName);
    const manifestCollections = manifest.collections && typeof manifest.collections === 'object'
      ? manifest.collections : {};
    const missingCollections = COLLECTIONS.filter(name => !Object.prototype.hasOwnProperty.call(manifestCollections, name));
    if (
      manifest.projectId !== PROJECT_ID ||
      manifest.readOnly !== true ||
      manifest.archive !== archiveName ||
      Number(manifest.totalDocuments) < 1 ||
      missingCollections.length > 0 ||
      !fs.existsSync(archivePath) ||
      fs.statSync(archivePath).size <= 0
    ) continue;

    let expectedHash = typeof manifest.archiveSha256 === 'string' ? manifest.archiveSha256.trim() : '';
    if (!expectedHash) {
      const sidecars = [archivePath + '.sha256', manifestPath + '.sha256'];
      for (const sidecar of sidecars) {
        if (fs.existsSync(sidecar)) {
          expectedHash = fs.readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
          break;
        }
      }
    }
    if (expectedHash) {
      const actualHash = await sha256File(archivePath);
      if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) continue;
      return {
        manifestPath, archivePath, totalDocuments: manifest.totalDocuments,
        hashVerified: true, archiveSha256: actualHash,
      };
    }
    if (!unhashedCandidate) {
      unhashedCandidate = {
        manifestPath, archivePath, totalDocuments: manifest.totalDocuments,
        hashVerified: false, archiveSha256: null,
      };
    }
  }
  if (unhashedCandidate) return unhashedCandidate;
  throw new Error('ogretmen-takip projesine ait tam koleksiyon manifestli ve okunabilir yedek bulunamadı.');
}

async function scanCollection(db, name, apply) {
  const collection = db.collection(name);
  let cursor = null;
  let scanned = 0;
  let missing = 0;
  let invalid = 0;
  let updated = 0;
  const batchSamples = [];
  while (true) {
    let query = collection.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;

    const missingDocs = page.docs.filter(doc => !Object.prototype.hasOwnProperty.call(doc.data(), 'donemYili'));
    const invalidDocs = page.docs.filter(doc => {
      const data = doc.data();
      return Object.prototype.hasOwnProperty.call(data, 'donemYili')
        && (typeof data.donemYili !== 'number' || !Number.isInteger(data.donemYili));
    });
    scanned += page.size;
    missing += missingDocs.length;
    invalid += invalidDocs.length;
    for (const doc of [...missingDocs, ...invalidDocs].slice(0, Math.max(0, 10 - batchSamples.length))) {
      const data = doc.data();
      batchSamples.push({
        collection: name,
        idSuffix: doc.id.slice(-6),
        periodState: Object.prototype.hasOwnProperty.call(data, 'donemYili') ? 'invalid-existing' : 'missing',
      });
    }

    if (apply && missingDocs.length) {
      const batch = db.batch();
      for (const doc of missingDocs) {
        // Field-only update preserves every other field and all subcollections.
        batch.update(doc.ref, { donemYili: TARGET_PERIOD });
      }
      await batch.commit();
      updated += missingDocs.length;
    }

    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  }
  return { scanned, missing, invalid, updated, samples: batchSamples };
}

async function verifyCollection(db, name) {
  const snapshot = await db.collection(name).where('donemYili', '==', TARGET_PERIOD).count().get();
  const allDocs = await db.collection(name).get();
  const remainingMissing = allDocs.docs.filter(doc =>
    !Object.prototype.hasOwnProperty.call(doc.data(), 'donemYili')
  ).length;
  const remainingInvalid = allDocs.docs.filter(doc => {
    const data = doc.data();
    return Object.prototype.hasOwnProperty.call(data, 'donemYili')
      && (typeof data.donemYili !== 'number' || !Number.isInteger(data.donemYili));
  }).length;
  return {
    targetPeriodCount: snapshot.data().count,
    remainingMissing,
    remainingInvalid,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = hasApplyFlag(argv);
  if (apply && !hasTargetConfirmation(argv)) {
    throw new Error('Yazma için --apply, --confirm-period=2026 ve --confirm-all-missing-are-2026 parametreleri birlikte zorunludur.');
  }
  const backup = await verifyBackup();
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();
  let totalScanned = 0;
  let totalMissing = 0;
  let totalInvalid = 0;
  let totalUpdated = 0;

  console.log('Proje:', PROJECT_ID);
  console.log('Hedef dönem:', TARGET_PERIOD);
  console.log('Mod:', apply ? 'UYGULAMA (önce salt okunur ön kontrol)' : 'DRY-RUN (salt okunur)');
  console.log('Yedek doğrulaması:', backup.totalDocuments, 'belge; arşiv ve manifest mevcut.');
  console.log('SHA-256:', backup.hashVerified ? 'DOĞRULANDI' : 'YOK (yalnızca dry-run yapılabilir).');
  if (apply && !backup.hashVerified) {
    throw new Error('Yazma öncesi SHA-256 doğrulaması zorunlu. Güncel backup scriptiyle yedek alın veya eşleşen .sha256 sidecar dosyası sağlayın.');
  }
  console.log('Dönem verisi olmayan profil ve ortak kitap kütüphanesi tanımları bilerek kapsam dışıdır.');
  console.log('UYARI: Bu script tarihleri yorumlamaz; yalnızca donemYili alanı bulunmayan hedef koleksiyon belgelerine 2026 yazar. Önce audit-missing-periods.js raporunu inceleyin; Haziran belirsizliği ve diğer dönem kayıtları çözülmeden --apply kullanmayın.');
  if (apply) console.log('Operatör onayı: tüm eksik donemYili kayıtlarının 2026 dönemine ait olduğu açıkça onaylandı.');

  // Always scan every collection before the first write. Existing but invalid
  // period values are never overwritten; if any are found, abort before apply.
  for (const name of COLLECTIONS) {
    const result = await scanCollection(db, name, false);
    totalScanned += result.scanned;
    totalMissing += result.missing;
    totalInvalid += result.invalid;
    console.log('ÖN KONTROL ' + name + ': taranan=' + result.scanned + ', eksik=' + result.missing + ', geçersiz-mevcut=' + result.invalid);
    if (result.samples.length) console.log('ÖRNEKLER ' + name + ': ' + JSON.stringify(result.samples));
  }
  console.log('ÖN KONTROL TOPLAM:', JSON.stringify({ totalScanned, totalMissing, totalInvalid, targetPeriod: TARGET_PERIOD }));
  if (apply && totalInvalid > 0) {
    throw new Error('Ön kontrol durduruldu: geçersiz mevcut donemYili değerleri var. Hiçbir belge yazılmadı; önce bu kayıtlar incelenmeli.');
  }

  if (apply) {
    for (const name of COLLECTIONS) {
      const result = await scanCollection(db, name, true);
      totalUpdated += result.updated;
      console.log('YAZIM ' + name + ': yazılan=' + result.updated + ', geçersiz-mevcut=' + result.invalid);
    }
  }

  console.log('TOPLAM:', JSON.stringify({ totalScanned, totalMissing, totalInvalid, totalUpdated, targetPeriod: TARGET_PERIOD }));
  if (apply) {
    let remaining = 0;
    for (const name of COLLECTIONS) {
      const check = await verifyCollection(db, name);
      remaining += check.remainingMissing + check.remainingInvalid;
      console.log('DOĞRULAMA ' + name + ': 2026 kayıt=' + check.targetPeriodCount + ', kalan eksik=' + check.remainingMissing + ', geçersiz=' + check.remainingInvalid);
    }
    if (remaining !== 0) throw new Error('Doğrulama başarısız: bazı belgelerde dönem alanı hâlâ eksik veya geçersiz. Mevcut geçersiz değerler otomatik olarak üzerine yazılmadı.');
    console.log('MIGRATION VERIFIED: kapsam içindeki tüm dönemsiz belgelere 2026 dönemi yazıldı.');
  } else {
    console.log('DRY-RUN tamamlandı. Hiçbir Firestore belgesi değiştirilmedi.');
    console.log('Önizleme doğrulandıktan ve açık karar verildikten sonra --apply --confirm-period=2026 --confirm-all-missing-are-2026 parametreleri birlikte kullanılmalıdır.');
  }
}

main().catch(error => {
  console.error('MIGRATION FAILED:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
