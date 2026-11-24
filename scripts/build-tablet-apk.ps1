# Build-only tablet APK preparation.
# This script NEVER deploys Firebase rules, changes Firestore data, or runs migrations.
# Run from the repository root on release/tablet-apk-2026-11-24.

$ErrorActionPreference = 'Stop'
$expectedBranch = 'release/tablet-apk-2026-11-24'
$expectedProjectId = 'ogretmen-takip'
$expectedPackage = 'com.ogretmentakip.app'
$expectedEasProjectId = '31baafe1-369c-4b64-b066-26b2de6ef837'
$firebaseAlias = 'production'

function Assert-LastExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step başarısız oldu (exit code: $LASTEXITCODE). EAS APK build başlatılmadı veya tamamlanmadı."
  }
}

$repoRoot = (Get-Location).Path
$branch = (git branch --show-current).Trim()
if ($branch -ne $expectedBranch) {
  throw "Önce $expectedBranch dalına geçin. Şu anki dal: $branch"
}

if (git status --porcelain) {
  throw 'Çalışma ağacında kaydedilmemiş değişiklik var. Önce bunları güvenli biçimde kaydedin veya yedekleyin.'
}

foreach ($tool in @('git', 'node', 'npm', 'npx')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool komutu bulunamadı."
  }
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 20) {
  throw "Node.js 20 veya üzeri gerekli. Bulunan: $(node --version)"
}

$appJsonPath = Join-Path $repoRoot 'app.json'
$firebasercPath = Join-Path $repoRoot '.firebaserc'
if (-not (Test-Path $appJsonPath) -or -not (Test-Path $firebasercPath)) {
  throw 'app.json veya .firebaserc bulunamadı.'
}

$app = Get-Content -Path $appJsonPath -Raw | ConvertFrom-Json
$firebaseRc = Get-Content -Path $firebasercPath -Raw | ConvertFrom-Json
if ($app.expo.android.package -ne $expectedPackage) {
  throw "Android package kimliği beklenenden farklı: $($app.expo.android.package)"
}
if ($app.expo.extra.eas.projectId -ne $expectedEasProjectId) {
  throw "EAS projectId beklenenden farklı: $($app.expo.extra.eas.projectId)"
}
if ($firebaseRc.projects.$firebaseAlias -ne $expectedProjectId) {
  throw "Firebase '$firebaseAlias' takma adı beklenen projeye bağlı değil."
}

Write-Host '1/4 — Bağımlılıklar kilit dosyasına göre kuruluyor...' -ForegroundColor Cyan
npm ci
Assert-LastExitCode 'npm ci'

Write-Host '2/4 — Android JavaScript paketi doğrulanıyor...' -ForegroundColor Cyan
$validationDir = Join-Path $env:TEMP 'ogretmen-ajanda-tablet-validation'
if (Test-Path $validationDir) {
  Remove-Item -Path $validationDir -Recurse -Force
}
npx expo export --platform android --output-dir $validationDir
Assert-LastExitCode 'Expo Android export'

Write-Host '3/5 — Üretim bağımlılıklarının güvenlik denetimi yapılıyor...' -ForegroundColor Cyan
$auditPath = Join-Path $env:TEMP 'ogretmen-ajanda-runtime-audit.json'
npm audit --omit=dev --json > $auditPath
$auditExitCode = $LASTEXITCODE
if (-not (Test-Path $auditPath)) {
  throw 'npm audit raporu üretilemedi; EAS APK build başlatılmadı.'
}
try {
  $audit = Get-Content -Path $auditPath -Raw | ConvertFrom-Json
} catch {
  throw "npm audit raporu okunamadı. Rapor: $auditPath"
}
if (-not $audit.metadata -or -not $audit.metadata.vulnerabilities) {
  throw "npm audit raporunda güvenlik özeti bulunamadı. Rapor: $auditPath"
}
$vuln = $audit.metadata.vulnerabilities
Write-Host "Üretim bağımlılıkları — kritik: $($vuln.critical), yüksek: $($vuln.high), orta: $($vuln.moderate), düşük: $($vuln.low)" -ForegroundColor Yellow
if ($vuln.critical -gt 0 -or $vuln.high -gt 0) {
  throw "Üretim bağımlılıklarında yüksek/kritik güvenlik uyarısı var. Önce raporu inceleyin: $auditPath"
}
if ($vuln.moderate -gt 0) {
  Write-Host "Orta düzey uyarılar var; rapor incelenmeli: $auditPath" -ForegroundColor Yellow
}

Write-Host '4/5 — EAS hesabı doğrulanıyor...' -ForegroundColor Cyan
npx eas-cli@latest whoami
Assert-LastExitCode 'EAS hesap erişimi'

Write-Host ''
Write-Host 'GÜVENLİK SINIRI: Bu betik Firebase Rules dağıtmaz, Cloud Functions dağıtmaz, Firestore verisine yazmaz ve veri silmez.' -ForegroundColor Yellow
Write-Host 'Yeni APK, güncel Firestore Rules canlı projeye ayrıca ve onaylı biçimde dağıtılmadan tablette kullanılmamalıdır.' -ForegroundColor Yellow
$approval = Read-Host 'Yalnızca EAS üzerinde preview tablet APK build işlemini başlatmak için BUILD yazın'
if ($approval -cne 'BUILD') {
  throw 'BUILD onayı verilmedi. EAS APK build başlatılmadı.'
}

Write-Host '5/5 — EAS preview Android APK build başlatılıyor...' -ForegroundColor Cyan
npx eas-cli@latest build --profile preview --platform android --non-interactive
Assert-LastExitCode 'EAS Android APK build'

Write-Host 'EAS build komutu tamamlandı. Build bağlantısını ve sonucunu EAS çıktısından doğrulayın.' -ForegroundColor Green
