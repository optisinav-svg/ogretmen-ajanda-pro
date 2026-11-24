import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, sendPasswordResetEmail, reload, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, ACCOUNT_LINKING_ENABLED } from '../firebaseConfig';
import { reserveCurrentEmailAlias } from '../services/sparkEmailAliases';
import { reactivateOwnAccount } from '../services/sparkAccountLifecycle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMAIL_KEY='@ogretmenAjandaPro_hatirlananEposta';
const REMEMBER_KEY='@ogretmenAjandaPro_beniHatirla';

export default function GirisEkrani({navigation}){
 const insets=useSafeAreaInsets();
 const [eposta,setEposta]=useState(''),[sifre,setSifre]=useState(''),[sifreGorunur,setSifreGorunur]=useState(false),[beniHatirla,setBeniHatirla]=useState(true),[yukleniyor,setYukleniyor]=useState(false);
 useEffect(()=>{(async()=>{try{const h=await AsyncStorage.getItem(REMEMBER_KEY);const e=await AsyncStorage.getItem(EMAIL_KEY);const aktif=h!=='false';setBeniHatirla(aktif);if(aktif&&e)setEposta(e);await AsyncStorage.removeItem('@ogretmenAjandaPro_hatirlananSifre');}catch(_){}})()},[]);
 const girisYap=async()=>{const e=eposta.trim();if(!e||!sifre)return Alert.alert('Hata','Lütfen e-posta adresinizi ve şifrenizi girin.');setYukleniyor(true);let girisAsamasi='Firebase kimlik doğrulama';try{const credential = await signInWithEmailAndPassword(auth,e,sifre);
girisAsamasi='E-posta alias kontrolü';try { await reserveCurrentEmailAlias(credential.user); } catch (aliasError) { await signOut(auth); throw aliasError; }
girisAsamasi='Kullanıcı profilini okuma';const profile = await getDoc(doc(db,'kullanicilar',credential.user.uid));
if (!profile.exists()) {
  Alert.alert('Mevcut hesabı tamamlama', 'Bu e-posta adresiyle bir giriş hesabınız var ancak profil tamamlanmamış. Yeni hesap açılmayacak. Hesap türünüzü seçerek mevcut hesabınızı tamamlayın.', [
    { text: 'Vazgeç', style: 'cancel', onPress: async () => { await signOut(auth); } },
    { text: 'Öğretmen', onPress: () => navigation.replace('Kayit', { devamEt: true, eposta: credential.user.email || e }) },
    ...(ACCOUNT_LINKING_ENABLED ? [{ text: 'Öğrenci', onPress: () => navigation.replace('OgrenciKayit', { devamEt: true }) }] : []),
  ]);
  return;
}
if (profile.get('hesapDurumu') === 'kapali') {
  Alert.alert('Hesap kapalı', 'Bu hesap daha önce kapatılmış. Geçmiş kayıtlarınıza erişmek için hesabınızı yeniden etkinleştirebilirsiniz.', [
    { text: 'Şimdi değil', style: 'cancel', onPress: async () => { await signOut(auth); } },
    { text: 'Hesabı yeniden etkinleştir', onPress: async () => { try {
      await reload(credential.user);
      if (!credential.user.emailVerified) throw new Error('Önce e-posta adresinizi doğrulayın.');
      await reactivateOwnAccount(credential.user);
      const refreshed = await getDoc(doc(db,'kullanicilar',credential.user.uid));
      if (refreshed.get('rol') === 'ogrenci') navigation.replace('OgrenciAnaSayfa');
      else navigation.replace('AnaSayfa');
    } catch (e) { Alert.alert('Etkinleştirilemedi', e.message || 'Daha sonra tekrar deneyin.'); } } }
  ]);
  return;
}
if (credential.user.emailVerified && profile.get('eposta') !== credential.user.email) {
  girisAsamasi='Profil e-posta bilgisini güncelleme';await updateDoc(doc(db,'kullanicilar',credential.user.uid), { eposta: (credential.user.email || '').trim().toLowerCase() });
}
const role = profile.get('rol');
if (role === 'ogrenci') {
  navigation.replace('OgrenciAnaSayfa');
  return;
}
if (role !== 'ogretmen') throw new Error('Hesap rolü tanımlı değil veya geçersiz. Güvenlik nedeniyle öğretmen erişimi verilmedi; destek alın.');
try{if(beniHatirla)await AsyncStorage.multiSet([[REMEMBER_KEY,'true'],[EMAIL_KEY,e]]);else await AsyncStorage.multiSet([[REMEMBER_KEY,'false'],[EMAIL_KEY,'']]);await AsyncStorage.removeItem('@ogretmenAjandaPro_hatirlananSifre');}catch(_){}navigation.replace('AnaSayfa');}catch(hata){let m=hata?.message||'Giriş yapılamadı.';if(hata?.code==='permission-denied'||hata?.code==='firestore/permission-denied'){m=`Firestore izni reddedildi.\nAşama: ${girisAsamasi}\nKod: ${hata.code}\nAyrıntı: ${m}`;}if(hata.code==='auth/user-not-found')m='Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';else if(hata.code==='auth/wrong-password'||hata.code==='auth/invalid-credential')m='E-posta veya şifre hatalı.';else if(hata.code==='auth/invalid-email')m='Geçersiz e-posta adresi.';else if(hata.code==='auth/too-many-requests')m='Çok fazla başarısız giriş denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.';else if(hata.code==='auth/network-request-failed')m='İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';Alert.alert('Giriş Hatası',m);}finally{setYukleniyor(false)}};
 const sifremiUnuttum=async()=>{const e=eposta.trim();if(!e)return Alert.alert('E-posta gerekli','Önce şifre sıfırlama bağlantısının gönderileceği e-posta adresinizi yazın.');try{await sendPasswordResetEmail(auth,e);Alert.alert('E-posta gönderildi','Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.')}catch(hata){Alert.alert('Hata',hata.code==='auth/invalid-email'?'Geçerli bir e-posta adresi yazın.':'Şifre sıfırlama e-postası gönderilemedi.')}};
 return <KeyboardAvoidingView style={s.kapsayici} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView contentContainerStyle={[s.icerik,{paddingBottom:insets.bottom+32}] } keyboardShouldPersistTaps="handled"><View style={s.baslik}><Text style={s.emoji}>📚</Text><Text style={s.baslikMetni}>Öğretmen AjandaPro</Text><Text style={s.altBaslik}>Hesabınıza giriş yapın</Text></View><View style={s.form}><Text style={s.etiket}>E-posta</Text><TextInput style={s.girdi} placeholder="ornek@mail.com" value={eposta} onChangeText={setEposta} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!yukleniyor}/><Text style={s.etiket}>Şifre</Text><View style={s.sifreSatiri}><TextInput style={s.sifreGirdi} placeholder="Şifrenizi girin" value={sifre} onChangeText={setSifre} secureTextEntry={!sifreGorunur} editable={!yukleniyor} autoCapitalize="none" autoCorrect={false}/><TouchableOpacity style={s.gosterButon} onPress={()=>setSifreGorunur(!sifreGorunur)} disabled={yukleniyor}><Text style={s.gosterMetni}>{sifreGorunur?'🙈 Gizle':'👁 Göster'}</Text></TouchableOpacity></View><TouchableOpacity style={s.hatirlaSatiri} onPress={()=>setBeniHatirla(!beniHatirla)} disabled={yukleniyor}><View style={[s.kutu,beniHatirla&&s.kutuSecili]}><Text style={s.kutuIsaret}>{beniHatirla?'✓':''}</Text></View><Text style={s.hatirlaMetni}>E-posta adresimi hatırla</Text></TouchableOpacity><TouchableOpacity style={s.unuttumLink} onPress={sifremiUnuttum} disabled={yukleniyor}><Text style={s.unuttumMetni}>🔑 Şifremi unuttum</Text></TouchableOpacity><TouchableOpacity style={[s.buton,yukleniyor&&s.butonDevre]} onPress={girisYap} disabled={yukleniyor}>{yukleniyor?<ActivityIndicator color="#fff"/>:<Text style={s.butonMetni}>Giriş Yap</Text>}</TouchableOpacity><TouchableOpacity style={s.kayitLink} onPress={()=>navigation.navigate('KayitRolSecimi')} disabled={yukleniyor}><Text style={s.kayitMetni}>Hesabınız yok mu? <Text style={s.kayitVurgu}>Kayıt Olun</Text></Text></TouchableOpacity></View></ScrollView></KeyboardAvoidingView>;
}
const s=StyleSheet.create({kapsayici:{flex:1,backgroundColor:'#F1F8E9'},icerik:{flexGrow:1,justifyContent:'center',padding:24,paddingBottom:40},baslik:{alignItems:'center',marginBottom:32},emoji:{fontSize:64,marginBottom:12},baslikMetni:{fontSize:28,fontWeight:'bold',color:'#1B5E20',marginBottom:6},altBaslik:{fontSize:16,color:'#558B2F'},form:{backgroundColor:'#fff',borderRadius:16,padding:24,elevation:3,shadowColor:'#000',shadowOpacity:.1,shadowRadius:8},etiket:{fontSize:14,fontWeight:'600',color:'#2E7D32',marginBottom:6,marginTop:12},girdi:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:12,fontSize:16,backgroundColor:'#F9FBE7'},sifreSatiri:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,backgroundColor:'#F9FBE7'},sifreGirdi:{flex:1,padding:12,fontSize:16},gosterButon:{paddingHorizontal:10,paddingVertical:12,borderLeftWidth:1,borderLeftColor:'#C8E6C9'},gosterMetni:{fontSize:12,color:'#2E7D32',fontWeight:'600'},hatirlaSatiri:{flexDirection:'row',alignItems:'center',marginTop:16},kutu:{width:22,height:22,borderWidth:1,borderColor:'#81C784',borderRadius:5,alignItems:'center',justifyContent:'center',marginRight:8},kutuSecili:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},kutuIsaret:{color:'#fff',fontWeight:'bold'},hatirlaMetni:{fontSize:14,color:'#555'},unuttumLink:{alignSelf:'flex-start',marginTop:14},unuttumMetni:{fontSize:14,color:'#2E7D32',fontWeight:'600'},buton:{backgroundColor:'#2E7D32',borderRadius:10,padding:16,alignItems:'center',marginTop:22},butonDevre:{backgroundColor:'#81C784'},butonMetni:{color:'#fff',fontSize:16,fontWeight:'bold'},kayitLink:{marginTop:16,alignItems:'center'},kayitMetni:{fontSize:14,color:'#555'},kayitVurgu:{color:'#2E7D32',fontWeight:'bold'}});
