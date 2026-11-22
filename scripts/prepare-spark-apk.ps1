# One-command Spark rules deployment + Android APK build.
# Run from the repository root after pulling release/pre-apk-2026-11-22.
$ErrorActionPreference = 'Stop'

$expectedBranch = 'release/pre-apk-2026-11-22'
$projectId = 'ogretmen-takip'
$backupRelativePath = 'firestore-backups/ogretmen-takip-firestore-2026-11-22T12-24-57-871Z.jsonl.gz'
$expectedBackupSha256 = '2716E9109096D6D5E4096DF92F4392A3914E44964B624829AE9980375399703D'

function Assert-LastExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step başarısız oldu (exit code: $LASTEXITCODE). Canlı rules dağıtımı başlamadıysa verilerde değişiklik yapılmamıştır."
  }
}

$repoRoot = (Get-Location).Path
$branch = (git branch --show-current).Trim()
if ($branch -ne $expectedBranch) {
  throw "Önce $expectedBranch dalına geçin. Şu anki dal: $branch"
}

$gitChanges = git status --porcelain
if ($gitChanges) {
  throw 'Çalışma ağacında kaydedilmemiş değişiklik var. Önce bunları güvenli biçimde kaydedin veya yedekleyin.'
}

$backupPath = Join-Path $repoRoot $backupRelativePath
if (-not (Test-Path $backupPath)) {
  throw "Canlı rules dağıtımından önce doğrulanmış Firestore yedeği bulunamadı: $backupPath"
}
$actualBackupSha256 = (Get-FileHash -Path $backupPath -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actualBackupSha256 -ne $expectedBackupSha256) {
  throw "Firestore yedeğinin SHA-256 değeri beklenen değerle eşleşmiyor. Beklenen: $expectedBackupSha256 / Bulunan: $actualBackupSha256"
}

foreach ($tool in @('git', 'npm', 'firebase', 'npx')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool komutu bulunamadı. Gerekli aracı kurup tekrar çalıştırın."
  }
}

Write-Host '1/5 — Firebase ve EAS hesap erişimi kontrol ediliyor...' -ForegroundColor Cyan
firebase projects:list
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Firebase oturumu açılıyor...' -ForegroundColor Yellow
  firebase login
  Assert-LastExitCode 'Firebase giriş'
  firebase projects:list
}
Assert-LastExitCode 'Firebase proje erişimi'

npx eas-cli@latest whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Expo/EAS oturumu açılıyor...' -ForegroundColor Yellow
  npx eas-cli@latest login
  Assert-LastExitCode 'EAS giriş'
  npx eas-cli@latest whoami
}
Assert-LastExitCode 'EAS hesap erişimi'

Write-Host '2/5 — Kilit dosyasına göre bağımlılıklar kuruluyor...' -ForegroundColor Cyan
npm ci
Assert-LastExitCode 'npm ci'

Write-Host '3/5 — Android JavaScript paketi doğrulanıyor...' -ForegroundColor Cyan
$validationDir = Join-Path $env:TEMP 'ogretmen-ajanda-spark-validation'
if (Test-Path $validationDir) {
  Remove-Item -Path $validationDir -Recurse -Force
}
npx expo export --platform android --output-dir $validationDir
Assert-LastExitCode 'Expo Android export'

Write-Host ''
Write-Host 'Canlıya dağıtılacak kurallar Spark öğrenci hesabı, öğretmen onayı, veri sahipliği ve Temmuz 2028 sonrası dönem temizliği içindir.' -ForegroundColor Yellow
Write-Host 'Bu adım yalnızca Firestore rules dağıtır; Cloud Functions dağıtmaz, kayıt taşımaz ve hiçbir öğrenci/dönem verisini silmez.' -ForegroundColor Yellow
Write-Host "Doğrulanan yedek: $backupRelativePath" -ForegroundColor Yellow
$approval = Read-Host "ogretmen-takip projesine sıkı Firestore rules dağıtmak için DEPLOY yazın"
if ($approval -cne 'DEPLOY') {
  throw 'Kullanıcı onayı verilmedi. Canlı Firestore rules değiştirilmedi ve APK derlemesi başlatılmadı.'
}

Write-Host '4/5 — Yalnızca Firestore rules canlı projeye dağıtılıyor...' -ForegroundColor Cyan
firebase deploy --only firestore:rules --project $projectId
Assert-LastExitCode 'Firestore rules dağıtımı'

Write-Host '5/5 — Android APK EAS üzerinde derleniyor...' -ForegroundColor Cyan
Write-Host 'APK tablet testi içindir. Telefon uygulamasına yüklemeden önce Android imza parmak izinin mevcut telefon uygulamasıyla aynı olduğu doğrulanmalıdır.' -ForegroundColor Yellow
npx eas-cli@latest build --profile preview --platform android
Assert-LastExitCode 'EAS Android APK build'

Write-Host 'EAS build isteği tamamlandı. EAS çıktısındaki build bağlantısından APK durumunu takip edin.' -ForegroundColor Green
