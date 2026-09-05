import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, ActivityIndicator
} from 'react-native';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function OgrenciEkrani({ route, navigation }) {
  const { sinif } = route.params || {};
  const [ogrenciler, setOgrenciler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [modalAcik, setModalAcik] = useState(false);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [telefon, setTelefon] = useState('');
  const uid = auth.currentUser.uid;

  useEffect(() => { ogrencileriYukle(); }, []);

  const ogrencileriYukle = async () => {
    setYukleniyor(true);
    try {
      const q = query(
        collection(db, 'ogrenciler'),
        where('sinifId', '==', sinif.id),
        where('uid', '==', uid)
      );
      const snap = await getDocs(q);
      setOgrenciler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { Alert.alert('Hata', 'Öğrenciler yüklenemedi.'); }
    setYukleniyor(false);
  };

  const ogrenciEkle = async () => {
    if (!ad.trim() || !soyad.trim()) { Alert.alert('Hata', 'Ad ve soyad zorunludur.'); return; }
    try {
      await addDoc(collection(db, 'ogrenciler'), {
        ad: ad.trim(), soyad: soyad.trim(),
        adSoyad: `${ad.trim()} ${soyad.trim()}`,
        telefon: telefon.trim(),
        sinifId: sinif.id, sinifAd: sinif.ad,
        okulId: sinif.okulId, okulAd: sinif.okulAd,
        uid, olusturulma: new Date().toISOString()
      });
      setAd(''); setSoyad(''); setTelefon('');
      setModalAcik(false);
      ogrencileriYukle();
    } catch (e) { Alert.alert('Hata', 'Öğrenci eklenemedi.'); }
  };

  const ogrenciSil = (id) => {
    Alert.alert('Sil', 'Bu öğrenciyi silmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        const koleksiyonlar=['odevler','yoklamalar','kitaplar','konular'];
        for(const k of koleksiyonlar){
          try{const snap=await getDocs(query(collection(db,k),where('ogrenciId','==',id),where('uid','==',uid)));for(const x of snap.docs)await deleteDoc(x.ref);}catch(e){}
          try{const snap=await getDocs(query(collection(db,k),where('hedefOgrenciIds','array-contains',id),where('uid','==',uid)));for(const x of snap.docs){const d=x.data();if(k==='odevler'){const ids=(d.hedefOgrenciIds||[]).filter(x=>x!==id);const durumlar={...(d.ogrenciDurumlari||{})};const gecmis={...(d.durumGecmisi||{})};delete durumlar[id];delete gecmis[id];if(ids.length===0) await deleteDoc(x.ref); else await updateDoc(x.ref,{hedefOgrenciIds:ids,hedefOgrenciAdlari:(d.hedefOgrenciAdlari||[]).filter((_,i)=>(d.hedefOgrenciIds||[])[i]!==id),ogrenciDurumlari:durumlar,durumGecmisi:gecmis});}}}catch(e){}
        }
        await deleteDoc(doc(db, 'ogrenciler', id));
        ogrencileriYukle();
      }},
    ]);
  };

  if (yukleniyor) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2E7D32" />;

  return (
    <View style={styles.kapsayici}>
      <View style={styles.baslik}>
        <Text style={styles.sinifAd}>{sinif?.ad} - Öğrenciler</Text>
        <Text style={styles.sinifOkul}>{sinif?.okulAd}</Text>
      </View>

      <ScrollView style={styles.liste}>
        {ogrenciler.length === 0 && (
          <Text style={styles.bos}>Henüz öğrenci eklenmemiş.</Text>
        )}
        {ogrenciler.map((ogr, i) => (
          <TouchableOpacity
            key={ogr.id}
            style={styles.kart}
            onPress={() => navigation.navigate('Kitap', { ogrenci: ogr })}
            onLongPress={() => ogrenciSil(ogr.id)}
          >
            <View style={styles.numara}>
              <Text style={styles.numaraMetni}>{i + 1}</Text>
            </View>
            <View style={styles.bilgi}>
              <Text style={styles.isim}>{ogr.adSoyad}</Text>
              {ogr.telefon ? <Text style={styles.telefon}>📞 {ogr.telefon}</Text> : null}
            </View>
            <Text style={styles.ok}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.ekleButon} onPress={() => setModalAcik(true)}>
        <Text style={styles.ekleMetni}>+ Öğrenci Ekle</Text>
      </TouchableOpacity>

      <Modal visible={modalAcik} transparent animationType="slide">
        <View style={styles.modalArka}>
          <View style={styles.modalIcerik}>
            <Text style={styles.modalBaslik}>Öğrenci Ekle</Text>
            <TextInput style={styles.girdi} placeholder="Ad" value={ad} onChangeText={setAd} autoCapitalize="words" />
            <TextInput style={styles.girdi} placeholder="Soyad" value={soyad} onChangeText={setSoyad} autoCapitalize="words" />
            <TextInput style={styles.girdi} placeholder="Telefon (isteğe bağlı)" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" />
            <TouchableOpacity style={styles.kaydetButon} onPress={ogrenciEkle}>
              <Text style={styles.kaydetMetni}>Kaydet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iptalButon} onPress={() => setModalAcik(false)}>
              <Text style={styles.iptalMetni}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  kapsayici: { flex: 1, backgroundColor: '#F1F8E9' },
  baslik: { backgroundColor: '#2E7D32', padding: 16 },
  sinifAd: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  sinifOkul: { color: '#A5D6A7', fontSize: 13, marginTop: 2 },
  liste: { flex: 1, padding: 12 },
  bos: { color: '#aaa', textAlign: 'center', padding: 32, fontSize: 15 },
  kart: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 2 },
  numara: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  numaraMetni: { color: '#2E7D32', fontWeight: 'bold', fontSize: 13 },
  bilgi: { flex: 1 },
  isim: { fontSize: 15, fontWeight: '600', color: '#1B5E20' },
  telefon: { fontSize: 12, color: '#888', marginTop: 2 },
  ok: { fontSize: 24, color: '#ccc' },
  ekleButon: { margin: 12, backgroundColor: '#2E7D32', borderRadius: 12, padding: 16, alignItems: 'center' },
  ekleMetni: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  modalArka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalIcerik: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalBaslik: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20', marginBottom: 16 },
  girdi: { borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 },
  kaydetButon: { backgroundColor: '#2E7D32', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8 },
  kaydetMetni: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  iptalButon: { padding: 12, alignItems: 'center' },
  iptalMetni: { color: '#888', fontSize: 14 },
});
