# Firestore backup before period migration

This helper creates a **read-only** snapshot of every top-level Firestore
collection and recursively discovered subcollection in project
`ogretmen-takip`.

## 1. Prerequisites

- Node.js 20 or newer.
- Install the Cloud SDK if `gcloud` is not already available.
- Use the Google account that has read access to the Firebase project.
- Do not create or download a service-account private key.

Open PowerShell and authenticate with Application Default Credentials:

```powershell
gcloud auth application-default login
```

A browser window opens. Sign in to the Google account that owns or has
read access to the Firebase project. Do not paste passwords or tokens into
the terminal or ChatGPT.

## 2. Run the backup

From the project folder:

```powershell
cd C:\Users\skykl\Desktop\ogretmen-takip\ogretmen-takip-sdk54\functions
npm install
node scripts/firestore-backup.js
```

By default, the archive is written to the repository's
`firestore-backups` folder, which is excluded by `.gitignore`.
To choose another location, pass it as the first argument:

```powershell
node scripts/firestore-backup.js "D:\OgretmenAjandaYedekleri"
```

The script only performs Firestore reads. It writes a compressed JSONL
archive and a manifest containing the project ID, timestamp, document count,
and per-collection counts. It includes nested subcollections and preserves
Firestore timestamps, geopoints, document references, and bytes with explicit
type markers.

## 3. Verify the backup

The command must finish with:

`READ-ONLY FIRESTORE BACKUP COMPLETED`

Check that both files exist:
- `ogretmen-takip-firestore-<timestamp>.jsonl.gz`
- matching `.manifest.json`

Keep the two files together, make a second copy to a separate drive, and do
not upload the archive to GitHub or ChatGPT. The archive contains student and
teacher data.

This is a document-data snapshot. It does not back up Firebase Authentication
users, Storage objects, deployed security rules, or index configuration; those
must be inventoried separately. Do not change production rules or data based
only on this snapshot.
