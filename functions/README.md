# Yıllık dönem arşivi ve saklama politikası

## Kesin kullanıcı kararı
- İlk veri yılı: 2026.
- 2026 dönemi, Temmuz 2028'e kadar saklanır; Temmuz 2028'de yalnızca 2026 silinir.
- Temmuz 2029'da yalnızca 2027; Temmuz 2030'da yalnızca 2028 silinir.
- Kural her yıl Temmuz ayında bir önceki iki yılın dönemini silerek devam eder.
- 2026 ve 2027'de hiçbir dönem silinmez.
- Bir önceki dönem arşiv olarak okunabilir kalır; değiştirilemez.
- Aktif dönem ve mevcut uygulamanın dönem seçimi/hesaplaması korunur.

## Veri modeli
Firestore'da gerçek tek parça yıllık dosyalar bulunmuyor. Uygulamanın mevcut `donemYili` alanı zaten her belgeyi dönemine göre ayırıyor. Dolayısıyla 2026/2027 "dosyası", ilgili koleksiyonlardaki `donemYili: 2026` veya `2027` belgelerinin mantıksal kümesidir. Fiziksel dosya oluşturmak veya mevcut kayıtları taşımak gerekmiyor.

## Temizlik kapsamı
Yalnızca şu dönemsel veriler:
- `dersNotlari`
- `dersler`
- `yoklamalar`
- `odevler`
- `kitaplar`
- `konular`

Okullar, sınıflar, öğrenciler, kullanıcı profilleri, ortak kitap kütüphanesi ve kütüphane konu tanımları silinmez.

## Çalışma şekli
Spark planında Cloud Functions Scheduler çalıştırılamaz. Bu nedenle görev, uygulama sahibi uygulamayı Temmuz ayında açtığında çalışan, yıl için bir kez kilitlenen/tekrarı engellenen uygulama içi bakım kontrolü olmalıdır. Önce salt okunur önizleme ve adetler gösterilir; kullanıcı onayı olmadan silme yapılmaz. İşlem küçük partilerde ilerler ve sonuç kaydı tutulur. Bu dosyadaki saf hesaplama yardımcıları hiçbir belge silmez.

## Dönem uyumluluğu
`utils/donem.js` içindeki mevcut dönem hesaplaması kullanıcı tarafından kullanılan dönem mekanizmasıdır ve değiştirilmemelidir. Temizlik politikası yalnızca `donemYili` değerini hedefler; aktif dönem seçimi ve kayıt oluşturma davranışını değiştirmez.
