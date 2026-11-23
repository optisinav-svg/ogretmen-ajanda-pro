import React,{useState,useEffect}from'react';
import {View,Text,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Modal,BackHandler,Alert}from'react-native';
import {collection,getDocs,query,where}from'firebase/firestore';
import {auth,db}from'../firebaseConfig';
import {donemYiliBugun,donemUygun}from'../utils/donem';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {ogrenciRaporHtml} from '../utils/ogrenciRaporPdf';
import { sinifRaporHtml } from '../utils/sinifRaporPdf';
const statusText=d=>d==='yapildi'?'✅ Yaptı':d==='yapilmadi'?'❌ Yapmadı':d==='gec'?'⏰ Geç getirdi':'📋 Bekliyor';
const sayfaAdedi=k=>Math.max(0,(parseInt(k?.bitisSayfa,10)||0)-(parseInt(k?.baslangicSayfa,10)||0)+1);
const zaman=v=>new Date(v||0).getTime()||0;
const odevRenk=d=>d==='yapildi'?'#2E7D32':d==='yapilmadi'?'#C62828':d==='gec'?'#F57F17':'#90A4AE';
export default function RaporEkrani({navigation,route}){
 const[siniflar,setSiniflar]=useState([]),[seciliSinif,setSeciliSinif]=useState(route?.params?.sinif||null),[notlar,setNotlar]=useState([]),[yoklamalar,setYoklamalar]=useState([]),[odevler,setOdevler]=useState([]),[ogrenciler,setOgrenciler]=useState([]),[konular,setKonular]=useState([]),[kitaplar,setKitaplar]=useState([]),[bireyselOturumlar,setBireyselOturumlar]=useState([]),[gecmisNotlar,setGecmisNotlar]=useState([]),[gecmisYoklamalar,setGecmisYoklamalar]=useState([]),[gecmisOdevler,setGecmisOdevler]=useState([]),[yukleniyor,setYukleniyor]=useState(false),[sekme,setSekme]=useState('notlar'),[detay,setDetay]=useState(route?.params?.ogrenci||null);
 const [pdfHazirlaniyor,setPdfHazirlaniyor]=useState(false);
 const uid=auth.currentUser?.uid; const donemYili=Number(route?.params?.donemYili||route?.params?.sinif?.donemYili||donemYiliBugun());
 useEffect(()=>{getDocs(query(collection(db,'siniflar'),where('uid','==',uid))).then(x=>setSiniflar(x.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)))).catch(()=>{})},[uid]);
 useEffect(()=>{const h=BackHandler.addEventListener('hardwareBackPress',()=>{if(detay){setDetay(null);return true}return false});return()=>h.remove()},[detay]);
 const sinifSec=async sinif=>{setSeciliSinif(sinif);setYukleniyor(true);try{const cols=['dersNotlari','yoklamalar','odevler','ogrenciler','konular','kitaplar'];const r=await Promise.all([...cols.map(c=>getDocs(query(collection(db,c),where('sinifId','==',sinif.id),where('uid','==',uid)))),getDocs(query(collection(db,'bireyselDersOturumlari'),where('uid','==',uid)))]);setNotlar(r[0].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)).sort((a,b)=>zaman(b.olusturulma||b.tarih)-zaman(a.olusturulma||a.tarih)));setYoklamalar(r[1].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)));setOdevler(r[2].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)));setOgrenciler(r[3].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)).sort((a,b)=>(a.adSoyad||'').localeCompare(b.adSoyad||'')));setKonular(r[4].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)).sort((a,b)=>zaman(b.olusturulma||b.tarih)-zaman(a.olusturulma||a.tarih)));setKitaplar(r[5].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)).sort((a,b)=>zaman(a.olusturulma)-zaman(b.olusturulma)));setBireyselOturumlar(r[6].docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,donemYili)));const hedef=route?.params?.ogrenci;if(hedef&&hedef.sinifId===sinif.id)setDetay(hedef)}catch(e){}setYukleniyor(false)};
 useEffect(()=>{if(seciliSinif)sinifSec(seciliSinif)},[donemYili]);
 useEffect(()=>{
  let aktif=true;
  const yukleGecmis=async()=>{
   if(!detay?.id||!seciliSinif){setGecmisNotlar([]);setGecmisYoklamalar([]);setGecmisOdevler([]);return;}
   const eskiSiniflar=[...new Set((detay.sinifGecmisi||[]).map(x=>x?.sinifId).filter(x=>x&&x!==seciliSinif.id))];
   if(!eskiSiniflar.length){setGecmisNotlar([]);setGecmisYoklamalar([]);setGecmisOdevler([]);return;}
   try{
    const kayitlar=await Promise.all(eskiSiniflar.map(async sinifId=>{
     const [n,y,o]=await Promise.all([
      getDocs(query(collection(db,'dersNotlari'),where('sinifId','==',sinifId),where('uid','==',uid))),
      getDocs(query(collection(db,'yoklamalar'),where('sinifId','==',sinifId),where('uid','==',uid))),
      getDocs(query(collection(db,'odevler'),where('sinifId','==',sinifId),where('uid','==',uid)))
     ]);
     return {notlar:n.docs.map(x=>({id:x.id,...x.data()})),yoklamalar:y.docs.map(x=>({id:x.id,...x.data()})),odevler:o.docs.map(x=>({id:x.id,...x.data()}))};
    }));
    if(!aktif)return;
    const sinifCikisTarihleri=new Map();
    (detay.sinifGecmisi||[]).forEach(h=>{
     if(!h?.sinifId||!h.tarih)return;
     const onceki=sinifCikisTarihleri.get(h.sinifId);
     if(!onceki||new Date(h.tarih).getTime()>new Date(onceki).getTime())sinifCikisTarihleri.set(h.sinifId,h.tarih);
    });
    const cikistanOnce=(kayit)=>{
     const cikis=sinifCikisTarihleri.get(kayit.sinifId);
     const tarih=kayit.tarih||kayit.olusturulma||kayit.teslimTarihi;
     return !cikis||!tarih||new Date(tarih).getTime()<=new Date(cikis).getTime();
    };
    setGecmisNotlar(kayitlar.flatMap(x=>x.notlar).filter(x=>donemUygun(x,donemYili)&&cikistanOnce(x)));
    setGecmisYoklamalar(kayitlar.flatMap(x=>x.yoklamalar).filter(x=>donemUygun(x,donemYili)&&cikistanOnce(x)));
    setGecmisOdevler(kayitlar.flatMap(x=>x.odevler).filter(x=>donemUygun(x,donemYili)&&cikistanOnce(x)));
   }catch(e){if(aktif)Alert.alert('Hata','Öğrencinin önceki sınıf geçmişi yüklenemedi. '+(e?.message||''));}
  };
  yukleGecmis();
  return()=>{aktif=false};
 },[detay?.id,seciliSinif?.id,donemYili,uid]);
 const yoklamaOzeti=()=>{const o={};yoklamalar.forEach(y=>{const id=y.ogrenciId||y.ogrenciAd;if(!o[id])o[id]={geldi:0,gecikti:0,gelmedi:0};o[id][y.durum]=(o[id][y.durum]||0)+1});return o};
 const studentAttendance=id=>[...yoklamalar,...gecmisYoklamalar].filter(y=>y.ogrenciId===id).sort((a,b)=>String(b.tarih||'').localeCompare(String(a.tarih||'')));
 const bireyselEtkinlikGecmisi=id=>bireyselOturumlar.filter(e=>e.ogrenciId===id).sort((a,b)=>String(a.tarih||'').localeCompare(String(b.tarih||''))||String(a.baslangicSaat||'').localeCompare(String(b.baslangicSaat||'')));

 const studentHomework=id=>[...odevler,...gecmisOdevler].filter(o=>((o.hedef==='sinif'||o.hedef==='tumSinif'||o.tumSinif===true)&&o.sinifId===seciliSinif?.id)||(o.hedefOgrenciIds||[]).includes(id)).sort((a,b)=>zaman(a.olusturulma||a.teslimTarihi)-zaman(b.olusturulma||b.teslimTarihi));
 const studentBookHomework=id=>{const records=[...odevler,...gecmisOdevler].filter(o=>(!!o.konuId||!!o.konuEslestirmeleri?.[id])&&(((o.hedef==='sinif'||o.hedef==='tumSinif'||o.tumSinif===true)&&o.sinifId===seciliSinif?.id)||(o.hedefOgrenciIds||[]).includes(id))).sort((a,b)=>zaman(a.olusturulma||a.teslimTarihi)-zaman(b.olusturulma||b.teslimTarihi)).map(o=>{const durum=(o.ogrenciDurumlari||{})[id]||o.durum||'bekliyor';const sayfa=o.sayfaAdedi||sayfaAdedi(o);const assignedBook=kitaplar.find(k=>k.ogrenciId===id&&(k.id===o.kitapId||k.kitapKutuphanesiId===o.kitapKutuphanesiId||k.kitapKutuphanesiId===o.kitapId));return{...o,kitapId:assignedBook?.id||o.kitapId,kitapAd:assignedBook?.ad||o.kitapAd,durum,sayfaAdedi:sayfa}});const unique=new Map();records.forEach(o=>unique.set(o.konuEslestirmeleri?.[id]||o.konuId||o.kitapKutuphanesiKonuId||o.id,o));return[...unique.values()]};
 const studentTopics=id=>{const dersKonular=[...notlar,...gecmisNotlar].filter(n=>!n.ogrenciId||n.ogrenciId===id).map(n=>{const tarihAna=v=>String(v?.tarih||'').slice(0,10);const ayniTarih=v=>tarihAna(v)===tarihAna(n);const saatAna=v=>String(v||'').trim();const ayniSaat=(v,a,b)=>{const va=saatAna(v?.baslangicSaat),vb=saatAna(v?.bitisSaat),na=saatAna(a),nb=saatAna(b);return !!na&&!!nb&&!!va&&!!vb&&va===na&&vb===nb};const adaylar=[...yoklamalar,...gecmisYoklamalar].filter(v=>v.ogrenciId===id);let y=null;if(n.oturumId)y=adaylar.find(v=>v.oturumId===n.oturumId);if(!y&&n.dersId)y=adaylar.find(v=>v.dersId===n.dersId&&ayniTarih(v));if(!y&&n.sinifId)y=adaylar.find(v=>v.sinifId===n.sinifId&&ayniTarih(v)&&ayniSaat(v,n.baslangicSaat,n.bitisSaat));if(!y&&n.sinifId)y=adaylar.find(v=>v.sinifId===n.sinifId&&ayniTarih(v)&&String(v.dersEtiketi||'').includes(`${n.baslangicSaat}–${n.bitisSaat}`));if(!y){const gunluk=adaylar.filter(v=>ayniTarih(v));if(gunluk.length===1)y=gunluk[0]}return{id:'not-'+n.id,ad:n.not||'İşlenen konu',kitapAd:n.kitapAd||'',tarih:n.tarih,tarihGosterim:n.tarihGosterim,olusturulma:n.olusturulma,dersteYok:y?.durum==='gelmedi',yoklamaDurumu:y?.durum||null,kaynak:'sinif_dersi'}});const bireyselKonular=bireyselEtkinlikGecmisi(id).flatMap(o=>(o.konular||[]).map((ad,i)=>({id:`bireysel-${o.id}-${i}`,ad,kitapAd:'',tarih:o.tarih,tarihGosterim:o.tarihGosterim||o.tarih,olusturulma:o.tarih,dersteYok:false,yoklamaDurumu:o.yoklamaDurumu||null,kaynak:'bireysel',tur:o.tur,baslangicSaat:o.baslangicSaat,bitisSaat:o.bitisSaat})));return{ders:[...dersKonular,...bireyselKonular].sort((a,b)=>zaman(b.olusturulma||b.tarih)-zaman(a.olusturulma||a.tarih))};};
 const konuOdevDurumu=k=>{const h=[...odevler,...gecmisOdevler].filter(o=>(o.konuId===k.id||o.konuEslestirmeleri?.[detay?.id]===k.id)&&(((o.hedef==='sinif'||o.hedef==='tumSinif'||o.tumSinif===true)&&o.sinifId===seciliSinif?.id)||(o.hedefOgrenciIds||[]).includes(detay?.id)));if(!h.length)return null;const latest=[...h].sort((a,b)=>zaman(b.olusturulma)-zaman(a.olusturulma))[0];return latest.ogrenciDurumlari?.[detay?.id]||latest.durum||'bekliyor'};
 const kitapIlerleme=k=>{const ks=konular.filter(x=>x.kitapId===k.id),done=ks.reduce((sum,x)=>konuOdevDurumu(x)==='yapildi'?sum+sayfaAdedi(x):sum,0),total=parseInt(k.sayfaSayisi,10)||0;return{done:total?Math.min(done,total):done,total,pct:total?Math.min(100,Math.round(done/total*100)):0}};
 const kitapGruplari=id=>{const odevlerKitap=studentBookHomework(id),ogrenciKitaplari=kitaplar.filter(k=>k.ogrenciId===id);const gruplar={};ogrenciKitaplari.forEach(k=>{gruplar[k.id]={kitapId:k.id,kitapAd:k.ad||'Kitap',totalSayfa:parseInt(k.sayfaSayisi,10)||0,items:[]}});odevlerKitap.forEach(o=>{const key=o.kitapId||o.kitapAd||'Kitap';if(!gruplar[key])gruplar[key]={kitapId:o.kitapId||key,kitapAd:o.kitapAd||'Kitap',totalSayfa:0,items:[]};gruplar[key].items.push(o)});Object.values(gruplar).forEach(g=>{const covered=g.items.reduce((n,o)=>n+(o.sayfaAdedi||1),0);const kalan=Math.max(0,(g.totalSayfa||0)-covered);if(kalan>0)g.items.push({id:`kalan-${g.kitapId}`,kitapId:g.kitapId,kitapAd:g.kitapAd,aciklama:'Kalan sayfalar',sayfaAdedi:kalan,durum:'bekliyor',isKalan:true})});return Object.values(gruplar).sort((a,b)=>zaman(a.items[0]?.olusturulma)-zaman(b.items[0]?.olusturulma));};
 const ogrenciKitapRaporu=id=>kitaplar.filter(k=>k.ogrenciId===id).map(k=>{
  const ks=konular.filter(x=>x.ogrenciId===id&&x.kitapId===k.id)
    .sort((a,b)=>(parseInt(a.baslangicSayfa,10)||0)-(parseInt(b.baslangicSayfa,10)||0));
  const parcalar=ks.map(konu=>{
    const adaylar=[...odevler,...gecmisOdevler].filter(o=>(o.konuId===konu.id||o.konuEslestirmeleri?.[id]===konu.id)&&(
      ((o.hedef==='sinif'||o.hedef==='tumSinif'||o.tumSinif===true)&&o.sinifId===seciliSinif?.id)||
      (o.hedefOgrenciIds||[]).includes(id)
    )).sort((a,b)=>zaman(b.olusturulma)-zaman(a.olusturulma));
    const o=adaylar[0];
    return {sayfa:sayfaAdedi(konu),durum:o?(o.ogrenciDurumlari||{})[id]||o.durum||'bekliyor':'bekliyor'};
  }).filter(x=>x.sayfa>0);
  const toplam=parseInt(k.sayfaSayisi,10)||0;
  const kullanilan=parcalar.reduce((n,x)=>n+x.sayfa,0);
  if(toplam>kullanilan)parcalar.push({sayfa:toplam-kullanilan,durum:'bekliyor'});
  return {ad:k.ad||'Kitap',toplamSayfa:toplam,parcalar};
 });
 const ogrenciPdfOlustur=async()=>{
  if(!detay||!seciliSinif||pdfHazirlaniyor)return;
  setPdfHazirlaniyor(true);
  try{
    const id=detay.id;
    const raporOdevleri=studentHomework(id).map(o=>{
      const durum=(o.ogrenciDurumlari||{})[id]||o.durum||'bekliyor';
      const gecmis=Array.isArray(o.durumGecmisi?.[id])?o.durumGecmisi[id]:[];
      const kontroller=gecmis.filter(x=>x.durum&&x.durum!=='bekliyor')
        .sort((a,b)=>zaman(b.tarih)-zaman(a.tarih));
      const son=kontroller[0];
      return {...o,durum,kontrolTarihi:son?.tarihGosterim||son?.tarih||'Kontrol tarihi yok',raporKonu:o.konuAd||o.aciklama,raporSayfa:o.baslangicSayfa&&o.bitisSayfa?`Sayfa ${o.baslangicSayfa}-${o.bitisSayfa}`:''};
    });
    const html=ogrenciRaporHtml({
      okulAdi:seciliSinif.okulAd||'Okul adi belirtilmedi',
      ogrenciAdi:detay.adSoyad,
      sinifAdi:seciliSinif.ad,
      dersAdi:seciliSinif.ders,
      olusturmaTarihi:new Date().toISOString(),
      konular:studentTopics(id).ders,
      odevler:raporOdevleri,
      kitaplar:ogrenciKitapRaporu(id),
      bireyselEtkinlikler:bireyselEtkinlikGecmisi(id)
    });
    const dosya=await Print.printToFileAsync({html,base64:false});
    const temizAd=(detay.adSoyad||'Ogrenci')
      .replace(/\s+/g,'')
      .replace(/[\\/:*?"<>|]/g,'');
    const dosyaAdi=(temizAd||'Ogrenci')+'Rapor.pdf';

    const cihazaKaydet=async()=>{
      try{
        const izin=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if(!izin.granted)return;
        const hedef=await FileSystem.StorageAccessFramework.createFileAsync(
          izin.directoryUri,
          dosyaAdi.replace(/\.pdf$/i,''),
          'application/pdf'
        );
        const icerik=await FileSystem.readAsStringAsync(dosya.uri,{
          encoding:FileSystem.EncodingType.Base64
        });
        await FileSystem.writeAsStringAsync(hedef,icerik,{
          encoding:FileSystem.EncodingType.Base64
        });
        Alert.alert('Kaydedildi',dosyaAdi+' se?ti?iniz klas?re kaydedildi.');
      }catch(e){
        console.error('PDF kaydetme hatasi:',e);
        Alert.alert('Kaydedilemedi','PDF cihaz klas\u00f6r\u00fcne kaydedilemedi.');
      }
    };

    const drivePaylas=async()=>{
      try{
        const hedef=FileSystem.cacheDirectory+dosyaAdi;
        const bilgi=await FileSystem.getInfoAsync(hedef);
        if(bilgi.exists)await FileSystem.deleteAsync(hedef,{idempotent:true});
        await FileSystem.copyAsync({from:dosya.uri,to:hedef});
        if(await Sharing.isAvailableAsync()){
          await Sharing.shareAsync(hedef,{
            mimeType:'application/pdf',
            dialogTitle:'Ogrenci raporu',
            UTI:'com.adobe.pdf'
          });
        }else{
          Alert.alert('Payla\u015f\u0131m kullan\u0131lam\u0131yor','Bu cihazda payla\u015f\u0131m \u00f6zelli\u011fi bulunamad\u0131.');
        }
      }catch(e){
        console.error('PDF paylasim hatasi:',e);
        Alert.alert('Payla\u015f\u0131lamad\u0131','PDF payla\u015f\u0131l\u0131rken bir hata olu\u015ftu.');
      }
    };

    Alert.alert('PDF haz\u0131r',dosyaAdi,[
      {text:'Vazge\u00e7',style:'cancel'},
      {text:'Cihaza Kaydet',onPress:cihazaKaydet},
      {text:'Drive / Payla\u015f',onPress:drivePaylas}
    ]);
  }catch(e){
    console.error('Ogrenci PDF hatasi:',e);
    Alert.alert('PDF olusturulamadi','Rapor hazirlanirken bir hata olustu. Tekrar deneyebilirsiniz.');
  }finally{
    setPdfHazirlaniyor(false);
  }
 };
 const sinifPdfOlustur=async()=>{
  if(!seciliSinif||pdfHazirlaniyor)return;
  setPdfHazirlaniyor(true);
  try{
   const students=ogrenciler.map(student=>{
    const attendance=yoklamalar.filter(item=>item.ogrenciId===student.id);
    const homework=odevler.filter(item=>
      ((item.hedef==='sinif'||item.hedef==='tumSinif'||item.tumSinif===true)&&item.sinifId===seciliSinif.id)||
      (item.hedefOgrenciIds||[]).includes(student.id)
    );
    const attendanceCounts={geldi:0,gecikti:0,gelmedi:0};
    attendance.forEach(item=>{const status=item.yoklamaDurumu||item.durum;if(Object.prototype.hasOwnProperty.call(attendanceCounts,status))attendanceCounts[status]+=1});
    const homeworkCounts={yapildi:0,gec:0,yapilmadi:0,bekliyor:0};
    homework.forEach(item=>{
      const status=(item.ogrenciDurumlari||{})[student.id]||item.durum||'bekliyor';
      if(Object.prototype.hasOwnProperty.call(homeworkCounts,status))homeworkCounts[status]+=1;
      else homeworkCounts.bekliyor+=1;
    });
    return {
      name:student.adSoyad||'Öğrenci',
      attendance:{...attendanceCounts,total:attendance.length},
      homework:{...homeworkCounts,total:homework.length},
    };
   });
   const notes=notlar.map(item=>({
    date:item.tarihGosterim||item.tarih,
    student:item.ogrenciId?ogrenciler.find(x=>x.id===item.ogrenciId)?.adSoyad||'Öğrenci':'Sınıf',
    note:item.not||item.konu||'Ders notu',
   }));
   const homeworks=odevler.map(item=>{
    const targets=(item.hedef==='sinif'||item.hedef==='tumSinif'||item.tumSinif===true)
      ?ogrenciler
      :ogrenciler.filter(student=>(item.hedefOgrenciIds||[]).includes(student.id));
    const counts={done:0,late:0,notDone:0,pending:0};
    targets.forEach(student=>{
      const status=(item.ogrenciDurumlari||{})[student.id]||item.durum||'bekliyor';
      if(status==='yapildi')counts.done+=1;
      else if(status==='gec')counts.late+=1;
      else if(status==='yapilmadi')counts.notDone+=1;
      else counts.pending+=1;
    });
    return {title:[item.kitapAd,item.konuAd||item.aciklama,item.baslangicSayfa&&item.bitisSayfa?`Sayfa ${item.baslangicSayfa}-${item.bitisSayfa}`:null].filter(Boolean).join(' · ')||'Ödev',due:item.teslimTarihi,...counts};
   });
   const books=ogrenciler.flatMap(student=>ogrenciKitapRaporu(student.id).map(book=>{
    const completed=book.parcalar.filter(part=>part.durum==='yapildi').reduce((sum,part)=>sum+(Number(part.sayfa)||0),0);
    const total=Number(book.toplamSayfa)||0;
    return {student:student.adSoyad||'Öğrenci',name:book.ad,total,completed,percent:total?Math.min(100,Math.round(completed/total*100)):0};
   }));
   const events=bireyselOturumlar.filter(item=>ogrenciler.some(student=>student.id===item.ogrenciId)).map(item=>({
    student:ogrenciler.find(student=>student.id===item.ogrenciId)?.adSoyad||'Öğrenci',
    type:({ozelDers:'Özel Ders',etut:'Etüt',soruCozumu:'Soru Çözümü'}[item.tur]||item.tur||'Bireysel etkinlik'),
    date:item.tarihGosterim||item.tarih,
    start:item.baslangicSaat,
    end:item.bitisSaat,
    status:item.yoklamaDurumu,
    topics:Array.isArray(item.konular)?item.konular:[],
   }));
   const html=sinifRaporHtml({
    okulAdi:seciliSinif.okulAd||'Okul belirtilmedi',
    sinifAdi:seciliSinif.ad,
    dersAdi:seciliSinif.ders,
    donemYili,
    olusturmaTarihi:new Date().toISOString(),
    students,notes,homeworks,books,events,
   });
   const file=await Print.printToFileAsync({html,base64:false});
   const cleanName=(seciliSinif.ad||'Sinif').replace(/\s+/g,'').replace(/[\\/:*?"<>|]/g,'');
   const filename=(cleanName||'Sinif')+`_${donemYili}_SinifRaporu.pdf`;
   const target=FileSystem.cacheDirectory+filename;
   const existing=await FileSystem.getInfoAsync(target);
   if(existing.exists)await FileSystem.deleteAsync(target,{idempotent:true});
   await FileSystem.copyAsync({from:file.uri,to:target});
   if(await Sharing.isAvailableAsync()){
    await Sharing.shareAsync(target,{mimeType:'application/pdf',dialogTitle:'Sınıf gelişim raporu',UTI:'com.adobe.pdf'});
   }else{
    Alert.alert('PDF hazır',filename+' oluşturuldu ancak cihaz paylaşım özelliği kullanılamıyor.');
   }
  }catch(e){
   console.error('Sınıf PDF hatası:',e);
   Alert.alert('PDF oluşturulamadı','Sınıf raporu hazırlanırken hata oluştu. '+(e?.message||''));
  }finally{
   setPdfHazirlaniyor(false);
  }
 };
 const toplamSayfa=items=>items.reduce((n,x)=>n+(x.sayfaAdedi||1),0)||1;const okulGruplari=()=>{const m={};siniflar.forEach(x=>{const k=x.okulId||x.okulAd||'okulsuz';if(!m[k])m[k]={okulId:x.okulId,okulAd:x.okulAd||'Okul belirtilmemiş',siniflar:[]};m[k].siniflar.push(x)});return Object.values(m).sort((a,b)=>String(a.okulAd).localeCompare(String(b.okulAd),'tr'));};
 return <View style={s.wrap}><ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:110}}><Text style={s.baslik}>Okul Seçin:</Text><View style={s.okulAlani}>{okulGruplari().map(g=><View key={g.okulId||g.okulAd} style={s.schoolGroup}><Text style={s.schoolTitle}>🏫 {g.okulAd}</Text><View style={s.classWrap}>{g.siniflar.map(x=><TouchableOpacity key={x.id} style={[s.sinifButon,seciliSinif?.id===x.id&&s.sinifAktif]} onPress={()=>sinifSec(x)}><Text style={[s.sinifMetni,seciliSinif?.id===x.id&&s.sinifMetniAktif]}>{x.ad}</Text><Text style={seciliSinif?.id===x.id?s.chipAltAktif:s.chipAlt}>{x.kademe?`${x.kademe}. Sınıf`:''}{x.ders?` • ${x.ders}`:''}</Text></TouchableOpacity>)}</View></View>)}</View>{seciliSinif&&!detay&&<TouchableOpacity style={s.classPdfButton} disabled={pdfHazirlaniyor||yukleniyor} onPress={sinifPdfOlustur}><Text style={s.classPdfButtonText}>{pdfHazirlaniyor?'PDF hazırlanıyor…':'📄 Sınıf Gelişim Raporu PDF'}</Text></TouchableOpacity>}{seciliSinif&&<View style={s.sekmeler}>{[['notlar','📖 Notlar'],['yoklama','✅ Yoklama'],['odevler','📋 Ödevler'],['ogrenciler','👤 Öğrenciler']].map(([k,t])=><TouchableOpacity key={k} style={[s.sekme,sekme===k&&s.sekmeAktif]} onPress={()=>setSekme(k)}><Text style={sekme===k?s.sekmeMetniAktif:s.sekmeMetni}>{t}</Text></TouchableOpacity>)}</View>}{yukleniyor?<ActivityIndicator style={{marginTop:32}} size="large" color="#2E7D32"/>:<View style={s.icerik}>{!seciliSinif?<Text style={s.bos}>Rapor görmek için sınıf seçin.</Text>:null}{seciliSinif&&sekme==='notlar'&&notlar.map(n=><View key={n.id} style={s.card}><Text style={s.small}>{n.tarihGosterim||n.tarih}</Text><Text style={s.cardText}>{n.not}</Text></View>)}{seciliSinif&&sekme==='yoklama'&&ogrenciler.map(o=>{const z=yoklamaOzeti()[o.id]||{};return <TouchableOpacity key={o.id} style={s.card} onPress={()=>setDetay(o)}><Text style={s.student}>{o.adSoyad}</Text><Text style={s.small}>Geldi {z.geldi||0} • Geçti {z.gecikti||0} • Gelmedi {z.gelmedi||0}</Text></TouchableOpacity>})}{seciliSinif&&sekme==='odevler'&&[...odevler].sort((a,b)=>zaman(b.olusturulma||b.teslimTarihi)-zaman(a.olusturulma||a.teslimTarihi)).map(o=><View key={o.id} style={s.card}><Text style={s.cardText}>{o.konuAd||o.aciklama}</Text>{o.kitapAd?<Text style={s.small}>📖 {o.kitapAd}{o.baslangicSayfa&&o.bitisSayfa?` · Sayfa ${o.baslangicSayfa}-${o.bitisSayfa}`:''}</Text>:null}<Text style={s.small}>Teslim: {o.teslimTarihi} · {(o.hedefOgrenciIds||[]).length} öğrenci</Text></View>)}{seciliSinif&&sekme==='ogrenciler'&&ogrenciler.map(o=><TouchableOpacity key={o.id} style={s.card} onPress={()=>setDetay(o)}><Text style={s.student}>{o.adSoyad} ›</Text><Text style={s.small}>Yoklama · Konular · Kitap İlerlemesi · Ödevler</Text></TouchableOpacity>)}</View>}</ScrollView>
 <Modal visible={!!detay} animationType="slide" onRequestClose={()=>setDetay(null)}><View style={s.detail}><View style={s.detailHead}><View style={{flex:1}}><Text style={s.detailTitle}>{detay?.adSoyad}</Text><Text style={s.small}>{seciliSinif?.okulAd||''} {seciliSinif?.kademe?`• ${seciliSinif.kademe}. Sınıf`:''} {seciliSinif?.ders?`• ${seciliSinif.ders}`:''}</Text></View><TouchableOpacity style={s.pdfButton} disabled={pdfHazirlaniyor} onPress={ogrenciPdfOlustur}><Text style={s.pdfButtonText}>{pdfHazirlaniyor?"Hazirlaniyor...":"PDF Olustur"}</Text></TouchableOpacity><TouchableOpacity onPress={()=>setDetay(null)}><Text style={s.close}>✕</Text></TouchableOpacity></View><ScrollView contentContainerStyle={{paddingBottom:40}}><Text style={s.sectionTitle}>📊 Yoklama Geçmişi</Text>{studentAttendance(detay?.id).map(y=><View key={y.id} style={s.row}><Text>{y.tarihGosterim||y.tarih} {y.dersEtiketi?`• ${y.dersEtiketi}`:''}</Text><Text style={{color:y.durum==='geldi'?'#2E7D32':y.durum==='gecikti'?'#F57F17':'#C62828',fontWeight:'bold'}}>{y.durum==='geldi'?'Geldi':y.durum==='gecikti'?'Geç geldi':'Gelmedi'}</Text></View>)}<Text style={s.sectionTitle}>🎯 Bireysel Ders Yoklaması</Text>{bireyselEtkinlikGecmisi(detay?.id).map(y=><View key={'bireysel-yoklama-'+y.id} style={s.row}><View style={{flex:1}}><Text>{y.tarihGosterim||y.tarih} · {y.tur||'Bireysel ders'}</Text><Text style={s.small}>{y.baslangicSaat||''}–{y.bitisSaat||''}</Text></View><Text style={{color:y.yoklamaDurumu==='geldi'?'#2E7D32':y.yoklamaDurumu==='gecikti'?'#F57F17':y.yoklamaDurumu==='gelmedi'?'#C62828':'#757575',fontWeight:'bold'}}>{y.yoklamaDurumu==='geldi'?'Geldi':y.yoklamaDurumu==='gecikti'?'Geç geldi':y.yoklamaDurumu==='gelmedi'?'Gelmedi':'Girilmedi'}</Text></View>)}<Text style={s.sectionTitle}>📘 Derste İşlenen Konular</Text>{studentTopics(detay?.id).ders.map(k=><View key={k.id} style={s.rowBlock}><Text style={s.cardText}>{k.ad}</Text>{k.kaynak==='bireysel'?<Text style={s.small}>🎯 Bireysel {k.tur||'ders'} · {k.baslangicSaat||''}–{k.bitisSaat||''}</Text>:null}{k.tarih?<Text style={s.small}>{k.tarihGosterim||k.tarih}</Text>:null}{k.kaynak==='bireysel'?(k.yoklamaDurumu==='geldi'?<Text style={s.present}>✅ Bireysel derse geldi</Text>:k.yoklamaDurumu==='gecikti'?<Text style={s.late}>⏰ Bireysel derse geç geldi</Text>:k.yoklamaDurumu==='gelmedi'?<Text style={s.absent}>❌ Bireysel derse gelmedi</Text>:<Text style={s.unknown}>⚪ Bireysel ders yoklaması girilmedi</Text>):k.yoklamaDurumu==='gelmedi'?<Text style={s.absent}>❌ Derste yok</Text>:k.yoklamaDurumu==='gecikti'?<Text style={s.late}>⏰ Derste geç geldi</Text>:k.yoklamaDurumu==='geldi'?<Text style={s.present}>✅ Derste var</Text>:<Text style={s.unknown}>⚪ Yoklama bilgisi bulunamadı.</Text>}</View>)}<Text style={s.sectionTitle}>📚 Kitap Konu Takibi</Text>{kitapGruplari(detay?.id).length===0?<View style={s.rowBlock}><Text style={s.small}>Henüz kitap konusundan ödev verilmemiş.</Text></View>:kitapGruplari(detay?.id).map(g=>{const total=toplamSayfa(g.items);return <View key={g.kitapId} style={s.book}><Text style={s.bookTitle}>📖 {g.kitapAd}</Text><View style={s.progressBar}>{g.items.map((o,i)=><View key={`${o.id}-${i}`} style={[s.progressSegment,{flexGrow:o.sayfaAdedi||1,backgroundColor:odevRenk(o.durum)}]} />)}</View><View style={s.progressLabels}>{g.items.map((o,i)=><View key={`l-${o.id}-${i}`} style={[s.progressLabel,{flexGrow:o.sayfaAdedi||1}]}><Text style={s.progressLabelText}>{o.sayfaAdedi||1} syf.</Text></View>)}</View><View style={s.legend}>{g.items.map((o,i)=><View key={`lg-${o.id}-${i}`} style={s.legendItem}><View style={[s.legendDot,{backgroundColor:odevRenk(o.durum)}]}/><Text style={s.legendText}>{i+1}. {o.durum==='yapildi'?'Yapıldı':o.durum==='yapilmadi'?'Yapılmadı':o.durum==='gec'?'Geç getirdi':'Bekliyor'} · {o.sayfaAdedi||1} sayfa</Text></View>)}</View><Text style={s.small}>Toplam {total} sayfa • Her bölümün uzunluğu sayfa sayısına göre orantılıdır.</Text></View>})}<Text style={s.sectionTitle}>📋 Ödev Geçmişi — kronolojik</Text>{studentHomework(detay?.id).map(o=><View key={o.id} style={s.row}><View style={{flex:1}}><Text style={s.cardText}>{o.konuAd||o.aciklama}</Text>{o.kitapAd?<Text style={s.small}>📖 {o.kitapAd}{o.baslangicSayfa||o.bitisSayfa?` • Sayfa ${o.baslangicSayfa}-${o.bitisSayfa}`:''}</Text>:null}<Text style={s.small}>Teslim: {o.teslimTarihi}</Text></View><Text style={{color:odevRenk((o.ogrenciDurumlari||{})[detay?.id]||o.durum),fontWeight:'bold'}}>{statusText((o.ogrenciDurumlari||{})[detay?.id]||o.durum)}</Text></View>)}</ScrollView></View></Modal></View>}
const s=StyleSheet.create({wrap:{flex:1,backgroundColor:'#F1F8E9'},baslik:{fontSize:14,fontWeight:'bold',color:'#2E7D32',padding:14,paddingBottom:6},sinifListesi:{paddingHorizontal:12,maxHeight:75},sinifButon:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:20,paddingHorizontal:14,paddingVertical:7,marginRight:8,backgroundColor:'#fff'},sinifAktif:{backgroundColor:'#2E7D32'},sinifMetni:{color:'#333',fontSize:13},sinifMetniAktif:{color:'#fff',fontWeight:'bold'},chipOkul:{fontSize:9,color:'#888',marginTop:2},chipOkulAktif:{fontSize:9,color:'#C8E6C9',marginTop:2},chipAlt:{fontSize:9,color:'#999',marginTop:2},chipAltAktif:{fontSize:9,color:'#C8E6C9',marginTop:2},sekmeler:{flexDirection:'row',backgroundColor:'#fff',padding:5},sekme:{flex:1,padding:9,alignItems:'center'},sekmeAktif:{backgroundColor:'#2E7D32',borderRadius:8},sekmeMetni:{fontSize:11,color:'#555'},sekmeMetniAktif:{fontSize:11,color:'#fff',fontWeight:'bold'},icerik:{padding:12},bos:{textAlign:'center',color:'#999',padding:30},card:{backgroundColor:'#fff',borderRadius:12,padding:13,marginBottom:8,elevation:1},cardText:{fontSize:14,color:'#333',fontWeight:'600'},student:{fontSize:15,fontWeight:'bold',color:'#1B5E20'},small:{fontSize:11,color:'#777',marginTop:3},okulAlani:{flexGrow:0},okulAlaniIcerik:{paddingHorizontal:12,paddingBottom:6},detail:{flex:1,backgroundColor:'#F1F8E9',padding:14},detailHead:{backgroundColor:'#2E7D32',borderRadius:14,padding:14,flexDirection:'row',alignItems:'center'},detailTitle:{fontSize:19,fontWeight:'bold',color:'#fff'},close:{fontSize:25,color:'#fff',padding:8},classPdfButton:{backgroundColor:'#1B5E20',padding:12,marginHorizontal:12,marginTop:8,marginBottom:6,borderRadius:10,alignItems:'center'},classPdfButtonText:{color:'#fff',fontSize:12,fontWeight:'bold'},pdfButton:{backgroundColor:'#fff',paddingHorizontal:11,paddingVertical:9,borderRadius:8,marginRight:5},pdfButtonText:{fontSize:11,fontWeight:'bold',color:'#1B5E20'},sectionTitle:{fontSize:14,fontWeight:'bold',color:'#1B5E20',marginTop:16,marginBottom:7},row:{backgroundColor:'#fff',borderRadius:10,padding:11,marginBottom:6,flexDirection:'row',alignItems:'center',gap:8},rowBlock:{backgroundColor:'#fff',borderRadius:10,padding:11,marginBottom:6},book:{backgroundColor:'#fff',borderRadius:10,padding:11,marginBottom:7},bookTitle:{fontSize:13,fontWeight:'bold',color:'#1B5E20',marginBottom:7},progressBar:{height:18,flexDirection:'row',borderRadius:6,overflow:'hidden',backgroundColor:'#ECEFF1'},progressSegment:{height:18,minWidth:4,borderRightWidth:1,borderRightColor:'#fff'},progressLabels:{flexDirection:'row',marginTop:3},progressLabel:{alignItems:'center',minWidth:4},progressLabelText:{fontSize:9,color:'#666'},legend:{marginTop:7},legendItem:{flexDirection:'row',alignItems:'center',marginTop:3},legendDot:{width:9,height:9,borderRadius:5,marginRight:6},legendText:{fontSize:10,color:'#555'},track:{height:8,backgroundColor:'#E0E0E0',borderRadius:5,overflow:'hidden',marginTop:6},fill:{height:8,backgroundColor:'#2E7D32'},present:{color:'#2E7D32',fontSize:11,fontWeight:'bold',marginTop:5},late:{color:'#F57F17',fontSize:11,fontWeight:'bold',marginTop:5},absent:{color:'#C62828',fontSize:11,fontWeight:'bold',marginTop:5},unknown:{color:'#757575',fontSize:11,fontWeight:'bold',marginTop:5}});