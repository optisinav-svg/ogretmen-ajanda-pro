import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GirisEkrani from './screens/GirisEkrani';
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
const Stack=createNativeStackNavigator();
const opt={headerStyle:{backgroundColor:'#2E7D32'},headerTintColor:'#fff',headerTitleStyle:{fontWeight:'bold'}};
export default function App(){return <NavigationContainer><Stack.Navigator initialRouteName="Giris" screenOptions={opt}>
<Stack.Screen name="Giris" component={GirisEkrani} options={{headerShown:false}}/>
<Stack.Screen name="Kayit" component={KayitEkrani} options={{headerShown:false}}/>
<Stack.Screen name="AnaSayfa" component={AnaSayfa} options={{title:'Öğretmen AjandaPro',headerBackVisible:false}}/>
<Stack.Screen name="OkulSinif" component={OkulSinifEkrani} options={{title:'Okul & Sınıf Yönetimi'}}/>
<Stack.Screen name="Ogrenci" component={OgrenciEkrani} options={{title:'Öğrenci Yönetimi'}}/>
<Stack.Screen name="Kitap" component={KitapEkrani} options={{title:'Kitap & Konu Takibi'}}/>
<Stack.Screen name="Takvim" component={TakvimEkrani} options={{title:'Ders Takvimi'}}/>
<Stack.Screen name="Yoklama" component={YoklamaEkrani} options={{title:'Yoklama'}}/>
<Stack.Screen name="DersNotu" component={DersNotuEkrani} options={{title:'Ders Notu'}}/>
<Stack.Screen name="Odev" component={OdevEkrani} options={{title:'Ödev Takibi'}}/>
<Stack.Screen name="Rapor" component={RaporEkrani} options={{title:'Raporlar'}}/>
</Stack.Navigator></NavigationContainer>}
