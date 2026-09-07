import AsyncStorage from '@react-native-async-storage/async-storage';
export const DONEM_KEY='@ogretmenAjandaPro_secilenDonem';
export const donemYiliBugun=()=>{const d=new Date(),y=d.getFullYear();return d>=new Date(y,5,1)?y:y-1};
export const kayitDonemYili=r=>{if(r?.donemYili!==undefined&&r?.donemYili!==null)return Number(r.donemYili);const v=r?.olusturulma||r?.tarih||r?.baslangicTarih||r?.teslimTarihi;const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))return donemYiliBugun();const y=d.getFullYear();return d>=new Date(y,5,1)?y:y-1};
export const donemUygun=(r,y)=>kayitDonemYili(r)===Number(y);
export const seciliDonemYili=async()=>{try{const x=await AsyncStorage.getItem(DONEM_KEY);return x?Number(JSON.parse(x).yil):donemYiliBugun()}catch(e){return donemYiliBugun()}};
