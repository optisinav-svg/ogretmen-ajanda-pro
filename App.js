import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GirisEkrani from './screens/GirisEkrani';
import KayitRolSecimiEkrani from './screens/KayitRolSecimiEkrani';
import KayitEkrani from './screens/KayitEkrani';
import AnaSayfa from './screens/AnaSayfa';
import OkulSinifEkrani from './screens/OkulSinifEkrani';
import OgrenciEkrani from './screens/OgrenciEkrani';
import KitapEkrani from './screens/KitapEkrani';
import TakvimEkrani from './screens/TakvimEkrani';
import YoklamaEkrani from './screens/YoklamaEkrani';
import DersNotuEkrani from './screens/DersNotuEkrani';
import OdevEkrani from './screens/OdevEkrani';
import RaporEkrani from './screens/RaporEkrani';
import SifreDegistirEkrani from './screens/SifreDegistirEkrani';
import OgrenciHesaplariEkrani from './screens/OgrenciHesaplariEkrani';
import OgrenciKayitEkrani from './screens/OgrenciKayitEkrani';
import OgrenciAnaSayfaEkrani from './screens/OgrenciAnaSayfaEkrani';
import IstatistikPaneliEkrani from './screens/IstatistikPaneliEkrani';
import KVKKBilgilendirmeEkrani from './screens/KVKKBilgilendirmeEkrani';
import ProfilEkrani from './screens/ProfilEkrani';
import RolDuzeltmeTalepleriEkrani from './screens/RolDuzeltmeTalepleriEkrani';
import DonemAktarimEkrani from './screens/DonemAktarimEkrani';
const Stack=createNativeStackNavigator();
const opt={headerStyle:{backgroundColor:'#2E7D32'},headerTintColor:'#fff',headerTitleStyle:{fontWeight:'bold'}};
export default function App(){return <SafeAreaProvider><NavigationContainer><Stack.Navigator initialRouteName="Giris" screenOptions={opt}>
<Stack.Screen name="Giris" component={GirisEkrani} options={{headerShown:false}}/>
<Stack.Screen name="KayitRolSecimi" component={KayitRolSecimiEkrani} options={{title:"Kayıt Türü"}}/>
<Stack.Screen name="Kayit" component={KayitEkrani} options={{headerShown:false}}/>\n<Stack.Screen name="KVKKBilgilendirme" component={KVKKBilgilendirmeEkrani} options={{title:"KVKK Bilgilendirme"}}/>\n<Stack.Screen name="OgrenciKayit" component={OgrenciKayitEkrani} options={{title:"Öğrenci Kaydı"}}/>\n<Stack.Screen name="OgrenciAnaSayfa" component={OgrenciAnaSayfaEkrani} options={{title:"Öğrenci Ajandası",headerBackVisible:false}}/>
<Stack.Screen name="AnaSayfa" component={AnaSayfa} options={{title:'Öğretmen AjandaPro',headerBackVisible:false}}/>
<Stack.Screen name="IstatistikPaneli" component={IstatistikPaneliEkrani} options={{title:'İstatistik Paneli'}}/>
<Stack.Screen name="OkulSinif" component={OkulSinifEkrani} options={{title:'Okul & Sınıf Yönetimi'}}/>
<Stack.Screen name="Ogrenci" component={OgrenciEkrani} options={{title:'Öğrenci Yönetimi'}}/>
<Stack.Screen name="Kitap" component={KitapEkrani} options={{title:'Kitap & Konu Takibi'}}/>
<Stack.Screen name="Takvim" component={TakvimEkrani} options={{title:'Ders Takvimi'}}/>
<Stack.Screen name="Yoklama" component={YoklamaEkrani} options={{title:'Yoklama'}}/>
<Stack.Screen name="DersNotu" component={DersNotuEkrani} options={{title:'Ders Notu'}}/>
<Stack.Screen name="Odev" component={OdevEkrani} options={{title:'Ödev Takibi'}}/>
<Stack.Screen name="Rapor" component={RaporEkrani} options={{title:'Raporlar'}}/>
<Stack.Screen name="SifreDegistir" component={SifreDegistirEkrani} options={{title:'Şifre Değiştir'}}/>
<Stack.Screen name="Profil" component={ProfilEkrani} options={{title:"Profil ve Hesap"}}/>
<Stack.Screen name="RolDuzeltmeTalepleri" component={RolDuzeltmeTalepleriEkrani} options={{title:"Rol Düzeltme Talepleri"}}/>
<Stack.Screen name="DonemAktarim" component={DonemAktarimEkrani} options={{title:"Yeni Döneme Aktarım"}}/>
<Stack.Screen name="OgrenciHesaplari" component={OgrenciHesaplariEkrani} options={{title:'Öğrenci Hesapları'}}/>
</Stack.Navigator></NavigationContainer></SafeAreaProvider>}
