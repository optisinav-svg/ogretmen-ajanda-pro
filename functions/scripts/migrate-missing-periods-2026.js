#!/usr/bin/env node
'use strict';

// One-time, explicit academic-period migration for legacy records.
// Safe default is dry-run. Only documents missing donemYili are updated;
// existing period values are never overwritten.
const fs = require('node:fs');
const path = require('node:path');
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

function verifyBackup() {
  const root = path.resolve(__dirname, '../..');
  const backupDir = path.join(root, 'firestore-backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('firestore-backups klasörü bulunamadı. Önce doğrulanmış yedeği kontrol edin.');
  }
  const manifests = fs.readdirSync(backupDir)
    .filter(name => name.endsWith('.manifest.json'))
    .sort()
    .reverse();
  for (const name of manifests) {
    const manifestPath = path.join(backupDir, name);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const archiveName = name.replace(/\.manifest\.json$/, '.jsonl.gz');
    const archivePath = path.join(backupDir, archiveName);
    if (
      manifest.projectId === PROJECT_ID &&
      Number(manifest.totalDocuments) >= 1 &&
      fs.existsSync(archivePath) &&
      fs.statSync(archivePath).size > 0
    ) {
      return { manifestPath, archivePath, totalDocuments: manifest.totalDocuments };
    }
  }
  throw new Error('ogretmen-takip projesine ait eşleşen ve dolu yedek + manifest bulunamadı.');
}

async function scanCollection(db, name, apply) {
  const collection = db.collection(name);
  let cursor = null;
  let scanned = 0;
  let missing = 0;
  let updated = 0;
  const batchSamples = [];
  while (true) {
    let query = collection.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;

    const missingDocs = page.docs.filter(doc => !Object.prototype.hasOwnProperty.call(doc.data(), 'donemYili'));
    scanned += page.size;
    missing += missingDocs.length;
    for (const doc of missingDocs.slice(0, Math.max(0, 10 - batchSamples.length))) {
      batchSamples.push({ collection: name, idSuffix: doc.id.slice(-6) });
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
  return { scanned, missing, updated, samples: batchSamples };
}

async function verifyCollection(db, name) {
  const snapshot = await db.collection(name).where('donemYili', '==', TARGET_PERIOD).count().get();
  const missingSnapshot = await db.collection(name).get();
  const missing = missingSnapshot.docs.filter(doc => !Object.prototype.hasOwnProperty.call(doc.data(), 'donemYili')).length;
  return { targetPeriodCount: snapshot.data().count, remainingMissing: missing };
}

async function main() {
  const apply = hasApplyFlag(process.argv.slice(2));
  const backup = verifyBackup();
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();
  const results = {};
  let totalScanned = 0;
  let totalMissing = 0;
  let totalUpdated = 0;

  console.log('Proje:', PROJECT_ID);
  console.log('Hedef dönem:', TARGET_PERIOD);
  console.log('Mod:', apply ? 'UYGULAMA' : 'DRY-RUN (salt okunur)');
  console.log('Yedek doğrulaması:', backup.totalDocuments, 'belge; arşiv ve manifest mevcut.');
  console.log('Dönem verisi olmayan profil ve ortak kitap kütüphanesi tanımları bilerek kapsam dışıdır.');

  for (const name of COLLECTIONS) {
    const result = await scanCollection(db, name, apply);
    results[name] = result;
    totalScanned += result.scanned;
    totalMissing += result.missing;
    totalUpdated += result.updated;
    console.log(name + ': taranan=' + result.scanned + ', dönemsiz=' + result.missing + ', yazılan=' + result.updated);
  }

  console.log('TOPLAM:', JSON.stringify({ totalScanned, totalMissing, totalUpdated, targetPeriod: TARGET_PERIOD }));
  if (apply) {
    let remaining = 0;
    for (const name of COLLECTIONS) {
      const check = await verifyCollection(db, name);
      remaining += check.remainingMissing;
      console.log('DOĞRULAMA ' + name + ': 2026 kayıt=' + check.targetPeriodCount + ', kalan dönemsiz=' + check.remainingMissing);
    }
    if (remaining !== 0) throw new Error('Doğrulama başarısız: bazı belgeler hâlâ dönemsiz.');
    console.log('MIGRATION VERIFIED: kapsam içindeki tüm dönemsiz belgelere 2026 dönemi yazıldı.');
  } else {
    console.log('DRY-RUN tamamlandı. Hiçbir Firestore belgesi değiştirilmedi.');
    console.log('Önizleme doğrulandıktan sonra aynı komutu --apply ile çalıştırın.');
  }
}

main().catch(error => {
  console.error('MIGRATION FAILED:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
