# Akademik dönem saklama politikası

Bu modül, akademik dönem saklama politikasının test edilebilir kurallarını içerir. **Spark planında zamanlanmış Cloud Functions dağıtılamadığı için otomatik arka plan temizliği yoktur.** Kod, kendi başına silme yapmaz.

## Dönem davranışı

- Aktif dönem hiçbir şekilde temizleme kapsamına girmez.
- Bir önceki tamamlanmış dönem arşivdir: okunabilir, fakat dönem düzenlemeye kapalıdır.
- Aktif dönemden iki yıl önce başlayan dönem, yalnızca Temmuz ayında temizleme adayı olur.
- Örnek: Temmuz 2026'da 2026/27 aktif dönemdir, 2025/26 arşivdir, yalnızca 2024/25 temizleme adayıdır.
- Temmuz dışındaki tarihlerde hedef dönem yoktur.
- Yalnızca tam olarak hedef donemYili ve dolu uid alanı bulunan belgeler adaydır. Daha eski yıllar <= ile topluca kapsama alınmaz.

## Dönemsel veri koleksiyonları

 dersNotlari, dersler, yoklamalar, odevler, kitaplar, konular.

Okul, sınıf, öğrenci ve kullanıcı profilleri; öğretmen-öğrenci bağlantı kayıtları; öğrenci hesapları; ortak kitap kütüphanesi ve ortak kitap konuları bu listenin dışındadır.

## Spark uygulama sınırı

Spark'ta bu işlem kendiliğinden arka planda veya belirli bir saatte çalıştırılamaz. Uygulama içinde yalnızca yetkili uygulama sahibi tarafından başlatılan bir işlem olmalıdır:

1. Temmuz ayında hedef dönem ve koleksiyonlar belirlenir.
2. Önce salt okunur önizleme ve belge sayıları gösterilir.
3. Ana kayıtlar ve paylaşılan kütüphane kapsam dışı tutulur.
4. Kullanıcı açıkça onaylamadan hiçbir belge silinmez.
5. Silme, Firestore güvenlik kurallarının izin verdiği küçük partilerde yapılır; işlem sonucu raporlanır.
6. Canlı veride bu ekran ve kurallar doğrulanmadan silme akışı açılmaz.

Bu doküman ve saf politika fonksiyonları canlı Firebase verisini değiştirmez.
