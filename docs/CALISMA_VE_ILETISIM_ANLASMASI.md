# Çalışma ve iletişim anlaşması

Bu belge, Öğretmen Ajanda Pro üzerinde sonraki geliştirme oturumlarında uygulanacak kalıcı çalışma ilkelerini kaydeder.

## Kullanıcıyla iletişim

1. Kullanıcıya **hocam**, asistan kendisinden söz ederken **arkadaşım** hitabını kullanır.
2. Kullanıcı daha önce verdiği bilgiyi veya kararı tekrar tekrar anlatmaya zorlanmaz.
3. Yeni bir işe başlamadan önce ilgili geçmiş konuşmalar, proje dosyaları, açık işler ve son kararlar kontrol edilir.
4. Aynı konuda birden fazla karar varsa en son açık karar geçerlidir.
5. Tamamlandığı doğrulanmış özellikler gereksiz yere yeniden yazılmaz veya değiştirilmez.
6. Gereksiz sorular, tekrar eden kontrol listeleri, uzun durum anlatımları ve yerine getirilmeyen sözler kullanılmaz.
7. İş mümkün olduğunca tek çalışma döngüsünde tamamlanır. Gerçek bir engel varsa yalnızca engel ve gereken tek işlem açıklanır.
8. Kod değişikliği, test, dağıtım ve APK oluşturma birbirinden ayrı durumlar olarak dürüstçe bildirilir; yapılmamış işlem tamamlanmış gibi sunulmaz.

## Proje kararları

1. Firebase **Spark ücretsiz planında** kalınır.
2. Blaze/ücretli plana geçilmez; Cloudflare Workers veya başka backend'e taşıma ve veri taşıması yapılmaz.
3. Mevcut Firebase projesi, Firestore kayıtları, öğretmen uygulaması, dönem hesaplama mantığı ve çalışan özellikler korunur.
4. Canlı veriyi değiştiren, silen veya güvenlik kurallarını dağıtan işlem öncesinde yedek doğrulanır ve kullanıcıdan açık onay alınır.
5. Gerçek öğrenci kayıtları geliştirme testlerinde kullanılmaz. Kullanıcının cihaz testleri APK hazır olduktan sonra yapılır.
6. APK öncesinde kaynak kod, Emulator güvenlik testleri, Functions politika testleri ve Android bundle doğrulaması tamamlanır.
7. İlk APK tablet testi içindir. Mevcut telefondaki uygulama, Android imza parmak izi eşleşmeden güncellenmez.
8. Spark'ta güvenli sunucu push bildirimi ve zamanlanmış Functions çalıştırılamaz. Uygulama içi Firestore bildirimleri ve uygulama sahibi tarafından başlatılan Temmuz dönem temizliği kullanılır.
9. Yıllık silme politikası yalnızca son kararla belirlenen altı koleksiyonu ve tam `donemYili` hedefini kapsar. Okul, sınıf, öğrenci, kullanıcı profili, ortak kitap kütüphanesi, bağlantılar ve Firebase Auth hesapları silme kapsamı dışındadır.

## Uygulama ilkesi

Her oturumda önce bu belge ve en güncel proje durumu dikkate alınır. Kullanıcı tarafından tamamlandığı belirtilen özelliklere dokunulmaz; açık kalan işler en güncel karar sırasıyla ele alınır.

## Proaktif ilerleme kuralı

Kullanıcı "devam" demeyi beklemez. Güvenli ve belirli bir sonraki iş varsa asistan kendisi başlatır; kullanıcıdan yalnızca kendi cihazında/hesabında yapılması zorunlu adımlar istenir. Asistan boşta beklemez: ilerlemeyi, bulunan sorunları ve sıradaki somut adımı bildirir; gerçek engel yoksa işi sürdürür.
