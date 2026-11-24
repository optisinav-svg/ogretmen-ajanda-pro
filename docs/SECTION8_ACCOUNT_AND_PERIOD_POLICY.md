# Bölüm 8 — Hesap, Profil, Dönem ve Kişisel Veri Yaşam Döngüsü

## Amaç ve güvenlik sınırları
Bu bölüm; öğretmen/öğrenci hesaplarının ayrımını, hesap sahipliğini, profil güncellemelerini, eski hesabın yeniden etkinleştirilmesini, rol düzeltme taleplerini ve akademik dönem geçişini kapsar. Hesap kimliği Firebase UID'dir; ad-soyad benzersiz değildir. Aynı görünen ada sahip çok sayıda kullanıcı bulunabilir.

## Kararlaştırılan kullanıcı akışları
- Tek kayıt giriş ekranı öğretmen ve öğrenci hesabı seçimi sunar. Öğrenci hesabı e-posta doğrulaması ve mevcut öğretmen eşleştirme onayı olmadan öğretmen verilerine erişemez.
- Aynı e-posta adresiyle ikinci bir Firebase Auth hesabı oluşturulamaz. E-posta değişiminden önce mevcut adres hesap UID'sine bağlı, SHA-256 ile anahtarlanmış bir alias kaydıyla rezerve edilir. Kayıt öncesi ve giriş sırasında uygulama callable kontrolleri alias'ın başka UID tarafından kullanılmasını engeller. Identity Platform blocking trigger'ları ek, atlatılamaz Auth katmanı korumasıdır; mevcut Spark ortamında varsayılan olarak kapalıdır ve yalnızca plan/ürün yükseltmesi ayrıca onaylanırsa etkinleştirilebilir. Kapalı hesap Auth kimliği hemen silinmeden tutulur; hesap sahibi üç yıllık saklama penceresi içinde doğrulanmış oturumla yeniden etkinleştirebilir. Kapatma anında alias kayıtlarına üç yıllık sona erme tarihi yazılır; yeniden etkinleştirme bu tarihi kaldırır. Üç yıl sonunda alias otomatik olarak serbest bırakılmaz; yalnızca uygulama sahibi önizlemesi, hukuki saklama kontrolü ve açık imha kararı sonrasında silinmesi değerlendirilebilir. Alias özeti de kişisel veri kabul edilerek KVKK incelemesine tabidir.
- Ad ve soyad düzenlenebilir; mevcut birleşik kullaniciAdi alanı geriye dönük uyumluluk için korunur. İsimler benzersiz değildir.
- Şifre değiştirme ve şifre sıfırlama akışları korunur.
- Hesap türü kullanıcı tarafından değiştirilemez. Rol düzeltme talebi mevcut hesap sahibi tarafından oluşturulur; yalnızca özel uygulama sahibi yetkisi olan hesap inceler. Onay, veri sahipliği/bağlantı incelemesi tamamlanmadan rolü değiştirmez.
- E-posta değişikliğinde mevcut hesap sahibi yeniden kimlik doğrular ve yeni adresi doğrular. Yeni adres başka bir Auth hesabında kullanılıyorsa işlem reddedilir. UID ve bağlantılar değişmez.
- Öğretmen/öğrenci hesabı kapatıldığında erişim kuralları kapatılır; öğretmen-öğrenci geçmişi fiziksel olarak hemen silinmez. Aynı hesap yeniden etkinleştirilebilir.
- Kapatma, diğer öğretmenlerin bağlantılarını veya öğrencilerin diğer öğretmenlerle ilişkilerini silmez.

## Yetkili karar matrisi
| İşlem | Kimlik doğrulayan | Kararı veren |
|---|---|---|
| E-posta değişikliği | Hesabın sahibi; mevcut kimlik bilgisi ve yeni e-posta doğrulaması | Otomatik güvenlik kontrolleri; rutin işlemde uygulama sahibi onayı yok |
| Rol düzeltme | Talep sahibi | Uygulama sahibi; kendisiyle ilgili talepte bağımsız yetkili süreç gerekir |
| Hesabı yeniden etkinleştirme | Hesap sahibi, doğrulanmış e-posta | Sunucu tarafı hesap durumu ve saklama politikası kontrolleri |
| Süre sonu imha | Uygulama sahibi açık onayı | Sunucu tarafı önizleme, kilit, kapsam ve denetim kaydı |

## Akademik dönem aktarımı — zorunlu kurallar
1. Aktarılan her okul, sınıf, öğrenci ataması ve öğrenciye özel kitap/konu ilerleme kaydı hedef dönemin donemYili alanıyla yeni kaydı olarak oluşturulur.
2. Eski dönem kayıtları değiştirilmez ve silinmez.
3. Öğrenci Firebase UID'si değişmez; öğretmen yerel öğrenci kaydı yeni dönemde yeni kayıt kimliği alır. Aktif öğrenci hesabı bağlantısı ve paylaşım izinleri yeni dönem/sınıf kimliğine taşınır; eski bağlantı ve geçmiş kayıtlar korunur.
4. Kitap kütüphanesinin sezon bağımsız tanımları çoğaltılmaz; yeni dönem atamaları mevcut kütüphane kimliklerini kullanır.
5. Eski ödev, yoklama, ders notu, bireysel etkinlik ve ilerleme kayıtları yeni döneme kopyalanmaz.
6. Öğretmen okul, sınıf, öğrenci ve her öğrenci için kitap atamalarını tek tek seçer. Sınıf seviyesi öğretmen tarafından hedeflenir; 12. sınıf, TYT ve AYT kaynak grupları hedefte TYT olur.
7. Aktarım onay ekranı hedef dönemi, seçilen sınıf ve öğrenci sayılarını ve kopyalanmayacak geçmiş verileri açıklar. İşlem kimliği ve deterministik kaynak-hedef eşlemesi tekrar çalıştırmada mükerrer kayıt oluşmasını engeller.
8. Aktarım yarıda kalırsa aynı işlem kimliğiyle güvenli devam eder; yeni dönem kaydı oluşturulmadan önce kaynak ve hedef ilişkileri doğrulanır.

## Hesap kapatma ve saklama
Hesap kapatma, anında fiziksel silme değildir. Kapalı hesap normal öğretmen/öğrenci yetkilerini kullanamaz; hesap sahibi doğrulamayla yeniden etkinleştirme isteyebilir. Saklama süreleri veri kategorisine göre gerekçelendirilir. Üç yıl bütün veriler için otomatik bir saklama hakkı değildir. İlgili işleme amacı veya hukuki sebep daha önce sona ererse veriler daha önce silinir/yok edilir/anonimleştirilir. Yasal saklama yükümlülüğü olan kayıtlar ayrı tutulur.

## KVKK saklama ve imha politikası — görüşmeye sunulan taslak
Bu metin nihai hukuki görüş veya yayıma hazır aydınlatma metni değildir; veri sorumlusu, işleme amaçları, hukuki sebepler, saklama süreleri ve veri işleyenler somutlaştırılarak hukuk danışmanı tarafından doğrulanmalıdır.

| Veri kategorisi | İşleme/saklama gerekçesi | Önerilen süre başlangıcı ve ölçüt | İmha yaklaşımı |
|---|---|---|---|
| Auth hesap kimliği, e-posta, rol | Hesap güvenliği, giriş, hizmetin sunulması | Hesap aktif olduğu sürece; kapatma sonrası yeniden etkinleştirme penceresi ve hukuki yükümlülükle sınırlı | Auth hesabı ve e-posta, saklama gerekçesi sona erince silinir; tekrar kayıt engeli için süresiz e-posta/hash listesi tutulmaz |
| Öğretmen profili ve uygulama ayarları | Hesap ve hizmet yönetimi | Hesap aktifliği; kapanıştan sonra yalnızca gerekçeli süre | Silme veya anonimleştirme |
| Öğrenci öğretmen-yerel kayıtları | Eğitim takibi, öğretmen-öğrenci ilişkisinin yürütülmesi | İlgili eğitim dönemi ve hizmet amacı; kapatma/ayrılma sonrası gerekçeli arşiv süresi | Öğrenci hesabı ve diğer öğretmen kayıtlarından ayrıştırılarak silme/anonimleştirme |
| Yoklama, ödev, ders, ilerleme, rapor | Eğitim sürecinin yürütülmesi ve geçmiş raporların sunulması | Dönem sonu ve hukuki/operasyonel gereklilik | Kategori bazında süre sonunda imha |
| Öğrenci-öğretmen bağlantıları ve onay kayıtları | Yetki, paylaşım ve hesap güvenliği | Bağlantı sona erene ve itiraz/denetim ihtiyacı bitene kadar | Gereksiz kişisel alanlar silinir; gerekli asgari denetim kanıtı ayrıştırılır |
| Rol düzeltme talepleri | Yetki değişikliği denetimi ve kötüye kullanımın önlenmesi | Talep sonuçlandıktan sonra belirlenmiş denetim süresi | Gerekçe ve kanıt gereksiz kişisel ayrıntılardan arındırılarak saklanır |
| Güvenlik/işlem denetim kayıtları | Olay inceleme, yetkisiz erişimi önleme | Risk ve hukuki yükümlülükle orantılı, tanımlı süre | Süre bitince silme/anonimleştirme |
| Yedekler | Felaket kurtarma ve hizmet sürekliliği | Yedekleme takviminde belirlenmiş kısa döngü; canlı kayıttaki silme işaretleri yedek geri dönüşünde uygulanır | Yedek rotasyonu ve geri yükleme sonrası silme kuyruğu yeniden uygulanır |
| İmha işlem kayıtları | Silme/yok etme/anonimleştirme işlemlerinin kanıtlanması | İlgili mevzuatın öngördüğü asgari süre; Yönetmelik kapsamındaki imha kayıtları en az 3 yıl | Süre sonunda güvenli imha |

### Periyodik kontrol
Veri kategorileri ve saklama gerekçeleri en az yılda bir gözden geçirilir. İlgili mevzuat kapsamındaki periyodik imha yükümlülükleri ayrıca takip edilir; uygulanabilir olduğu durumlarda periyodik imha aralığı altı ayı aşmaz. Her imha öncesi kapsam ve adet önizlemesi, yetkili onayı, işlem kilidi, sonuç ve hata denetimi tutulur.

### Tamamlanması gereken hukuki bilgiler
- Veri sorumlusu gerçek/tüzel kişi ve iletişim bilgileri.
- Uygulamanın somut işleme amaçları ve her amaç için KVKK m.5/m.6 hukuki sebebi.
- Çocuk/öğrenci verilerinde veli/kanuni temsilci süreçlerinin gerekip gerekmediği.
- Firebase/Google ve diğer hizmet sağlayıcılarının veri işleyen/aktarımı rolleri ve yurt dışı aktarım mekanizması.
- Her kategori için kesin süre ve başlangıç olayı.
- İlgili kişi başvuru kanalı, başvuru prosedürü ve veri ihlali süreci.

## Teknik sınırlamalar / canlıya alma ön koşulları
- Bu dalda yapılan değişiklikler üretim Firebase'e dağıtılmaz.
- `functions/emailAliases.js` içindeki `beforeUserCreated` ve `beforeUserSignedIn` korumaları Firebase Authentication with Identity Platform yükseltmesi ve Authentication > Blocking functions tetikleyicilerinin etkinleştirilmesini gerektirir. Bu işlem yapılmadan eski e-posta alias koruması üretimde kesin güvence sayılmaz. Identity Platform, Spark üzerinde günlük aktif kullanıcı sınırları ve ayrı fiyatlandırma kuralları getirir; yükseltme öncesinde kullanım ve maliyet etkisi kontrol edilmelidir.
- E-posta alias kayıtları yalnızca SHA-256 e-posta özeti ve hesap UID'si tutar; hash de kişisel veriyle ilişkilendirilebilir olduğundan saklama ve imha politikası kapsamındadır.
- Cloud Functions dağıtımı, e-posta doğrulama şablonları, Firebase Auth ayarları ve indeksler ayrıca doğrulanmalıdır.
- Eski hesapların UID/e-posta eşlemesi salt okunur envanterle kontrol edilmeden toplu migrasyon yapılmaz.
- Dönem aktarımı, kaynak koleksiyon şemaları ve bütün ilişki alanları doğrulanmadan üretim kullanımına açılmaz.


## Akademik dönem aktarımı — uygulama kapsamı

- Öğretmen kaynak dönemdeki okul/sınıf kayıtlarını görür; aktarılacak sınıfları, öğrencileri, hedef kademeyi ve her öğrenci için aktarılacak kitap atamalarını tek tek seçer.
- Ortak `kitapKutuphanesi` ve `kitapKutuphanesiKonulari` koleksiyonları zaten dönemden bağımsızdır; kopyalanmaz. Seçilen öğrenci kitap atamaları ve konu sayfa aralıkları yeni dönem kayıtları olarak kopyalanır.
- Eski dönem yoklama, ders, ödev ve tamamlanma geçmişi yeni döneme taşınmaz. Yeni dönem konu/ödev ilerlemesi sıfırdan başlar. Eski kayıtlar değişmeden kalır.
- Öğrenci hesap bağlantısı ve paylaşım izinleri varsa, yeni öğrenci kaydına ayrı bir dönem bağlantısı oluşturulur; eski bağlantı geçmişi korunur.
- 12. sınıf, TYT ve AYT kaynak sınıfları hedefte TYT olarak açılır. Diğer kademeler öğretmen tarafından seçilir.
- Aktarım kimlikleri kaynak kayıt + hedef dönem üzerinden deterministiktir. Aynı aktarım tekrar çalıştırılırsa aynı belge kimlikleri kullanılır; farklı bir kayıtla çakışma tespit edilirse işlem güvenli biçimde durur.
- İlk sürüm bir çağrıda en fazla 500 öğrenci ve 100 sınıfı kabul eder. Daha büyük aktarım gruplara bölünerek yapılmalıdır.
- Aktarım Admin SDK callable üzerinden çalışır; istemci doğrudan geçmiş dönemi değiştirmez. Canlıya alınmadan önce Firestore Emulator entegrasyon testi ve örnek veri üzerinde dry-run/önizleme gerekir.


## E-posta alias uygulama sınırları ve geçiş

- Öğretmen ve öğrenci kayıt ekranları Auth hesabı oluşturulmadan önce rezerve edilmiş adresi kontrol eder. Doğrulanmış girişte mevcut adres UID'ye bağlanır; e-posta değişiminde eski adres önce rezerve edilir ve yeni adresin alias kaydı kontrol edilir.
- `functions/scripts/backfill-email-aliases.js` mevcut Firebase Auth hesaplarının şu anki e-posta adreslerini tarar. Varsayılanı yalnızca dry-run'dır; `--apply` yazma yapar ve yalnızca ayrıca onaylanmış bakım adımında çalıştırılmalıdır. Auth kayıtlarında geçmişte değiştirilmiş eski adresler bulunmadığından bu script onları geriye dönük keşfedemez.
- Mevcut Firebase Spark projesinde Identity Platform blocking trigger'ları etkin değildir. Uygulama içi callable kontrolleri standart kayıt akışını korur; Firebase Auth API'sini uygulama dışından doğrudan kullanan bir istemci bu kontrolleri atlayabilir. Atlatılamaz garanti için Identity Platform gereklidir; Spark sınırları ve maliyet etkisi kullanıcı onayı olmadan değiştirilmez.
- Alias kayıtları otomatik olarak süre sonunda serbest bırakılmaz. Üç yıllık `sonaErme` yalnızca imha incelemesi için işarettir. İmha kararı verilene kadar başka UID'ye devredilmez. Hash kayıtları da kişisel veri/pseudonim veri sayılabileceğinden saklama hukuki dayanak ve süre bakımından ayrıca onaylanmalıdır.


## Açık kalan teknik ve hukuki kararlar — Bölüm 8 tamamlanma engelleri

- Hesap kapatıldığında üç yıllık saklama bitiş tarihi profile yazılır ve alias kayıtlarına inceleme tarihi eklenir. Ancak hesap kapanışına bağlı tüm öğretmen/öğrenci kayıtlarının sayımını, uygulama sahibi önizlemesini, açık imha onayını ve Firebase Auth hesabı silme adımını içeren ayrı imha akışı henüz tamamlanmamıştır. Bu akış kurulmadan hesap kapatma saklama süreci tamamlanmış sayılamaz.
- Firebase Auth hesabı daha önce kalıcı olarak silinmişse aynı UID'nin otomatik kurtarımı garanti edilemez. Mevcut akış yalnızca Auth hesabı hâlâ bulunan ve profili kapalı olarak işaretlenen kullanıcıyı yeniden etkinleştirebilir.
- Öğretmen/öğrenci rol dönüşümü, öğretmen verisi veya öğrenci bağlantısı bulunduğunda güvenlik gereği engellenir. Bu kayıtları kayıpsız taşıyan kontrollü dönüşüm henüz yoktur.
- Identity Platform blocking trigger'ları mevcut Spark ortamında kapalıdır. Uygulama içi alias kontrolleri standart kayıt akışını korusa da doğrudan Firebase Auth API erişimini engellemez. Atlatılamaz güvence için plan/ürün kararı gerekir.
- Alias backfill betiği yalnızca mevcut Auth e-posta adreslerini tarar. Geçmişte değiştirilmiş ve Auth'ta artık bulunmayan e-posta adresleri Firebase Auth listesinden geri çıkarılamaz.
