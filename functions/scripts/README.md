# Operasyon betikleri — güvenli kullanım notları

Bu klasördeki betikler canlı Firebase projesine erişebilir. Varsayılan olarak salt okunur/dry-run davranışı tercih edilir. Hiçbir betik, kullanıcıdan ayrı onay alınmadan çalıştırılmamalıdır. Komut örnekleri depo kökünden değil, `functions` klasörünün içinden çalıştırılacak şekilde yazılmıştır.

## Salt okunur betikler

### `audit-missing-periods.js`
- Dönemle ilişkili 15 koleksiyonu salt okunur tarar (okul/sınıf/öğrenci, ders/ödev/yoklama/kitap, bireysel etkinlikler ve öğrenci bağlantı kayıtları).
- Açık `donemYili` değerlerini, eksik/geçersiz alanları, tarih alanlarına göre olası dönemi ve Haziran belirsizliğini raporlar.
- Haziran tarihlerini otomatik olarak bir döneme atamaz.
- Tam belge kimliği, öğrenci adı veya e-posta yazdırmaz.
- Firestore'a yazmaz.

Çalıştırma:
```powershell
node .\scripts\audit-missing-periods.js
```

### \`audit-rules-compatibility.js\`
- Mevcut belgelerin yeni Firestore Rules ile veri yapısı ve referans uyumluluğunu salt okunur denetler.
- Okul/sınıf/öğrenci, dönem, ders/ödev/yoklama/kitap/konu ilişkilerini ve kitap kütüphanesi alan şemasını kontrol eder.
- Yalnızca sayaç ve dönem dağılımı üretir; öğrenci adı, e-posta, belge kimliği veya içerik yazdırmaz.
- Hiçbir belgeyi oluşturmaz, güncellemez veya silmez.
- Çıktı incelenmeden canlı Rules dağıtımı yapılmamalıdır.

Çalıştırma:
\`\`\`powershell
node .\\scripts\\audit-rules-compatibility.js
\`\`\`

### `firestore-backup.js`
- Firestore verisini salt okunur dışa aktarır.
- Arşiv ve manifest oluşturur; manifest içine arşivin SHA-256 değerini yazar.
- Yedek dosyaları gizli tutulmalı; GitHub'a veya herkese açık depoya eklenmemelidir.

### `audit-account-ownership.js`
- Yalnızca komut satırında verilen e-posta adreslerini Auth'ta arar.
- Her hesap için Auth UID'si, Firestore profilinin varlığı ve ilgili koleksiyonlardaki `uid` / `ogretmenUid` / `ogrenciUid` sahiplik referans sayılarını gösterir.
- Öğrenci adları, e-postaları veya belge içerikleri listelenmez; sadece sayımlar raporlanır.
- Auth veya Firestore'a yazmaz; hesap silmez ve rol değiştirmez.

Çalıştırma (karşılaştırılacak adresleri açıkça yazarak):
```powershell
node .\scripts\audit-account-ownership.js hesap1@example.com hesap2@example.com
```

## Açık onay gerektiren betikler

### `migrate-missing-periods-2026.js`
- Varsayılanı DRY-RUN'dır; `--apply` olmadan yazma yapmaz.
- Yalnızca dokuz hedef koleksiyonda `donemYili` alanı tamamen bulunmayan belgeleri hedefler; var olan değerleri değiştirmez.
- Tarihten dönem çıkarmaz; yalnızca kendi dokuz hedef koleksiyonundaki eksik alanların hepsini 2026 yapar. Bireysel etkinlik ve öğrenci bağlantı koleksiyonları bu otomatik migration betiğinin dışındadır. Bu nedenle önce `audit-missing-periods.js` raporu incelenmeli ve tüm eksik belgelerin gerçekten 2026'ya ait olduğu teyit edilmelidir.
- Geçersiz mevcut `donemYili` değerleri bulunursa yazmaya başlamadan durur.
- Yazma için birlikte şu parametreler gerekir: `--apply --confirm-period=2026 --confirm-all-missing-are-2026`.
- SHA-256 doğrulanmış, proje kimliği ve dokuz hedef koleksiyonu içeren tam yedek olmadan yazma moduna geçmez.
- Bu betik kullanıcı onayı olmadan çalıştırılmayacaktır.

### `set-application-owner-claim.js`
- Varsayılanı DRY-RUN'dır.
- Yalnızca belirtilen Auth kullanıcısına `uygulamaSahibi: true` custom claim ekler; Firestore profilini değiştirmez.
- `--apply` ve ekranda istenen açık onay olmadan değişiklik yapmaz.
- Gerçek UID/e-posta eşleşmesi ayrıca doğrulanmalıdır.

### `manual-period-cleanup.js`
- Spark uyumlu yerel Admin SDK betiğidir; Cloud Functions veya Blaze kullanmaz.
- Varsayılan çalışma biçimi yoktur; `--preview` açıkça seçilirse salt okunur sayım yapar.
- Yalnızca Temmuz 2028 ve sonrasında, o yılın iki yıl öncesindeki dönemi hedefler.
- Yalnızca `dersNotlari`, `dersler`, `yoklamalar`, `odevler`, `kitaplar` ve `konular` koleksiyonlarını işler.
- Etkin uygulama sahibi custom claim'ini ve öğretmen profilini doğrular.
- Silme için son 24 saatte alınmış tam yedeği, arşiv dosyasını ve SHA-256 özetini doğrular; hedef, toplam belge sayısı ve yedek özeti ayrı ayrı açıkça onaylanmalıdır.
- Alt koleksiyonu olan belgeler varsa silmeye başlamadan durur. 400'lük partiler, işlem kilidi ve kesinti sonrası ilk yedeğe bağlı devam mekanizması kullanır.
- Çalıştırma ve onay örnekleri `docs/SECTION12_SPARK_RETENTION_CLEANUP.md` içindedir. Betik canlı projede çalıştırılmadan önce CI ve ayrı kod incelemesi tamamlanmalıdır.

## Devre dışı / kullanılmaması gereken betik

### `configure-existing-accounts.js`
- Eski hesap yapılandırma yaklaşımı güvenlik nedeniyle devre dışıdır.
- Çalıştırmayın; betik bilerek hata vererek durur.



## Cloud Functions

Proje Spark planında kalacağı için `firebase.json` içinde Functions deploy hedefi yoktur ve `functions/index.js` hiçbir fonksiyon export etmez. Bu klasördeki eski Functions modülleri yalnızca kaynak incelemesi ve izole testler içindir; deploy edilmemelidir.
