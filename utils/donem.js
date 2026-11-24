import AsyncStorage from '@react-native-async-storage/async-storage';
export const DONEM_KEY='@ogretmenAjandaPro_secilenDonem';
export const donemBaslangicTarihi=y=>`${Number(y)}-06-01`;
export const donemBitisTarihi=y=>`${Number(y)+1}-06-30`;
export const donemBilgi=y=>({yil:Number(y),ad:`${y}/${Number(y)+1}`,baslangic:`1 Haziran ${y}`,bitis:`30 Haziran ${Number(y)+1}`,baslangicTarihi:donemBaslangicTarihi(y),bitisTarihi:donemBitisTarihi(y)});
export const donemYiliBugun=()=>{const d=new Date(),y=d.getFullYear();return d>=new Date(y,5,1)?y:y-1};
export const donemTarihAraliginda=(tarih,y)=>!!tarih&&String(tarih).slice(0,10)>=donemBaslangicTarihi(y)&&String(tarih).slice(0,10)<=donemBitisTarihi(y);
export const donemKayitTarihi=r=>r?.tarih||r?.baslangicTarih||r?.teslimTarihi||r?.olusturulma;
// GEÇİCİ UYARI: Eski kayıt uyumluluğu için donemYili/tarih alanları eksikse
// mevcut dönem varsayımı kullanılabilir. Bu, Haziran çakışmasında veya tarihi
// olmayan eski belgelerde yanlış döneme dahil etme riski taşır. P1 dönem envanteri
// ve kontrollü migrasyon tamamlanmadan bu fallback davranışını değiştirmeyin;
// yeni kayıtlar her zaman seçili donemYili ile yazılmalıdır.
export const kayitDonemYili=r=>{if(r?.donemYili!==undefined&&r?.donemYili!==null)return Number(r.donemYili);const v=donemKayitTarihi(r);const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))return donemYiliBugun();const y=d.getFullYear();return d>=new Date(y,5,1)?y:y-1};
export const donemUygun=(r,y)=>kayitDonemYili(r)===Number(y);
export const donemDuzenlemeyeAcik=(y,bugun=new Date())=>{const tarih=new Date(bugun.getFullYear(),bugun.getMonth(),bugun.getDate());return tarih>=new Date(Number(y),5,1)&&tarih<=new Date(Number(y)+1,5,30,23,59,59)};

export const seciliDonemYili=async()=>{try{const x=await AsyncStorage.getItem(DONEM_KEY);return x?Number(JSON.parse(x).yil):donemYiliBugun()}catch(e){return donemYiliBugun()}};
