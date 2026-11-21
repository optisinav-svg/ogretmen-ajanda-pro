# Three-year academic-period retention

The scheduled function `donemSonuVeriTemizligi` runs daily at 03:20
(`Europe/Istanbul`). It removes only explicitly period-tagged records whose
academic-period start year has completed three academic years.

## Retention boundary

- A period such as 2026/2027 starts on June 1, 2026.
- It remains available through June 30, 2029 (the end of its third academic year).
- The cleanup may first remove it on July 1, 2029.
- Cleanup is skipped throughout June so the period ending on June 30 is never
  removed early.

## Included period-owned collections

`bireyselDersOturumlari`, `bireyselEtkinlikler`, `ogrenciOdevBildirimleri`, `dersNotlari`,
`yoklamalar`, `odevler`, `konular`, `kitaplar`, `dersler`,
`ogrenciler`, `siniflar`, and `okullar`.

Shared book-library definitions (`kitapKutuphanesi`,
`kitapKutuphanesiKonulari`) and user profiles are deliberately excluded.

The Firebase inventory previously supplied also listed `Dersler` (uppercase D),
while the current app code writes to `dersler` (lowercase d). The uppercase
collection is intentionally not included until its ownership and legacy data
are reviewed; Firestore collection names are case-sensitive.

The function deletes child/activity records before student, class, and school
records. Student history embedded in an expired student document expires with
that document.

## Safety behavior

- Only records with a numeric `donemYili` at or before the cutoff are eligible.
- A non-empty `uid` is also required.
- Records without an explicit `donemYili` are skipped. Their period is not
  guessed from timestamps because a June date alone cannot reliably identify
  the selected period. These legacy records need a separate reviewed migration.
- The function does not touch Firestore until
  `RETENTION_DELETE_ENABLED=true` is configured.
- With the variable unset or set to any other value, it performs a dry run and
  logs per-collection counts.
- Processing is paginated and uses batches of at most 400 documents. If a run
  fails partway through, a later run can safely continue.

## Local verification

From the repository root:

```sh
cd functions
npm install
npm test
```

## Deployment notes

Deploying scheduled Functions requires the Firebase project to have the
required Cloud Functions / Cloud Scheduler APIs and billing configuration.
This repository change does not deploy anything or change live Firestore data.

First deploy with `RETENTION_DELETE_ENABLED=false` (dry-run), review Cloud
Logging counts, and confirm the collection inventory and legacy-record plan.
Only then set the variable to `true` and redeploy to enable deletion.
