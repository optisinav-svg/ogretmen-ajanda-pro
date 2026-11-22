# Öğretmen Ajanda Pro — Birleştirilmiş Kontrol ve Sürüm Planı

Bu dosya Grup 1–6, önceki mimari kararlar ve tablet/telefon sürüm sırasını tek yerde toplar. Kodda bulunması, CI'da geçmesi, canlıya dağıtılması ve gerçek cihazda denenmesi ayrı durumlardır. Kanıt olmadan hiçbir madde tamamlandı sayılmaz.

## Değişmez güvenlik ve sürüm kararları

- Mevcut telefon uygulaması, imza anahtarı ve Firebase verileri korunur. İmza eşleşmesi doğrulanmadan telefondaki uygulama güncellenmez veya kaldırılmaz.
- Canlı veriye yönelik silme, toplu taşıma, geri yükleme veya başka yıkıcı işlem öncesinde yedek ve geri dönüş yöntemi doğrulanır; gerçek öğrenci kayıtları izinsiz test verisi olarak kullanılmaz.
- Firestore yedeği, öğrenci/öğretmen kişisel verisi içerdiğinden gizli tutulur; GitHub'a, sohbete veya herkese açık depoya konulmaz.
- Öğrenci hesap bağlantısı `ACCOUNT_LINKING_ENABLED=false` kalır. Yalnızca gerekli Cloud Functions ve Firestore rules canlıya dağıtılıp canlı kontroller başarıyla tamamlandıktan sonra açılır.
- Ortaokul öğrenci hesapları, veli/vasi ve hukuki süreç netleşene kadar kapalı kalır.
- Paylaşım izinleri varsayılan kapalıdır; öğrenci yalnızca öğretmenin açıkça verdiği izin kapsamındaki verileri okuyabilir.
- Google Drive yedeklemesi kullanıcı isteğiyle bu sürüm kapsamından çıkarılmıştır; ertelenmiştir ve tablet APK / ilk kullanım testlerinin engeli değildir. Bu aşamada Drive bağlantısı, OAuth, otomatik yedek ve geri yükleme geliştirmesi yapılmayacaktır.
- KVKK aydınlatma metni ile açık rıza birbirinden ayrılır. Açık rıza yalnızca gerçekten gerekli olduğu işlemler için alınır; bildirim izni ayrı ve isteğe bağlıdır. Veri sorumlusu kimliği/iletişim bilgisi uydurulmaz.
- APK üretmek tek başına özelliği tamamlamaz. Tablet testleri kullanıcı tarafından yapılır; telefon güncellemesi tablet testleri geçtikten ve imza doğrulandıktan sonra hazırlanır.

## Aşama 1 — Grup 1–6 ve önceki kararların kontrol listesi

### Grup 1 — Okul, sınıf ve akademik dönem altyapısı
- [ ] Okul → sınıf → öğrenci ilişkileri ve sahiplik kontrolleri bütün akışlarda doğrulandı.
- [ ] Akademik dönem alanları, dönem geçişi ve eski dönem kayıtlarının korunması doğrulandı.
- [ ] Okul/sınıf/öğrenci ekleme, düzenleme, silme ve ilişkili kayıt davranışları gözden geçirildi.
- [ ] Eski çalışan özelliklerde geriye dönük uyumluluk kontrol edildi.

### Grup 2 — Ders, kitap, ödev, yoklama, takvim ve rapor
- [ ] Ortak kitap kütüphanesi: kitap bir kez tanımlanır, birden fazla öğrenciye atanır; ilerleme öğrenci bazında bağımsızdır.
- [ ] Kitap yapısı yalnızca kitap → konu başlığı → sayfa aralığıdır; ayrı bölüm/ünite alanı eklenmez.
- [ ] Kitap adı ve toplam sayfa zorunluluğu, sayfa aralığı doğrulaması ve çakışma kontrolü korunur.
- [ ] Ders işleme ekranındaki kazanım seçimi ve arama sistemi yeniden yazılmadan korunur.
- [ ] Ödev, yoklama ve rapor ekranlarının ortak kitap kütüphanesi / çoklu öğrenci atama yapısı ile uyumu doğrulandı.
- [ ] Öğrenciye özel Özel Ders, Etüt ve Soru Çözümü takvim etkinlikleri ve PDF raporlarına yansıması doğrulandı.
- [ ] Öğrenci transferinde geçmiş kayıtların taşınması; bireysel ve sınıf etütleri; ödev durumları ve yoklama geçmişi korundu.
- [ ] Silinen öğrenci ve diğer kayıtlar için mevcut Firestore verileri ve yerel yedeklerden güvenli kurtarma prosedürü doğrulandı.
- [ ] Silme işlemlerinde bağlı kayıtlar, yetki ve veri bütünlüğü kontrol edildi.

### Grup 3 — Firestore güvenliği ve backend
- [ ] Öğretmen profili/rol ataması yalnızca güvenilir Cloud Functions üzerinden yapılır.
- [ ] Firestore rules: kullanıcı/veri sahipliği, sınıf-öğrenci-ders-kitap ilişkileri, dönem tutarlılığı ve varsayılan reddetme denetlendi.
- [ ] Öğrenci bağlantısı, kod süresi/tek kullanımlılık, e-posta/ad/sınıf/dönem doğrulaması ve öğretmen onayı denetlendi.
- [ ] Veri saklama/temizleme işlevi güvenli varsayılanla (dry-run) çalışır; silme modu ayrıca yetkilendirilmeden açılmaz.
- [ ] Canlı Firestore yedeği ve geri yükleme tatbikatı; Auth, Storage, rules, indexes ve Functions kapsamındaki ek yedek ihtiyaçları belirlendi.
- [ ] Gerekli Firestore indeksleri gerçek sorgulara göre belirlendi ve canlı yapılandırmayla karşılaştırıldı.
- [ ] Canlı Firestore rules ve Cloud Functions dağıtımı öncesi proje, yedek, test ve geri dönüş planı doğrulandı.

### Grup 4 — Öğrenci uygulaması ve bildirimler
- [ ] Öğrenci kayıt/giriş ve e-posta doğrulaması doğrulandı.
- [ ] Öğretmenin tek kullanımlık eşleştirme kodu üretmesi ve öğrenci talebini onaylaması/reddetmesi doğrulandı.
- [ ] Bir öğrenci hesabının birden fazla öğretmen/sınıf bağlantısı; aynı öğretmen öğrenci kaydının iki hesaba bağlanamaması doğrulandı.
- [ ] Öğretmen izinleri varsayılan kapalıdır; öğrenci yalnızca izinli verileri okur.
- [ ] Öğrenci ödev tamamlama bildirimi öğretmen değerlendirmesinden ayrı tutulur.
- [ ] Uygulama içi yeni ödev bildirimi, okundu durumu ve bildirim iptali doğrulandı.
- [ ] Expo Push / FCM V1 kimlik bilgileri EAS'te doğrulandı ve gerçek Android cihazda teslimat testi yapıldı.
- [ ] Push tokenları istemciden okunamaz/yazılamaz; mesaj yükünde öğrenci PII bulunmaz.
- [ ] Ortaokul hesap akışı kapalıdır.

### Grup 5 — APK ve kurulum hazırlığı
- [ ] Expo yapılandırması, Android paket kimliği, sürüm ve EAS proje kimliği doğrulandı.
- [ ] EAS Android imza kimliği ve mevcut telefondaki kurulu uygulamanın sertifika parmak izi karşılaştırıldı.
- [ ] Tablet için `preview` APK üretimi yapıldı; build kaydı ve APK indirme bağlantısı doğrulandı.
- [ ] Telefonun mevcut kurulumunu etkilemeden tablet kurulumu gerçekleştirildi.
- [ ] İmza eşleşmesi doğrulanmadan telefona güncelleme APK'sı verilmedi.

### Grup 6 — Kullanım testleri ve yayın hazırlığı
- [ ] Tablet test senaryoları ve sonuç kayıtları hazırlandı.
- [ ] Gerçek öğretmen sınıfındaki kullanıcı tarafından sağlanan ikinci e-posta ile gerçek öğrenci hesabı açıldı.
- [ ] Ödev görüntüleme, tamamlama bildirimi, öğretmen tarafı görünümü ve PDF üretimi test edildi.
- [ ] Silme testleri yalnızca önceden yedek/geri dönüşü doğrulanmış, açıkça belirlenmiş öğrenci kaydı üzerinde yapıldı.
- [ ] Hata düzeltmeleri ve regresyon testleri tamamlandı.
- [ ] KVKK taslak metni ve kayıt ekranı kullanıcıya gösterilecek; veri sorumlusu ad-soyad alanı `.......` bırakılacak. Mağaza yayını öncesi gerçek bilgiler girilecek ve hukuki inceleme yapılacak.
- [ ] Tablet testleri geçtikten sonra telefon imza eşleşmesi doğrulandı ve güncelleme APK'sı hazırlandı.
- [ ] Temizlik, geçici dosya/yedek ayıklama ve depo düzeni ancak yayın sonrası ve yedekler doğrulandıktan sonra yapıldı.

## Aşama 2 — Grup 3 ve 4 entegrasyonu / canlı yapılandırma denetimi
- [ ] PR ve dal tabanı/commit farkı doğrulandı.
- [ ] Grup 1–2 entegrasyon dalındaki değişikliklerin Grup 3–4 ile çakışma/geriye dönük etki analizi yapıldı.
- [ ] Firestore rules emulator testleri ve Functions birim/politika testleri çalıştırıldı.
- [ ] Canlı Firebase proje kimliği, mevcut rules, Functions, indexes, Auth sağlayıcıları ve Storage yapılandırması salt okunur biçimde envanterlendi.
- [ ] Canlı ve depo yapılandırması arasındaki farklar raporlandı.
- [ ] Yedek kapsamı, geri yükleme yöntemi ve geri dönüş adımları doğrulandı.
- [ ] Bu denetim bitmeden canlıya dağıtım yapılmadı.

## Aşama 3 — KVKK kayıt akışı ve ertelenen işler
- [x] Google Drive yedeklemesi bu sürümden ertelendi; mevcut iş akışında yapılmayacak.
- [x] KVKK çalışma taslağı ve uygulama içi bilgilendirme ekranı eklendi; veri sorumlusu adı-soyadı `.......` olarak bırakıldı. Nihai metin ve hukuki inceleme mağaza yayını öncesine bırakıldı.
- [ ] Açık rıza, aydınlatma metninden ayrıldı ve yalnızca gerekli işlem için alındı.
- [ ] Bildirim izni ayrı, isteğe bağlı ve geri alınabilir olarak kaydedildi.
- [ ] Metin sürümü, zaman damgası, kapsam ve geri çekme kaydı tutuldu.
- [ ] Veri sorumlusu adı/iletişim bilgisi kullanıcıdan doğrulandı; hukuki uygunluk iddiası verilmeden uzman incelemesi önerildi.
- [ ] Önceki yarım işler ve karar kayıtları bu kontrol listesiyle karşılaştırıldı.

## Aşama 4 — Testler ve sürüm kontrolleri
- [ ] Bağımlılık ve Expo uyumluluk kontrolleri.
- [ ] Android bundle/export ve statik sözdizimi kontrolleri.
- [ ] Firestore Emulator güvenlik testleri.
- [ ] Cloud Functions birim/politika testleri.
- [ ] Gerekli indeks ve sorgu testleri.
- [ ] Öğretmen temel iş akışları için regresyon kontrolü.
- [ ] Öğrenci izin sınırları ve veri ayrımı için güvenlik kontrolü.
- [ ] KVKK bilgilendirme ekranının cihaz üzerinde görüntülenmesi ve nihai metnin hukuki onayı. (Taslak ekran, nihai yasal uygunluk onayı değildir.)
- [ ] Sürüm, paket kimliği, EAS projesi, build profili ve imza kontrolü.

## Aşama 5 — Kontrollü canlı dağıtım
- [ ] Kullanıcıya canlıya geçiş özeti ve geri dönüş planı sunuldu.
- [ ] Yedek alındı ve okunabilirliği/manifesti doğrulandı.
- [ ] Doğru Firebase projesi açıkça doğrulandı.
- [ ] Cloud Functions önce dağıtıldı; kritik callable işlevler canlıda doğrulandı.
- [ ] Firestore rules kontrollü dağıtıldı; öğretmen ve öğrenci erişim sınırları doğrulandı.
- [ ] Gerekli indexes dağıtıldı ve sorgular doğrulandı.
- [ ] Öğrenci bağlantısı ancak tüm backend kontrolleri geçtikten sonra açıldı.
- [ ] Canlı loglar, hata oranları ve güvenlik davranışları kontrol edildi.

## Aşama 6 — Tablet APK
- [ ] EAS kimlik bilgileri ve FCM V1 ayarları doğrulandı.
- [ ] Son sürüm kodundan `preview` APK üretildi.
- [ ] Build başarılı ve APK indirilebilir olarak doğrulandı.
- [ ] APK tablet üzerine kuruldu; mevcut telefon kurulumu değiştirilmedi.

## Aşama 7 — Tablet üzerinde kullanıcı testleri
- [ ] Öğretmen hesabıyla giriş ve temel ekranlar.
- [ ] Öğretmenin gerçek sınıfındaki öğrenci kaydına doğru e-posta eklenmesi.
- [ ] Öğrenci hesabı oluşturma ve e-posta doğrulama.
- [ ] Eşleştirme kodu, öğretmen onayı ve izinler.
- [ ] Öğrenci tarafında yalnızca izinli ders/ödev/kitap verilerinin görünmesi.
- [ ] Yeni ödev bildirimi ve telefon bildirimi.
- [ ] Ödev tamamlama bildiriminin öğretmen ekranına ulaşması.
- [ ] PDF raporunun içerik ve görünüm kontrolü.
- [ ] Silme/geri alma testleri; yalnızca güvenli yedek ve açık onayla.
- [ ] Hatalar giderildikten sonra testlerin tekrarı.

## Aşama 8 — Telefon güncellemesi
- [ ] Mevcut telefondaki kurulu APK'nın imza sertifikası parmak izi alındı.
- [ ] EAS imza sertifikası parmak iziyle birebir eşleşme doğrulandı.
- [ ] Eşleşmiyorsa mevcut uygulamanın üzerine kurulum denenmedi; güvenli geçiş planı çıkarıldı.
- [ ] Tablet testleri başarılı son sürümden telefon güncelleme APK'sı üretildi.
- [ ] Telefon kurulumu ve mevcut yerel/veri erişimi korunduğu doğrulandı.

## Başlangıçta doğrulanmış kanıtlar (22.11.2026)

- Firebase CLI 15.28.2 ile `ogretmen-takip` projesi listelenebildi.
- EAS proje kimliği: `31baafe1-369c-4b64-b066-26b2de6ef837`; `preview` profili APK üretim türünde.
- Grup 4 dalı `feature/group4-student-app`, entegrasyon dalından 73 commit ileride ve geride değil.
- PR #11 ve PR #12 açık/taslak; birleştirme yapılmadı.
- Grup 4 commit'i `676266565d995e6042c7e99c1348f57882b18ba6` için GitHub Actions güvenlik iş akışı başarılı.
- `firebaseConfig.js` içinde `ACCOUNT_LINKING_ENABLED=false`.
- `screens/OgrenciKayitEkrani.js` bu bayrak kapalıyken öğrenci hesap oluşturma akışını açıkça engelliyor.
- KVKK taslak metni `docs/KVKK_AYDINLATMA_TASLAGI.md` ve kayıt ekranlarından erişilen bilgilendirme sayfası eklendi. Bu hukuki nihai onay değildir; veri sorumlusu adı-soyadı `.......` bırakıldı.
- Google Drive yedeklemesi kullanıcı talimatıyla ertelendi; APK hazırlığına engel değil.
- PR #12 (Grup 3 + Grup 4) entegrasyon dalına birleştirildi; PR #11 yinelenen değişiklik olduğu için kapatıldı.
- PR #10 (Grup 3 + 4'ün Grup 1 + 2 tabanına entegrasyonu) 22.11.2026 tarihinde başarıyla birleştirildi; merge commit `97cd404a22de7203fd33ace9d9873971bc1ece5c`.
- Tablet APK hazırlığı için sabit kaynak dalı `release/pre-apk-2026-11-22` oluşturuldu.
- Entegrasyonun son doğrulanmış kodu `ddb76dd44058b68d96f284b8475644ae81f2ee97`; Firestore Emulator, Functions politika/sözdizimi ve Android bundle CI çalışması `45019591649` başarıyla tamamlandı.
- `firebase.json` artık `firestore.indexes.json` dosyasını deploy yapılandırmasına bağlıyor.
- Canlı rules/Functions/indexes dağıtımı, FCM V1 ve gerçek cihaz push testi henüz kanıtlanmış değil.
- EAS/telefon imza sertifikası karşılaştırması henüz yapılmadı.
