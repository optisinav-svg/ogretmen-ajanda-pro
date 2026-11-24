# Bölüm 11 — Entegrasyon ve kod bütünlüğü incelemesi

Tarih: 24.11.2026  
Çalışma dalı: `work/section11-integration-2026-11-24`

## Çalışma tabanı ve güvenli dal

- Kaynak depo: `optisinav-svg/ogretmen-ajanda-pro`
- Taban dal: `work/section10-notifications-linking`
- Taban commit: `a5c9b2785c1e2d1ab91b762276923eb4414be472`
- Bölüm 11 çalışma dalı: `work/section11-integration-2026-11-24`
- Ana dal ve canlı Firebase üzerinde değişiklik yapılmadı.

Eski `work/section11-tablet-apk` dalı güncel Bölüm 10 dalının 21 commit gerisindeydi. Eski dal birleştirilmedi. Oradaki güvenli navigasyon düzeltmesi güncel Bölüm 10 tabanına yeniden uygulandı. EAS APK workflow'u Bölüm 12'ye ertelendi. Eski PR #29'a bu durum hakkında açıklama eklendi.

## Navigasyon ve statik bütünlük düzeltmeleri

- `App.js` içinde `Kayit`, `KVKKBilgilendirme`, `OgrenciKayit` ve `OgrenciAnaSayfa` Stack.Screen tanımları arasında gerçek satır sonları yerine literal `\n` metinleri bulunuyordu. Dört tanım ayrı JSX satırlarına ayrıldı.
- Ekran isimleri, sırası, component bağlantıları ve options değerleri değiştirilmedi.
- `App.js` içindeki 21 ekran importu depo ağacında karşılaştırıldı; eksik import bulunmadı.
- 21 navigasyon rota adı karşılaştırıldı; yinelenen rota adı bulunmadı.
- `tests/appNavigation.test.js` regresyon koruması eklendi. Test çalıştırılmadı.
- Takvim ekranı ve dosyası değiştirilmedi; kullanıcının çalıştığını doğruladığı takvim davranışları korunuyor.

## Spark callable incelemesi ve kaynakta yapılan düzeltmeler

Başlangıç taramasında dokuz ekranda Cloud Functions callable çağrıları bulundu. Her akış için güvenlik ve veri bütünlüğü incelemesi yapıldı.

Spark istemci + Firestore Rules olarak kaynakta uygulananlar:
- SHA-256 hash belge kimliğini koruyan `services/sparkEmailAliases.js`; Rules kullanıcının yalnızca kendi doğrulanmış Auth e-posta hash'ini okuyabilir/oluşturabilir/güncelleyebilir. Listeleme ve silme kapalıdır.
- Öğretmen profili e-posta doğrulanmadan oluşturulmaz; doğrulama sonrası alias rezervasyonu tamamlanır. Öğrenci hesabı da doğrulama sonrası alias servisini kullanır.
- Giris, öğretmen kayıt ve öğrenci kayıt ekranlarından alias callable ve ön kontrol callable çağrıları kaldırıldı.
- Profil ad/soyad kaydı, kendi UID profiline doğrudan alan sınırlı yazıma taşındı.
- Doğrulanmış Auth e-postasının kendi Firestore profiline senkronizasyonu, token e-postası eşitliğini şart koşan Rules ile istemciye taşındı.
- Hesap kapatma/yeniden etkinleştirme, kendi profil belgesi ve aynı batch içindeki audit kaydıyla istemciye taşındı. Rules uygulama sahibi istisnasını, üç yıllık saklama aralığını ve imha kilidi kontrollerini uygular.

Güvenli Spark karşılığı henüz tamamlanmadığı için açık uyarıyla geçici olarak devre dışı bırakılanlar:
- Profil e-posta değişikliği.
- Rol düzeltme talebi/kararı; uygulama sahibi ekranında bekleyen talepler salt okunur.
- Öğrenci sınıf/kayıtsız sınıf taşıma ve kalıcı silme.
- Okul kaldırma (sınıf ve kayıtsız öğrenci verileri dahil).
- Akademik dönem aktarımı.
- Kapalı hesap listeleme ve Firebase Auth hesabını imha etme.
- Çok koleksiyonlu yıllık dönem temizliği.

Bu kapatmalar kullanıcıya açıklanır; ilgili ekranlarda callable çağrısı veya gizli veri silme işlemi yapılmaz. İşlevlerin güvenli Spark uygulaması daha sonra ilgili iş paketinde tamamlanmalıdır.

## Son callable taraması

Depo ağacındaki 38 uygulama JavaScript/JSX/TS/TSX dosyası tarandı. Uygulama kaynaklarında `httpsCallable(` çağrısı kalmadı. Functions kaynak modülleri ve eski export'lar geriye dönük kaynak uyumluluğu için depoda duruyor; uygulama ekranları bunlara bağlı değil.

Ayrıntılı akış ve risk kaydı: `docs/SPARK_CALLABLE_AUDIT_2026-11-24.md`.

## Bölüm 11 tamamlanmadan önce kalan kod işleri

1. Dönem temizliği tarih uyumsuzluğu kaynakta düzeltildi: Temmuz 2028'de 2026, Temmuz 2029'da 2027 ve sonraki yıllarda Temmuz ayında yıl-2 hedefleniyor. Yeni Rules/helper beklentileri için Emulator testi Bölüm 12'de bekliyor.
2. Öğrenci taşıma ve okul kaldırma akışları için atomik/tekrar başlatılabilir Spark çözümünü tasarla; güvenli çözüm gelene kadar kapalı kalacak.
3. Rol düzeltme ve dönem aktarımı için güvenli yetki/veri sahipliği çözümünü belirle; güvenli çözüm yoksa kapalı tut.
4. Dönem temizliği ve kapalı hesap imhası için güvenli yetkili süreç belirle; Firebase Admin Auth gerektiren işlem istemciye taşınmayacak.
5. Önceki bölümlerden devreden diğer açık maddeleri ana çalışma listesiyle eşleştir; çalışan takvimi ve doğrulanmış ekranları yeniden yazma.

## Bölüm 12'ye devredilen doğrulamalar

- Yeni kaynak değişiklikleri için statik sözdizimi, Firestore Emulator, birim/regresyon ve indeks testleri.
- Android bundle/export ve EAS preview APK.
- Tablet kurulumu ve Android crash log incelemesi.
- Kullanıcının gerçek sınıfında, belirlenmiş güvenli sınırlar içinde öğretmen/öğrenci uçtan uca testi.
- Canlı Firestore Rules dağıtımı için ayrı açık onay ve geri dönüş planı.
- Telefon sürümüne güncelleme ancak tablet doğrulamasından sonra.

## Güvenlik durumu

- Bu dalda Firestore Rules kaynak dosyası değişti; canlı projeye dağıtılmadı.
- Canlı Firestore verisi, Auth hesapları, alias kayıtları veya kullanıcı profilleri değiştirilmedi.
- Hiçbir veri silme/taşıma/migrasyon çalıştırılmadı.
- Test, bundle, APK veya cihaz doğrulaması yapılmadı.

## Sonuç ve durum

Navigasyon düzeltmesi ve callable kaynak bağımlılığı temizliği yapıldı. Spark'ta güvenli karşılığı tamamlanmayan riskli özellikler kullanıcıya açık biçimde devre dışı bırakıldı. Ancak dönem saklama tarih uyumsuzluğu ve diğer bölümlerden devreden entegrasyon işleri sürüyor.

Bu nedenle **Bölüm 11 henüz tamamlandı olarak işaretlenmiyor**. Ana çalışma listesi esas alınarak kalan kod işleri tamamlanacak; test ve APK aşaması Bölüm 12'de kalacak.
