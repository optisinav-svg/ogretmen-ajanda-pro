# Period ownership and legacy collection audit

This document records a source-code audit only. It does not inspect or modify live
Firestore documents. Collection existence, document counts, field coverage, and
legacy ownership must be verified against an approved backup or an explicitly
authorized live-data review before enabling deletion.

## Period ownership found in current app write paths

The current application passes the selected period from the home screen to
period-specific screens. The following current write paths explicitly store
`donemYili`:

- Schools and classes: `okullar`, `siniflar` (`OkulSinifEkrani.js`).
- Students: `ogrenciler` (`OgrenciEkrani.js`).
- Lesson notes: `dersNotlari` (`DersNotuEkrani.js`).
- Attendance and homework: `yoklamalar`, `odevler` (`YoklamaEkrani.js`,
  `OdevEkrani.js`).
- Student books and topics: `kitaplar`, `konular` (`KitapEkrani.js`).
- Weekly lesson schedule and individual calendar activities/sessions:
  `dersler`, `bireyselEtkinlikler`, `bireyselDersOturumlari`
  (`TakvimEkrani.js`).

This is evidence about current source write paths, not proof that every
historical document in those collections contains a valid numeric
`donemYili`.

## Global or shared data

- Shared book definitions and shared book-topic definitions are not owned by a
  single academic period. Keep `kitapKutuphanesi` and
  `kitapKutuphanesiKonulari` outside automatic period deletion.
- User profiles are not period-owned. Registration stores the selected
  `sezon` as profile metadata in `kullanicilar`; do not treat a profile as an
  academic-period record or delete it with period cleanup.
- Developer and other global collections are outside the period cleanup
  allowlist.

## Collection-name reconciliation required

Firestore collection names are case-sensitive. The supplied Firebase inventory
and current app source contain these differences:

| Supplied inventory name | Current app source name | Handling |
| --- | --- | --- |
| `Dersler` | `dersler` | Keep uppercase legacy collection out of cleanup until separately reviewed |
| `kullanıcılar` | `kullanicilar` | Do not rename or merge without a reviewed migration |
| `KitapKutuphanesi` | `kitapKutuphanesi` | Confirm actual live collection identity before any migration |
| `KitapKutuphanesiKonuları` | `kitapKutuphanesiKonulari` | Confirm actual live collection identity before any migration |

The app also references `ogrenciler`, `odevler`, `bireyselEtkinlikler`,
and `bireyselDersOturumlari`, which were not in the supplied inventory.
The supplied inventory included `geliştiriciler` and `öğeler`, which were
not found as literal collection references in the reviewed app source.
These differences do not prove that data is missing; Firestore may contain
collections created by earlier versions or other tools.

## Legacy records without an explicit period

The retention function deliberately skips records without a numeric
`donemYili` and non-empty `uid`. Do not infer their period from timestamps:
during June, the user may intentionally select either of two overlapping
periods, so a timestamp alone cannot reliably recover the selected period.

Before enabling deletion:

1. Review a current backup or an approved export.
2. Inventory documents missing `donemYili`, grouped by exact collection name.
3. Reconcile case-sensitive collection-name differences.
4. Determine ownership and period for each legacy group from reliable
   historical context; leave ambiguous records untouched.
5. Test any approved migration on a copy and verify counts and relationships.
6. Run the scheduled cleanup in dry-run mode and review its per-collection
   counts before separately approving deletion.


## Period selector alignment

The home-screen selector now presents only the three adjacent period start years
(current minus one, current, and current plus one), rather than discovering an
unlimited number of periods from historical school/class documents. The
upcoming period can be selected and stored explicitly, but existing
`donemDuzenlemeyeAcik` checks in the period-specific screens prevent
modification before that period's June 1 start date. Selecting a period
continues to pass its year to the screens; records are not reassigned based on
the calendar date.

This is a source-code change only. The selector behavior still requires
verification in the Android build after APK creation.


The non-destructive recovery procedure is documented in `functions/RECOVERY_RUNBOOK.md`. It requires a verified data export and a reviewed candidate list; it does not overwrite current documents.

## Current safety status

- The scheduled cleanup allowlist excludes shared libraries and user profiles.
- The scheduled cleanup requires explicit numeric `donemYili` and `uid`.
- Legacy documents without those fields are not eligible.
- No live Firestore data was read, migrated, or deleted during this audit.
- The cleanup remains dry-run by default and is not deployed.


## Newly introduced student-account collection

`ogrenciOdevBildirimleri` is introduced by the teacher–student account workflow. It stores a student's "completed" notification separately from the teacher's homework assessment. New documents carry the teacher's `uid` and the homework's explicit numeric `donemYili`, so they are covered by the three-year retention allowlist. The collection has no live records from this source change because account linking remains disabled and no Functions have been deployed.
