import { sql, cors, yetkili, tablolar, hata } from './_db.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Anahtarsız TANI ucu: yalnızca kurulum durumunu söyler, hiçbir veri döndürmez.
  // Hata metni asla dışarı verilmez (bağlantı dizesi sızmasın).
  if (req.query && req.query.probe) {
    const varDb = !!process.env.DATABASE_URL;
    const varKey = !!process.env.APP_KEY;
    let db = 'denenmedi';
    if (varDb) {
      try { await sql()`select 1`; db = 'bagli'; }
      catch { db = 'baglanamadi'; }
    } else db = 'DATABASE_URL yok';
    return res.status(200).json({ ok: true, kurulum: { DATABASE_URL: varDb, APP_KEY: varKey }, db });
  }

  if (!yetkili(req)) return hata(res, 401, 'Geçersiz anahtar');
  try {
    await tablolar();
    const q = sql();
    const [{ n: durum }] = await q`select count(*)::int as n from app_state`;
    const [{ n: cekilis }] = await q`select count(*)::int as n from draws`;
    const oyunlar = await q`select game, count(*)::int as adet, max(draw_date) as son
                            from draws group by game order by game`;
    res.status(200).json({ ok: true, app_state: durum, draws: cekilis, oyunlar });
  } catch (e) {
    hata(res, 500, String(e.message || e));
  }
}
