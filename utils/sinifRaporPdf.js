const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

const dateText = value => {
  if (!value) return '—';
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) :
    `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

const statusLabel = value => ({
  geldi: 'Geldi', gecikti: 'Geç geldi', gelmedi: 'Gelmedi',
  yapildi: 'Yapıldı', yapilmadi: 'Yapılmadı', gec: 'Geç getirdi',
  bekliyor: 'Bekliyor',
}[value] || '—');

export function sinifRaporHtml({
  okulAdi, sinifAdi, dersAdi, donemYili, olusturmaTarihi,
  students = [], notes = [], homeworks = [], books = [], events = [],
}) {
  const attendanceTotal = students.reduce((sum, item) => sum + item.attendance.total, 0);
  const homeworkTotal = students.reduce((sum, item) => sum + item.homework.total, 0);
  const attendanceRows = students.map(item => `<tr>
    <td>${esc(item.name)}</td>
    <td>${item.attendance.geldi}</td>
    <td>${item.attendance.gecikti}</td>
    <td>${item.attendance.gelmedi}</td>
    <td>${item.homework.yapildi}</td>
    <td>${item.homework.gec}</td>
    <td>${item.homework.yapilmadi}</td>
    <td>${item.homework.bekliyor}</td>
  </tr>`).join('');
  const noteRows = notes.map(item => `<tr><td>${dateText(item.date)}</td><td>${esc(item.student || 'Sınıf')}</td><td>${esc(item.note)}</td></tr>`).join('');
  const homeworkRows = homeworks.map(item => `<tr>
    <td>${esc(item.title)}</td><td>${dateText(item.due)}</td><td>${item.done}</td>
    <td>${item.late}</td><td>${item.notDone}</td><td>${item.pending}</td>
  </tr>`).join('');
  const bookRows = books.map(item => `<tr>
    <td>${esc(item.student)}</td><td>${esc(item.name)}</td><td>${item.completed} / ${item.total}</td><td>%${item.percent}</td>
  </tr>`).join('');
  const eventRows = events.map(item => `<tr>
    <td>${esc(item.student)}</td><td>${esc(item.type)}</td><td>${dateText(item.date)}</td>
    <td>${esc(item.start || '')}–${esc(item.end || '')}</td><td>${esc(statusLabel(item.status))}</td>
    <td>${esc((item.topics || []).join(', '))}</td>
  </tr>`).join('');
  const generated = dateText(olusturmaTarihi || new Date().toISOString());
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@page{size:A4 portrait;margin:14mm}
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#263238;font-size:9pt;margin:0}
h1{font-size:19pt;color:#1b5e20;text-align:center;margin:0 0 5mm}
h2{font-size:12pt;color:#1b5e20;border-bottom:1px solid #c8e6c9;padding-bottom:2mm;margin:8mm 0 3mm}
.meta{text-align:center;color:#546e7a;line-height:1.6;margin-bottom:7mm}
.summary{display:flex;gap:3mm;margin:5mm 0}.tile{flex:1;border:1px solid #c8e6c9;border-radius:5px;padding:3mm;text-align:center}
.tile strong{display:block;font-size:16pt;color:#1b5e20}.tile span{font-size:8pt;color:#607d8b}
table{width:100%;border-collapse:collapse;margin:2mm 0 5mm;table-layout:auto}
th,td{border:1px solid #cfd8dc;padding:2.2mm;text-align:left;vertical-align:top}
th{background:#e8f5e9;color:#1b5e20;font-weight:bold}tr{page-break-inside:avoid}
.small{font-size:8pt;color:#607d8b}.empty{color:#78909c;font-style:italic;padding:3mm 0}
.footer{margin-top:8mm;text-align:right;color:#78909c;font-size:8pt}
</style></head><body>
<h1>Sınıf Gelişim Raporu</h1>
<div class="meta"><strong>${esc(okulAdi || 'Okul belirtilmedi')}</strong><br>
${esc(sinifAdi || 'Sınıf')} · ${esc(dersAdi || 'Ders belirtilmedi')} · ${esc(donemYili || '')} dönemi<br>
Rapor tarihi: ${generated}</div>
<div class="summary">
<div class="tile"><strong>${students.length}</strong><span>Öğrenci</span></div>
<div class="tile"><strong>${notes.length}</strong><span>Ders notu / konu kaydı</span></div>
<div class="tile"><strong>${attendanceTotal}</strong><span>Yoklama kaydı</span></div>
<div class="tile"><strong>${homeworkTotal}</strong><span>Öğrenci-ödev durumu</span></div>
</div>
<h2>Öğrenci bazında yoklama ve ödev özeti</h2>
${students.length ? `<table><thead><tr><th>Öğrenci</th><th>Geldi</th><th>Geç</th><th>Gelmedi</th><th>Yaptı</th><th>Geç</th><th>Yapmadı</th><th>Bekliyor</th></tr></thead><tbody>${attendanceRows}</tbody></table>` : '<p class="empty">Öğrenci kaydı bulunamadı.</p>'}
<h2>İşlenen dersler ve notlar</h2>
${notes.length ? `<table><thead><tr><th>Tarih</th><th>Öğrenci</th><th>İşlenen konu / ders notu</th></tr></thead><tbody>${noteRows}</tbody></table>` : '<p class="empty">Ders notu bulunamadı.</p>'}
<h2>Ödevlerin sınıf geneli durumu</h2>
${homeworks.length ? `<table><thead><tr><th>Ödev</th><th>Teslim</th><th>Yaptı</th><th>Geç</th><th>Yapmadı</th><th>Bekliyor</th></tr></thead><tbody>${homeworkRows}</tbody></table>` : '<p class="empty">Ödev kaydı bulunamadı.</p>'}
<h2>Kitap ve sayfa ilerlemesi</h2>
${books.length ? `<table><thead><tr><th>Öğrenci</th><th>Kitap</th><th>Tamamlanan / toplam sayfa</th><th>İlerleme</th></tr></thead><tbody>${bookRows}</tbody></table>` : '<p class="empty">Kitap ilerleme kaydı bulunamadı.</p>'}
<h2>Özel ders, etüt ve soru çözümü etkinlikleri</h2>
${events.length ? `<table><thead><tr><th>Öğrenci</th><th>Etkinlik</th><th>Tarih</th><th>Saat</th><th>Yoklama</th><th>İşlenen konular</th></tr></thead><tbody>${eventRows}</tbody></table>` : '<p class="empty">Bireysel etkinlik kaydı bulunamadı.</p>'}
<div class="footer">Öğretmen Ajanda Pro · Bu rapor seçili dönem kayıtlarından oluşturulmuştur.</div>
</body></html>`;
}
