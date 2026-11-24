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
- Geçmiş test seçili değilse **boş yer/boşluk bırakma**; seçilmeyen sütun hiç yer kaplamaz (tüm sayfalarda).
- Geçmiş testler **ileriye bakmaz** (walk-forward): hedef tarihten ÖNCEKİ verilerle kurulur.
- **Kopyala butonu yalnızca 🔮 Yeni Tahmin** için; geçmiş sütunlarda kopyala yok.
- "📅 Son 2 çekilişi doldur" butonu dropdown'ları son çekilişlerle doldurur.
- Aynı bilgiyi tekrar eden bölümler yerine tek yerde göster; bir sayfada zaten tarihe göre geçmiş gösteriliyorsa ayrıca "Geçmiş Test" kapsayıcısı koyma.

## 3. Renk ve işaret standardı (DOKUNMA)
- **Yeşil ✓ = net** (gerçek sonuçta var), **turuncu ~ = ±1 yakın**, gri = çıkmadı. Rozetler `_fadRozet` / `_fadDurum` / `_fadYakinSet` ile çizilir.
- Siyah çerçeve = kesişim tekrarı (`data-sk-tekrar`), mor ×N = N sütun aynı sayıyı üretti, T/Ç = Gülay toplama/çıkarma. Bu özel renklendirmeler genel UI değişikliklerinde **bozulmaz**.
- **Net/yakın gösteren her yerde, grubun üstünde "✓ N net · ~ M yakın" yazar.** Bu, `_netYakinOzet` gözlemcisiyle otomatik eklenir (sayı rozetleri ✓/~ taşıyan her grup). Yeni bir alan eklerken rozetleri ✓/~ işaretiyle üret ki özet kendiliğinden çıksın; özel çizimlerde başlığa açıkça "N net · M yakın" yaz.
- Net Odaklı Aday Havuzu'nda turuncu ±1 yakınlar da gösterilir.

## 4. Veri ve motorlar
- Çekiliş verisi: `_kbGetDraws(gid)` / `_scanGetDraws(gid)` (yeniden eskiye `{date,nums,bonus}`). Oyunlar: sans, super, sayisal, onnumara.
- Sıradaki çekilişin tarihi `_predNextDrawDate` (yoksa `_dxSonraki`); formüller o günün gün/ayına bakar.
- 🧪 Deneme Excel: formüller `_DX_SABLON`, motor `_dxMotor`; Sayısal Joker sırası `_DX_JOKER` ile geri konur. Çalışma kitabıyla doğrulandı (4660 hücrenin 4649'u aynı). Deneme Excel × Gülay kapsayıcısı: 🟣 Aynı + 🟠 Yakın (±1), Anlık Tahmin sayfasının en üstünde ve Excel sayfasının Deneme sekmesinde.
- 📊 Excel sekmesi: büyük tablo yok, her formül kendi kapsayıcısında; girişler `onchange` (donma olmasın). Formüller kullanıcının Deneme Excel çalışma kitabından (`_DX_SABLON`) gelir ve `_dxMotor` ile hesaplanır (yeni tahmin satırı sıradaki çekilişin tarihini kullanır); sekmedeki düzenlemeler `_dxMotor`'a `ovr` olarak geçer. Uygulama genelindeki Excel yıldızları (`_exYeniTahminSayilari`) da bu formülleri kullanır. Yeni Excel gelince `_DX_SABLON` yeniden üretilir.
- Kazanan/Kronoloji: hane filtre kutuları + "tüm hanelerde ara" + Filtrele; internetten yeni ikramiye kazananı tarama butonu.

## 5. Kaldırılan alanlar (geri getirme)
3 Bilet AI (her yerde), 🧠 Çekirdek Motor, 🔑 Anahtar Şablon, 🔁 Formüllerde Tekrar Eden Sayılar, "Analiz bazlı adaylar", 🔒 En Güçlü Banko, Hızlı Tahmin sayfası, Excel Karşılaştırma sayfası, Hane Hesaplama sayfası, FAD Şablon, CHT AI, Gülsis Sıfır, CHT'deki DRN Analiz, Nihai'de Ardışık Seçici ve Çoklu Geçmiş Test, Haber'de Ölçüm Karnesi ve ✅/❌ yöntem listeleri.
Ana sayfadan kaldırılanlar (başka sayfalarda duruyor): 🧮 Formül, 🎰 Aday Sayılar, 🤖 AI Bilet Üretici.

## 6. Ana sayfa sırası
Tarihli Çekiliş Verisi en üstte → … → 🎯 Nihai Tahmin → 🎯 Net Odaklı Aday Havuzu → 🧾 Tespit → 🔀 Ortak Sayı Bulucu → 🔢 Oyun No Analizi. (Sıra `_HOME_IDS` ile de belirlenir; ikisini birlikte güncelle.)

## 7. Görsel tema
- Açık renk arka plan (koyu tema istenmedi). hamol.studio'dan alınan genel dil: Manrope yazı tipi, hap biçimli menü, yuvarlak ince çizgili kartlar, geniş harf aralıklı kart başlıkları.
- 🔲 Bölünmüş Ekran butonu menünün sol üst köşesinde (marka yanında), küçük.
