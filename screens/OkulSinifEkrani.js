import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { collection, addDoc, getDocs, doc, query, where, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
import { auth, db, functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import kazanmlar from '../assets/kazanimlar.json';
import {donemYiliBugun,donemUygun,donemDuzenlemeyeAcik} from '../utils/donem';

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
  const okulEkle = async () => {
    if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için okul kayıtları değiştirilemez.');
    if(!yeniOkul.trim())return Alert.alert('Hata','Okul adı girin.');
    try{
      const ad=yeniOkul.trim();
      if(duzenlenenOkul){
        const [sinifSnap,ogrenciSnap]=await Promise.all([
          getDocs(query(collection(db,'siniflar'),where('okulId','==',duzenlenenOkul.id),where('uid','==',uid))),
          getDocs(query(collection(db,'ogrenciler'),where('okulId','==',duzenlenenOkul.id),where('uid','==',uid)))
        ]);
        const bagliKayitlar=[
          ...sinifSnap.docs.filter(x=>donemUygun(x.data(),donemYili)),
          ...ogrenciSnap.docs.filter(x=>donemUygun(x.data(),donemYili))
        ];
        for(let i=0;i<bagliKayitlar.length;i+=450){
          const batch=writeBatch(db);
          bagliKayitlar.slice(i,i+450).forEach(x=>batch.update(x.ref,{okulAd:ad}));
          await batch.commit();
        }
        await updateDoc(doc(db,'okullar',duzenlenenOkul.id),{ad});
      }else{
        await addDoc(collection(db,'okullar'),{ad,uid,donemYili,olusturulma:new Date().toISOString()});
      }
      kapatOkulModal();
      await okullariYukle();
    }catch(e){Alert.alert('Hata','Okul kaydedilemedi. Bağlı sınıf ve öğrenci kayıtları tekrar denenerek eşitlenebilir. '+(e?.message||''));}
  };
  const kapatOkulModal=()=>{setYeniOkul('');setDuzenlenenOkul(null);setModalAcik(false)};
  const okulDuzenle=(o)=>{setDuzenlenenOkul(o);setYeniOkul(o.ad);setModalAcik(true)};
  const kayitsizSinifGetir=async(okul)=>{
    const snap=await getDocs(query(collection(db,'siniflar'),where('uid','==',uid)));
    const mevcut=snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>x.ozelTur==='kayitsiz'&&x.okulId===(okul.id||'')&&Number(x.donemYili)===donemYili);
    if(mevcut)return mevcut;
    const ref=await addDoc(collection(db,'siniflar'),{ad:'Kayıtsız Öğrenciler',kademe:'',ders:'',okulId:okul.id||'',okulAd:okul.ad||'',uid,donemYili,ozelTur:'kayitsiz',olusturulma:new Date().toISOString()});
    return {id:ref.id,ad:'Kayıtsız Öğrenciler',okulId:okul.id||'',okulAd:okul.ad||'',ozelTur:'kayitsiz'};
  };
  const dersProgramlariniKaldir=async(sinifKayitlari)=>{
    for(const sinif of sinifKayitlari){
      const snap=await getDocs(query(collection(db,'dersler'),where('sinifId','==',sinif.id),where('uid','==',uid)));
      const donemProgramlari=snap.docs.filter(x=>donemUygun(x.data(),donemYili));
      for(let i=0;i<donemProgramlari.length;i+=400){
        const batch=writeBatch(db);
        donemProgramlari.slice(i,i+400).forEach(x=>batch.delete(x.ref));
        await batch.commit();
      }
    }
  };
  const okulSil=async(okul)=>{
    if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için okul kaldırılamaz.');
    const kontrolEt=async()=>{
      const classesSnap=await getDocs(query(collection(db,'siniflar'),where('okulId','==',okul.id),where('uid','==',uid)));
      const schoolClasses=classesSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili));
      const regularClasses=schoolClasses.filter(x=>!x.ozelTur);
      const occupied=[];
      for(const cls of regularClasses){
        const students=await getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',cls.id),where('uid','==',uid)));
        const count=students.docs.filter(x=>donemUygun(x.data(),donemYili)).length;
        if(count)occupied.push(`${cls.ad}: ${count} öğrenci`);
      }
      const kayitsizClassIds=schoolClasses.filter(x=>x.ozelTur==='kayitsiz').map(x=>x.id);
      const allTeacherStudents=await getDocs(query(collection(db,'ogrenciler'),where('uid','==',uid)));
      const unregisteredStudents=allTeacherStudents.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(x=>donemUygun(x,donemYili)
          && (kayitsizClassIds.includes(x.sinifId)||(x.kayitsizMi===true&&x.okulId===okul.id)));
      return {schoolClasses,occupied,unregisteredStudents};
    };
    try{
      const preview=await kontrolEt();
      if(preview.occupied.length){
        return Alert.alert('Okul kaldırılamaz','Önce aşağıdaki sınıflardaki öğrencileri başka sınıflara veya aynı okulun Kayıtsız Öğrenciler alanına taşıyın.\n\n'+preview.occupied.join('\n'));
      }
      const irreversibleText=preview.unregisteredStudents.length
        ? `\n\n${preview.unregisteredStudents.length} kayıtsız öğrencinin bu öğretmene ait öğrenci kaydı, yoklama, ödev, kitap, konu ilerlemesi, ders/etüt geçmişi ve bildirimleri kalıcı olarak silinecek. Öğrencilerin genel uygulama hesapları ve diğer öğretmenlerle bağlantıları korunacak. Bu silme geri alınamaz.`
        : '\n\nKayıtsız öğrenci kaydı bulunmadı; öğrenci verisi silinmeyecek.';
      Alert.alert('Okulu Kaldır',`Okul ve ${preview.schoolClasses.length} sınıf aktif listeden kaldırılacak. Normal sınıflarda kayıtlı öğrenci bulunmadığı doğrulandı.${irreversibleText}`,[
        {text:'Vazgeç',style:'cancel'},
        {text:preview.unregisteredStudents.length?'Sil ve okulu kaldır':'Okulu kaldır',style:'destructive',onPress:async()=>{
          try{
            // Kilit, aynı anda başka bir oturumun yeni öğrenci eklemesini engeller.
            await updateDoc(doc(db,'okullar',okul.id),{
              arsivDurumu:'isleniyor',
              arsivBaslangic:new Date().toISOString(),
            });
            const latest=await kontrolEt();
            if(latest.occupied.length){
              await updateDoc(doc(db,'okullar',okul.id),{
                arsivDurumu:deleteField(),
                arsivBaslangic:deleteField(),
              });
              return Alert.alert('Okul kaldırılamaz','Kontrol sırasında sınıfa öğrenci eklendi. Okul kilidi kaldırıldı. Öğrencileri önce başka sınıfa taşıyın.\n\n'+latest.occupied.join('\n'));
            }
            const previewIds=preview.unregisteredStudents.map(x=>x.id).sort();
            const latestIds=latest.unregisteredStudents.map(x=>x.id).sort();
            if(JSON.stringify(previewIds)!==JSON.stringify(latestIds)){
              await updateDoc(doc(db,'okullar',okul.id),{
                arsivDurumu:deleteField(),
                arsivBaslangic:deleteField(),
              });
              Alert.alert('Öğrenci listesi değişti','Silinecek kayıtsız öğrenci sayısı değişti. Güncel liste yeniden kontrol edilecek.');
              return okulSil(okul);
            }
            const remove=httpsCallable(functions,'ogretmenOgrenciKaydiniKaliciSil');
            for(const student of latest.unregisteredStudents){
              await remove({ogrenciKayitId:student.id,confirm:true});
            }
            await dersProgramlariniKaldir(latest.schoolClasses);
            for(let i=0;i<latest.schoolClasses.length;i+=400){
              const batch=writeBatch(db);
              latest.schoolClasses.slice(i,i+400).forEach(x=>batch.update(doc(db,'siniflar',x.id),{
                arsivlendi:true,arsivDurumu:'tamamlandi',arsivTarihi:new Date().toISOString(),
              }));
              await batch.commit();
            }
            await updateDoc(doc(db,'okullar',okul.id),{
              arsivlendi:true,arsivDurumu:'tamamlandi',arsivTarihi:new Date().toISOString(),
            });
            if(seciliOkul?.id===okul.id){setSeciliOkul(null);setSiniflar([])}
            await okullariYukle();
            Alert.alert('Tamamlandı',latest.unregisteredStudents.length
              ? `Okul kaldırıldı. ${latest.unregisteredStudents.length} kayıtsız öğrenciye ait yalnızca sizin öğretmen kayıtlarınız ve ilişkili veriler silindi; genel öğrenci hesapları ve diğer öğretmen bağlantıları korundu.`
              : 'Okul ve boş sınıfları arşivlendi. Öğrenci verisi silinmedi.');
          }catch(e){
            // Hata durumunda isleniyor kilidi korunur; tekrar denemede kalan işlem devam eder.
            Alert.alert('İşlem tamamlanamadı','Okul kaldırma işlemi tamamlanamadı. Güvenlik için okul geçici olarak kilitli tutuldu; aynı işlemi yeniden deneyebilirsiniz. Daha önce tamamlanan kalıcı öğrenci silme adımları geri alınamaz. '+(e?.message||''));
            await okullariYukle();
          }
        }}
      ]);
    }catch(e){Alert.alert('Okul kontrol edilemedi','Silme öncesi öğrenci ve sınıf kontrolleri tamamlanamadı; hiçbir kayıt silinmedi. '+(e?.message||''));}
  };
  const siniflariYukle=async(o)=>{setSeciliOkul(o);try{const q=query(collection(db,'siniflar'),where('okulId','==',o.id),where('uid','==',uid));const s=await getDocs(q);setSiniflar(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)&&!x.arsivlendi));}catch(e){Alert.alert('Hata','Sınıflar yüklenemedi.');}};
  const sinifEkle=async()=>{
    if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için sınıf kayıtları değiştirilemez.');
    if(!yeniSinif.trim()||!seciliKademe||!seciliDers)return Alert.alert('Eksik bilgi','Sınıf adı, kademe ve ders seçin.');
    try{
      const data={ad:yeniSinif.trim(),kademe:seciliKademe,ders:seciliDers,okulId:seciliOkul.id,okulAd:seciliOkul.ad,uid};
      if(duzenlenenSinif){
        const sinifId=duzenlenenSinif.id;
        const [ogrenciSnap,kitapSnap,konuSnap]=await Promise.all([
          getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',sinifId),where('uid','==',uid))),
          getDocs(query(collection(db,'kitaplar'),where('sinifId','==',sinifId),where('uid','==',uid))),
          getDocs(query(collection(db,'konular'),where('sinifId','==',sinifId),where('uid','==',uid)))
        ]);
        const bagliKayitlar=[
          ...ogrenciSnap.docs.filter(x=>donemUygun(x.data(),donemYili)),
          ...kitapSnap.docs.filter(x=>donemUygun(x.data(),donemYili)),
          ...konuSnap.docs.filter(x=>donemUygun(x.data(),donemYili))
        ];
        for(let i=0;i<bagliKayitlar.length;i+=450){
          const batch=writeBatch(db);
          bagliKayitlar.slice(i,i+450).forEach(x=>batch.update(x.ref,{sinifAd:data.ad}));
          await batch.commit();
        }
        await updateDoc(doc(db,'siniflar',sinifId),data);
      }else{
        await addDoc(collection(db,'siniflar'),{...data,donemYili,olusturulma:new Date().toISOString()});
      }
      kapatSinifModal();
      await siniflariYukle(seciliOkul);
    }catch(e){Alert.alert('Hata','Sınıf kaydedilemedi. Bağlı öğrenci, kitap ve konu kayıtları tekrar denenerek eşitlenebilir. '+(e?.message||''));}
  };
  const kapatSinifModal=()=>{setYeniSinif('');setSeciliKademe('');setSeciliDers('');setDersArama('');setDuzenlenenSinif(null);setSinifModalAcik(false)};
  const sinifDuzenle=(s)=>{setDuzenlenenSinif(s);setYeniSinif(s.ad||'');setSeciliKademe(s.kademe||'');setSeciliDers(s.ders||'');setDersArama(s.ders||'');setSinifModalAcik(true)};
  const sinifSil=(sinifKaydi)=>{
    if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için sınıf kaldırılamaz.');
    if(sinifKaydi.ozelTur)return Alert.alert('İşlem yapılamadı','Kayıtsız Öğrenciler alanı doğrudan kaldırılamaz.');
    Alert.alert('Sınıfı Kaldır','Sınıfta kayıtlı öğrenci varsa işlem yapılmayacak. Boş sınıf aktif listeden arşivlenerek kaldırılacak; geçmiş kayıtlar ve tarihsel sınıf referansları korunacak.',[
      {text:'İptal',style:'cancel'},
      {text:'Boş sınıfı kaldır',style:'destructive',onPress:async()=>{
        try{
          const students=await getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',sinifKaydi.id),where('uid','==',uid)));
          const count=students.docs.filter(x=>donemUygun(x.data(),donemYili)).length;
          if(count){
            return Alert.alert('Sınıf kaldırılamaz',`Bu sınıfta ${count} kayıtlı öğrenci var. Önce öğrencileri başka bir sınıfa veya aynı okulun Kayıtsız Öğrenciler alanına taşıyın.`);
          }
          await dersProgramlariniKaldir([sinifKaydi]);
          await updateDoc(doc(db,'siniflar',sinifKaydi.id),{arsivlendi:true,arsivDurumu:'tamamlandi',arsivTarihi:new Date().toISOString()});
          await siniflariYukle(seciliOkul);
          Alert.alert('Tamamlandı','Boş sınıf aktif listeden kaldırıldı. Geçmiş kayıtlar ve sınıfın tarihsel referansı korundu.');
        }catch(e){Alert.alert('İşlem tamamlanamadı','Sınıf kaldırılamadı. Kayıtlar korunuyor. '+(e?.message||''));}
      }}
    ]);
  };


  if(yukleniyor) return <ActivityIndicator style={{flex:1}} size="large" color="#2E7D32"/>;
  return <SafeAreaView style={styles.kapsayici}><ScrollView contentContainerStyle={{paddingBottom:40}}>
    <View style={styles.bolum}><View style={styles.bolumBaslik}><Text style={styles.bolumMetni}>🏫 Okullarım</Text><TouchableOpacity style={styles.ekleButon} onPress={()=>{kapatOkulModal();setModalAcik(true)}}><Text style={styles.ekleMetni}>+ Okul Ekle</Text></TouchableOpacity></View>
    {okullar.length===0&&<Text style={styles.bos}>Henüz okul eklenmemiş.</Text>}
    {okullar.map(o=><View key={o.id} style={[styles.kart,seciliOkul?.id===o.id&&styles.kartSecili]}><TouchableOpacity onPress={()=>siniflariYukle(o)}><Text style={styles.kartMetni}>🏫 {o.ad}</Text><Text style={styles.kartAlt}>Sınıfları görmek için dokunun</Text></TouchableOpacity><View style={styles.islemSatir}><TouchableOpacity style={styles.duzenle} onPress={()=>okulDuzenle(o)}><Text style={styles.islemYazi}>✏️ Düzenle</Text></TouchableOpacity><TouchableOpacity style={styles.sil} onPress={()=>okulSil(o)}><Text style={styles.silYazi}>📦 Arşivle</Text></TouchableOpacity></View></View>)}</View>
    {seciliOkul&&<View style={styles.bolum}><View style={styles.bolumBaslik}><Text style={styles.bolumMetni}>📋 {seciliOkul.ad} - Sınıflar</Text><TouchableOpacity style={styles.ekleButon} onPress={()=>{kapatSinifModal();setSinifModalAcik(true)}}><Text style={styles.ekleMetni}>+ Sınıf</Text></TouchableOpacity></View>
    {siniflar.length===0&&<Text style={styles.bos}>Bu okula sınıf eklenmemiş.</Text>}
    {siniflar.map(s=><View key={s.id} style={styles.kart}><TouchableOpacity onPress={()=>navigation.navigate('Ogrenci',{sinif:s,donemYili})}><Text style={styles.kartMetni}>📋 {s.ad}</Text><Text style={styles.kartAlt}>{s.ozelTur?'Özel kayıt alanı • Ders programı ve sınıf ödevi kullanılamaz':`${s.kademe||'Kademe yok'} • ${s.ders||'Ders yok'}`}</Text></TouchableOpacity>{!s.ozelTur&&<View style={styles.islemSatir}><TouchableOpacity style={styles.duzenle} onPress={()=>sinifDuzenle(s)}><Text style={styles.islemYazi}>✏️ Düzenle</Text></TouchableOpacity><TouchableOpacity style={styles.sil} onPress={()=>sinifSil(s)}><Text style={styles.silYazi}>📦 Arşivle</Text></TouchableOpacity></View>}</View>)}</View>}
  </ScrollView>
  <Modal visible={modalAcik} transparent animationType="slide"><View style={styles.modalArka}><View style={styles.modalIcerik}><Text style={styles.modalBaslik}>{duzenlenenOkul?'Okulu Düzenle':'Okul Ekle'}</Text><TextInput style={styles.girdi} placeholder="Okul adını girin" value={yeniOkul} onChangeText={setYeniOkul}/><TouchableOpacity style={styles.kaydetButon} onPress={okulEkle}><Text style={styles.kaydetMetni}>Kaydet</Text></TouchableOpacity><TouchableOpacity style={styles.iptalButon} onPress={kapatOkulModal}><Text style={styles.iptalMetni}>İptal</Text></TouchableOpacity></View></View></Modal>
  <Modal visible={sinifModalAcik} transparent animationType="slide"><View style={styles.modalArka}><View style={[styles.modalIcerik,{maxHeight:'90%'}]}><ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.modalBaslik}>{duzenlenenSinif?'Sınıfı Düzenle':'Sınıf Ekle'}</Text><TextInput style={styles.girdi} placeholder="Örn: 9-A, 12-B, TYT Grubu" value={yeniSinif} onChangeText={setYeniSinif}/><Text style={styles.etiket}>Kademe</Text><View style={styles.cipler}>{KADEMELER.map(k=><TouchableOpacity key={k} style={[styles.cip,seciliKademe===k&&styles.cipAktif]} onPress={()=>setSeciliKademe(k)}><Text style={[styles.cipYazi,seciliKademe===k&&styles.cipYaziAktif]}>{k==='TYT'||k==='AYT'?k:k+'. Sınıf'}</Text></TouchableOpacity>)}</View><Text style={styles.etiket}>Ders</Text><TextInput style={styles.girdi} placeholder="Ders ara..." value={dersArama} onChangeText={setDersArama}/>{seciliDers?<View style={styles.seciliDers}><Text>Seçilen ders: <Text style={{fontWeight:'bold'}}>{seciliDers}</Text></Text><TouchableOpacity onPress={()=>setSeciliDers('')}><Text style={{color:'#C62828'}}>Değiştir</Text></TouchableOpacity></View>:gorunenDersler.map(d=><TouchableOpacity key={d} style={styles.dersSatir} onPress={()=>{setSeciliDers(d);setDersArama(d)}}><Text>{d}</Text></TouchableOpacity>)}<TouchableOpacity style={styles.kaydetButon} onPress={sinifEkle}><Text style={styles.kaydetMetni}>Kaydet</Text></TouchableOpacity><TouchableOpacity style={styles.iptalButon} onPress={kapatSinifModal}><Text style={styles.iptalMetni}>İptal</Text></TouchableOpacity></ScrollView></View></View></Modal>
  </SafeAreaView>;
}
const styles=StyleSheet.create({kapsayici:{flex:1,backgroundColor:'#F1F8E9'},bolum:{margin:16,backgroundColor:'#fff',borderRadius:14,padding:16,elevation:2},bolumBaslik:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},bolumMetni:{fontSize:15,fontWeight:'bold',color:'#1B5E20',flex:1},ekleButon:{backgroundColor:'#2E7D32',borderRadius:8,paddingHorizontal:12,paddingVertical:8},ekleMetni:{color:'#fff',fontWeight:'bold',fontSize:13},kart:{borderWidth:1,borderColor:'#E8F5E9',borderRadius:10,padding:14,marginBottom:8,backgroundColor:'#F9FBE7'},kartSecili:{borderColor:'#2E7D32',backgroundColor:'#E8F5E9'},kartMetni:{fontSize:15,color:'#1B5E20',fontWeight:'600'},kartAlt:{fontSize:12,color:'#777',marginTop:4},islemSatir:{flexDirection:'row',gap:8,marginTop:10},duzenle:{flex:1,backgroundColor:'#E3F2FD',padding:9,borderRadius:8,alignItems:'center'},sil:{flex:1,backgroundColor:'#FFEBEE',padding:9,borderRadius:8,alignItems:'center'},islemYazi:{color:'#1565C0',fontSize:12,fontWeight:'600'},silYazi:{color:'#C62828',fontSize:12,fontWeight:'600'},bos:{color:'#aaa',textAlign:'center',padding:16},modalArka:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'center',padding:20},modalIcerik:{backgroundColor:'#fff',borderRadius:16,padding:20,paddingBottom:28},modalBaslik:{fontSize:18,fontWeight:'bold',color:'#1B5E20',marginBottom:16},girdi:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:12,fontSize:16,marginBottom:12},kaydetButon:{backgroundColor:'#2E7D32',borderRadius:10,padding:14,alignItems:'center',marginTop:12,marginBottom:8},kaydetMetni:{color:'#fff',fontWeight:'bold'},iptalButon:{padding:12,alignItems:'center'},iptalMetni:{color:'#888'},etiket:{fontSize:13,fontWeight:'bold',color:'#2E7D32',marginBottom:7},cipler:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:14},cip:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:8,paddingHorizontal:10,paddingVertical:8},cipAktif:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},cipYazi:{fontSize:12},cipYaziAktif:{color:'#fff',fontWeight:'bold'},dersSatir:{padding:11,borderBottomWidth:1,borderBottomColor:'#eee'},seciliDers:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#E8F5E9',padding:12,borderRadius:9}});