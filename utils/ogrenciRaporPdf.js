const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

const tarih = v => {
  if (!v) return 'Belirtilmedi';
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  }
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? esc(v) :
    `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
};

const durumRenk = d => ({
  yapildi:'#2E7D32',
  yapilmadi:'#C62828',
  gec:'#F57F17',
  bekliyor:'#90A4AE'
}[d] || '#90A4AE');

const durumAd = d => ({
  yapildi:'Yap\u0131ld\u0131',
  yapilmadi:'Yap\u0131lmad\u0131',
  gec:'Ge\u00e7 getirdi',
  bekliyor:'Bekliyor'
}[d] || 'Bekliyor');

export function ogrenciRaporHtml({
  okulAdi, ogrenciAdi, sinifAdi, dersAdi, olusturmaTarihi,
  konular = [], odevler = [], kitaplar = [], bireyselEtkinlikler = []
}) {
  const konuHtml = konular.map(k => {
    const d = k.yoklamaDurumu === 'geldi' ? 'Derste var' :
      k.yoklamaDurumu === 'gecikti' ? 'Ge\u00e7 geldi' :
      k.yoklamaDurumu === 'gelmedi' ? 'Derste yok' :
      'Yoklama bilgisi yok';
    const renk = k.yoklamaDurumu === 'geldi' ? '#2E7D32' :
      k.yoklamaDurumu === 'gecikti' ? '#F57F17' :
      k.yoklamaDurumu === 'gelmedi' ? '#C62828' : '#757575';
    return `<div class="topic-row">
      <div class="topic-name">${esc(k.ad || '\u0130\u015Flenen konu')}</div>
      <div class="topic-date">${tarih(k.tarihGosterim || k.tarih)}</div>
      <div class="topic-status" style="color:${renk}">${d}</div>
    </div>`;
  }).join('');

  const odevHtml = odevler.map(o => {
    const d = o.durum || 'bekliyor';
    const baslik = [o.kitapAd, o.aciklama].filter(Boolean).join(' - ') || '\u00D6dev';
    return `<div class="homework-row">
      <div class="homework-title">${esc(baslik)}</div>
      <div class="homework-meta">
        <span>Verili\u015F: ${tarih(o.olusturulma || o.tarih || o.tarihGosterim)}</span>
        <span>Kontrol: ${esc(o.kontrolTarihi || 'Kontrol tarihi yok')}</span>
        <strong style="color:${durumRenk(d)}">${durumAd(d)}</strong>
      </div>
    </div>`;
  }).join('');

  const kitapHtml = kitaplar.map(k => {
    const toplam = Math.max(0, Number(k.toplamSayfa) || 0);
    const parcalar = k.parcalar || [];
    const biten = parcalar.reduce((n,p) =>
      n + (p.durum === 'yapildi' ? (Number(p.sayfa) || 0) : 0), 0);
    const yuzde = toplam ? Math.min(100, Math.round(biten / toplam * 100)) : 0;
    const bar = parcalar.map(p =>
      `<span style="flex:${Math.max(1,Number(p.sayfa)||1)};background:${durumRenk(p.durum)}"></span>`
    ).join('');
    return `<div class="book">
      <div class="progress">${bar || '<span style="flex:1;background:#90A4AE"></span>'}</div>
      <div class="book-name">${esc(k.ad)} \u00B7 ${yuzde}% tamamland\u0131</div>
      <div class="record-meta">Tamamlanan: ${biten} / ${toplam || '?'} sayfa</div>
    </div>`;
  }).join('');

  const etkinlikHtml = bireyselEtkinlikler
    .slice()
    .sort((a,b) => String(a.tarih || a.baslangicTarih || '').localeCompare(String(b.tarih || b.baslangicTarih || '')) || String(a.baslangicSaat || '').localeCompare(String(b.baslangicSaat || '')))
    .map(e => '<div class="homework-row"><strong>' + esc(e.tur || 'Bireysel etkinlik') + '</strong><div>' + tarih(e.tarih) + ' · ' + esc(e.baslangicSaat || '') + ' – ' + esc(e.bitisSaat || '') + '</div><div class="record-meta">Yoklama: ' + (e.yoklamaDurumu === 'geldi' ? 'Geldi' : e.yoklamaDurumu === 'gecikti' ? 'Geç geldi' : e.yoklamaDurumu === 'gelmedi' ? 'Gelmedi' : 'Girilmedi') + '</div><div class="record-meta">İşlenen konular: ' + (Array.isArray(e.konular) && e.konular.length ? e.konular.map(esc).join(' · ') : 'Konu kaydı yok') + '</div></div>').join('');
  const tarihMetni = tarih(olusturmaTarihi || new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page {
  size: A4 portrait;
  margin: 17mm 14mm 19mm;
  @bottom-center {
    content: "Sayfa " counter(page);
    font-family: Arial, sans-serif;
    font-size: 9pt;
    color: #777;
  }
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  color: #263238;
  font-size: 10pt;
}
.report-date {
  text-align: right;
  font-size: 9pt;
  color: #666;
  margin-bottom: 5mm;
}
.school {
  text-align: center;
  font-size: 17pt;
  font-weight: bold;
  margin: 0 0 7mm;
  color: #1B5E20;
}
.student-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8mm;
  border-bottom: 1px solid #BDBDBD;
  padding-bottom: 4mm;
  font-size: 11pt;
  font-weight: bold;
}
.student-line .lesson { text-align: right; }
.columns {
  column-count: 2;
  column-gap: 10mm;
  column-fill: auto;
  margin-top: 22mm;
}
.section-title {
  font-size: 12pt;
  font-weight: bold;
  color: #1B5E20;
  margin: 0 0 4mm;
  padding-bottom: 2mm;
  border-bottom: 1px solid #C8E6C9;
  break-after: avoid;
}
.topic-row {
  display: flex;
  align-items: center;
  gap: 2mm;
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 0 2mm;
  padding: 2.5mm 1.5mm;
  border-bottom: 1px solid #E0E0E0;
  font-size: 8pt;
}
.topic-name {
  flex: 1;
  min-width: 0;
  font-weight: bold;
  overflow-wrap: anywhere;
}
.topic-date {
  white-space: nowrap;
  color: #666;
  font-size: 7.5pt;
}
.topic-status {
  white-space: nowrap;
  font-size: 7.5pt;
  font-weight: bold;
}
.homework-section { break-before: column; }
.homework-row {
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 0 3mm;
  padding: 2.5mm;
  border: 1px solid #E0E0E0;
  border-radius: 2mm;
}
.homework-title {
  font-weight: bold;
  font-size: 9pt;
  margin-bottom: 2mm;
}
.homework-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5mm 2mm;
  font-size: 7.2pt;
  color: #666;
}
.homework-meta strong { font-size: 7.5pt; }
.record-meta { color: #666; font-size: 8.5pt; margin-top: 1.5mm; }
.books-title { margin-top: 5mm; }
.book {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 5mm;
}
.progress {
  display: flex;
  height: 7mm;
  overflow: hidden;
  border-radius: 2mm;
  background: #ECEFF1;
  border: 1px solid #D5DADD;
}
.progress span { min-width: 1px; border-right: 1px solid white; }
.book-name { font-weight: bold; font-size: 9.5pt; margin-top: 2mm; }
@media screen {
  body { padding: 10mm; }
}
</style>
</head>
<body>
  <div class="report-date">Rapor tarihi: ${tarihMetni}</div>
  <div class="school">${esc(okulAdi || 'Okul ad\u0131 belirtilmedi')}</div>
  <div class="student-line">
    <div>${esc(ogrenciAdi || '\u00D6\u011Frenci')}</div>
    <div class="lesson">${esc(sinifAdi || '')} \u00B7 ${esc(dersAdi || '')}</div>
  </div>
  <main class="columns">
    <section>
      <h2 class="section-title">\u0130\u015Flenen Konular ve Derse Kat\u0131l\u0131m</h2>
      ${konuHtml || '<div class="homework-row">Hen\u00FCz i\u015Flenen konu kayd\u0131 bulunmuyor.</div>'}
    </section>
    <section class="homework-section">
      <h2 class="section-title">\u00D6dev Ge\u00E7mi\u015Fi</h2>
      ${odevHtml || '<div class="homework-row">Hen\u00FCz \u00F6dev kayd\u0131 bulunmuyor.</div>'}
      <h2 class="section-title">Bireysel Ders ve Etüt Geçmişi</h2>
      ${etkinlikHtml || '<div>Henüz bireysel etkinlik kaydı bulunmuyor.</div>'}
      <h2 class="section-title books-title">Kitap \u0130lerlemesi</h2>
      ${kitapHtml || '<div class="homework-row">\u00D6\u011Frenciye atanm\u0131\u015F kitap bulunmuyor.</div>'}
    </section>
  </main>
</body>
</html>`;
}
