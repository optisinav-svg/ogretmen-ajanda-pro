# DEPRECATED: This legacy script combined live Firestore Rules deployment with APK build.
# It is intentionally blocked to prevent accidental production changes.
# Use scripts/build-tablet-apk.ps1 for an EAS tablet APK build only.
# Firestore Rules deployment must be reviewed and approved as a separate operation.

$ErrorActionPreference = 'Stop'
throw @'
Bu eski birleşik betik güvenlik nedeniyle devre dışı bırakıldı.
Canlı Firestore Rules dağıtımı ile APK üretimi artık ayrı işlemlerdir.
Tablet APK hazırlığı için scripts/build-tablet-apk.ps1 dosyasını kullanın.
Bu betik canlı Firebase projesine bağlanmaz ve Rules dağıtmaz.
'@
