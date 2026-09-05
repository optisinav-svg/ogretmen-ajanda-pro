import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, where, getDoc
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import kazanmlar from '../assets/kazanimlar.json';

const normalize = (text = '') => text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function sinifKodlariniBul(sinifAd = '') {
  const s = normalize(sinifAd);
  if (s.includes('tyt') || s.includes('ayt')) return ['21', '22'];
  const eslesme = s.match(/(^|\D)([1-9]|1[0-2])(?:\D|$)/);
  return eslesme ? [eslesme[2]] : [];
}

function StudentSelector({sinif,uid,onSelect}){const [list,setList]=useState([]);useEffect(()=>{if(sinif)getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',sinif.id),where('uid','==',uid))).then(x=>setList(x.docs.map(d=>({id:d.id,...d.data()})))).catch(()=>{})},[]);return <ScrollView style={{padding:12}}>{list.length?list.map(o=><TouchableOpacity key={o.id} style={{backgroundColor:'#fff',padding:15,borderRadius:10,marginBottom:8}} onPress={()=>onSelect(o)}><Text style={{fontSize:16,fontWeight:'bold',color:'#1B5E20'}}>{o.adSoyad}</Text><Text style={{color:'#777',marginTop:2}}>Kitaplarını görmek için dokunun ›</Text></TouchableOpacity>):<Text style={{padding:20,textAlign:'center',color:'#999'}}>Bu sınıfta öğrenci yok.</Text>}</ScrollView>}

export default function KitapEkrani({ route }) {
  const [ogrenciSecili, setOgrenciSecili] = useState(route.params?.ogrenci || null);
  const sinifRoute = route.params?.sinif || null;
  const ogrenci = ogrenciSecili;
  const [kitaplar, setKitaplar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kitapModal, setKitapModal] = useState(false);
  const [konuModal, setKonuModal] = useState(false);
  const [seciliKitap, setSeciliKitap] = useState(null);
  const [konular, setKonular] = useState([]);
  const [kitapAdi, setKitapAdi] = useState('');
  const [sayfaSayisi, setSayfaSayisi] = useState('');
  const [konuAdi, setKonuAdi] = useState('');
  const [baslangicSayfa, setBaslangicSayfa] = useState('');
  const [bitisSayfa, setBitisSayfa] = useState('');
  const [arama, setArama] = useState('');
  const [profilBrans, setProfilBrans] = useState('');
  const [sinifBilgi, setSinifBilgi] = useState(null);
  const [seciliKazanim, setSeciliKazanim] = useState(null);
  const [manuelKonu, setManuelKonu] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => { profilYukle(); if (ogrenci) { kitaplariYukle(); sinifBilgiYukle(); } }, [ogrenci?.id]);
  

  const profilYukle = async () => {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, 'kullanicilar', uid));
      if (snap.exists()) setProfilBrans(snap.data().brans || '');
    } catch (_) {}
  };

  const sinifBilgiYukle = async () => {
    if (!ogrenci?.sinifId) return;
    try {
      const snap = await getDoc(doc(db, 'siniflar', ogrenci.sinifId));
      if (snap.exists()) setSinifBilgi({ id: snap.id, ...snap.data() });
    } catch (_) {}
  };

  const kitaplariYukle = async () => {
    if (!ogrenci?.id || !uid) return;
    setYukleniyor(true);
    try {
      const q = query(collection(db, 'kitaplar'), where('ogrenciId', '==', ogrenci.id), where('uid', '==', uid));
      const snap = await getDocs(q);
      setKitaplar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { Alert.alert('Hata', 'Kitaplar yüklenemedi.'); }
    setYukleniyor(false);
  };

  const kitapEkle = async () => {
    if (!kitapAdi.trim()) { Alert.alert('Hata', 'Kitap adı girin.'); return; }
    try {
      await addDoc(collection(db, 'kitaplar'), {
        ad: kitapAdi.trim(), sayfaSayisi: parseInt(sayfaSayisi, 10) || 0,
        ogrenciId: ogrenci.id, ogrenciAd: ogrenci.adSoyad,
        sinifId: ogrenci.sinifId, sinifAd: ogrenci.sinifAd,
        okulId: ogrenci.okulId, okulAd: ogrenci.okulAd,
        brans: sinifBilgi?.ders || profilBrans, kademe: sinifBilgi?.kademe || '', uid, olusturulma: new Date().toISOString()
      });
      setKitapAdi(''); setSayfaSayisi(''); setKitapModal(false); kitaplariYukle();
    } catch (e) { Alert.alert('Hata', 'Kitap eklenemedi.'); }
  };

  const konulariYukle = async (kitap) => {
    setSeciliKitap(kitap);
    try {
      const q = query(collection(db, 'konular'), where('kitapId', '==', kitap.id), where('uid', '==', uid));
      const snap = await getDocs(q);
      setKonular(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { Alert.alert('Hata', 'Konular yüklenemedi.'); }
  };

  const uygunKazanimlar = useMemo(() => {
    const ders = normalize(sinifBilgi?.ders || profilBrans);
    const kademe = sinifBilgi?.kademe || '';
    const kodlar = kademe === 'TYT' || kademe === 'AYT' ? ['21', '22'] : (kademe ? [String(kademe)] : sinifKodlariniBul(ogrenci?.sinifAd || ''));
    const ar = normalize(arama.trim());
    if (!ders || !kodlar.length || !ar) return [];
    return kazanmlar
      .filter(k => normalize(k.ders) === ders && kodlar.includes(String(k.sinif)))
      .filter(k => normalize(`${k.kod} ${k.ad}`).includes(ar))
      .slice(0, 80);
  }, [profilBrans, sinifBilgi?.ders, sinifBilgi?.kademe, ogrenci?.sinifAd, arama]);

  const konuEkle = async () => {
    const ad = manuelKonu ? konuAdi.trim() : seciliKazanim?.ad?.trim();
    if (!ad) { Alert.alert('Hata', 'Bir konu seçin veya kendiniz konu yazın.'); return; }
    try {
      await addDoc(collection(db, 'konular'), {
        ad,
        baslangicSayfa: parseInt(baslangicSayfa, 10) || 0,
        bitisSayfa: parseInt(bitisSayfa, 10) || 0,
        kitapId: seciliKitap.id, kitapAd: seciliKitap.ad,
        ogrenciId: ogrenci.id, sinifId: ogrenci.sinifId, sinifAd: ogrenci.sinifAd,
        okulId: ogrenci.okulId, okulAd: ogrenci.okulAd,
        kazanımKodu: manuelKonu ? '' : (seciliKazanim?.kod || ''),
        kaynak: manuelKonu ? 'manuel' : 'csv', brans: sinifBilgi?.ders || profilBrans, kademe: sinifBilgi?.kademe || '',
        uid, olusturulma: new Date().toISOString()
      });
      setKonuAdi(''); setBaslangicSayfa(''); setBitisSayfa(''); setArama('');
      setSeciliKazanim(null); setManuelKonu(true); setKonuModal(false); konulariYukle(seciliKitap);
    } catch (e) { Alert.alert('Hata', 'Konu eklenemedi.'); }
  };

  const kitapSil = (id) => Alert.alert('Sil', 'Bu kitabı silmek istiyor musunuz?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => {
      await deleteDoc(doc(db, 'kitaplar', id));
      if (seciliKitap?.id === id) { setSeciliKitap(null); setKonular([]); }
      kitaplariYukle();
    }}
  ]);

  const konuSil = (id) => Alert.alert('Sil', 'Bu konuyu silmek istiyor musunuz?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'konular', id)); konulariYukle(seciliKitap); }}
  ]);

  if (yukleniyor) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2E7D32" />;

  if (!ogrenci) return <View style={styles.kapsayici}><View style={styles.baslik}><Text style={styles.ogrenciAd}>{sinifRoute?.ad||'Öğrenci seçimi'}</Text><Text style={styles.sinifAd}>Kitap & Konular için öğrenci seçin.</Text></View><StudentSelector sinif={sinifRoute} uid={uid} onSelect={o=>setOgrenciSecili(o)} /></View>;
  return (
    <KeyboardAvoidingView style={styles.kapsayici} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.baslik}>
        <Text style={styles.ogrenciAd}>{ogrenci?.adSoyad}</Text>
        <Text style={styles.sinifAd}>{ogrenci?.sinifAd} - {ogrenci?.okulAd}</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.bolum}>
          <View style={styles.bolumBaslik}><Text style={styles.bolumMetni}>📚 Kitaplar</Text><TouchableOpacity style={styles.ekleButon} onPress={() => setKitapModal(true)}><Text style={styles.ekleMetni}>+ Kitap</Text></TouchableOpacity></View>
          {kitaplar.length === 0 && <Text style={styles.bos}>Henüz kitap eklenmemiş.</Text>}
          {kitaplar.map(kitap => <TouchableOpacity key={kitap.id} style={[styles.kart, seciliKitap?.id === kitap.id && styles.kartSecili]} onPress={() => konulariYukle(kitap)} onLongPress={() => kitapSil(kitap.id)}>
            <Text style={styles.kartMetni}>📖 {kitap.ad}</Text>{kitap.sayfaSayisi > 0 && <Text style={styles.kartAlt}>{kitap.sayfaSayisi} sayfa</Text>}
          </TouchableOpacity>)}
        </View>
        {seciliKitap && <View style={styles.bolum}>
          <View style={styles.bolumBaslik}><Text style={styles.bolumMetni}>📑 {seciliKitap.ad} - Konular</Text><TouchableOpacity style={styles.ekleButon} onPress={() => setKonuModal(true)}><Text style={styles.ekleMetni}>+ Konu</Text></TouchableOpacity></View>
          {konular.length === 0 && <Text style={styles.bos}>Henüz konu eklenmemiş.</Text>}
          {konular.map((konu, i) => <TouchableOpacity key={konu.id} style={styles.konuKart} onLongPress={() => konuSil(konu.id)}>
            <View style={styles.konuSolum}><Text style={styles.konuSira}>{i + 1}</Text></View><View style={styles.konuBilgi}><Text style={styles.konuAd}>{konu.kazanımKodu ? `${konu.kazanımKodu} — ` : ''}{konu.ad}</Text>{(konu.baslangicSayfa > 0 || konu.bitisSayfa > 0) && <Text style={styles.konuSayfa}>Sayfa: {konu.baslangicSayfa} - {konu.bitisSayfa}</Text>}</View>
          </TouchableOpacity>)}
        </View>}
      </ScrollView>

      <Modal visible={kitapModal} transparent animationType="slide"><View style={styles.modalArka}><View style={styles.modalIcerik}><Text style={styles.modalBaslik}>Kitap Ekle</Text><TextInput style={styles.girdi} placeholder="Kitap adı" value={kitapAdi} onChangeText={setKitapAdi} autoFocus /><TextInput style={styles.girdi} placeholder="Sayfa sayısı (isteğe bağlı)" value={sayfaSayisi} onChangeText={setSayfaSayisi} keyboardType="numeric" /><TouchableOpacity style={styles.kaydetButon} onPress={kitapEkle}><Text style={styles.kaydetMetni}>Kaydet</Text></TouchableOpacity><TouchableOpacity style={styles.iptalButon} onPress={() => setKitapModal(false)}><Text style={styles.iptalMetni}>İptal</Text></TouchableOpacity></View></View></Modal>

      <Modal visible={konuModal} transparent animationType="slide"><View style={styles.modalArka}><View style={[styles.modalIcerik, { maxHeight: '90%' }]}><ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.modalBaslik}>Konu Ekle</Text>
        <View style={styles.secimSatir}><TouchableOpacity style={[styles.secim, manuelKonu && styles.secimAktif]} onPress={() => {setManuelKonu(true);setSeciliKazanim(null);}}><Text style={[styles.secimText, manuelKonu && styles.secimTextAktif]}>Kendim yazacağım</Text></TouchableOpacity><TouchableOpacity style={[styles.secim, !manuelKonu && styles.secimAktif]} onPress={() => setManuelKonu(false)}><Text style={[styles.secimText, !manuelKonu && styles.secimTextAktif]}>CSV'den seç</Text></TouchableOpacity></View>
        {!manuelKonu && <><Text style={styles.kucukBilgi}>{sinifBilgi?.ders || profilBrans || 'Ders'} • {sinifBilgi?.kademe || sinifKodlariniBul(ogrenci?.sinifAd || '').join(' + ') || 'Kademe'}</Text><TextInput style={styles.girdi} placeholder="Konu veya kazanım ara..." value={arama} onChangeText={setArama} />{arama.trim() && uygunKazanimlar.map(k => <TouchableOpacity key={`${k.sinif}-${k.kod}-${k.ad}`} style={[styles.kazanimKart, seciliKazanim?.kod === k.kod && styles.kazanimSecili]} onPress={() => setSeciliKazanim(k)}><Text style={styles.kazanimKod}>{k.kod}</Text><Text style={styles.kazanimAd}>{k.ad}</Text></TouchableOpacity>)}{arama.trim() && uygunKazanimlar.length === 0 && <Text style={styles.bos}>Uygun kayıt bulunamadı.</Text>}</>}
        {manuelKonu && <TextInput style={styles.girdi} placeholder="Konu adı" value={konuAdi} onChangeText={setKonuAdi} autoFocus />}
        <TextInput style={styles.girdi} placeholder="Başlangıç sayfası" value={baslangicSayfa} onChangeText={setBaslangicSayfa} keyboardType="numeric" /><TextInput style={styles.girdi} placeholder="Bitiş sayfası" value={bitisSayfa} onChangeText={setBitisSayfa} keyboardType="numeric" />
        <TouchableOpacity style={styles.kaydetButon} onPress={konuEkle}><Text style={styles.kaydetMetni}>Kaydet</Text></TouchableOpacity><TouchableOpacity style={styles.iptalButon} onPress={() => setKonuModal(false)}><Text style={styles.iptalMetni}>İptal</Text></TouchableOpacity>
      </ScrollView></View></View></Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ kapsayici:{flex:1,backgroundColor:'#F1F8E9'},baslik:{backgroundColor:'#2E7D32',padding:16},ogrenciAd:{color:'#fff',fontSize:18,fontWeight:'bold'},sinifAd:{color:'#A5D6A7',fontSize:13,marginTop:2},bolum:{margin:16,backgroundColor:'#fff',borderRadius:14,padding:16,elevation:2},bolumBaslik:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},bolumMetni:{fontSize:14,fontWeight:'bold',color:'#1B5E20',flex:1},ekleButon:{backgroundColor:'#2E7D32',borderRadius:8,paddingHorizontal:12,paddingVertical:6},ekleMetni:{color:'#fff',fontWeight:'bold',fontSize:13},kart:{borderWidth:1,borderColor:'#E8F5E9',borderRadius:10,padding:12,marginBottom:8,backgroundColor:'#F9FBE7'},kartSecili:{borderColor:'#2E7D32',backgroundColor:'#E8F5E9'},kartMetni:{fontSize:14,color:'#1B5E20',fontWeight:'600'},kartAlt:{fontSize:12,color:'#888',marginTop:2},konuKart:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#E8F5E9',borderRadius:10,padding:12,marginBottom:8},konuSolum:{width:28,height:28,borderRadius:14,backgroundColor:'#E8F5E9',alignItems:'center',justifyContent:'center',marginRight:12},konuSira:{color:'#2E7D32',fontWeight:'bold',fontSize:12},konuBilgi:{flex:1},konuAd:{fontSize:14,color:'#1B5E20',fontWeight:'600'},konuSayfa:{fontSize:12,color:'#888',marginTop:2},bos:{color:'#aaa',textAlign:'center',padding:16},modalArka:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',padding:20},modalIcerik:{backgroundColor:'#fff',borderRadius:16,padding:20},modalBaslik:{fontSize:18,fontWeight:'bold',color:'#1B5E20',marginBottom:14},girdi:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:12,fontSize:16,marginBottom:10,backgroundColor:'#fff'},kaydetButon:{backgroundColor:'#2E7D32',borderRadius:10,padding:14,alignItems:'center',marginBottom:8},kaydetMetni:{color:'#fff',fontWeight:'bold',fontSize:15},iptalButon:{padding:12,alignItems:'center'},iptalMetni:{color:'#888',fontSize:14},secimSatir:{flexDirection:'row',gap:8,marginBottom:10},secim:{flex:1,borderWidth:1,borderColor:'#C8E6C9',borderRadius:9,padding:10,alignItems:'center'},secimAktif:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},secimText:{fontSize:12,color:'#333'},secimTextAktif:{color:'#fff',fontWeight:'bold'},kucukBilgi:{fontSize:12,color:'#558B2F',marginBottom:8},kazanimKart:{borderWidth:1,borderColor:'#E8F5E9',borderRadius:9,padding:10,marginBottom:7,backgroundColor:'#F9FBE7'},kazanimSecili:{borderColor:'#2E7D32',backgroundColor:'#E8F5E9'},kazanimKod:{fontSize:11,color:'#2E7D32',fontWeight:'bold'},kazanimAd:{fontSize:13,color:'#333',marginTop:2} });
