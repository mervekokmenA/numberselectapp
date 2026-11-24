# numberselectapp — Geliştirme Kuralları

Bu dosya, kullanıcının sohbetlerde verdiği kalıcı kuralları tutar. **Her geliştirmede önce buraya bak, yeni kural gelirse buraya ekle.**
Uygulama tek dosya: `index.html` (vanilla HTML/JS, Türkçe arayüz). Test için Playwright + `new Function` ile script sözdizimi denetimi kullanılır.

## 1. Genel çalışma kuralları
- Kullanıcı "her yerden kaldır" demediyse bir alanı **yalnızca söylenen sayfadan** kaldır; "her yerden / tamamen / uygulamanın tamamı" dediyse tüm sayfalardan ve ölü koddan temizle.
- Bir sayfa silinince: menü butonu, `_PAGE_IDS`, `_PAGE_LABELS`, `showMainPage` listeleri, `_pageInit`, `_OYUN_SETTERS` kayıtları da temizlenir.
- Oyun seçimi üstteki **global oyun çubuğundan** gelir; sayfaların kendi oyun seçicisi olmaz (`_oyunYay` → `_OYUN_SETTERS`).
- Değişiklikten sonra: script sözdizimi kontrolü, tüm sayfaların gezildiği tarama (hata listesi boş olmalı), ilgili sayfada Playwright doğrulaması.
- Commit mesajı sonuna attribution satırları eklenir. İş bitince hem çalışma dalına hem canlı dala (`claude/lottery-guessing-machine-ODD1U`) push edilir; canlı dal ilişkisiz geçmişli olabilir → `git merge --allow-unrelated-histories -X theirs`.
- Kullanıcıya rapor Türkçe, dürüst: yapılanlar + sınırlar/varsayımlar.

## 2. Standart tahmin/test tasarımı
- Her tahmin kapsayıcısı: **🔮 Yeni Tahmin + en çok 2 adet 📊 Geçmiş Test** sütunu (3'lü değil, **2'li**; 3. tarih seçicileri global olarak gizli/devre dışı).
- İSTİSNA: 🧫 Test sayfası 4 geçmiş test kullanır (`tfDateSel3/4`).
- İSTİSNA: Excel sayfasının iki sekmesi de (📊 Excel: `exDateSel3`, 🧪 Deneme Excel: `dxDateSel3`) 🔮 Yeni Tahmin + **3** geçmiş test kullanır (`dxDateSel3` gizlenmez, menüdeki 📅 Son 2 yine de 3 alanı da doldurur).
- Geçmiş test seçili değilse **boş yer/boşluk bırakma**; seçilmeyen sütun hiç yer kaplamaz (tüm sayfalarda).
- Henüz üretilmemiş (boş) 🔮 Yeni Tahmin sütunu da, geçmiş test sütunları açıkken yer tutmaz (Anlık/Basit `qt-pair-row`, Nihai, Net Odaklı).
- Geçmiş testler **ileriye bakmaz** (walk-forward): hedef tarihten ÖNCEKİ verilerle kurulur.
- **Kopyala butonu yalnızca 🔮 Yeni Tahmin** için; geçmiş sütunlarda kopyala yok.
- Sayfa içi kapsayıcılarda 'son N geçmiş test' / tarih doldurma butonu OLMAZ; hepsi menüdeki 📅 Son 2 ile dolar (Listeler'de aynı buton son 2 çekilişi test sütunu olarak ekler + yeni tahmin üretir).
- "📅 Son 2" (🔄 veri kontrolü ile birlikte) menünün sağ üst köşesinde TEK yerde durur; sayfalara tek tek 'Son 3' vb. buton konmaz.
- Menünün sağ üstünde 📅 Son 2'nin yanında ✕ butonu tüm sayfalardaki geçmiş test seçimlerini kapatır (`_t3Kapat`). Yeni bir geçmiş test seçicisi eklerken id'si `…Date`/`…DateSel`(+2) biçiminde ve ilk seçeneği boş olsun ki ikisi de çalışsın.
- Kareleme (siyah çerçeve): yeni sütun `data-sk-yeni="<gid>"`, geçmiş sütun `data-sk-gecmis="<gid>|<tarih>"` ile etiketlenir; geçmiş sütun KENDİ tarihinin (o günden önceki çekilişin) kesişim kümesiyle çerçevelenir. Test sayfası ve Test Geçmişi buna uyar.
- Yan yana sütunlarda (Yeni Tahmin + geçmişler) aynı sıradaki bölümler aynı üst hizadan başlar: `_hizalaKur` (CSS subgrid) bunu otomatik yapar; yeni bir sütun ızgarası eklersen `SEL` listesine ekle.
- Bölünmüş ekran sayfa listesi menü butonlarından (sıra + ad) okunur; menüye sayfa eklenince otomatik gelir.
- Aynı bilgiyi tekrar eden bölümler yerine tek yerde göster; bir sayfada zaten tarihe göre geçmiş gösteriliyorsa ayrıca "Geçmiş Test" kapsayıcısı koyma.

## 3. Renk ve işaret standardı (DOKUNMA)
- **Yeşil ✓ = net** (gerçek sonuçta var), **turuncu ~ = ±1 yakın**, gri = çıkmadı. Rozetler `_fadRozet` / `_fadDurum` / `_fadYakinSet` ile çizilir.
- Siyah çerçeve = kesişim tekrarı (`data-sk-tekrar`), mor ×N = N sütun aynı sayıyı üretti, T/Ç = Gülay toplama/çıkarma. Bu özel renklendirmeler genel UI değişikliklerinde **bozulmaz**.
- **Net/yakın gösteren her yerde, grubun üstünde "✓ N net · ~ M yakın" yazar.** Bu, `_netYakinOzet` gözlemcisiyle otomatik eklenir (sayı rozetleri ✓/~ taşıyan her grup). Yeni bir alan eklerken rozetleri ✓/~ işaretiyle üret ki özet kendiliğinden çıksın; özel çizimlerde başlığa açıkça "N net · M yakın" yaz.
- Net Odaklı Aday Havuzu'nda turuncu ±1 yakınlar da gösterilir.

## 4. Veri ve motorlar
- Bilet satırlarında (`_nnRenderTickets`) `data-lp` bulunur: basılı tutunca bilet kopyalanır. Yeni bilet çizen yerlerde de `data-lp` koy.
- Çekiliş verisi: `_kbGetDraws(gid)` / `_scanGetDraws(gid)` (yeniden eskiye `{date,nums,bonus}`). Oyunlar: sans, super, sayisal, onnumara.
- Sıradaki çekilişin tarihi `_predNextDrawDate` (yoksa `_dxSonraki`); formüller o günün gün/ayına bakar.
- 🧪 Deneme Excel: formüller `_DX_SABLON`, motor `_dxMotor`; Sayısal Joker sırası `_DX_JOKER` ile geri konur. Çalışma kitabıyla doğrulandı (4660 hücrenin 4649'u aynı). Deneme Excel × Gülay kapsayıcısı: 🟣 Aynı + 🟠 Yakın (±1), Anlık Tahmin sayfasının en üstünde ve Excel sayfasının Deneme sekmesinde.
- 📊 Excel sekmesi: sıkıştırılmış görünüm — 🔮 Yeni Tahmin + 3 geçmiş test sütunu, her sütunda formül sonuçları küçük 'harf·değer' hücreleri (formül metni gösterilmez); hücreler sabit sütunlu ızgarada (`.ex-izgara`: dar 3, orta 4, geniş 6) ve okunur boyutta; 🔁 Çoklananlar filtresi (2+/3+/4+/5+ formül aynı sayıyı üretmişse göster, hücrede mor ×N); formül düzenleme/ekleme paneli ƒx ikonuyla açılır; girişler `onchange` (donma olmasın). Formüller kullanıcının Deneme Excel çalışma kitabından (`_DX_SABLON`) gelir ve `_dxMotor` ile hesaplanır (yeni tahmin satırı sıradaki çekilişin tarihini kullanır); sekmedeki düzenlemeler `_dxMotor`'a `ovr` olarak geçer. Uygulama genelindeki Excel yıldızları (`_exYeniTahminSayilari`) da bu formülleri kullanır. Yeni Excel gelince `_DX_SABLON` yeniden üretilir.
- 🧫 'Markov ve Hazard' sayfası (eski adı Test; `page-test`, `_ts*`; kullanıcı Markov-2 ve Hazard'ı en iyi buluyor): Yeni Bilet Sistemi (`_nnCore`) × Net Odaklı Havuz (`_npPool`) × Excel (`_dxHesapla`) × Gülay (`_dxGulay`) ortak(≥2 kaynak)/yakın işaretleme, analiz tipi seçilip BİLET üretilir (`_TS_TIP`, `_tsBiletler`; bilet başına ✓/~ ve basılı tutarak kopyalama), 🔮 Yeni + **4** geçmiş test (`tfDateSel`…`tfDateSel4`; Test sayfası istisna). 🕘 Test Geçmişi: oyun başına son 100 BENZERSİZ ekran, yalnızca bilet sütunları (yeni + aktif geçmişler) (`_tsGecmis_<gid>`, oluşma zamanı, yeni+geçmiş bilet, ortak/yakın) saklanır (`_tsKaydet`/`_tsGecmisRender`); sonuç belli olunca ✓/~ ile değerlendirilir; DB senkronuna dahil. Bilet kümeleri sayfa yenilenince değişebilir (sabit tohum İSTENMEDİ). 🎯 4/5 net hedefli versiyonlar: ikinci seçici `tfAlgo2` (`<id>_h4`/`_h5`, `_tsHedefBilet`: havuzdaki k'lı grupları kapsayan biletler); iki seçiciden yalnızca biri aktif (`_tsAlgoSec`); her iki seçicinin yanında ◀ ▶ geçiş okları (`_tsOk`); YALNIZCA 4/5 net listesi son çekilişteki başarıya göre sıralanır (`_tsHedefSirala`, seçenekte 'son: N net'), diğer liste sıralanmaz; mevcut analizler DEĞİŞMEZ. Ölçüm (3 oyun × 200 çekiliş): 4+/5+ net her yöntemde ≈%0-1; hedefli versiyonlar iyileştirmedi (3+ oranı biraz düştü). 🎯 9 net hedefli grup (`_TS_H9`: kn, cf, gu, an, np, mk) YALNIZCA On Numara seçiliyken listede ve aktiftir; On Numara'da iç liste sırası 9 net → 5 net → 4 net. Ölçüm (On Numara, 120 çekiliş, aynı havuz boyutunda rastgele puanlı referansa karşı): hiçbiri anlamlı üstün değil (z -2.4…+0.7); seçilenler referanstan geri kalmayanlar. Ayrıca hedefli (havuza sıkışık) biletler serbest rastgele biletlerden daha düşük en-iyi-net verir (≈3.5 vs ≈5.0). Ölçüm alanı kullanıcı isteğiyle KALDIRILDI (geri koyma). Keşif bulgusu (18 analiz × 4 oyun × 200 çekiliş, iki ayrı dönemde): hiçbir analiz her iki dönemde anlamlı biçimde şansı geçmedi; 🤝 Eş-Görünüm tek tutarlı (ama küçük) olandır. Yeni analiz eklerken iki dönemde doğrula, başarı iddia etme. Yeni analizler Test sayfasında seçicinin altındaki '🆕 Yeni Analizler' grubuna (`_TS_TIP_YENI`) eklenir, eskilerle karışmaz. Denenen bilet-yapısı analizleri (Delta, Dengeli Yapı, Çevirme, Tekrar Kotası; 3 oyun × 200 çekiliş) rastgele biletlerden ayırt edilemedi. 2. tur (Sıcak-Soğuk, Hazard, Gecikmeli Tekrar, Markov-2, Mod-5, Ardışık Kotası, Excel∩Gülay, Borda, Pozisyon; `_TS_TIP_YENI2`) de aynı: şansı geçen yok. Algoritma eklerken ölçümle rastgele beklentiyle karşılaştır; ölçüm sonuçlarını dürüst raporla.
- Kazanan/Kronoloji: hane filtre kutuları + "tüm hanelerde ara" + Filtrele; internetten yeni ikramiye kazananı tarama butonu.

## 5. Kaldırılan alanlar (geri getirme)
3 Bilet AI (her yerde), 🧠 Çekirdek Motor, 🔑 Anahtar Şablon, 🔁 Formüllerde Tekrar Eden Sayılar, "Analiz bazlı adaylar", 🔒 En Güçlü Banko, Hızlı Tahmin sayfası, Excel Karşılaştırma sayfası, Hane Hesaplama sayfası, FAD Şablon, CHT AI, Gülsis Sıfır, CHT'deki DRN Analiz, Nihai'de Ardışık Seçici ve Çoklu Geçmiş Test, Haber'de Ölçüm Karnesi ve ✅/❌ yöntem listeleri.
Ana sayfadan kaldırılanlar (başka sayfalarda duruyor): 🧮 Formül, 🎰 Aday Sayılar, 🤖 AI Bilet Üretici.

## 6. Ana sayfa sırası
Tarihli Çekiliş Verisi en üstte → … → 🎯 Nihai Tahmin → 🎯 Net Odaklı Aday Havuzu → 🧾 Tespit → 🔀 Ortak Sayı Bulucu → 🔢 Oyun No Analizi. (Sıra `_HOME_IDS` ile de belirlenir; ikisini birlikte güncelle.)

## 7. Görsel tema
- Açık renk arka plan (koyu tema istenmedi). hamol.studio'dan alınan genel dil: Manrope yazı tipi, hap biçimli menü, yuvarlak ince çizgili kartlar, geniş harf aralıklı kart başlıkları.
- Menü itemları sola yaslı ve sıralı (hap içinde, gerilmez/dağıtılmaz).
- 🔲 Bölünmüş Ekran butonu menünün sol üst köşesinde (marka yanında), küçük.
