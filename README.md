# Harita Pin Lite

Kişisel kullanım için, telefon tarayıcısından çalışan, **sunucusuz** bir harita + fotoğraf uygulaması (PWA). iPhone Fotoğraflar'ın harita görünümüne benzer: haritada istediğin yerlere pin koyup fotoğraf ekliyorsun; pinler kapak fotoğrafının küçük resmi olarak görünüyor, yakın pinler otomatik kümeleniyor.

**Hiçbir sunucu/backend yok.** Fotoğraflar hiçbir yere yüklenmiyor, analitik/telemetri yok. Tüm veri telefonunun tarayıcısında (IndexedDB) duruyor. Tek ağ trafiği harita karoları (ve dışa aktarılan paylaşım dosyasında CDN'den kütüphane yükleme).

## Özellikler

- **Uzun basarak** (harita üzerinde ~500ms) veya **"+" butonuyla** (seçtiğin fotoğrafların EXIF GPS bilgisine göre otomatik konumlama, birbirine ~50m'den yakın fotoğraflar aynı pine gider) pin ekleme.
- Yakın pinler haritada otomatik kümeleniyor; köşede toplam fotoğraf sayısı rozeti.
- Pin detayı: başlık/not düzenleme, fotoğraf ekleme/silme, pini taşıma (nişangahla), pini silme.
- Tam ekran fotoğraf görüntüleyici: kaydırma, iki parmakla yakınlaştırma, aşağı kaydırarak ya da geri tuşuyla kapatma.
- **Yedekle / Geri yükle:** tüm veriyi tek bir `.zip` dosyasına aktarma, geri yüklerken "birleştir" ya da "değiştir" seçeneği.
- **Paylaşılabilir harita olarak dışa aktarma:** tek bir `.html` dosyası — alıcı internet olduğu sürece (harita karoları için) tarayıcıda açıp haritayı, pinleri ve fotoğrafları salt okunur görebilir. Hiçbir ek kurulum gerekmez.
- **KMZ olarak dışa aktarma:** Google Earth'te açılabilen dosya.
- PWA: "Ana ekrana ekle" ile uygulama gibi açılma, çevrimdışı açılış (harita karoları hariç — onlar internet ister).

## Teknik yapı

Derleme adımı yok: düz HTML + CSS + JavaScript (ES modülleri). Kütüphaneler (`MapLibre GL JS`, `supercluster`, `exifr`, `fflate`) tek seferlik indirilip `vendor/` klasörüne gömülü; uygulama çalışırken hiçbir CDN'e gitmez (yalnızca harita karoları ve paylaşım dosyası dışa aktarılırken).

```
index.html, styles.css, manifest.webmanifest, sw.js
icons/             ikonlar (icon.svg kaynağı + üretilen PNG'ler)
vendor/            sabit sürümlü kütüphaneler
src/               uygulama kodu (app.js giriş noktası)
  ui/              panel/diyalog bileşenleri
tools/             geliştirme araçları (vendor indirme, ikon üretme) — uygulamanın parçası değil
tests/             Playwright duman testleri
```

## Yerelde çalıştırma

Gereksinim: [Node.js](https://nodejs.org) (geliştirme araçları ve test çalıştırıcısı için; uygulamanın kendisi derlenmiyor).

```bash
npm install
npm run serve
```

Tarayıcıda **http://localhost:5173** açılır.

### Telefondan aynı Wi-Fi üzerinden test

1. Bilgisayarının yerel IP adresini bul (`ipconfig` → "IPv4 Address").
2. Telefonun tarayıcısında `http://<bilgisayarın-IP'si>:5173` adresine git.

**Not:** Konum (`navigator.geolocation`) ve service worker gibi bazı özellikler tarayıcılar tarafından HTTPS ister (yerel ağda düz `http://` üzerinden çalışmayabilir). Bu özellikleri tam test etmek için aşağıdaki gibi HTTPS ile yayınlanmış bir adres kullanman gerekir.

## Yayınlama (ücretsiz, HTTPS ile)

İkisi de statik dosya barındırma servisidir, bu projeye uygundur.

### GitHub Pages

1. Bu klasörü bir GitHub deposuna gönder (`git push`).
2. Depo ayarlarında **Settings → Pages** → "Deploy from a branch" → `main` dalı, kök klasör (`/`).
3. Birkaç dakika sonra `https://<kullanıcı-adın>.github.io/<depo-adı>/` adresinde yayında olur.

### Netlify Drop

1. [app.netlify.com/drop](https://app.netlify.com/drop) adresine git.
2. Proje klasörünü (tamamını) tarayıcıya sürükle-bırak.
3. Anında bir `https://...netlify.app` adresi verir.

## "Ana ekrana ekle"

### iPhone (Safari)

1. Siteyi Safari'de aç.
2. Alt menüden **Paylaş** ikonuna dokun.
3. **"Ana Ekrana Ekle"**ye dokun.

### Android (Chrome)

1. Siteyi Chrome'da aç.
2. Sağ üstteki ⋮ menüsünden **"Ana ekrana ekle"** ya da **"Uygulama yükle"**yi seç.

Ana ekrandaki simgeden açınca adres çubuğu olmadan, tam ekran bir uygulama gibi çalışır.

## Verilerin gizliliği ve yedekleme

**Tüm pinler ve fotoğraflar yalnızca o anda kullandığın telefonun/tarayıcının yerel deposunda (IndexedDB) durur.** Hiçbir sunucuya gönderilmez. Bu şu anlama gelir:

- Tarayıcı verilerini temizlersen (veya "gizli sekme" kullanırsan) pinler kalıcı olarak silinir.
- Telefonu değiştirirsen veya tarayıcıyı değiştirirsen eski veriler otomatik taşınmaz.
- Uygulamayı kaldırıp yeniden eklemek (ana ekrandan) genelde veriyi silmez (tarayıcı depolamasına bağlıdır) ama garanti değildir.

**Bu yüzden menüdeki "Yedekle" ile düzenli aralıklarla `.zip` yedeği alıp kendine (Drive, mail, WhatsApp vb.) göndermen önemlidir.** Uygulama 2 haftadan uzun süredir yedek almadıysan ana ekranda nazikçe hatırlatır.

## Testler

[Playwright](https://playwright.dev) ile yazılmış duman testleri: sayfa açılıyor, uzun basmayla pin ekleniyor, kümeleme/rozetler, pin detay paneli, "+" akışı (EXIF GPS), yedekle/geri yükle, paylaşılabilir HTML dışa aktarma (dışa aktarılan dosya gerçekten `file://` ile açılıp test ediliyor), KMZ dışa aktarma, PWA (manifest/service worker/çevrimdışı).

```bash
npm test
```

Playwright, sistemde kurulu Chrome'u kullanır (ayrı bir tarayıcı indirmez).

### Kurumsal ağ / yönetilen tarayıcı sorunu

Bazı kurumsal ağlarda (güvenlik politikası gereği) Chrome, Playwright'ın varsayılan başlatma yöntemini engelleyip anında kapanabilir. Böyle bir hata alırsan:

1. Chrome'u elle, hata ayıklama portuyla başlat:
   ```bash
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```
2. Testleri o Chrome'a bağlanacak şekilde çalıştır:
   ```bash
   CDP_ENDPOINT=http://localhost:9222 npm test
   ```

## Geliştirme araçları (`tools/`, uygulamanın parçası değil)

- `npm run fetch-vendor` — `vendor/` klasöründeki kütüphaneleri CDN'den yeniden indirir (sürüm güncellemesi gerektiğinde `tools/fetch-vendor.mjs` içindeki sürüm numaralarını değiştir).
- `npm run gen-icons` — `icons/icon.svg`'deki tasarımı `icons/*.png` olarak yeniden üretir.

- @Future path track çizilebilsin
