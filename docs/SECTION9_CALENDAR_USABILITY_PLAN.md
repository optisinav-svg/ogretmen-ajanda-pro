# Bölüm 9 — Takvim ve kullanım kolaylığı

Bu bölüm, Section 8 doğrulanmış dalından başlatılmıştır. Kod değişiklikleri küçük, ayrı commitlerle ve çalışan akışları bozmadan yapılır.

## Kullanıcı tarafından daha önce kabul edilmiş gereksinimler

1. **Beni Hatırla**
   - Yalnızca e-posta adresi hatırlanır.
   - Şifre hatırlanmaz; uygulama açıldığında şifre alanı boş kalır.
   - Otomatik giriş yapılmaz; kullanıcı GİRİŞ YAP düğmesine basar.
   - Şifre göster/gizle kontrolü korunur.

2. **Klavye davranışı**
   - Metin girişi olan ekranlarda klavye açılınca aktif alan görünür kalır.
   - Form içerikleri klavye açıkken kaydırılabilir olmalıdır.
   - Android yapılandırmasındaki `softwareKeyboardLayoutMode: resize` korunur; her ekranın kendi scroll/keyboard davranışı ayrıca kontrol edilir.

3. **Alt eylem düğmeleri**
   - Kaydet/Vazgeç gibi alt düğmeler Android sistem gezinme alanının arkasında kalmamalıdır.
   - Safe-area / alt inset boşluğu tutarlı olmalıdır.
   - Önceki takvim ekranındaki düzeltme diğer metin girişli ekranlara da uygulanıp kontrol edilmelidir.

4. **Ders Takvimi saat seçici**
   - Saat ve dakika seçimi dikey kaydırma ile yapılır; sabit artır/azalt düğmelerine bağlı kalmaz.
   - Saat döngüseldir: 23 → 00 → 01.
   - Dakika 5'er dakikalık adımlarla döngüseldir: 00 → 05 → … → 55 → 00.
   - Kaydırma sırasında seçili değer ortada ve okunaklı görünür; erişilebilir dokunma alanları korunur.

## Uygulama sırası

1. Section 8 tabanındaki mevcut login, app.json, TakvimEkrani ve diğer form ekranlarını incele.
2. Daha önce uygulanmış düzeltmeleri yeniden yazma; yalnızca eksik veya tutarsız olanları tamamla.
3. Saat seçiciyi dikey döngüsel picker olarak uygula ve saat/dakika sınır testlerini ekle.
4. Metin girişli ekranlarda keyboard avoidance ve alt eylem alanlarını tek tek kontrol et.
5. Android bundle ve testleri çalıştır; canlıya dağıtım veya APK üretme.

## Kapsam dışı

- Yeni takvim işlevleri veya bildirim özellikleri ekleme.
- Kullanıcı verilerini taşıma/silme.
- Canlı Firebase değişikliği, PR birleştirme, deploy veya APK üretimi.
