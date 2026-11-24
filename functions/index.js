/**
 * Spark-only deployment entrypoint.
 *
 * This project intentionally exports no Cloud Functions. Firebase Spark does
 * not support deploying Cloud Functions, and the application has been migrated
 * to Firestore Rules-enforced client flows where safe. Risky or privileged
 * operations remain disabled in the app until a safe Spark design is complete.
 *
 * Legacy function modules remain in this folder for source review and isolated
 * policy tests only. Do not re-export them without an explicit architecture
 * decision and a separate review of billing, security and data-retention impact.
 */
module.exports = {};
