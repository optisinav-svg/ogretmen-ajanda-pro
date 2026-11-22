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

Firebase Spark'ta Cloud Functions dağıtımı ve dolayısıyla şu mevcut sunucu işlevleri çalıştırılamaz:
- Auth kullanıcı oluşturma tetikleyicisi / profil oluşturma callable'ı
- Öğretmen-öğrenci eşleştirme callable'ları
- Ödev tamamlama callable bildirimi
- Push token callable'ları
- Firestore tetikleyicileriyle yeni ödev bildirimleri
- Uygulama sahibi istatistik callable'ı
- Zamanlanmış dönem temizliği

Kaynak depodaki Functions kodunun bulunması, canlı Firebase'de çalıştığı anlamına gelmez. Bu projede daha önce canlı Functions envanteri boş bulunmuştur.

## Spark içinde önerilen uygulama karşılıkları

| Mevcut özellik | Spark içinde yapılabilecek karşılık | Sınır / kontrol |
|---|---|---|
| Öğretmen profili oluşturma | Kayıt ekranından Firestore profili oluşturma | İstemci uygulama sahibi rolünü atayamaz; rol yükseltme engellenmeli |
| Öğrenci profili | Öğrenci kayıt/eşleştirme akışında kontrollü Firestore yazımı | Sadece izin verilen rol alanları; e-posta doğrulama ve kayıt eşleşmesi kontrolü |
| Eşleştirme kodu | Kriptografik rastgele kod + hash belge kimliği; istemci transaction | Kurallar kodun okunmasını/yakılmasını, süreyi, tek kullanımı ve sahipliği doğrulamalı; enumeration/rate-limit riski ayrıca değerlendirilir |
| Talep gönderme | Öğrencinin Firestore'a talep yazması | Öğrenci kimliği, kayıt e-postası, sınıf, dönem ve kod ilişkisi kurallarda doğrulanmalı |
| Onay/reddetme/izin/iptal | Öğretmenin sahip olduğu kayıt ve bağlantı belgelerinde sınırlı yazım | İzin anahtarları allowlist; bağlantı başka öğretmene taşınamaz |
| Ödev tamamlandı bildirimi | Öğrenci tarafından ayrı bildirim belgesi yazılması | Kurallar yalnızca kendi etkin bağlantısı ve hedef ödev için yazmaya izin vermeli |
| Yeni ödev uygulama içi bildirimi | Ödev oluşturma/düzenleme akışında aynı batch/transaction içinde bildirim belgeleri üretme | Tüm ödev yazma yolları güncellenmeli; mükerrer bildirim ve iptal senaryoları test edilmeli |
| Telefon push bildirimi | Güvenli otomatik gönderim Spark'ta mevcut kodla yapılamaz | FCM/Expo gönderici kimliği istemciye konulamaz. Bu özellik mevcut haliyle devre dışı kalmalı; uygulama içi bildirim kullanılabilir |
| Uygulama sahibi istatistikleri | Custom claim kontrolü ve yalnızca özet alanlara izin veren Firestore sorguları | Kurallar global okumayı sadece uygulama sahibi claim'ine açmalı; öğrenci kişisel kayıtları gösterilmemeli |
| Dönem temizliği | Temmuz ayında uygulama sahibi ekranından önizleme + açık onay + küçük partiler | Arka plan zamanlayıcısı yok; Temmuz dışında işlem kapalı; yalnızca açık dönem alanı ve allowlist |

## Kritik teknik gerçekler

1. Firestore istemci SDK'sı güvenlik kurallarına tabidir. Bu yüzden tüm yazma yollarının kurallarla uyumlu olması gerekir.
2. Admin SDK / Cloud Functions olmadan istemciden güvenilir sunucu rolü veya gizli anahtar üretilemez.
3. Öğrenciye push mesajı göndermek için Expo/FCM sunucu kimlik bilgilerini APK içine koymak güvenli değildir. Böyle yapılmayacak.
4. Firestore rules tek başına genel amaçlı zamanlayıcı değildir. Spark'ta dönem temizliği uygulama içinde başlatılmalıdır.
5. Güvenlik kuralları canlı projeye dağıtılmadan önce Emulator testleri, mevcut iki öğretmen profili ve eski kayıt uyumluluğu doğrulanmalıdır.

## Uygulama sırası

1. Kaynak kodda tüm Functions çağrılarını ve tetikleyicilerini envanterle.
2. Her çağrıyı yukarıdaki Spark karşılığına göre dönüştür.
3. Firestore rules'u aynı anda yeniden tasarla; istemciye güvenip sadece ekranı gizleme.
4. Emulator testleri: normal kullanıcı, öğrenci, başka öğretmen, yetkisiz rol, eski dönem ve dönem sınırı.
5. Öğretmen temel akışlarında regresyon testi.
6. Expo export/bundle ve CI.
7. EAS preview APK.
8. Tablet testleri kullanıcı tarafından yapılır.
9. Push bildirimi, arka plan temizliği ve server-only işler için mevcut Spark kapsamındaki sınır açıkça korunur.

## İstek-kod denetim standardı

Her yeni otomasyon veya veri işlemi için aşağıdakiler zorunludur:
- Kullanıcının açık talep maddesi ve kapsamı
- Etkilenen dosyalar, koleksiyonlar ve alanlar
- Otomatik tetikleyici / zamanlama bilgisi
- Okuma-yazma-silme etkisi
- Yetki modeli
- Test kanıtı
- Canlı dağıtım durumu

Kullanıcı talebinde bulunmayan zamanlanmış görev, toplu silme, harici servis veya rol yükseltme eklenmez.
