# Safe Firestore record recovery runbook

This runbook is for recovering records that were deleted before a recoverable
archive mechanism existed. It is intentionally non-destructive by default.
It does not connect to Firestore, inspect production data, or perform a restore.

## Required source material

Use a verified Firestore export or local backup made before the deletion.
A source-code ZIP is not a Firestore data backup. Record the backup date,
project ID, exact collection names, and export format before processing it.

Never place service-account JSON, private keys, access tokens, or production
credentials in this repository or a chat message.

## Recovery workflow

1. Preserve the original backup unchanged and create a separate working copy.
2. Parse the backup into a staging inventory with exact collection name,
   document ID, and document data. Preserve nested objects, arrays, timestamps,
   and document IDs exactly.
3. Compare each candidate with the current Firestore document at the same
   collection/document path.
4. Restore only documents proven absent from the current database. Never
   overwrite an existing document as part of recovery.
5. For period-owned records, verify the numeric `donemYili` and owner `uid`.
   Do not infer the period from a timestamp. Ambiguous legacy records remain
   in staging and are not restored automatically.
6. Verify parent-child relationships before restoring dependent documents:
   school/class before student; student/book before topic and homework;
   lesson/session before related attendance or lesson notes where applicable.
7. Keep exact case-sensitive collection names. Do not merge `Dersler` with
   `dersler`, or Turkish-character collection names with ASCII variants.
8. Generate a before/after count report and a list of every document that
   would be created. Review that report before any production restore.
9. Restore in bounded batches (no more than 400 writes per batch), recording
   successful document paths so a failed run can be resumed without replacing
   existing records.
10. After restoration, verify counts and key relationships from a fresh read.

## Special handling

- Student document restoration alone does not recreate missing attendance,
  homework, book, or topic documents; each collection must be reviewed.
- Shared book-library definitions and user profiles are not period-owned and
  must not be restored using the academic-period retention workflow.
- A student who has since been re-enrolled or transferred must not have their
  current class fields overwritten with old backup values. Recovery must be
  field-aware: restore a missing document only, or separately merge reviewed
  historical data without replacing current class/period fields.
- If the backup contains a student document that currently exists, do not
  overwrite it. Extract only independently missing historical child records
  after verifying their ownership and references.

## Approval boundary

Actual production restoration requires a verified backup, a reviewed candidate
list, and explicit approval of the exact documents/collections to restore.
No restore should be run merely because a record appears in an older backup.
