import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import kazanmlar from '../assets/kazanimlar.json';
import {donemYiliBugun,donemUygun} from '../utils/donem';

const KADEMELER = ['1','2','3','4','5','6','7','8','9','10','11','12','TYT','AYT'];

export default function OkulSinifEkrani({ navigation,route }) {
  const [okullar, setOkullar] = useState([]); const [yukleniyor, setYukleniyor] = useState(true);
  const [modalAcik, setModalAcik] = useState(false); const [sinifModalAcik, setSinifModalAcik] = useState(false);
  const [yeniOkul, setYeniOkul] = useState(''); const [yeniSinif, setYeniSinif] = useState('');
  const [seciliKademe, setSeciliKademe] = useState(''); const [dersArama, setDersArama] = useState(''); const [seciliDers, setSeciliDers] = useState('');
  const [seciliOkul, setSeciliOkul] = useState(null); const [siniflar, setSiniflar] = useState([]);
  const [duzenlenenOkul, setDuzenlenenOkul] = useState(null); const [duzenlenenSinif, setDuzenlenenSinif] = useState(null);
  const uid = auth.currentUser?.uid; const donemYili=Number(route?.params?.donemYili||donemYiliBugun());
  const dersler = useMemo(() => [...new Set(kazanmlar.map(x => x.ders).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')), []);
  const gorunenDersler = useMemo(() => dersler.filter(d => d.toLocaleLowerCase('tr-TR').includes(dersArama.toLocaleLowerCase('tr-TR'))).slice(0,20), [dersler, dersArama]);

  useEffect(() => { okullariYukle(); }, [donemYili]);
  const okullariYukle = async () => { setYukleniyor(true); try { const q=query(collection(db,'okullar'),where('uid','==',uid)); const s=await getDocs(q); setOkullar(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)&&!x.arsivlendi)); } catch(e){Alert.alert('Hata','Okullar yüklenemedi.');} setYukleniyor(false); };
  const okulEkle = async () => { if(!yeniOkul.trim()) return Alert.alert('Hata','Okul adı girin.'); try { if(duzenlenenOkul) await updateDoc(doc(db,'okullar',duzenlenenOkul.id),{ad:yeniOkul.trim()}); else await addDoc(collection(db,'okullar'),{ad:yeniOkul.trim(),uid,donemYili,olusturulma:new Date().toISOString()}); kapatOkulModal(); okullariYukle(); } catch(e){Alert.alert('Hata','Okul kaydedilemedi.');} };
  const kapatOkulModal=()=>{setYeniOkul('');setDuzenlenenOkul(null);setModalAcik(false)};
  const okulDuzenle=(o)=>{setDuzenlenenOkul(o);setYeniOkul(o.ad);setModalAcik(true)};
  const kayitsizSinifGetir=async(okul)=>{
    const snap=await getDocs(query(collection(db,'siniflar'),where('uid','==',uid)));
    const mevcut=snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>x.ozelTur==='kayitsiz'&&x.okulId===(okul.id||'')&&Number(x.donemYili)===donemYili);
    if(mevcut)return mevcut;
    const ref=await addDoc(collection(db,'siniflar'),{ad:'Kayıtsız Öğrenciler',kademe:'',ders:'',okulId:okul.id||'',okulAd:okul.ad||'',uid,donemYili,ozelTur:'kayitsiz',olusturulma:new Date().toISOString()});
    return {id:ref.id,ad:'Kayıtsız Öğrenciler',okulId:okul.id||'',okulAd:okul.ad||'',ozelTur:'kayitsiz'};
  };
  const ogrencileriKorumaliTasi=async(sinifKayitlari,hedef)=>{
    const ogrenciler=[];
    for(const sinif of sinifKayitlari){
      const snap=await getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',sinif.id),where('uid','==',uid)));
      snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>donemUygun(o,donemYili)).forEach(o=>ogrenciler.push({ogrenci:o,sinif}));
    }
    for(let i=0;i<ogrenciler.length;i+=400){
      const batch=writeBatch(db);
      ogrenciler.slice(i,i+400).forEach(({ogrenci:o,sinif})=>{
        batch.update(doc(db,'ogrenciler',o.id),{
          sinifGecmisi:arrayUnion({sinifId:o.sinifId,sinifAd:o.sinifAd||sinif.ad,okulId:o.okulId||sinif.okulId||'',okulAd:o.okulAd||sinif.okulAd||'',donemYili,tarih:new Date().toISOString(),neden:'sinif_arsivleme'}),
          sinifId:hedef.id,sinifAd:hedef.ad,okulId:hedef.okulId||'',okulAd:hedef.okulAd||'',kademe:'',brans:'',kayitsizMi:true,kayitsizTarihi:new Date().toISOString()
        });
      });
      await batch.commit();
    }
  };
  const dersProgramlariniKaldir=async(sinifKayitlari)=>{
    for(const sinif of sinifKayitlari){
      const snap=await getDocs(query(collection(db,'dersler'),where('sinifId','==',sinif.id),where('uid','==',uid)));
      for(let i=0;i<snap.docs.length;i+=400){
        const batch=writeBatch(db);
        snap.docs.slice(i,i+400).forEach(x=>batch.delete(x.ref));
        await batch.commit();
      }
    }
  };
  const okulSil=(okul)=>Alert.alert('Okulu Arşivle','Okul ve sınıfları aktif listeden kaldırılacak. Bu okuldaki öğrenciler Kayıtsız Öğrenciler sınıfına taşınacak; geçmiş ders notları, yoklamalar, ödevler, kitaplar ve konu kayıtları korunacak. Bu işlem geri alınamaz.',[{text:'İptal',style:'cancel'},{text:'Okulu arşivle',style:'destructive',onPress:async()=>{
    try{
      await updateDoc(doc(db,'okullar',okul.id),{arsivDurumu:'isleniyor',arsivBaslangic:new Date().toISOString()});
      const snap=await getDocs(query(collection(db,'siniflar'),where('okulId','==',okul.id),where('uid','==',uid)));
      const okulSiniflari=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!x.ozelTur);
      const hedef=await kayitsizSinifGetir(okul);
      await ogrencileriKorumaliTasi(okulSiniflari,hedef);
      await dersProgramlariniKaldir(okulSiniflari);
      for(let i=0;i<okulSiniflari.length;i+=400){
        const batch=writeBatch(db);
        okulSiniflari.slice(i,i+400).forEach(x=>batch.update(doc(db,'siniflar',x.id),{arsivlendi:true,arsivTarihi:new Date().toISOString()}));
        await batch.commit();
      }
      await updateDoc(doc(db,'okullar',okul.id),{arsivlendi:true,arsivDurumu:'tamamlandi',arsivTarihi:new Date().toISOString()});
      if(seciliOkul?.id===okul.id){setSeciliOkul(null);setSiniflar([])}
      await okullariYukle();
      Alert.alert('Tamamlandı','Okul arşivlendi. Öğrenciler ve geçmiş kayıtları korundu.');
    }catch(e){Alert.alert('İşlem tamamlanamadı','Arşivleme kaldığı yerden tekrar başlatılabilir. Mevcut kayıtlar silinmedi. '+(e?.message||''));}
  }}]);
  const siniflariYukle=async(o)=>{setSeciliOkul(o);try{const q=query(collection(db,'siniflar'),where('okulId','==',o.id),where('uid','==',uid));const s=await getDocs(q);setSiniflar(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)&&!x.arsivlendi));}catch(e){Alert.alert('Hata','Sınıflar yüklenemedi.');}};
  const sinifEkle=async()=>{if(!yeniSinif.trim()||!seciliKademe||!seciliDers) return Alert.alert('Eksik bilgi','Sınıf adı, kademe ve ders seçin.');try{const data={ad:yeniSinif.trim(),kademe:seciliKademe,ders:seciliDers,okulId:seciliOkul.id,okulAd:seciliOkul.ad,uid};if(duzenlenenSinif) await updateDoc(doc(db,'siniflar',duzenlenenSinif.id),data);else await addDoc(collection(db,'siniflar'),{...data,donemYili,olusturulma:new Date().toISOString()});kapatSinifModal();siniflariYukle(seciliOkul);}catch(e){Alert.alert('Hata','Sınıf kaydedilemedi.');}};
  const kapatSinifModal=()=>{setYeniSinif('');setSeciliKademe('');setSeciliDers('');setDersArama('');setDuzenlenenSinif(null);setSinifModalAcik(false)};
  const sinifDuzenle=(s)=>{setDuzenlenenSinif(s);setYeniSinif(s.ad||'');setSeciliKademe(s.kademe||'');setSeciliDers(s.ders||'');setDersArama(s.ders||'');setSinifModalAcik(true)};
  const sinifSil=(sinifKaydi)=>Alert.alert('Sınıfı Kaldır','Öğrenciler aynı okul içindeki Kayıtsız Öğrenciler sınıfına taşınacak. Ders programı kaldırılacak; geçmiş ders notları, yoklamalar, ödevler, kitaplar ve konu kayıtları silinmeyecek.',[{text:'İptal',style:'cancel'},{text:'Sınıfı kaldır',style:'destructive',onPress:async()=>{
    if(sinifKaydi.ozelTur)return Alert.alert('İşlem yapılamadı','Kayıtsız Öğrenciler sınıfı doğrudan kaldırılamaz.');
    try{
      const hedef=await kayitsizSinifGetir({id:sinifKaydi.okulId||'',ad:sinifKaydi.okulAd||''});
      await ogrencileriKorumaliTasi([sinifKaydi],hedef);
      await dersProgramlariniKaldir([sinifKaydi]);
      await updateDoc(doc(db,'siniflar',sinifKaydi.id),{arsivlendi:true,arsivTarihi:new Date().toISOString()});
      await siniflariYukle(seciliOkul);
      Alert.alert('Tamamlandı','Sınıf arşivlendi. Öğrenciler ve geçmiş kayıtları korundu.');
    }catch(e){Alert.alert('İşlem tamamlanamadı','Sınıf kaldırma işlemi tamamlanamadı. Kayıtlar silinmedi; tekrar deneyebilirsiniz. '+(e?.message||''));}
  }}]);

  if(yukleniyor) return <ActivityIndicator style={{flex:1}} size="large" color="#2E7D32"/>;
  return <SafeAreaView style={styles.kapsayici}><ScrollView contentContainerStyle={{paddingBottom:40}}>
    <View style={styles.bolum}><View style={styles.bolumBaslik}><Text style={styles.bolumMetni}>🏫 Okullarım</Text><TouchableOpacity style={styles.ekleButon} onPress={()=>{kapatOkulModal();setModalAcik(true)}}><Text style={styles.ekleMetni}>+ Okul Ekle</Text></TouchableOpacity></View>
    {okullar.length===0&&<Text style={styles.bos}>Henüz okul eklenmemiş.</Text>}
    {okullar.map(o=><View key={o.id} style={[styles.kart,seciliOkul?.id===o.id&&styles.kartSecili]}><TouchableOpacity onPress={()=>siniflariYukle(o)}><Text style={styles.kartMetni}>🏫 {o.ad}</Text><Text style={styles.kartAlt}>Sınıfları görmek için dokunun</Text></TouchableOpacity><View style={styles.islemSatir}><TouchableOpacity style={styles.duzenle} onPress={()=>okulDuzenle(o)}><Text style={styles.islemYazi}>✏️ Düzenle</Text></TouchableOpacity><TouchableOpacity style={styles.sil} onPress={()=>okulSil(o)}><Text style={styles.silYazi}>📦 Arşivle</Text></TouchableOpacity></View></View>)}</View>
    {seciliOkul&&<View style={styles.bolum}><View style={styles.bolumBaslik}><Text style={styles.bolumMetni}>📋 {seciliOkul.ad} - Sınıflar</Text><TouchableOpacity style={styles.ekleButon} onPress={()=>{kapatSinifModal();setSinifModalAcik(true)}}><Text style={styles.ekleMetni}>+ Sınıf</Text></TouchableOpacity></View>
    {siniflar.length===0&&<Text style={styles.bos}>Bu okula sınıf eklenmemiş.</Text>}
    {siniflar.map(s=><View key={s.id} style={styles.kart}><TouchableOpacity onPress={()=>navigation.navigate('Ogrenci',{sinif:s,donemYili})}><Text style={styles.kartMetni}>📋 {s.ad}</Text><Text style={styles.kartAlt}>{s.kademe||'Kademe yok'} • {s.ders||'Ders yok'}</Text></TouchableOpacity><View style={styles.islemSatir}><TouchableOpacity style={styles.duzenle} onPress={()=>sinifDuzenle(s)}><Text style={styles.islemYazi}>✏️ Düzenle</Text></TouchableOpacity><TouchableOpacity style={styles.sil} onPress={()=>sinifSil(s)}><Text style={styles.silYazi}>📦 Arşivle</Text></TouchableOpacity></View></View>)}</View>}
  </ScrollView>
  <Modal visible={modalAcik} transparent animationType="slide"><View style={styles.modalArka}><View style={styles.modalIcerik}><Text style={styles.modalBaslik}>{duzenlenenOkul?'Okulu Düzenle':'Okul Ekle'}</Text><TextInput style={styles.girdi} placeholder="Okul adını girin" value={yeniOkul} onChangeText={setYeniOkul}/><TouchableOpacity style={styles.kaydetButon} onPress={okulEkle}><Text style={styles.kaydetMetni}>Kaydet</Text></TouchableOpacity><TouchableOpacity style={styles.iptalButon} onPress={kapatOkulModal}><Text style={styles.iptalMetni}>İptal</Text></TouchableOpacity></View></View></Modal>
  <Modal visible={sinifModalAcik} transparent animationType="slide"><View style={styles.modalArka}><View style={[styles.modalIcerik,{maxHeight:'90%'}]}><ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.modalBaslik}>{duzenlenenSinif?'Sınıfı Düzenle':'Sınıf Ekle'}</Text><TextInput style={styles.girdi} placeholder="Örn: 9-A, 12-B, TYT Grubu" value={yeniSinif} onChangeText={setYeniSinif}/><Text style={styles.etiket}>Kademe</Text><View style={styles.cipler}>{KADEMELER.map(k=><TouchableOpacity key={k} style={[styles.cip,seciliKademe===k&&styles.cipAktif]} onPress={()=>setSeciliKademe(k)}><Text style={[styles.cipYazi,seciliKademe===k&&styles.cipYaziAktif]}>{k==='TYT'||k==='AYT'?k:k+'. Sınıf'}</Text></TouchableOpacity>)}</View><Text style={styles.etiket}>Ders</Text><TextInput style={styles.girdi} placeholder="Ders ara..." value={dersArama} onChangeText={setDersArama}/>{seciliDers?<View style={styles.seciliDers}><Text>Seçilen ders: <Text style={{fontWeight:'bold'}}>{seciliDers}</Text></Text><TouchableOpacity onPress={()=>setSeciliDers('')}><Text style={{color:'#C62828'}}>Değiştir</Text></TouchableOpacity></View>:gorunenDersler.map(d=><TouchableOpacity key={d} style={styles.dersSatir} onPress={()=>{setSeciliDers(d);setDersArama(d)}}><Text>{d}</Text></TouchableOpacity>)}<TouchableOpacity style={styles.kaydetButon} onPress={sinifEkle}><Text style={styles.kaydetMetni}>Kaydet</Text></TouchableOpacity><TouchableOpacity style={styles.iptalButon} onPress={kapatSinifModal}><Text style={styles.iptalMetni}>İptal</Text></TouchableOpacity></ScrollView></View></View></Modal>
  </SafeAreaView>;
}
const styles=StyleSheet.create({kapsayici:{flex:1,backgroundColor:'#F1F8E9'},bolum:{margin:16,backgroundColor:'#fff',borderRadius:14,padding:16,elevation:2},bolumBaslik:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},bolumMetni:{fontSize:15,fontWeight:'bold',color:'#1B5E20',flex:1},ekleButon:{backgroundColor:'#2E7D32',borderRadius:8,paddingHorizontal:12,paddingVertical:8},ekleMetni:{color:'#fff',fontWeight:'bold',fontSize:13},kart:{borderWidth:1,borderColor:'#E8F5E9',borderRadius:10,padding:14,marginBottom:8,backgroundColor:'#F9FBE7'},kartSecili:{borderColor:'#2E7D32',backgroundColor:'#E8F5E9'},kartMetni:{fontSize:15,color:'#1B5E20',fontWeight:'600'},kartAlt:{fontSize:12,color:'#777',marginTop:4},islemSatir:{flexDirection:'row',gap:8,marginTop:10},duzenle:{flex:1,backgroundColor:'#E3F2FD',padding:9,borderRadius:8,alignItems:'center'},sil:{flex:1,backgroundColor:'#FFEBEE',padding:9,borderRadius:8,alignItems:'center'},islemYazi:{color:'#1565C0',fontSize:12,fontWeight:'600'},silYazi:{color:'#C62828',fontSize:12,fontWeight:'600'},bos:{color:'#aaa',textAlign:'center',padding:16},modalArka:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'center',padding:20},modalIcerik:{backgroundColor:'#fff',borderRadius:16,padding:20,paddingBottom:28},modalBaslik:{fontSize:18,fontWeight:'bold',color:'#1B5E20',marginBottom:16},girdi:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:12,fontSize:16,marginBottom:12},kaydetButon:{backgroundColor:'#2E7D32',borderRadius:10,padding:14,alignItems:'center',marginTop:12,marginBottom:8},kaydetMetni:{color:'#fff',fontWeight:'bold'},iptalButon:{padding:12,alignItems:'center'},iptalMetni:{color:'#888'},etiket:{fontSize:13,fontWeight:'bold',color:'#2E7D32',marginBottom:7},cipler:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:14},cip:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:8,paddingHorizontal:10,paddingVertical:8},cipAktif:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},cipYazi:{fontSize:12},cipYaziAktif:{color:'#fff',fontWeight:'bold'},dersSatir:{padding:11,borderBottomWidth:1,borderBottomColor:'#eee'},seciliDers:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#E8F5E9',padding:12,borderRadius:9}});