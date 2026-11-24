# Bölüm 11 — Entegrasyon ve kod bütünlüğü incelemesi

Tarih: 24.11.2026

## Çalışma tabanı ve güvenli dal

- Kaynak depo: \`optisinav-svg/ogretmen-ajanda-pro\`
- Taban dal: \`work/section10-notifications-linking\`
- Taban commit: \`a5c9b2785c1e2d1ab91b762276923eb4414be472\`
- Bölüm 11 çalışma dalı: \`work/section11-integration-2026-11-24\`
- Ana dal ve canlı Firebase üzerinde değişiklik yapılmadı.

Eski \`work/section11-tablet-apk\` dalı güncel Bölüm 10 dalının 21 commit gerisindeydi. Eski dal birleştirilmedi. Oradaki güvenli navigasyon düzeltmesi güncel Bölüm 10 tabanına yeniden uygulandı. Eski dalda bulunan EAS APK workflow'u Bölüm 12'ye ertelendi. Eski PR #29'a bu durum hakkında açıklama eklendi.

## Tamamlanan statik düzeltmeler

- \`App.js\` içinde \`Kayit\`, \`KVKKBilgilendirme\`, \`OgrenciKayit\` ve \`OgrenciAnaSayfa\` Stack.Screen tanımları arasında gerçek satır sonları yerine literal \`\\n\` metinleri bulunuyordu. Dört tanım ayrı JSX satırlarına ayrıldı.
- Ekranların isimleri, sırası, component bağlantıları ve options değerleri değiştirilmedi.
- \`App.js\` içindeki 21 ekran importu depo ağacında karşılaştırıldı; eksik import bulunmadı.
- 21 navigasyon rota adı karşılaştırıldı; yinelenen rota adı bulunmadı.
- \`tests/appNavigation.test.js\` regresyon koruması eklendi. Bu dosya literal kaçışlı satır sonunu, ekran dosyalarının varlığını ve rota adı benzersizliğini denetleyecek.
- Bölüm 10 dokümanındaki gerçek öğrenci/tablet testi yönlendirmesi Bölüm 12 olarak düzeltildi.

Bu bölümde test komutları çalıştırılmadı. Kaynak taraması ve statik karşılaştırma yapıldı.

## Kritik entegrasyon engeli — Spark ve Cloud Functions

Kaynak kod taramasında Spark uyumluluk planıyla çelişen callable bağımlılıkları bulundu. \`firebaseConfig.js\` içinde Functions istemcisi tanımlı ve aşağıdaki ekranlar \`httpsCallable\` çağırıyor:

- \`GirisEkrani.js\`: e-posta alias rezervasyonu, kapalı hesabı yeniden etkinleştirme, e-posta değişikliğini profile yansıtma.
- \`KayitEkrani.js\`: e-posta kaydı kontrolü ve alias rezervasyonu.
- \`OgrenciKayitEkrani.js\`: öğrenci e-posta kontrolü ve alias rezervasyonu.
- \`ProfilEkrani.js\`: ad-soyad güncelleme, e-posta alias kontrolü/değişikliği, rol düzeltme talebi, hesap kapatma.
- \`RolDuzeltmeTalepleriEkrani.js\`: rol düzeltme talebini karara bağlama.
- \`OgrenciEkrani.js\` ve \`OkulSinifEkrani.js\`: öğrenci taşıma ve kalıcı silme.
- \`DonemAktarimEkrani.js\`: dönem aktarımı.
- \`IstatistikPaneliEkrani.js\`: kapalı hesap listeleme/imha ve dönem temizliği önizleme/onay işlemleri.

Bu işlevlerin kaynak kodda \`functions/index.js\` tarafından dışa aktarılması, Firebase Spark projesinde canlı olarak çalıştıkları anlamına gelmez. Spark planında Cloud Functions dağıtımı yapılamaz. Bu nedenle ilgili kullanıcı akışlarının Spark üzerinde çalıştığı henüz doğrulanmış değildir.

Bu işlemlerden bazıları hesap sahipliği, e-posta geçmişi, rol yetkisi, öğrenci verisi taşıma/silme ve dönemsel veri imhası içerir. Sadece hatayı gizlemek veya çağrıları kaldırmak güvenli değildir; istemciye taşınmaları da Firestore kurallarıyla yeniden tasarlanıp doğrulanmalıdır. Bu nedenle Bölüm 11 sırasında bu çağrılar gelişigüzel değiştirilmedi ve canlı sistemde hiçbir işlem yapılmadı.

## Bölüm 12 öncesi zorunlu kod işleri

1. Yukarıdaki callable işlemlerinin her biri için Spark üzerinde güvenli istemci/Firestore karşılığı olup olmadığını ayrı ayrı belirle.
2. Sunucu yetkisi gerektiren veya Firestore Rules ile güvenli biçimde yapılamayan işlemleri uygulama arayüzünde etkin göstermeme; güvenli bir çözüm olmadan çalıştırmama.
3. E-posta alias geçmişi ve hesap kurtarma politikasını koruyacak bir Spark uyumlu model belirle. Tarihsel e-posta adreslerinin tekrar hesap açmak için kullanılmasına izin verme.
4. Öğrenci taşıma/silme, dönem aktarımı ve dönem temizliği işlemlerinde kısmi yazma/veri kaybı riskini ortadan kaldır.
5. Bu kod işleri tamamlanmadan Bölüm 12'de gerçek kullanıcı testi veya APK dağıtımı başlatma.

## Bölüm 12'ye devredilen doğrulamalar

- Güncel dalda Firestore Emulator ve Functions politika CI çalıştırmaları.
- Android bundle ve EAS preview APK üretimi.
- Tablet kurulumu ve Android crash log incelemesi.
- Gerçek öğretmen/öğrenci hesabıyla uçtan uca kullanım.
- Canlı Firestore rules dağıtımı için ayrı açık onay ve geri dönüş planı.
- Telefon sürümüne güncelleme ancak tablet doğrulamasından sonra.

## Sonuç ve durum

Navigasyon kusuru düzeltildi; statik import/rota incelemesi ve regresyon koruması hazırlandı. Ancak Spark ile uyumsuz Cloud Functions çağrıları kritik entegrasyon engeli olarak kaldı.

Bu nedenle Bölüm 11'in inceleme ve güvenli düzeltme kısmı tamamlandı, fakat **Bölüm 11 bütünüyle tamamlandı olarak işaretlenemez**. Önce callable bağımlılıklarının güvenli Spark uyumlu karşılıkları hazırlanmalı veya riskli işlemler güvenli biçimde kapatılmalıdır. Test aşaması yine Bölüm 12'ye ertelenmiştir.
