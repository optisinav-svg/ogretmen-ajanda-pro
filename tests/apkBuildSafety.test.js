const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-tablet-apk.ps1'), 'utf8');
const legacyScript = fs.readFileSync(path.join(root, 'scripts', 'prepare-spark-apk.ps1'), 'utf8');

test('tablet APK build script cannot deploy Firebase or mutate Firestore', () => {
  assert.doesNotMatch(buildScript, /firebase\s+deploy|firestore:rules|firestore:delete|migrate-missing-periods/i);
  assert.match(buildScript, /npm audit --omit=dev --json/);\n  assert.match(buildScript, /vuln\.critical -gt 0 -or \$vuln\.high -gt 0/);\n  assert.match(buildScript, /BUILD yazın/);
  assert.match(buildScript, /release\/tablet-apk-2026-11-24/);
});

test('tablet APK build script validates the expected Firebase and EAS project identities', () => {
  assert.match(buildScript, /ogretmen-takip/);
  assert.match(buildScript, /31baafe1-369c-4b64-b066-26b2de6ef837/);
  assert.match(buildScript, /com\.ogretmentakip\.app/);
});

test('legacy combined deployment script fails closed', () => {
  assert.match(legacyScript, /DEPRECATED/);
  assert.match(legacyScript, /throw/);
  assert.doesNotMatch(legacyScript, /firebase\s+deploy/);
});
