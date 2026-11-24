// DEPRECATED — this legacy script expected exactly two profiles and could modify
// Firestore role fields. It must not be used for the current three-account state.
// Use set-application-owner-claim.js instead; that script changes only the custom
// claim after verifying an explicit UID/email pair and requires --apply + confirmation.

console.error(
  'DEPRECATED: no account or Firestore changes were made. ' +
  'Use set-application-owner-claim.js with OWNER_UID and OWNER_EMAIL after reviewing its dry-run.'
);
process.exitCode = 1;
