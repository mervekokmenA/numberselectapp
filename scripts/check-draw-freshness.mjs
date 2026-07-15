#!/usr/bin/env node
// update-draws.mjs her çalıştığında (kaynaklar başarılı olsa da olmasa da) çağrılır.
// index.html içindeki DRAW_SCHEDULE'a göre her oyunun "geçmiş olması gereken en son çekiliş
// tarihi" hesaplanır ve elimizdeki en yeni veriyle karşılaştırılır. GRACE_DAYS'i aşan bir
// gecikme varsa (yani mynet+lotobil+millipiyangoonline'ın HEPSİ aynı anda başarısız oldu demektir)
// stdout'a "STALE:" ile başlayan bir satır basılır — workflow bunu görünce bir GitHub issue
// açar/günceller, repo sahibine e-posta gider. Böylece sorun sessizce günlerce fark edilmeden kalmaz.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INDEX_PATH = fileURLToPath(new URL('../index.html', import.meta.url));
const GRACE_DAYS = 3; // kaynakların geç yayınlaması için tolerans payı

function trNow() {
  return new Date(Date.now() + 3 * 3600 * 1000);
}

// `days` (0=Paz..6=Cmt) içinde, `from` tarihinden GERİYE doğru ilk uyan günü bulur (ISO date).
function lastScheduledOnOrBefore(days, from) {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    if (days.includes(d.getUTCDay())) return d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return null;
}

function main() {
  const html = readFileSync(INDEX_PATH, 'utf8');

  const schedRe = /const DRAW_SCHEDULE\s*=\s*\{([\s\S]*?)\};/;
  const sm = schedRe.exec(html);
  if (!sm) { console.log('DRAW_SCHEDULE bulunamadı, kontrol atlandı.'); return; }
  const schedule = {};
  const gRe = /(\w+):\s*\[([\d,\s]*)\]/g;
  let g;
  while ((g = gRe.exec(sm[1]))) {
    schedule[g[1]] = g[2].split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n));
  }

  const blockRe = /const DRAW_DATA = \{([\s\S]*?)\n\};/;
  const bm = blockRe.exec(html);
  if (!bm) { console.log('DRAW_DATA bulunamadı, kontrol atlandı.'); return; }
  const gameRe = /(sayisal|super|sans|onnumara):`([^`]*)`/g;
  const latest = {};
  let m;
  while ((m = gameRe.exec(bm[1]))) {
    const first = m[2].split('\n').find(l => l.trim());
    latest[m[1]] = first ? (first.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || null : null;
  }

  const today = trNow();
  const graceFrom = new Date(today.getTime() - GRACE_DAYS * 86400000);
  const stale = [];
  for (const [gameId, days] of Object.entries(schedule)) {
    if (!days.length) continue;
    const expected = lastScheduledOnOrBefore(days, graceFrom);
    const have = latest[gameId];
    if (expected && (!have || have < expected)) {
      stale.push({ gameId, have: have || 'yok', expectedAtLeast: expected });
    }
  }

  if (stale.length) {
    console.log('STALE:' + JSON.stringify(stale));
  } else {
    console.log('OK: tüm oyunların verisi güncel (tolerans: ' + GRACE_DAYS + ' gün).');
  }
}

main();
