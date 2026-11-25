#!/usr/bin/env node
// ⚡ Hızlı On sonuçlarını toplar → <çıktı>.json ([no,"YYYY-MM-DD HH:MM"(TR),[20 sayı]], yeniden eskiye, son 31 gün).
// Milli Piyango'nun çekiliş API'si dışarıdan 403 verir; istekler sayfanın kendi gizli anahtarıyla imzalanır
// (X-GW-HMAC = HMAC-SHA256(secretkey, tamURL+"GET")). Bu yüzden gerçek bir tarayıcıyla (Playwright) sitenin
// sayfası açılır ve istekler SAYFANIN İÇİNDEN atılır. Anahtarlar sayfadan çalışma anında okunur (depoda tutulmaz).
// Kullanım: node scripts/update-hizlion.mjs <hizlion.json yolu> [geriye_dönük_gün]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const OUT = process.argv[2] || 'hizlion.json';
const GUN = 31, SAYFA = 'https://www.millipiyangoonline.com/hizli-on-numara/cekilis-sonuclari';
const mevcut = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const harita = new Map(mevcut.map(x => [x[0], x]));
const trNow = new Date(Date.now() + 3 * 3600e3);
// kaç gün geriye: elle verilmişse o; yoksa veri yok → 31, var → son çekilişin gününden bugüne
let geri = +process.argv[3] || 0;
if (!geri) {
  if (!mevcut.length) geri = GUN;
  else {
    const son = Date.parse(mevcut[0][1].replace(' ', 'T') + ':00Z');
    geri = Math.min(GUN, Math.floor((trNow - son) / 86400e3) + 1);
  }
}
const sonNo = mevcut.length ? mevcut[0][0] : 0;
const sonZaman = mevcut.length ? Date.parse(mevcut[0][1].replace(' ', 'T') + ':00Z') : 0;

// 'chromium' kanalı = tam (yeni headless) Chromium; eski headless-shell Akamai'ye daha kolay yakalanıyor
const yerel = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : { channel: 'chromium' };
const b = await chromium.launch({ args: ['--no-sandbox'], ...yerel });
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' });
const p = await ctx.newPage();
try { await p.goto(SAYFA, { timeout: 60000, waitUntil: 'domcontentloaded' }); } catch (e) { console.log('goto:', e.message.slice(0, 80)); }
let hazir = false;
for (let i = 0; i < 20 && !hazir; i++) {          // bekleme odası / yavaş yükleme için ~40 sn'ye kadar bekle
  await p.waitForTimeout(2000);
  hazir = await p.evaluate(() => !!(window.sisalsansglobal && window.sisalsansglobal.secretkey)).catch(() => false);
}
if (!hazir) { console.log('url:', p.url(), 'başlık:', await p.title().catch(()=>'?')); console.log('HATA: sayfa anahtarları yüklenmedi (erişim engeli / bekleme odası olabilir)'); await b.close(); process.exit(2); }

let ek = 0, hata = 0, istek = 0;
for (let d = 0; d < geri; d++) {
  const t = new Date(trNow.getTime() - d * 86400e3);
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, g = t.getUTCDate();
  for (let h = 23; h >= 0; h--) {
    // gelecekteki saatleri ve son çekilişten önceki (zaten bilinen) saatleri atla
    const saatBas = Date.UTC(y, m - 1, g, h, 0) ;
    if (saatBas > trNow.getTime()) continue;
    if (sonZaman && saatBas + 3600e3 <= sonZaman - 3600e3 && d > 0) continue;
    const url = `https://lotteryservice.millipiyangoonline.com/api/hizli-on-numara/v1/hourly-draws-history/${y}/${m}/${g}/${h}?caller=web-portal`;
    istek++;
    let r;
    for (let k = 0; k < 2; k++) {
      r = await p.evaluate(async u => {
        try {
          const G = window.sisalsansglobal, te = new TextEncoder();
          const key = await crypto.subtle.importKey('raw', te.encode(G.secretkey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const hm = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(u + 'GET')))].map(x => x.toString(16).padStart(2, '0')).join('');
          const x = await fetch(u, { headers: { 'Internal-Key': G.internalkey, 'X-GW-Client-Id': 'web-portal', 'X-GW-Origin': 'https://www.millipiyangoonline.com', 'X-GW-HMAC': hm, Accept: 'application/json, text/plain, */*' } });
          return { s: x.status, t: await x.text() };
        } catch (e) { return { s: 0, t: String(e) }; }
      }, url);
      if (r.s === 200) break;
      await p.waitForTimeout(1200);
    }
    if (r.s !== 200) { hata++; continue; }
    let j; try { j = JSON.parse(r.t); } catch (e) { hata++; continue; }
    if (!Array.isArray(j)) continue;
    j.forEach(x => {
      try {
        const no = x.drawId.number, nums = x.winningNumbers[0].numbers;
        if (!nums || nums.length !== 20 || new Set(nums).size !== 20 || nums.some(n => n < 1 || n > 80)) return;
        const tr = new Date(new Date(x.drawDate).getTime() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
        if (!harita.has(no)) { harita.set(no, [no, tr, nums.slice().sort((a, c) => a - c)]); ek++; }
      } catch (e) {}
    });
    await p.waitForTimeout(80);
  }
}
await b.close();
let liste = [...harita.values()].sort((a, c) => c[0] - a[0]);
if (liste.length) {
  const esik = Date.parse(liste[0][1].replace(' ', 'T') + ':00Z') - GUN * 86400e3;
  liste = liste.filter(x => Date.parse(x[1].replace(' ', 'T') + ':00Z') >= esik);
}
console.log(`istek ${istek} · hata ${hata} · yeni ${ek} · toplam ${liste.length} · en yeni ${liste[0] ? liste[0][0] + ' ' + liste[0][1] : '-'}`);
if (istek > 0 && hata === istek) { console.log('HATA: hiçbir istek başarılı olmadı'); process.exit(3); }
writeFileSync(OUT, JSON.stringify(liste));
