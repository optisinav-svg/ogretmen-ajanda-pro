# Firebase Spark uyumluluk planı — 22.11.2026

## Değişmez kararlar

- Firebase Spark ücretsiz planında kalınacak.
- Blaze/ücretli plan kullanılmayacak.
- Cloudflare Workers veya başka bir backend'e taşıma yapılmayacak.
- Mevcut Firebase projesi, Firestore verileri, öğretmen uygulaması ve imza kimliği korunacak.
- Google Drive yedekleme ertelendi.
- KVKK taslağında veri sorumlusu ad-soyadı ....... kalacak.
- Gerçek öğrenci verisiyle test veya veri silme, yedek ve geri dönüş kontrolü olmadan yapılmayacak.

## Spark sınırı

Firebase Spark'ta Cloud Functions dağıtımı ve dolayısıyla şu sunucu işlevleri canlıya alınamaz:
- Auth kullanıcı oluşturma tetikleyicisi / profil oluşturma callable'ı
- Öğretmen-öğrenci eşleştirme callable'ları
- Ödev tamamlama callable bildirimi
- Push token callable'ları
- Firestore tetikleyicileriyle yeni ödev bildirimi
- Uygulama sahibi istatistik callable'ı
- Zamanlanmış dönem temizliği

Kaynak depoda Functions kodunun bulunması, canlı Firebase'de çalıştığı anlamına gelmez. Canlı Functions envanteri boş bulunmuştur. Bu nedenle APK'nın kullanıcı akışlarında Cloud Functions çağrısı bırakılmamalıdır.

## Spark karşılıkları — kaynak kodda yapılanlar

| Özellik | Spark uygulaması | Durum |
|---|---|---|
| Öğretmen profili | Kayıt ekranı, kendi UID'si altında Firestore profili oluşturur. Rol ve uygulama sahibi yetkisi sonradan değiştirilemez. | Kaynak kodda uygulandı |
| Öğrenci hesabı | E-posta doğrulaması korunur. Öğretmenin 16 karakterlik rastgele kodu SHA-256 belge kimliğiyle saklanır; 12 saat geçerli ve tek kullanımlıdır. | Kaynak kodda uygulandı |
| Öğrenci kimliği | Kod, kayıtlı e-posta ve ad-soyad eşleşmesi kontrol edilir. E-posta karşılaştırması için öğrenci kaydında normalize edilmiş ek alan tutulur. | Kaynak kodda uygulandı |
| Öğretmen onayı | Öğretmen talebi onaylar/reddeder; onayda bağlantı ve kayıt indeksi aynı Firestore transaction içinde oluşturulur. İzinler allowlist ile sınırlıdır. | Kaynak kodda uygulandı |
| Öğrenci erişimi | Yalnızca aktif bağlantı ve öğretmenin verdiği izinler kadar veri görünür. Öğrenci başka öğretmenin verisini okuyamaz. | Kurallar ve testler güncellendi |
| Ödev tamamlandı bildirimi | Öğrenci yalnızca kendisine atanmış ödev için ayrı Firestore bildirimi oluşturur. | Kaynak kodda uygulandı |
| Yeni ödev bildirimi | Öğretmen ödev oluşturduğunda veya yeni öğrenci hedeflediğinde uygulama içi bildirim yazılır; hedef kaldırılırsa mevcut bildirim iptal edilir. | Kaynak kodda uygulandı |
| Telefon push bildirimi | Spark'ta güvenli sunucu gönderimi yoktur. Expo/FCM gizli anahtarı APK'ya konulmaz. Öğrenci ekranı uygulama içi bildirimleri kullanır. | Push devre dışı; uygulama içi bildirim var |
| Uygulama sahibi istatistikleri | Custom claim kontrolüyle öğretmen, öğrenci, bağlantı ve bekleyen talep sayıları Firestore'dan hesaplanır; öğrenci kimliği ekranda gösterilmez. | Kaynak kodda uygulandı |
| Dönem temizliği | Uygulama sahibi Temmuz ayında altı koleksiyonu önizler; açık onayla yalnızca iki yıl önceki dönemi 400 kayıtlık batch'lerle siler ve yıllık kilit yazar. Firestore rules Temmuz dışı okumayı/silmeyi reddeder. | Kaynak kodda uygulandı; Emulator doğrulaması bekliyor |

## Yıllık arşiv ve silme kararı

- 2026 kayıtları Temmuz 2028'e kadar korunur.
- Temmuz 2028'de yalnızca `donemYili == 2026` olan kayıtlar silinir.
- Temmuz 2029'da yalnızca 2027; Temmuz 2030'da yalnızca 2028 silinir.
- Silme kapsamı yalnızca `dersler`, `dersNotlari`, `yoklamalar`, `odevler`, `kitaplar`, `konular` koleksiyonlarıdır.
- Okul, sınıf, öğrenci, kullanıcı profili, ortak kitap kütüphanesi, öğretmen-öğrenci bağlantısı ve Firebase Auth hesabı silinmez.
- Eski dönemler görüntülenebilir/arşiv olarak kalır; düzenlenmez.
- `utils/donem.js` mevcut çalışma mantığı korunur.
- Spark'ta zamanlayıcı yoktur; Temmuz ayında uygulama sahibi paneli açıp önizleme ve açık onayla temizliği başlatır. Yıllık kilit ikinci çalıştırmayı engeller. Bu dalda hiçbir veri silinmemiştir.

## Canlıya alma güvenliği

- Firestore kuralları kaynak kodda Spark kayıt/eşleştirme ve bildirim işlemlerine göre yeniden yazıldı.
- Canlı Firestore kuralları henüz dağıtılmadı. Canlı projedeki mevcut geniş kurallar, yeni sıkı kuralların yerine geçmiyor.
- Öğrenci hesap akışı `ACCOUNT_LINKING_ENABLED` bayrağı kapalı tutulduğu sürece uygulama içinde kullanıma açılmaz.
- Bayrak yalnızca Emulator testleri başarılı olduktan ve yeni kurallar canlıya dağıtıldıktan sonra açılmalıdır.
- Bu dalda canlı veri silme, canlı dönem temizliği veya Firestore veri taşıması yapılmadı.

## Sıradaki teknik doğrulama sırası

1. Firestore Emulator testleri: öğretmen profil kaydı, doğrulanmış öğrenci kod talebi, tek kullanımlılık, öğretmen onayı, izinler, bildirimler, başka öğretmene erişim engeli.
2. Functions politika testleri ve Android JS bundle/export.
3. Çalışan özelliklere dokunmadan sınıf raporu eksikliği ve diğer kullanıcı tarafından henüz test edilmemiş ekranların APK öncesi kod kontrolü.
4. Güvenlik kurallarını canlıya alma ve öğrenci özelliğini açma.
5. EAS preview APK.
6. Kullanıcı APK'yı tablette test eder; öğretmen telefonu ve mevcut imza kimliği korunur.

## Açık teknik sınırlar

- Push bildirimi Spark'ta sunucu tarafı güvenli biçimde gönderilemez; uygulama içi bildirim kullanılacaktır.
- Arka plan zamanlayıcısı yoktur; dönem temizliği uygulama sahibi tarafından Temmuz'da başlatılır.
- Gerçek öğrenci verisiyle test yapılmaz; APK sonrası kullanıcı kendi test hesabıyla tablette test eder.
