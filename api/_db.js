// Neon Postgres bağlantısı ve ortak yardımcılar.
// Bağlantı dizesi YALNIZCA sunucu tarafında, Vercel ortam değişkeninde durur (DATABASE_URL).
// Tarayıcı hiçbir zaman bağlantı dizesini görmez.
import { neon } from '@neondatabase/serverless';

let _sql = null;
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL tanımlı değil');
    _sql = neon(url);
  }
  return _sql;
}

// Basit paylaşılan anahtar doğrulaması. APP_KEY tanımlıysa istemci x-app-key göndermek zorunda.
export function yetkili(req) {
  const beklenen = process.env.APP_KEY;
  if (!beklenen) return true;                     // anahtar tanımlı değilse açık (yerel geliştirme)
  const gelen = req.headers['x-app-key'] || '';
  return gelen === beklenen;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-app-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

export async function tablolar() {
  const q = sql();
  await q`create table if not exists app_state (
    k text primary key,
    v jsonb not null,
    updated_at timestamptz not null default now()
  )`;
  await q`create table if not exists draws (
    game text not null,
    draw_date date not null,
    nums integer[] not null,
    bonus integer[] not null default '{}',
    updated_at timestamptz not null default now(),
    primary key (game, draw_date)
  )`;
  await q`create index if not exists draws_game_date_idx on draws (game, draw_date desc)`;
}

// Gövdeyi güvenli oku (Vercel bazen string, bazen nesne verir)
export async function govde(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body); } catch { return {}; } }
  let ham = '';
  for await (const p of req) ham += p;
  try { return ham ? JSON.parse(ham) : {}; } catch { return {}; }
}

export function hata(res, kod, mesaj) {
  res.status(kod).json({ ok: false, hata: mesaj });
}
