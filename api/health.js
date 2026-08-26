import { sql, cors, yetkili, tablolar, hata } from './_db.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
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
