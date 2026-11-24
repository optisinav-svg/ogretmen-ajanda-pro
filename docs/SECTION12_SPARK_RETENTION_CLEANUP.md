# Spark uyumlu manuel dönem temizliği

Bu işlem Cloud Functions veya Blaze gerektirmez. Uygulama sahibi, kendi bilgisayarında Firebase Admin SDK kullanan yerel bir betiği çalıştırır. Betik Firestore Rules dağıtmaz ve kendiliğinden zamanlanmaz.

## Saklama politikası

- İlk uygun temizlik Temmuz 2028'de yalnızca \`2026\` dönemini hedefler.
- Sonraki her Temmuz, yalnızca o yılın iki yıl öncesindeki tek dönemi hedefler.
- Temmuz dışında, 2028'den önce veya başka bir dönem için silme başlatılamaz.
- Yalnızca \`dersNotlari\`, \`dersler\`, \`yoklamalar\`, \`odevler\`, \`kitaplar\` ve \`konular\` koleksiyonlarındaki eşleşen \`donemYili\` belgeleri hedeflenir.
- Okul, sınıf, öğrenci, kullanıcı profili, hesap, eşleştirme ve ortak kitap kütüphanesi kayıtları bu betik tarafından silinmez.
- Hedef belgelerin altında alt koleksiyon bulunursa işlem başlamadan durur; alt koleksiyonları sahipsiz bırakmaz.

## Ön koşullar

1. Node.js 20 veya üzeri ve \`functions\` bağımlılıkları kurulu olmalı.
2. Bilgisayarda Google Application Default Credentials hazır olmalı. İlk kurulum gerekiyorsa \`gcloud auth application-default login\` kullanılır.
3. Uygulama sahibinin Auth UID'si, \`uygulamaSahibi: true\` custom claim'i ve etkin \`ogretmen\` profili doğrulanmalı.
4. Silme işleminden önce son 24 saat içinde tam, salt okunur Firestore yedeği alınmalı. Betik arşiv ve manifest SHA-256 özetini doğrular.
5. Yedek dosyaları özel tutulmalı; GitHub'a veya sohbet ortamına yüklenmemeli.

## Önizleme

Depo kökünden:

\`\`\`powershell
Set-Location .\\functions
node .\\scripts\\firestore-backup.js
node .\\scripts\\manual-period-cleanup.js --preview --owner-uid=<UYGULAMA_SAHIBI_UID>
\`\`\`

İlk komut salt okunur tam yedek üretir. Varsayılan çıktı klasörü depo kökündeki \`firestore-backups\` klasörüdür. İkinci komut yalnızca hedef yılı ve koleksiyon bazında sayımları gösterir; hiçbir Firestore belgesini değiştirmez.

## Silme

Önizlemeden alınan hedef yıl ve toplam belge sayısı ile en son yedek manifestindeki \`archiveSha256\` değeri açıkça onaylanmalıdır:

\`\`\`powershell
node .\\scripts\\manual-period-cleanup.js --delete --owner-uid=<UYGULAMA_SAHIBI_UID> --confirm-target=ogretmen-takip:2026 --confirm-total=<ONIZLEME_TOPLAMI> --confirm-backup-sha256=<MANIFEST_SHA256>
\`\`\`

Örnek hedef yıl \`2026\` yalnızca Temmuz 2028'de geçerlidir. Sayı ve SHA değerleri örnek olarak sabit yazılmamalı; çalıştırma günündeki önizleme ve yedek manifestinden aynen alınmalıdır.

## Kesinti ve devam

- Betik silmeye başlamadan önce \`donemTemizlikKayitlari\` içine bir işlem kilidi ve ilk yedeğin kimliğini yazar.
- Silme 400 belgeyi aşmayan küçük partilerle yapılır; her partiden sonra kilit süresi uzatılır.
- İşlem yarıda kesilirse aynı hedef, toplam ve ilk yedek özetiyle yeniden önizleme alınır ve devam edilir.
- Devam sırasında yeni bir yedek oluşturulsa bile betik, silme başlamadan önce kaydedilmiş ilk yedeği doğrulamadan devam etmez.
- Tamamlandığında altı koleksiyonun hedef dönem sorguları yeniden sayılır; sıfır değilse işlem tamamlandı olarak işaretlenmez.
- Tamamlanan yıl için ikinci kez silme yapılamaz.

## Güvenlik sınırı

Bu betik henüz canlı projede çalıştırılmamıştır. Kodun eklenmesi veya CI testlerinin geçmesi canlı veriyi silmez. Çalıştırma yalnızca ilgili Temmuz ayında, önizleme ve açık onay sonrasında yapılmalıdır. Rules ve indeks dağıtımı bundan ayrı işlemlerdir.
