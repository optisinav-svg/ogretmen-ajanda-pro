import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

const bolumler = [
  {
    baslik: 'Veri sorumlusu',
    metin: 'Öğretmen Ajanda Pro için veri sorumlusu: .......\nİletişim adresi: .......\nİletişim e-posta adresi: .......',
  },
  {
    baslik: 'İşlenebilecek veriler',
    metin: 'Hesap ve kimlik bilgileri (ad-soyad, kullanıcı adı, e-posta ve rol); okul, sınıf ve eğitim dönemi bilgileri; ders, konu, kitap ilerlemesi, ödev, yoklama, takvim ve rapor kayıtları; hesap güvenliği ve işlem kayıtları; bildirim tercihi ve bildirim için gereken cihaz belirteçleri.',
  },
  {
    baslik: 'İşleme amaçları',
    metin: 'Kullanıcı hesabını oluşturmak ve güvenliğini sağlamak; öğretmenlerin eğitim faaliyetlerini yönetmesine yardımcı olmak; öğretmenin izin verdiği bilgileri bağlı öğrenci hesabına göstermek; ödev ve uygulama bildirimleri göndermek; rapor oluşturmak ve teknik sorunları gidermek.',
  },
  {
    baslik: 'Hukuki sebepler',
    metin: 'Her veri ve amaç için geçerli hukuki sebep, uygulamanın gerçek kullanım biçimi ve veri akışı dikkate alınarak belirlenmelidir. Açık rıza, gerekli olmayan işlemler için zorunlu bir genel onay olarak kullanılmaz.',
  },
  {
    baslik: 'Hizmet sağlayıcılar ve aktarım',
    metin: 'Kimlik doğrulama, veritabanı, sunucu ve bildirim hizmetlerinin sağlayıcıları, erişim ülkeleri ve aktarım mekanizmaları yayın öncesinde doğrulanmalıdır. Yurt dışına aktarım varsa KVKK m.9 kapsamındaki gerekli süreçler tamamlanmalıdır.',
  },
  {
    baslik: 'Saklama ve ilgili kişi hakları',
    metin: 'Veri kategorilerine göre saklama süreleri belirlenir; süre sonunda mevzuata uygun silme, yok etme veya anonimleştirme uygulanır. KVKK m.11 kapsamındaki talepler için başvuru kanalı: .......',
  },
];

export default function KVKKBilgilendirmeEkrani() {
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.warning}>
        <Text style={s.warningTitle}>Geliştirme sürümü — taslak metin</Text>
        <Text style={s.warningText}>Bu ekran henüz yayıma hazır hukuki metin değildir. Gerçek veri sorumlusu ve iletişim bilgileri ile hizmet sağlayıcı/aktarim ayrıntıları doğrulanıp uzman incelemesinden geçirilmeden herkese açık kullanıma açılmamalıdır.</Text>
      </View>
      {bolumler.map((item) => (
        <View key={item.baslik} style={s.card}>
          <Text style={s.heading}>{item.baslik}</Text>
          <Text style={s.body}>{item.metin}</Text>
        </View>
      ))}
      <Text style={s.footer}>Aydınlatma metninin gösterilmesi, tek başına açık rıza alınması anlamına gelmez. Bildirim izni ayrıca ve isteğe bağlı yönetilmelidir.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F1F8E9'},
  content:{padding:18,paddingBottom:32},
  warning:{backgroundColor:'#FFF3E0',borderColor:'#FFCC80',borderWidth:1,borderRadius:12,padding:15,marginBottom:14},
  warningTitle:{fontSize:15,fontWeight:'800',color:'#8D4E00',marginBottom:6},
  warningText:{fontSize:13,color:'#654321',lineHeight:20},
  card:{backgroundColor:'#fff',borderRadius:12,padding:16,marginBottom:12},
  heading:{fontSize:16,fontWeight:'800',color:'#1B5E20',marginBottom:8},
  body:{fontSize:14,color:'#37474F',lineHeight:21},
  footer:{fontSize:12,color:'#667766',lineHeight:18,marginTop:4},
});
