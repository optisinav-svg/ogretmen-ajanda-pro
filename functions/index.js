const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const {
  RETENTION_COLLECTIONS,
  expiredPeriodStartYear,
  isEligiblePeriodRecord,
} = require('./retentionPolicy');

initializeApp();
const db = getFirestore();
const PAGE_SIZE = 400;

exports.donemSonuVeriTemizligi = onSchedule(
  {
    schedule: 'every day 03:20',
    timeZone: 'Europe/Istanbul',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
    retryCount: 3,
  },
  async () => {
    const cutoffYear = expiredPeriodStartYear(new Date());

    if (cutoffYear === null) {
      logger.info('Haziran dönem çakışması: saklama temizliği bu ay çalıştırılmadı.');
      return;
    }

    // Safe default: deployment performs a full dry-run until this variable
    // is explicitly set to "true" in the Functions environment.
    const deleteEnabled = process.env.RETENTION_DELETE_ENABLED === 'true';
    const totals = {
      mode: deleteEnabled ? 'delete' : 'dry-run',
      cutoffYear,
      scanned: 0,
      eligible: 0,
      deleted: 0,
      skipped: 0,
      collections: {},
    };
    const failures = [];

    for (const collectionName of RETENTION_COLLECTIONS) {
      let cursor = null;
      const result = { scanned: 0, eligible: 0, deleted: 0, skipped: 0 };

      try {
        while (true) {
          let pageQuery = db.collection(collectionName)
            .where('donemYili', '<=', cutoffYear)
            .limit(PAGE_SIZE);

          if (cursor) pageQuery = pageQuery.startAfter(cursor);

          const page = await pageQuery.get();
          if (page.empty) break;

          const batch = db.batch();
          let batchDeleteCount = 0;

          for (const snapshot of page.docs) {
            result.scanned += 1;
            const data = snapshot.data();

            if (!isEligiblePeriodRecord(data, cutoffYear)) {
              result.skipped += 1;
              continue;
            }

            result.eligible += 1;
            if (deleteEnabled) {
              batch.delete(snapshot.ref);
              batchDeleteCount += 1;
            }
          }

          if (deleteEnabled && batchDeleteCount > 0) {
            await batch.commit();
            result.deleted += batchDeleteCount;
          }

          cursor = page.docs[page.docs.length - 1];
          if (page.size < PAGE_SIZE) break;
        }

        totals.scanned += result.scanned;
        totals.eligible += result.eligible;
        totals.deleted += result.deleted;
        totals.skipped += result.skipped;
        totals.collections[collectionName] = result;
      } catch (error) {
        failures.push({ collection: collectionName, message: error?.message || String(error) });
        logger.error('Dönem verisi temizliği koleksiyon hatası', {
          collection: collectionName,
          cutoffYear,
          error,
        });
      }
    }

    logger.info('Üç yıllık dönem saklama taraması tamamlandı.', totals);

    if (failures.length) {
      throw new Error(
        'Bazı koleksiyonlar işlenemedi: ' +
        failures.map(item => item.collection).join(', ')
      );
    }
  }
);
