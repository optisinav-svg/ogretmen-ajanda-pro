import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, reload } from 'firebase/auth';
import { auth, ACCOUNT_LINKING_ENABLED } from '../firebaseConfig';
import { submitStudentPairingRequest } from '../services/sparkStudentAccounts';

export default function OgrenciKayitEkrani({ navigation, route }) {
  const devamEt = !!route?.params?.devamEt || !!auth.currentUser;
  const [adSoyad, setAdSoyad] = useState(auth.currentUser?.displayName || '');
  const [eposta, setEposta] = useState(auth.currentUser?.email || '');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [kod, setKod] = useState('');
  const [hesapHazir, setHesapHazir] = useState(devamEt);
  const [yukleniyor, setYukleniyor] = useState(false);

  const kodGonder = async () => {
    const temizKod = kod.trim().toUpperCase();
    if (!/^[A-F0-9]{16}$/.test(temizKod)) {
      Alert.alert('Kod hatalı', 'Öğretmeninizin verdiği 16 karakterli kodu kontrol edin.');
      return;
    }
    if (!auth.currentUser) {
      Alert.alert('Oturum bulunamadı', 'Önce öğrenci hesabınızı oluşturun.');
      return;
    }
    setYukleniyor(true);
    try {
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      if (!auth.currentUser.emailVerified) {
        Alert.alert('E-posta doğrulanmadı', 'Önce e-posta kutunuza gönderilen doğrulama bağlantısını açın. Ardından tekrar deneyin.');
        return;
      }
      await submitStudentPairingRequest(temizKod, adSoyad.trim());
      navigation.replace('OgrenciAnaSayfa');
    } catch (e) {
      Alert.alert(
        'Eşleştirme isteği gönderilemedi',
        e?.message || 'Kodu kontrol edip tekrar deneyin. Kodun süresi dolduysa öğretmeninizden yeni kod isteyin.',
      );
    } finally {
      setYukleniyor(false);
    }
  };

  const hesapOlustur = async () => {
    if (adSoyad.trim().length < 2) return Alert.alert('Ad gerekli', 'Adınızı ve soyadınızı girin.');
    if (!eposta.trim()) return Alert.alert('E-posta gerekli', 'E-posta adresinizi girin.');
    if (sifre.length < 6) return Alert.alert('Şifre kısa', 'Şifreniz en az 6 karakter olmalıdır.');
    if (sifre !== sifreTekrar) return Alert.alert('Şifreler eşleşmiyor', 'İki şifre alanını aynı şekilde doldurun.');
    setYukleniyor(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, eposta.trim(), sifre);
      await updateProfile(result.user, { displayName: adSoyad.trim() });
      await sendEmailVerification(result.user);
      setHesapHazir(true);
      setSifre('');
      setSifreTekrar('');
      Alert.alert('Doğrulama e-postası gönderildi', 'E-posta kutunuza gönderilen bağlantıyı açıp adresinizi doğrulayın. Doğrulama tamamlanmadan eşleştirme isteği gönderemezsiniz.');
    } catch (e) {
      const message = e?.code === 'auth/email-already-in-use'
        ? 'Bu e-posta ile bir hesap zaten var. Giriş ekranından giriş yapıp öğrenci kaydınızı kodla tamamlayabilirsiniz.'
        : e?.code === 'auth/invalid-email'
          ? 'Geçerli bir e-posta adresi girin.'
          : e?.message || 'Öğrenci hesabı oluşturulamadı.';
      Alert.alert('Kayıt yapılamadı', message);
    } finally {
      setYukleniyor(false);
    }
  };

  if (!ACCOUNT_LINKING_ENABLED) {
    return (
      <View style={s.center}>
        <Text style={s.icon}>🎓</Text>
        <Text style={s.title}>Öğrenci kaydı henüz açılmadı</Text>
        <Text style={s.info}>Öğrenci hesabı, doğrulanmış e-posta ve öğretmeninizin tek kullanımlık koduyla eşleştirilir. Öğretmen onay verene kadar hiçbir öğrenci verisi açılmaz.</Text>
        <TouchableOpacity style={s.button} onPress={() => navigation.goBack()}><Text style={s.buttonText}>Geri dön</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.icon}>🎓</Text>
        <Text style={s.title}>Öğrenci Hesabı</Text>
        <Text style={s.info}>Öğretmeninizin verdiği kodu kullanarak hesabınızı ilgili öğrenci kaydıyla eşleştirin. Öğretmen onay verene kadar ders ve öğrenci verileri paylaşılmaz.</Text>
        {!hesapHazir ? (
          <View style={s.card}>
            <Text style={s.label}>Adınız Soyadınız</Text>
            <TextInput style={s.input} value={adSoyad} onChangeText={setAdSoyad} placeholder="Adınız Soyadınız" autoCapitalize="words"/>
            <Text style={s.label}>E-posta</Text>
            <TextInput style={s.input} value={eposta} onChangeText={setEposta} placeholder="ornek@mail.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}/>
            <Text style={s.label}>Şifre</Text>
            <TextInput style={s.input} value={sifre} onChangeText={setSifre} placeholder="En az 6 karakter" secureTextEntry/>
            <Text style={s.label}>Şifre Tekrar</Text>
            <TextInput style={s.input} value={sifreTekrar} onChangeText={setSifreTekrar} placeholder="Şifrenizi tekrar girin" secureTextEntry/>
            <TouchableOpacity style={s.button} onPress={hesapOlustur} disabled={yukleniyor}>
              {yukleniyor ? <ActivityIndicator color="#fff"/> : <Text style={s.buttonText}>Hesap Oluştur</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.label}>Hesap</Text>
            <Text style={s.account}>{auth.currentUser?.email || eposta}</Text>
            <TouchableOpacity style={s.link} onPress={async () => { try { await sendEmailVerification(auth.currentUser); Alert.alert("E-posta gönderildi", "Doğrulama bağlantısını e-posta kutunuzdan açın."); } catch (e) { Alert.alert("Gönderilemedi", e?.message || "Doğrulama e-postası gönderilemedi."); } }}><Text style={s.linkText}>Doğrulama e-postasını yeniden gönder</Text></TouchableOpacity>
            <Text style={s.label}>Öğretmen Eşleştirme Kodu</Text>
            <TextInput style={s.input} value={kod} onChangeText={setKod} placeholder="16 karakterli kod" autoCapitalize="characters" autoCorrect={false} maxLength={16}/>
            <TouchableOpacity style={s.button} onPress={kodGonder} disabled={yukleniyor}>
              {yukleniyor ? <ActivityIndicator color="#fff"/> : <Text style={s.buttonText}>Eşleştirme İsteği Gönder</Text>}
            </TouchableOpacity>
            <Text style={s.note}>Kod geçersiz veya süresi dolmuşsa öğretmeninizden yeni kod isteyin. Daha sonra da bu ekrandan yeni bir kod gönderebilirsiniz.</Text>
          </View>
        )}
        <TouchableOpacity style={s.link} onPress={() => navigation.navigate('KVKKBilgilendirme')}><Text style={s.linkText}>KVKK Aydınlatma Bilgisi</Text></TouchableOpacity>
        <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Giris')}><Text style={s.linkText}>Giriş ekranına dön</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F1F8E9'},content:{flexGrow:1,justifyContent:'center',padding:22,paddingBottom:40},
  center:{flex:1,justifyContent:'center',padding:26,backgroundColor:'#F1F8E9'},icon:{fontSize:52,textAlign:'center',marginBottom:12},
  title:{fontSize:25,fontWeight:'bold',color:'#1B5E20',textAlign:'center',marginBottom:12},
  info:{fontSize:14,color:'#526452',lineHeight:21,textAlign:'center',marginBottom:20},
  card:{backgroundColor:'#fff',borderRadius:16,padding:20,elevation:3},
  label:{fontSize:14,fontWeight:'700',color:'#2E7D32',marginTop:12,marginBottom:6},
  input:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:13,fontSize:16,backgroundColor:'#FAFFF7'},
  account:{fontSize:15,color:'#37474F',paddingVertical:8},
  button:{backgroundColor:'#2E7D32',padding:15,borderRadius:10,alignItems:'center',marginTop:20},
  buttonText:{color:'#fff',fontSize:15,fontWeight:'bold'},note:{fontSize:12,color:'#667766',lineHeight:18,marginTop:14},
  link:{alignItems:'center',padding:18},linkText:{color:'#2E7D32',fontWeight:'700'},
});
