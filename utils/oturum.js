export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const displayDate = iso => iso ? iso.split('-').reverse().join('.') : '';
export const oturumIdOlustur = (dersId, tarih) => `${dersId}_${tarih}`;
export const dersTarihi = tarih => typeof tarih === 'string' ? tarih.slice(0,10) : isoDate(new Date());
export const gunAdi = d => ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][d.getDay()];
export const bugun = () => isoDate(new Date());
