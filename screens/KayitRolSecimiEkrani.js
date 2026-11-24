import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function KayitRolSecimiEkrani({ navigation }) {
  return (
    <View style={s.root}>
      <Text style={s.icon}>📚</Text>
      <Text style={s.title}>Kayıt türünüzü seçin</Text>
      <Text style={s.subtitle}>Öğretmen veya öğrenci hesabı oluşturabilirsiniz. Hesap türü daha sonra kullanıcı tarafından değiştirilemez; düzeltme talepleri uygulama sahibi tarafından incelenir.</Text>
      <TouchableOpacity style={s.teacher} onPress={() => navigation.navigate('Kayit')}>
        <Text style={s.buttonTitle}>Öğretmen hesabı</Text>
        <Text style={s.buttonSub}>Okul, sınıf, ders ve öğrenci takibi</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.student} onPress={() => navigation.navigate('OgrenciKayit')}>
        <Text style={s.buttonTitle}>Öğrenci hesabı</Text>
        <Text style={s.buttonSub}>Ödevlerinizi ve öğretmeninizin paylaştığı bilgileri takip edin</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.back} onPress={() => navigation.navigate('Giris')}>
        <Text style={s.backText}>Giriş ekranına dön</Text>
      </TouchableOpacity>
    </View>
  );
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F1F8E9',justifyContent:'center',padding:24},
 icon:{fontSize:54,textAlign:'center',marginBottom:16},
 title:{fontSize:24,fontWeight:'bold',color:'#1B5E20',textAlign:'center'},
 subtitle:{fontSize:13,color:'#607D8B',lineHeight:20,textAlign:'center',marginTop:10,marginBottom:26},
 teacher:{backgroundColor:'#2E7D32',borderRadius:14,padding:18,marginBottom:12},
 student:{backgroundColor:'#1565C0',borderRadius:14,padding:18},
 buttonTitle:{color:'#fff',fontSize:17,fontWeight:'bold',textAlign:'center'},
 buttonSub:{color:'#E8F5E9',fontSize:12,textAlign:'center',marginTop:5,lineHeight:17},
 back:{alignItems:'center',padding:16,marginTop:8},
 backText:{color:'#2E7D32',fontWeight:'700'},
});
