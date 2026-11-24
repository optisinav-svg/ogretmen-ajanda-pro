import React,{useEffect,useMemo,useState,useLayoutEffect}from'react';
import{View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,Alert,ActivityIndicator,Modal,KeyboardAvoidingView,Platform}from'react-native';
import{collection,addDoc,getDocs,deleteDoc,doc,query,where,updateDoc,writeBatch}from'firebase/firestore';
import{auth,db}from'../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import kazanmlar from'../assets/kazanimlar.json';
import{donemYiliBugun,donemUygun,donemDuzenlemeyeAcik}from'../utils/donem';
const norm=x=>(x||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const duzeltTurkce=x=>{const s=String(x??'');if(!/[ÃÂÄÅ]/.test(s))return s;try{return decodeURIComponent(Array.from(s).map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''))}catch(e){return s}};
const sinifKodlari=x=>{const s=norm(x);if(s.includes('tyt')||s.includes('ayt'))return['21','22'];const m=s.match(/(^|\D)([1-9]|1[0-2])(?:\D|$)/);return m?[m[2]]:[]};
const sayfaAdedi=k=>Math.max(0,(parseInt(k?.bitisSayfa,10)||0)-(parseInt(k?.baslangicSayfa,10)||0)+1);
const pozitifTamSayi=x=>{const s=String(x??'').trim();if(!/^\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)&&n>0?n:null};
const KADEMELER=['1','2','3','4','5','6','7','8','9','10','11','12','TYT','AYT'];
function StudentSelector({sinif,uid,donemYili,onSelect}){const[l,setL]=useState([]);useEffect(()=>{if(!sinif)return;getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',sinif.id),where('uid','==',uid))).then(s=>setL(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)))).catch(()=>{})},[sinif?.id,uid,donemYili]);return <ScrollView style={{padding:12}}>{l.length?l.map(o=><TouchableOpacity key={o.id} style={st.student} onPress={()=>onSelect(o)}><Text style={st.studentName}>{o.adSoyad}</Text><Text style={st.muted}>Kitaplarını görmek için dokunun ›</Text></TouchableOpacity>):<Text style={st.empty}>Bu sınıfta öğrenci yok.</Text>}</ScrollView>}
export default function KitapEkrani({route,navigation}){
 const insets=useSafeAreaInsets();
 const donemYili=Number(route?.params?.donemYili||route?.params?.sinif?.donemYili||donemYiliBugun());const sinif=route?.params?.sinif||null;const uid=auth.currentUser?.uid;
 const[ogrenci,setOgrenci]=useState(route?.params?.ogrenci||null),[kitaplar,setKitaplar]=useState([]),[konular,setKonular]=useState([]),[odevler,setOdevler]=useState([]),[seciliKitap,setSeciliKitap]=useState(null),[yukleniyor,setYukleniyor]=useState(true),[kitapModal,setKitapModal]=useState(false),[konuModal,setKonuModal]=useState(false),[duzenlenenKitap,setDuzenlenenKitap]=useState(null),[duzenlenenKonu,setDuzenlenenKonu]=useState(null),[kitapAdi,setKitapAdi]=useState(''),[sayfaSayisi,setSayfaSayisi]=useState(''),[konuAdi,setKonuAdi]=useState(''),[baslangicSayfa,setBaslangicSayfa]=useState(''),[bitisSayfa,setBitisSayfa]=useState(''),[manuelKonu,setManuelKonu]=useState(true),[arama,setArama]=useState(''),[seciliKazanim,setSeciliKazanim]=useState(null),[sinifModal,setSinifModal]=useState(false),[kademe,setKademe]=useState(sinif?.kademe||''),[ders,setDers]=useState(sinif?.ders||''),[dersArama,setDersArama]=useState('');

 const[kutuphaneKitaplari,setKutuphaneKitaplari]=useState([]),[kutuphaneKonulari,setKutuphaneKonulari]=useState([]),[kutuphaneModal,setKutuphaneModal]=useState(false),[kutuphaneSecili,setKutuphaneSecili]=useState(null),[kutuphaneArama,setKutuphaneArama]=useState(''),[kutuphaneModu,setKutuphaneModu]=useState(false);

 const[kutuphaneOgrencileri,setKutuphaneOgrencileri]=useState([]),[kutuphaneSeciliOgrenciler,setKutuphaneSeciliOgrenciler]=useState([]),[atamaModal,setAtamaModal]=useState(false),[atamaYukleniyor,setAtamaYukleniyor]=useState(false);
 useLayoutEffect(()=>{navigation.setOptions({headerLeft:()=> <TouchableOpacity onPress={()=>{if(ogrenci){setOgrenci(null);setSeciliKitap(null)}else navigation.goBack()}}><Text style={{color:'#fff',fontSize:16}}>‹ Geri</Text></TouchableOpacity>})},[navigation,ogrenci]);
 const dersler=useMemo(()=>[...new Set(kazanmlar.map(x=>x.ders).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')),[kazanmlar]);const gorunenDersler=useMemo(()=>dersler.filter(x=>norm(x).includes(norm(dersArama))).slice(0,20),[dersler,dersArama]);
 const uygunKazanimlar=useMemo(()=>{const kod=sinifKodlari(kademe||ogrenci?.sinifAd||sinif?.ad);const a=norm(arama.trim());if(!ders||!a||!kod.length)return[];return kazanmlar.filter(x=>norm(x.ders)===norm(ders)&&kod.includes(String(x.sinif))).filter(x=>norm(`${x.kod} ${x.ad}`).includes(a)).slice(0,80)},[ders,kademe,ogrenci?.sinifAd,sinif?.ad,arama]);
 const yukle=async o=>{if(!o)return;setYukleniyor(true);try{const[ks,ts,os]=await Promise.all([getDocs(query(collection(db,'kitaplar'),where('ogrenciId','==',o.id),where('uid','==',uid))),getDocs(query(collection(db,'konular'),where('ogrenciId','==',o.id),where('uid','==',uid))),getDocs(query(collection(db,'odevler'),where('sinifId','==',o.sinifId),where('uid','==',uid)))]);setKitaplar(ks.docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)));setKonular(ts.docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)));setOdevler(os.docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)));}catch(e){Alert.alert('Hata','Kitap ve konu kayıtları yüklenemedi.')}setYukleniyor(false)};
 useEffect(()=>{if(ogrenci)yukle(ogrenci);else setYukleniyor(false)},[ogrenci?.id,donemYili]);


 const kutuphaneOgrencileriYukle=async()=>{
  if(!sinif?.id||!uid)return Alert.alert('Eksik bilgi','Öğrenci listesi için bir sınıf seçili olmalıdır.');
  setAtamaYukleniyor(true);
  try{
   const q=await getDocs(query(collection(db,'ogrenciler'),where('sinifId','==',sinif.id),where('uid','==',uid)));
   setKutuphaneOgrencileri(q.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)));
  }catch(e){Alert.alert('Hata','Öğrenciler yüklenemedi. '+(e?.message||''))}
  finally{setAtamaYukleniyor(false)}
 };

 const kitapKopyaVerisi=(kitap,konu,ogr,kitapRefId,zaman)=>({
  ad:konu.ad,
  baslangicSayfa:konu.baslangicSayfa,
  bitisSayfa:konu.bitisSayfa,
  kazanımKodu:konu['kazanımKodu']||'',
  kaynak:konu.kaynak||'manuel',
  kitapId:kitapRefId,
  kitapAd:kitap.ad,
  ogrenciId:ogr.ogrenciId||ogr.id,
  sinifId:ogr.sinifId,
  sinifAd:ogr.sinifAd||sinif?.ad||'',
  okulId:ogr.okulId||'',
  okulAd:ogr.okulAd||'',
  kademe:ogr.kademe||kademe||'',
  brans:ogr.brans||ders||'',
  uid,
  donemYili:ogr.donemYili||donemYili,
  kitapKutuphanesiId:kitap.id,
  kitapKutuphanesiKonuId:konu.id,
  olusturulma:zaman
 });

 // Eşitleme tekrar çalıştırıldığında eksik konu kopyalarını tamamlar; öğrenci ödev kayıtlarına dokunmaz.
 const kutuphaneAtamalariniEsitle=async(kitapId,{kitapData=null,konuId=null,konuData=null}={})=>{
  const [kitapSnap,konuSnap]=await Promise.all([
   getDocs(query(collection(db,'kitaplar'),where('uid','==',uid))),
   getDocs(query(collection(db,'konular'),where('uid','==',uid)))
  ]);
  const atamalar=kitapSnap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>
   x.kitapKutuphanesiId===kitapId&&donemDuzenlemeyeAcik(Number(x.donemYili))
  );
  const atamaMap=new Map(atamalar.map(x=>[x.id,x]));
  const mevcutKonular=konuSnap.docs.map(x=>({id:x.id,ref:x.ref,...x.data()})).filter(x=>atamaMap.has(x.kitapId));
  const islemler=[];
  for(const kitap of atamalar){
   if(kitapData)islemler.push({ref:doc(db,'kitaplar',kitap.id),data:kitapData});
   if(konuId&&konuData&&!mevcutKonular.some(x=>x.kitapId===kitap.id&&x.kitapKutuphanesiKonuId===konuId)){
    const yeniRef=doc(collection(db,'konular'));
    islemler.push({ref:yeniRef,data:kitapKopyaVerisi(
     {id:kitapId,ad:kitapData?.ad||kitap.ad},
     {id:konuId,...konuData},
     kitap,
     kitap.id,
     new Date().toISOString()
    ),create:true});
   }
  }
  for(const konu of mevcutKonular){
   if(konuData&&konu.kitapKutuphanesiKonuId===konuId){
    islemler.push({ref:doc(db,'konular',konu.id),data:{...konuData,kitapAd:kitapData?.ad||atamaMap.get(konu.kitapId)?.ad||konu.kitapAd}});
   }else if(kitapData&&kitapData.ad){
    islemler.push({ref:doc(db,'konular',konu.id),data:{kitapAd:kitapData.ad}});
   }
  }
  for(let i=0;i<islemler.length;i+=450){
   const batch=writeBatch(db);
   islemler.slice(i,i+450).forEach(x=>x.create?batch.set(x.ref,x.data):batch.update(x.ref,x.data));
   await batch.commit();
  }
  return {atamaSayisi:atamalar.length,guncellenenKayit:islemler.length};
 };

 const kitapAta=async()=>{
  if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrencilere kitap atanamaz.');
  if(!seciliKitap)return Alert.alert('Kitap seçilmedi','Önce bir kitap seçin.');
  if(!kutuphaneSeciliOgrenciler.length)return Alert.alert('Öğrenci seçilmedi','En az bir öğrenci seçin.');
  const kaynakKonular=kutuphaneKonulari.filter(x=>x.kitapId===seciliKitap.id);
  if(kaynakKonular.length+1>450)return Alert.alert('Atama yapılamadı','Bu kitapta çok fazla konu kaydı var. Güvenli aktarım sınırı 449 konudur.');
  let atanan=0,atlanan=0,onarilan=0;
  setAtamaYukleniyor(true);
  try{
   const [kitapSnap,konuSnap]=await Promise.all([
    getDocs(query(collection(db,'kitaplar'),where('uid','==',uid))),
    getDocs(query(collection(db,'konular'),where('uid','==',uid)))
   ]);
   const tumKitaplar=kitapSnap.docs.map(x=>({id:x.id,...x.data()}));
   const tumKonular=konuSnap.docs.map(x=>({id:x.id,...x.data()}));
   for(const ogrId of kutuphaneSeciliOgrenciler){
    const ogr=kutuphaneOgrencileri.find(x=>x.id===ogrId);
    if(!ogr)continue;
    const mevcutKitap=tumKitaplar.find(x=>
     x.ogrenciId===ogr.id&&Number(x.donemYili)===donemYili&&x.kitapKutuphanesiId===seciliKitap.id
    );
    const kitapRefId=mevcutKitap?.id||doc(collection(db,'kitaplar')).id;
    const kitapData={
     ad:seciliKitap.ad,
     sayfaSayisi:seciliKitap.sayfaSayisi,
     ogrenciId:ogr.id,
     ogrenciAd:ogr.adSoyad,
     sinifId:ogr.sinifId,
     sinifAd:ogr.sinifAd||sinif?.ad||'',
     okulId:ogr.okulId||'',
     okulAd:ogr.okulAd||'',
     kademe:ogr.kademe||kademe||'',
     brans:ogr.brans||ders||'',
     uid,
     donemYili,
     kitapKutuphanesiId:seciliKitap.id,
     olusturulma:mevcutKitap?.olusturulma||new Date().toISOString()
    };
    const existentes=tumKonular.filter(x=>x.kitapId===kitapRefId);
    const novas=kaynakKonular.filter(k=>!existentes.some(x=>x.kitapKutuphanesiKonuId===k.id));
    const batch=writeBatch(db);
    if(!mevcutKitap)batch.set(doc(db,'kitaplar',kitapRefId),kitapData);
    else if(mevcutKitap.ad!==kitapData.ad||Number(mevcutKitap.sayfaSayisi)!==Number(kitapData.sayfaSayisi)){
     batch.update(doc(db,'kitaplar',kitapRefId),{ad:kitapData.ad,sayfaSayisi:kitapData.sayfaSayisi});
    }
    existentes.filter(x=>x.kitapKutuphanesiKonuId&&x.kitapId===kitapRefId&&x.kitapAd!==seciliKitap.ad).forEach(x=>
     batch.update(doc(db,'konular',x.id),{kitapAd:seciliKitap.ad})
    );
    novas.forEach(k=>{
     const ref=doc(collection(db,'konular'));
     batch.set(ref,kitapKopyaVerisi(seciliKitap,k,ogr,kitapRefId,new Date().toISOString()));
    });
    if(!mevcutKitap||novas.length||existentes.some(x=>x.kitapKutuphanesiKonuId&&x.kitapId===kitapRefId&&x.kitapAd!==seciliKitap.ad)){
     await batch.commit();
     if(mevcutKitap)onarilan++;else atanan++;
    }else atlanan++;
    if(!mevcutKitap){
     tumKitaplar.push({id:kitapRefId,...kitapData});
    }
    novas.forEach(k=>existentes.push({kitapId:kitapRefId,kitapKutuphanesiKonuId:k.id}));
   }
   setAtamaModal(false);
   setKutuphaneSeciliOgrenciler([]);
   Alert.alert('Atama tamamlandı',atanan+' öğrenciye yeni kitap atandı.'+(onarilan? '\n'+onarilan+' mevcut atama eksik konu/kitap bilgileriyle tamamlandı.':'')+(atlanan?'\n'+atlanan+' öğrenci için kitap zaten günceldi.':''));
  }catch(e){
   Alert.alert('Atama hatası','İşlem sırasında hata oluştu. '+(e?.message||'')+'\nTamamlanan kayıtlar korunur; yeniden denediğinizde mevcut atamalar kontrol edilerek eksikler tamamlanır.');
  }finally{setAtamaYukleniyor(false)}
 };
 const kutuphaneYukle=async()=>{
  if(!uid)return;
  try{
   const[a,b]=await Promise.all([
    getDocs(query(collection(db,'kitapKutuphanesi'),where('uid','==',uid))),
    getDocs(query(collection(db,'kitapKutuphanesiKonulari'),where('uid','==',uid)))
   ]);
   setKutuphaneKitaplari(a.docs.map(x=>({id:x.id,...x.data()})));
   setKutuphaneKonulari(b.docs.map(x=>({id:x.id,...x.data()})));
  }catch(e){Alert.alert('Hata','Kitap kütüphanesi yüklenemedi. '+(e?.message||''))}
 };
 useEffect(()=>{kutuphaneYukle()},[uid]);


 const kitapFormAc=k=>{setDuzenlenenKitap(k);setKitapAdi(duzeltTurkce(k?.ad||''));setSayfaSayisi(k?.sayfaSayisi?String(k.sayfaSayisi):'');setKitapModal(true)};const kitapFormKapat=()=>{setKitapModal(false);setDuzenlenenKitap(null);setKitapAdi('');setSayfaSayisi('')};
 const kitapKaydet=async()=>{
 if(!kutuphaneModu&&!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrenci kitap kayıtları değiştirilemez.');
 if(!kitapAdi.trim())return Alert.alert('Hata','Kitap adı girin.');
 const toplamSayfa=pozitifTamSayi(sayfaSayisi);
 if(!toplamSayfa)return Alert.alert('Hata','Toplam sayfa sayısı zorunludur ve 0’dan büyük tam sayı olmalıdır.');
 try{
  if(kutuphaneModu){
   const mevcut=kutuphaneKonulari.filter(x=>x.kitapId===duzenlenenKitap?.id);
   if(duzenlenenKitap&&mevcut.length+1>450)return Alert.alert('Hata','Bu kitapta çok fazla konu var. Güvenli güncelleme sınırı 449 konudur.');
   const maxSayfa=mevcut.reduce((m,x)=>Math.max(m,Number(x.bitisSayfa)||0),0);
   if(duzenlenenKitap&&maxSayfa>toplamSayfa)return Alert.alert('Hata',`Kitabın sayfa sayısı mevcut konu kayıtları nedeniyle ${maxSayfa} sayfadan az olamaz.`);
   const yeniAd=kitapAdi.trim();
   if(duzenlenenKitap){
    const batch=writeBatch(db);
    batch.update(doc(db,'kitapKutuphanesi',duzenlenenKitap.id),{ad:yeniAd,sayfaSayisi:toplamSayfa});
    if(yeniAd!==duzenlenenKitap.ad)mevcut.forEach(x=>batch.update(doc(db,'kitapKutuphanesiKonulari',x.id),{kitapAd:yeniAd}));
    await batch.commit();
    try{
     await kutuphaneAtamalariniEsitle(duzenlenenKitap.id,{kitapData:{ad:yeniAd,sayfaSayisi:toplamSayfa}});
    }catch(esitlemeHatasi){
     Alert.alert('Kitap kaydedildi','Kütüphane güncellendi ancak bazı mevcut öğrenci atamalarına yansıtılamadı. Aynı kitabı yeniden kaydederseniz eşitleme tekrar denenir. '+(esitlemeHatasi?.message||''));
    }
    setSeciliKitap(prev=>prev?.id===duzenlenenKitap.id?{...prev,ad:yeniAd,sayfaSayisi:toplamSayfa}:prev);
   }else{
    await addDoc(collection(db,'kitapKutuphanesi'),{ad:yeniAd,sayfaSayisi:toplamSayfa,uid,olusturulma:new Date().toISOString()});
   }
   kitapFormKapat();await kutuphaneYukle();return;
  }
  if(duzenlenenKitap){
   const mevcutKonular=konular.filter(x=>x.kitapId===duzenlenenKitap.id);
   if(mevcutKonular.length+1>450)return Alert.alert('Hata','Bu kitapta çok fazla konu var. Güvenli güncelleme sınırı 449 konudur.');
   const maxKonuSayfasi=mevcutKonular.reduce((m,x)=>Math.max(m,Number(x.bitisSayfa)||0),0);
   if(maxKonuSayfasi>toplamSayfa)return Alert.alert('Hata',`Kitabın sayfa sayısı ${maxKonuSayfasi} sayfadan az olamaz. Mevcut bir konu bu sayfaya kadar kayıtlı.`);
   const yeniAd=kitapAdi.trim();const batch=writeBatch(db);
   batch.update(doc(db,'kitaplar',duzenlenenKitap.id),{ad:yeniAd,sayfaSayisi:toplamSayfa});
   if(yeniAd!==duzenlenenKitap.ad)mevcutKonular.forEach(x=>batch.update(doc(db,'konular',x.id),{kitapAd:yeniAd}));
   await batch.commit();
   setSeciliKitap(prev=>prev?.id===duzenlenenKitap.id?{...prev,ad:yeniAd,sayfaSayisi:toplamSayfa}:prev);
  }else{
   await addDoc(collection(db,'kitaplar'),{ad:kitapAdi.trim(),sayfaSayisi:toplamSayfa,ogrenciId:ogrenci.id,ogrenciAd:ogrenci.adSoyad,sinifId:ogrenci.sinifId,sinifAd:ogrenci.sinifAd,okulId:ogrenci.okulId,okulAd:ogrenci.okulAd,kademe,brans:ders,uid,donemYili,olusturulma:new Date().toISOString()});
  }
  kitapFormKapat();await yukle(ogrenci);
 }catch(e){Alert.alert('Hata','Kitap kaydedilemedi. '+(e?.message||''))}
};

 const kitapSil=k=>{if(!kutuphaneModu&&!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrenci kitapları silinemez.');Alert.alert('Kitabı Sil',kutuphaneModu?'Bu kitap yalnızca kütüphaneden silinecek. Öğrencilere atanmış kopyalar korunacak.':'Kitap ve içindeki konular silinecek.',[{text:'İptal',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{try{const koleksiyon=kutuphaneModu?'kitapKutuphanesiKonulari':'konular';const q=await getDocs(query(collection(db,koleksiyon),where('kitapId','==',k.id),where('uid','==',uid)));if(q.docs.length+1>450){Alert.alert('Hata','Bu kitapta çok fazla konu var. Güvenli silme sınırı 449 konudur.');return;}const batch=writeBatch(db);q.docs.forEach(x=>batch.delete(x.ref));batch.delete(doc(db,kutuphaneModu?'kitapKutuphanesi':'kitaplar',k.id));await batch.commit();setSeciliKitap(null);if(kutuphaneModu)await kutuphaneYukle();else await yukle(ogrenci)}catch(e){Alert.alert('Hata','Kitap silinemedi. '+(e?.message||''))}}}]);};

 const konuFormAc=k=>{setDuzenlenenKonu(k);setKonuAdi(duzeltTurkce(k?.ad||''));setBaslangicSayfa(k?.baslangicSayfa?String(k.baslangicSayfa):'');setBitisSayfa(k?.bitisSayfa?String(k.bitisSayfa):'');setManuelKonu(!k||k.kaynak==='manuel');setSeciliKazanim(k?{kod:k.kazanımKodu||'',ad:k.ad}:null);setKonuModal(true)};const konuFormKapat=()=>{setKonuModal(false);setDuzenlenenKonu(null);setKonuAdi('');setBaslangicSayfa('');setBitisSayfa('');setArama('');setSeciliKazanim(null);setManuelKonu(true)};
 const konuKaydet=async()=>{
 if(!kutuphaneModu&&!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrenci kitap konuları değiştirilemez.');
 if(!seciliKitap)return;
 const ad=manuelKonu?duzeltTurkce(konuAdi.trim()):duzeltTurkce(seciliKazanim?.ad?.trim());
 const bas=pozitifTamSayi(baslangicSayfa),bit=pozitifTamSayi(bitisSayfa);
 if(!ad)return Alert.alert('Hata','Konu seçin veya yazın.');
 if(!bas||!bit||bit<bas)return Alert.alert('Hata','Başlangıç ve bitiş sayfaları geçerli pozitif tam sayılar olmalı.');
 const toplamSayfa=pozitifTamSayi(seciliKitap.sayfaSayisi);
 if(!toplamSayfa)return Alert.alert('Hata','Bu kitabın toplam sayfa sayısı kayıtlı değil.');
 if(bit>toplamSayfa)return Alert.alert('Hata',`Bitiş sayfası kitabın toplam sayfası olan ${toplamSayfa} sayfayı aşamaz.`);
 const liste=kutuphaneModu?kutuphaneKonulari:konular;
 const cakisan=liste.find(x=>x.kitapId===seciliKitap.id&&x.id!==duzenlenenKonu?.id&&pozitifTamSayi(x.baslangicSayfa)&&pozitifTamSayi(x.bitisSayfa)&&bas<=Number(x.bitisSayfa)&&bit>=Number(x.baslangicSayfa));
 if(cakisan)return Alert.alert('Sayfa aralığı çakışıyor',`Bu konu, “${duzeltTurkce(cakisan.ad)}” konusunun ${cakisan.baslangicSayfa}-${cakisan.bitisSayfa}. sayfa aralığıyla çakışıyor.`);
 try{
  const data={ad,baslangicSayfa:bas,bitisSayfa:bit,kazanımKodu:manuelKonu?'':seciliKazanim?.kod||'',kaynak:manuelKonu?'manuel':'kazanım'};
  if(kutuphaneModu){
   let konuId=duzenlenenKonu?.id;
   if(duzenlenenKonu){
    await updateDoc(doc(db,'kitapKutuphanesiKonulari',konuId),data);
   }else{
    const ref=await addDoc(collection(db,'kitapKutuphanesiKonulari'),{...data,kitapId:seciliKitap.id,kitapAd:seciliKitap.ad,uid,olusturulma:new Date().toISOString()});
    konuId=ref.id;
   }
   try{
    await kutuphaneAtamalariniEsitle(seciliKitap.id,{konuId,konuData:data});
   }catch(esitlemeHatasi){
    Alert.alert('Konu kaydedildi','Kütüphane konusu güncellendi ancak bazı mevcut öğrenci kitaplarına yansıtılamadı. Aynı konuyu yeniden kaydettiğinizde eşitleme tekrar denenir. '+(esitlemeHatasi?.message||''));
   }
   konuFormKapat();await kutuphaneYukle();return;
  }
  if(duzenlenenKonu)await updateDoc(doc(db,'konular',duzenlenenKonu.id),data);
  else await addDoc(collection(db,'konular'),{...data,kitapId:seciliKitap.id,kitapAd:seciliKitap.ad,ogrenciId:ogrenci.id,sinifId:ogrenci.sinifId,sinifAd:ogrenci.sinifAd,okulId:ogrenci.okulId,okulAd:ogrenci.okulAd,kademe,brans:ders,uid,donemYili,olusturulma:new Date().toISOString()});
  konuFormKapat();await yukle(ogrenci);
 }catch(e){Alert.alert('Hata','Konu kaydedilemedi. '+(e?.message||''))}
};

 const konuSil=k=>{if(!kutuphaneModu&&!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrenci kitap konuları silinemez.');Alert.alert('Konuyu Sil',kutuphaneModu?'Kütüphaneden kaldırılacak. Daha önce öğrencilere atanmış kitaplarda ve geçmiş ödev kayıtlarında korunacak. Devam edilsin mi?':'Bu konu kaydı silinsin mi?',[{text:'İptal',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{try{await deleteDoc(doc(db,kutuphaneModu?'kitapKutuphanesiKonulari':'konular',k.id));if(kutuphaneModu)await kutuphaneYukle();else await yukle(ogrenci)}catch(e){Alert.alert('Hata','Konu silinemedi.')}}}]);};

 const konuOdevDurumu=k=>{const h=odevler.filter(o=>o.konuId===k.id&&((o.hedef==='sinif'&&o.sinifId===ogrenci?.sinifId)||(o.hedefOgrenciIds||[]).includes(ogrenci?.id)));if(!h.length)return null;const x=[...h].sort((a,b)=>new Date(b.olusturulma||0)-new Date(a.olusturulma||0))[0];return x.ogrenciDurumlari?.[ogrenci.id]||x.durum||'bekliyor'};
 const ilerleme=k=>{const ks=konular.filter(x=>x.kitapId===k.id),tam=ks.reduce((n,x)=>konuOdevDurumu(x)==='yapildi'?n+sayfaAdedi(x):n+0,0),top=parseInt(k.sayfaSayisi,10)||0;return{tam,top,yuzde:top?Math.min(100,Math.round(tam/top*100)):0}};
 if(yukleniyor)return <ActivityIndicator style={{flex:1}} size="large" color="#2E7D32"/>;

 if(kutuphaneModu)return <KeyboardAvoidingView style={st.wrap} behavior={Platform.OS==='ios'?'padding':'height'}>
  <View style={st.header}>
   <Text style={st.headerTitle}>Kitap Kütüphanem</Text>
   <Text style={st.headerSub}>Kitapları bir kez tanımlayın, istediğiniz öğrencilere atayın. Açık dönemdeki atamalar kitap ve konu düzenlemeleriyle eşitlenir; silinen kütüphane konuları eski öğrenci kayıtlarında korunur.</Text>
   <TouchableOpacity onPress={()=>{setKutuphaneModu(false);setSeciliKitap(null);setAtamaModal(false)}} style={{marginTop:10}}>
    <Text style={{color:'#fff',fontWeight:'bold'}}>← Öğrenci kitaplarına dön</Text>
   </TouchableOpacity>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+35}}>
   <View style={st.section}>
    <View style={st.sectionHead}>
     <Text style={st.sectionTitle}>Kütüphanedeki Kitaplar</Text>
     <TouchableOpacity style={st.smallBtn} onPress={()=>kitapFormAc()}>
      <Text style={st.smallBtnText}>+ Kitap ekle</Text>
     </TouchableOpacity>
    </View>
    {!kutuphaneKitaplari.length&&<Text style={st.empty}>Henüz kütüphaneye kitap eklenmemiş.</Text>}
    {kutuphaneKitaplari.map(k=>{
     const secili=seciliKitap?.id===k.id;
     const konuAdedi=kutuphaneKonulari.filter(x=>x.kitapId===k.id).length;
     return <View key={k.id} style={[st.book,secili&&{borderColor:'#2E7D32',borderWidth:2}]}>
      <TouchableOpacity style={{flex:1}} onPress={()=>setSeciliKitap(k)}>
       <Text style={st.bookName}>{duzeltTurkce(k.ad)}</Text>
       <Text style={st.muted}>{k.sayfaSayisi} sayfa • {konuAdedi} konu</Text>
      </TouchableOpacity>
      <View style={st.actions}>
       <TouchableOpacity onPress={()=>{setSeciliKitap(k);kitapFormAc(k)}}>
        <Text style={st.edit}>✏️</Text>
       </TouchableOpacity>
       <TouchableOpacity onPress={()=>kitapSil(k)}>
        <Text style={st.delete}>🗑️</Text>
       </TouchableOpacity>
      </View>
     </View>
    })}
   </View>
   {seciliKitap&&<View style={st.section}>
    <View style={st.sectionHead}>
     <Text style={st.sectionTitle}>{duzeltTurkce(seciliKitap.ad)} - Konular</Text>
     <TouchableOpacity style={st.smallBtn} onPress={()=>konuFormAc()}>
      <Text style={st.smallBtnText}>+ Konu</Text>
     </TouchableOpacity>
    </View>
    {kutuphaneKonulari.filter(k=>k.kitapId===seciliKitap.id).sort((a,b)=>(Number(a.baslangicSayfa)||0)-(Number(b.baslangicSayfa)||0)).map((k,i)=>
     <View key={k.id} style={st.topic}>
      <Text style={st.no}>{i+1}</Text>
      <View style={{flex:1}}>
       <Text style={st.topicName}>{k.ad}</Text>
       <Text style={st.muted}>Sayfa {k.baslangicSayfa}-{k.bitisSayfa} ({sayfaAdedi(k)} sayfa)</Text>
      </View>
      <View style={st.actions}>
       <TouchableOpacity onPress={()=>konuFormAc(k)}><Text style={st.edit}>✏️</Text></TouchableOpacity>
       <TouchableOpacity onPress={()=>konuSil(k)}><Text style={st.delete}>🗑️</Text></TouchableOpacity>
      </View>
     </View>
    )}
    <TouchableOpacity style={st.save} onPress={async()=>{
     setKutuphaneSeciliOgrenciler([]);
     await kutuphaneOgrencileriYukle();
     setAtamaModal(true);
    }}>
     <Text style={st.saveText}>Bu kitabı öğrencilere ata</Text>
    </TouchableOpacity>
   </View>}
  </ScrollView>

  <Modal visible={atamaModal} transparent animationType="slide" onRequestClose={()=>setAtamaModal(false)}>
   <View style={st.modalBg}>
    <View style={[st.modal,{maxHeight:'90%',paddingBottom:insets.bottom+24}]}>
     <Text style={st.modalTitle}>Öğrenci seçimi</Text>
     <Text style={st.muted}>{seciliKitap?.ad||''} kitabı seçilen öğrencilere ayrı ayrı kopyalanacak.</Text>
     {atamaYukleniyor&&!kutuphaneOgrencileri.length?<ActivityIndicator size="large" color="#2E7D32"/>:
      <ScrollView style={{marginTop:10}} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+16}}>
       {!kutuphaneOgrencileri.length&&<Text style={st.empty}>Bu sınıfta öğrenci bulunamadı.</Text>}
       {kutuphaneOgrencileri.map(o=>{
        const secili=kutuphaneSeciliOgrenciler.includes(o.id);
        return <TouchableOpacity key={o.id} onPress={()=>setKutuphaneSeciliOgrenciler(prev=>secili?prev.filter(x=>x!==o.id):[...prev,o.id])} style={[st.student,{borderWidth:1,borderColor:secili?'#2E7D32':'#eee',flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}>
         <Text style={st.studentName}>{o.adSoyad}</Text>
         <Text style={{fontWeight:'bold',color:secili?'#2E7D32':'#999'}}>{secili?'☑ Seçildi':'□ Seç'}</Text>
        </TouchableOpacity>
       })}
      </ScrollView>}
     <Text style={st.muted}>Seçilen öğrenci: {kutuphaneSeciliOgrenciler.length}</Text>
     <TouchableOpacity style={st.save} disabled={atamaYukleniyor} onPress={kitapAta}>
      <Text style={st.saveText}>{atamaYukleniyor?'İşleniyor...':'Seçilen öğrencilere ata'}</Text>
     </TouchableOpacity>
     <TouchableOpacity style={st.cancel} onPress={()=>setAtamaModal(false)}><Text>Vazgeç</Text></TouchableOpacity>
    </View>
   </View>
  </Modal>

  <Modal visible={kitapModal} transparent animationType="slide">
   <KeyboardAvoidingView style={st.modalBg} behavior={Platform.OS==='ios'?'padding':'height'}><View style={[st.modal,{maxHeight:'90%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+24}}>
    <Text style={st.modalTitle}>{duzenlenenKitap?'Kitabı Düzenle':'Kütüphaneye Kitap Ekle'}</Text>
    <TextInput style={st.input} placeholder="Kitap adı" value={kitapAdi} onChangeText={setKitapAdi}/>
    <TextInput style={st.input} placeholder="Toplam sayfa sayısı *" value={sayfaSayisi} onChangeText={setSayfaSayisi} keyboardType="numeric"/>
    <Text style={st.hint}>Toplam sayfa sayısı zorunludur.</Text>
    <TouchableOpacity style={st.save} onPress={kitapKaydet}><Text style={st.saveText}>{duzenlenenKitap?'Güncelle':'Kaydet'}</Text></TouchableOpacity>
    <TouchableOpacity style={st.cancel} onPress={kitapFormKapat}><Text>İptal</Text></TouchableOpacity>
   </ScrollView></View></KeyboardAvoidingView>
  </Modal>

  <Modal visible={konuModal} transparent animationType="slide">
   <KeyboardAvoidingView style={st.modalBg} behavior={Platform.OS==='ios'?'padding':'height'}><View style={[st.modal,{maxHeight:'92%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+24}}>
    <Text style={st.modalTitle}>{duzenlenenKonu?'Konuyu Düzenle':'Konu Ekle'}</Text>
    <View style={st.secimSatir}>
     <TouchableOpacity style={[st.secim,manuelKonu&&st.active]} onPress={()=>{setManuelKonu(true);setSeciliKazanim(null)}}><Text style={manuelKonu?st.activeText:st.secimText}>Kendim yazacağım</Text></TouchableOpacity>
     <TouchableOpacity style={[st.secim,!manuelKonu&&st.active]} onPress={()=>setManuelKonu(false)}><Text style={!manuelKonu?st.activeText:st.secimText}>Kazanımlardan seç</Text></TouchableOpacity>
    </View>
    {manuelKonu?<TextInput style={st.input} placeholder="Konu adı" value={konuAdi} onChangeText={setKonuAdi}/>:
     <View>
      <Text style={st.muted}>{kademe} • {ders} — sınıfa filtreli</Text>
      <TextInput style={st.input} placeholder="Konu / kazanım ara..." value={arama} onChangeText={setArama}/>
      {uygunKazanimlar.map(k=><TouchableOpacity key={k.kod} style={st.ders} onPress={()=>setSeciliKazanim(k)}><Text style={st.kod}>{k.kod}</Text><Text>{duzeltTurkce(k.ad)}</Text></TouchableOpacity>)}
     </View>}
    <TextInput style={st.input} placeholder="Başlangıç sayfası *" value={baslangicSayfa} onChangeText={setBaslangicSayfa} keyboardType="numeric"/>
    <TextInput style={st.input} placeholder="Bitiş sayfası *" value={bitisSayfa} onChangeText={setBitisSayfa} keyboardType="numeric"/>
    <Text style={st.hint}>Sayfa aralıkları çakışamaz.</Text>
    <TouchableOpacity style={st.save} onPress={konuKaydet}><Text style={st.saveText}>{duzenlenenKonu?'Güncelle':'Kaydet'}</Text></TouchableOpacity>
    <TouchableOpacity style={st.cancel} onPress={konuFormKapat}><Text>İptal</Text></TouchableOpacity>
   </ScrollView></View></KeyboardAvoidingView>
  </Modal>
 </KeyboardAvoidingView>;

 if(!ogrenci)return <View style={st.wrap}><View style={st.header}><Text style={st.headerTitle}>{sinif?.ad||'Öğrenci seçimi'}</Text><Text style={st.headerSub}>{kademe?`${kademe}. Sınıf`:''}{ders?` • ${ders}`:''}</Text></View><TouchableOpacity style={[st.info,{marginBottom:0}]} onPress={()=>{setSeciliKitap(null);setKutuphaneModu(true);}}><Text style={st.infoTitle}>📚 Kitap Kütüphanem</Text><Text style={st.muted}>Kitapları tanımlayın ve birden fazla öğrenciye atayın.</Text></TouchableOpacity>{(!kademe||!ders)&&<TouchableOpacity style={st.info} onPress={()=>setSinifModal(true)}><Text style={st.infoTitle}>Sınıf seviyesi ve ders seç</Text><Text style={st.muted}>Kitap ve konu takibi için sınıf bilgisini tamamlayın.</Text></TouchableOpacity>}<StudentSelector sinif={sinif} uid={uid} donemYili={donemYili} onSelect={setOgrenci}/><Modal visible={sinifModal} transparent animationType="slide"><KeyboardAvoidingView style={st.modalBg} behavior={Platform.OS==='ios'?'padding':'height'}><View style={[st.modal,{maxHeight:'90%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+24}}><Text style={st.modalTitle}>Sınıf Bilgisi</Text><Text style={st.label}>Kademe</Text><View style={st.chips}>{KADEMELER.map(k=><TouchableOpacity key={k} style={[st.chip,kademe===k&&st.active]} onPress={()=>setKademe(k)}><Text style={kademe===k?st.activeText:st.chipText}>{k==='TYT'||k==='AYT'?k:`${k}. Sınıf`}</Text></TouchableOpacity>)}</View><Text style={st.label}>Ders</Text><TextInput style={st.input} placeholder="Ders ara..." value={dersArama} onChangeText={setDersArama}/>{gorunenDersler.map(x=><TouchableOpacity key={x} style={st.ders} onPress={()=>{setDers(x);setDersArama(x)}}><Text>{x}</Text></TouchableOpacity>)}<TouchableOpacity style={st.save} onPress={async()=>{if(!kademe||!ders)return Alert.alert('Eksik bilgi','Kademe ve ders seçin.');if(route?.params?.ogrenci?.id)await updateDoc(doc(db,'ogrenciler',route.params.ogrenci.id),{kademe,brans:ders});setSinifModal(false)}}><Text style={st.saveText}>Kaydet</Text></TouchableOpacity></ScrollView></View></KeyboardAvoidingView></Modal></View>;
 const siraliKonular=konular.filter(k=>k.kitapId===seciliKitap?.id).sort((a,b)=>(Number(a.baslangicSayfa)||0)-(Number(b.baslangicSayfa)||0)||(Number(a.bitisSayfa)||0)-(Number(b.bitisSayfa)||0));
 return <KeyboardAvoidingView style={st.wrap} behavior={Platform.OS==='ios'?'padding':'height'}><View style={st.header}><Text style={st.headerTitle}>{ogrenci.adSoyad}</Text><Text style={st.headerSub}>{kademe?`${kademe}. Sınıf`:ogrenci.sinifAd}{ders?` • ${ders}`:''}{ogrenci.okulAd?` • ${ogrenci.okulAd}`:''}</Text></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:Math.max(110,insets.bottom+80)}}><View style={st.section}><View style={st.sectionHead}><Text style={st.sectionTitle}>📚 Kitaplar</Text><TouchableOpacity style={st.smallBtn} onPress={()=>kitapFormAc()}><Text style={st.smallBtnText}>+ Kitap</Text></TouchableOpacity></View>{kitaplar.length===0&&<Text style={st.empty}>Henüz kitap eklenmemiş.</Text>}{kitaplar.map(k=>{const p=ilerleme(k);return <View key={k.id} style={st.book}><TouchableOpacity style={{flex:1}} onPress={()=>setSeciliKitap(k)}><Text style={st.bookName}>📖 {duzeltTurkce(k.ad)}</Text><Text style={st.muted}>{k.sayfaSayisi} sayfa • %{p.yuzde} tamamlandı</Text><View style={st.track}><View style={[st.fill,{width:`${p.yuzde}%`}]}/></View></TouchableOpacity><View style={st.actions}><TouchableOpacity onPress={()=>kitapFormAc(k)}><Text style={st.edit}>✏️</Text></TouchableOpacity><TouchableOpacity onPress={()=>kitapSil(k)}><Text style={st.delete}>🗑️</Text></TouchableOpacity></View></View>})}</View>{seciliKitap&&<View style={st.section}><View style={st.sectionHead}><Text style={st.sectionTitle}>📑 {duzeltTurkce(seciliKitap.ad)} - Konular</Text><TouchableOpacity style={st.smallBtn} onPress={()=>konuFormAc()}><Text style={st.smallBtnText}>+ Konu</Text></TouchableOpacity></View>{siraliKonular.length===0&&<Text style={st.empty}>Henüz konu eklenmemiş.</Text>}{siraliKonular.map((k,i)=>{const d=konuOdevDurumu(k);return <View key={k.id} style={st.topic}><Text style={st.no}>{i+1}</Text><View style={{flex:1}}><Text style={st.topicName}>{k.kazanımKodu?`${k.kazanımKodu} — `:''}{duzeltTurkce(k.ad)}</Text><Text style={st.muted}>Sayfa {k.baslangicSayfa}-{k.bitisSayfa} ({sayfaAdedi(k)} sayfa)</Text>{d==='yapildi'?<Text style={st.done}>☑ Ödev tamamlandı</Text>:d?<Text style={st.pending}>☐ Ödev: {d==='gec'?'Geç getirdi':d==='yapilmadi'?'Yapmadı':'Bekliyor'}</Text>:null}</View><View style={st.actions}><TouchableOpacity onPress={()=>konuFormAc(k)}><Text style={st.edit}>✏️</Text></TouchableOpacity><TouchableOpacity onPress={()=>konuSil(k)}><Text style={st.delete}>🗑️</Text></TouchableOpacity></View></View>})}</View>}</ScrollView><Modal visible={kitapModal} transparent animationType="slide"><KeyboardAvoidingView style={st.modalBg} behavior={Platform.OS==='ios'?'padding':'height'}><View style={[st.modal,{maxHeight:'90%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+24}}><Text style={st.modalTitle}>{duzenlenenKitap?'Kitabı Düzenle':'Kitap Ekle'}</Text><TextInput style={st.input} placeholder="Kitap adı" value={kitapAdi} onChangeText={setKitapAdi}/><TextInput style={st.input} placeholder="Toplam sayfa sayısı *" value={sayfaSayisi} onChangeText={setSayfaSayisi} keyboardType="numeric"/><Text style={st.hint}>Toplam sayfa sayısı zorunludur.</Text><TouchableOpacity style={st.save} onPress={kitapKaydet}><Text style={st.saveText}>{duzenlenenKitap?'Güncelle':'Kaydet'}</Text></TouchableOpacity><TouchableOpacity style={st.cancel} onPress={kitapFormKapat}><Text>İptal</Text></TouchableOpacity></ScrollView></View></KeyboardAvoidingView></Modal><Modal visible={konuModal} transparent animationType="slide"><KeyboardAvoidingView style={st.modalBg} behavior={Platform.OS==='ios'?'padding':'height'}><View style={[st.modal,{maxHeight:'92%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+24}}><Text style={st.modalTitle}>{duzenlenenKonu?'Konuyu Düzenle':'Konu Ekle'}</Text><View style={st.secimSatir}><TouchableOpacity style={[st.secim,manuelKonu&&st.active]} onPress={()=>{setManuelKonu(true);setSeciliKazanim(null)}}><Text style={manuelKonu?st.activeText:st.secimText}>Kendim yazacağım</Text></TouchableOpacity><TouchableOpacity style={[st.secim,!manuelKonu&&st.active]} onPress={()=>setManuelKonu(false)}><Text style={!manuelKonu?st.activeText:st.secimText}>Kazanımlardan seç</Text></TouchableOpacity></View>{manuelKonu?<TextInput style={st.input} placeholder="Konu adı" value={konuAdi} onChangeText={setKonuAdi}/>:<View><Text style={st.muted}>{kademe} • {ders} — sınıfa filtreli</Text><TextInput style={st.input} placeholder="Konu / kazanım ara..." value={arama} onChangeText={setArama}/>{uygunKazanimlar.map(k=><TouchableOpacity key={`${k.sinif}-${k.kod}-${duzeltTurkce(k.ad)}`} style={st.ders} onPress={()=>setSeciliKazanim(k)}><Text style={st.kod}>{k.kod}</Text><Text>{duzeltTurkce(k.ad)}</Text></TouchableOpacity>)}</View>}<TextInput style={st.input} placeholder="Başlangıç sayfası *" value={baslangicSayfa} onChangeText={setBaslangicSayfa} keyboardType="numeric"/><TextInput style={st.input} placeholder="Bitiş sayfası *" value={bitisSayfa} onChangeText={setBitisSayfa} keyboardType="numeric"/><Text style={st.hint}>Sayfa aralıkları çakışamaz. Örneğin 1–30 kayıtlıysa yeni konu 31 veya daha sonraki bir sayfadan başlamalıdır.</Text><TouchableOpacity style={st.save} onPress={konuKaydet}><Text style={st.saveText}>{duzenlenenKonu?'Güncelle':'Kaydet'}</Text></TouchableOpacity><TouchableOpacity style={st.cancel} onPress={konuFormKapat}><Text>İptal</Text></TouchableOpacity></ScrollView></View></KeyboardAvoidingView></Modal></KeyboardAvoidingView>;
}
const st=StyleSheet.create({wrap:{flex:1,backgroundColor:'#F1F8E9'},header:{backgroundColor:'#2E7D32',padding:16},headerTitle:{color:'#fff',fontSize:19,fontWeight:'bold'},headerSub:{color:'#C8E6C9',fontSize:12,marginTop:3},info:{margin:12,backgroundColor:'#fff',padding:14,borderRadius:12},infoTitle:{fontWeight:'bold',color:'#1B5E20'},student:{backgroundColor:'#fff',padding:14,borderRadius:12,marginBottom:8},studentName:{fontSize:15,fontWeight:'bold',color:'#1B5E20'},section:{backgroundColor:'#fff',margin:12,padding:14,borderRadius:14},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},sectionTitle:{fontSize:15,fontWeight:'bold',color:'#1B5E20',flex:1},smallBtn:{backgroundColor:'#E8F5E9',padding:8,borderRadius:8},smallBtnText:{color:'#2E7D32',fontWeight:'bold'},book:{flexDirection:'row',borderWidth:1,borderColor:'#E8F5E9',borderRadius:10,padding:11,marginBottom:8},bookName:{fontSize:14,fontWeight:'bold',color:'#1B5E20'},actions:{flexDirection:'row',gap:10,marginLeft:8},edit:{fontSize:18},delete:{fontSize:17},track:{height:8,backgroundColor:'#E0E0E0',borderRadius:5,overflow:'hidden',marginTop:5},fill:{height:8,backgroundColor:'#2E7D32'},topic:{flexDirection:'row',alignItems:'flex-start',borderWidth:1,borderColor:'#eee',borderRadius:10,padding:10,marginBottom:7},no:{width:28,height:28,borderRadius:14,backgroundColor:'#E8F5E9',textAlign:'center',textAlignVertical:'center',color:'#2E7D32',fontWeight:'bold',marginRight:8},topicName:{fontSize:13,fontWeight:'600'},done:{fontSize:11,color:'#2E7D32',fontWeight:'bold',marginTop:4},pending:{fontSize:11,color:'#F57F17',fontWeight:'bold',marginTop:4},muted:{fontSize:11,color:'#777',marginTop:3},empty:{color:'#999',textAlign:'center',padding:20},modalBg:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'center',padding:20},modal:{backgroundColor:'#fff',borderRadius:18,padding:20},modalTitle:{fontSize:19,fontWeight:'bold',color:'#1B5E20',marginBottom:12},label:{fontWeight:'bold',color:'#2E7D32',marginTop:10,marginBottom:6},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:8,padding:9},chipText:{fontSize:12},active:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},activeText:{color:'#fff'},input:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:12,fontSize:15,marginBottom:10},selected:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#E8F5E9',padding:11,borderRadius:9,marginBottom:8},ders:{padding:10,borderBottomWidth:1,borderBottomColor:'#eee'},kod:{fontSize:10,color:'#2E7D32',fontWeight:'bold'},secimSatir:{flexDirection:'row',gap:7,marginBottom:10},secim:{flex:1,borderWidth:1,borderColor:'#C8E6C9',borderRadius:8,padding:10,alignItems:'center'},secimText:{fontSize:12},save:{backgroundColor:'#2E7D32',padding:14,borderRadius:10,alignItems:'center',marginTop:7},saveText:{color:'#fff',fontWeight:'bold'},cancel:{padding:13,alignItems:'center'},hint:{fontSize:11,color:'#558B2F',backgroundColor:'#F1F8E9',padding:9,borderRadius:8,marginBottom:8}});