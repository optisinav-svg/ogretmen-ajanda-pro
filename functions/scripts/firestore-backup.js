/**
 * Read-only Firestore snapshot for the academic-period migration.
 *
 * Authentication: Google Cloud Application Default Credentials (ADC).
 * Run after: gcloud auth application-default login
 *
 * Usage (from the repository's functions directory):
 *   node scripts/firestore-backup.js
 *   node scripts/firestore-backup.js "C:/OgretmenAjandaBackups"
 *
 * This script only reads Firestore. It never writes, updates, or deletes
 * production documents. The resulting archive contains personal data:
 * keep it private and never commit or upload it to GitHub/chat.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'ogretmen-takip';
const PAGE_SIZE = 400;

function encodeValue(value) {
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value)) {
    return { __firestoreType: 'bytes', base64: value.toString('base64') };
  }
  if (Array.isArray(value)) return value.map(encodeValue);

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function'
      && Number.isInteger(value.seconds)
      && Number.isInteger(value.nanoseconds)) {
      return {
        __firestoreType: 'timestamp',
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
      };
    }
    if (typeof value.latitude === 'number'
      && typeof value.longitude === 'number'
      && Object.keys(value).length <= 2) {
      return {
        __firestoreType: 'geopoint',
        latitude: value.latitude,
        longitude: value.longitude,
      };
    }
    if (typeof value.path === 'string'
      && value.firestore
      && typeof value.get === 'function') {
      return { __firestoreType: 'documentReference', path: value.path };
    }
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = encodeValue(nested);
    }
    return result;
  }
  return value;
}

async function writeLine(gzip, value) {
  if (!gzip.write(JSON.stringify(value) + '\n')) {
    await once(gzip, 'drain');
  }
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

async function main() {
  const outputDir = path.resolve(
    process.argv[2] || path.join(__dirname, '../../firestore-backups')
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `ogretmen-takip-firestore-${stamp}.jsonl.gz`;
  const archivePath = path.join(outputDir, archiveName);
  const manifestPath = archivePath.replace(/\.jsonl\.gz$/, '.manifest.json');

  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
  const db = getFirestore();
  const output = fs.createWriteStream(archivePath, { flags: 'wx' });
  const gzip = zlib.createGzip({ level: 9 });
  gzip.pipe(output);

  const manifest = {
    projectId: PROJECT_ID,
    createdAt: new Date().toISOString(),
    archive: archiveName,
    format: 'JSON Lines compressed with gzip; Firestore special values tagged',
    readOnly: true,
    totalDocuments: 0,
    collections: {},
  };

  async function exportCollection(collectionRef) {
    const collectionPath = collectionRef.path;
    if (!manifest.collections[collectionPath]) {
      manifest.collections[collectionPath] = 0;
    }

    let cursor = null;
    while (true) {
      let query = collectionRef
        .orderBy(FieldPath.documentId())
        .limit(PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);

      const page = await query.get();
      if (page.empty) break;

      for (const doc of page.docs) {
        await writeLine(gzip, {
          collection: collectionPath,
          id: doc.id,
          path: doc.ref.path,
          data: encodeValue(doc.data()),
        });
        manifest.collections[collectionPath] += 1;
        manifest.totalDocuments += 1;

        const childCollections = await doc.ref.listCollections();
        for (const childCollection of childCollections) {
          await exportCollection(childCollection);
        }
      }

      cursor = page.docs[page.docs.length - 1];
      if (page.size < PAGE_SIZE) break;
    }
  }

  try {
    const topLevelCollections = await db.listCollections();
    for (const collection of topLevelCollections) {
      await exportCollection(collection);
    }
    gzip.end();
    await finished(output);
    manifest.archiveSha256 = await sha256File(archivePath);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
      flag: 'wx',
    });
    console.log('READ-ONLY FIRESTORE BACKUP COMPLETED');
    console.log(JSON.stringify({
      projectId: manifest.projectId,
      totalDocuments: manifest.totalDocuments,
      collectionCount: Object.keys(manifest.collections).length,
      archivePath,
      manifestPath,
      archiveSha256: manifest.archiveSha256,
    }, null, 2));
    console.log('Keep both files private. Do not commit or send the archive.');
  } catch (error) {
    gzip.destroy(error);
    output.destroy();
    try { fs.unlinkSync(archivePath); } catch {}
    throw error;
  }
}

main().catch(error => {
  console.error('Firestore backup failed; no data was changed.');
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
