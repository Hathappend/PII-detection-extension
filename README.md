# PromptGuard — Prompting Protection

Ekstensi Chrome (Manifest V3) yang mencegah kebocoran data pribadi (PII)
saat menulis prompt ke ChatGPT / Gemini. 100% lokal — tidak ada data yang
dikirim ke server mana pun.

## Cara kerja

```
ketikan -> debounce -> Detector.analyze -> keputusan -> UI
                              |
              +----------------+-----------------+
              |                                  |
     RegexConfig (23 pola)              NER transformers.js
     ID terstruktur, presisi            nama/lokasi/tanggal,
     tinggi (NIK, HP, email)            recall tinggi
              |                                  |
              +--------> RiskScorer <-------------+
                        skor 0-100
```

Keputusan berdasarkan skor: **pass** (<20) → tidak ada aksi;
**warn** (≥20) → toast kuning; **redact** (≥55) → tombol kirim mati +
opsi "Tetap kirim"; **block** (≥85) → tombol kirim + Enter dimatikan.

## Struktur folder

```
src/
├── config/
│   ├── app.config.js      # selector DOM per platform + konstanta UI
│   ├── regex.config.js    # 23 pola RegexConfig (id, nama, regex)
│   └── model.config.js    # konfigurasi model NER (id, threshold, debounce)
├── core/                  # logika inti, tanpa dependensi DOM
│   ├── risk-scorer.js     # RiskScorer: skor 0-100 + keputusan
│   ├── ner-postprocess.js # NerPostprocess: stoplist pronomina, gabung fragment
│   └── detector.js        # Detector: orkestrasi regex + NER -> skor
├── ner/
│   └── ner-client.js      # NerClient: lazy-load transformers.js (graceful off)
├── content/               # kode yang menyentuh DOM halaman
│   ├── content.js         # entry: observer, debounce, panggil Detector
│   ├── domManager.js      # toast, tombol kirim, intersepsi Enter
│   └── content.css
├── popup/                 # UI popup ekstensi
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           # status + tombol download model NER
├── scripts/
│   └── fetch-vendor.mjs   # dev-time: bundle transformers.js -> vendor/
└── vendor/                # hasil fetch-vendor (transformers.js + *.wasm)
```

File dimuat berurutan sesuai `manifest.json` sebagai script klasik
(global `AppConfig`, `RegexConfig`, `RiskScorer`, dst. — tanpa build step).

## Memasang NER (otomatis, dua tahap)

**Tahap 1 — sekali oleh developer** (sebelum distribusi):

```bash
node scripts/fetch-vendor.mjs
```

Mengunduh & mem-bundle `transformers.js` menjadi satu file di `vendor/`
(jangan pakai CDN — CSP Manifest V3 melarang remote code), beserta file
WASM onnxruntime. Folder `vendor/` ikut ter-commit agar hasil clone
langsung bisa di-load.

**Tahap 2 — sekali oleh tiap pengguna** (otomatis via popup):

1. Klik ikon ekstensi → bagian **Model NER** → **⬇ Download Model NER**.
2. Model (~180MB, default `Xenova/bert-base-multilingual-cased-ner-hrl`)
   diunduh dengan progress bar, lalu tersimpan permanen di cache browser.
3. Jangan tutup tab selama mengunduh.

Tanpa tahap 2, ekstensi tetap jalan penuh dengan regex + risk scorer
(NER adalah penguat, bukan syarat).

## Instalasi ekstensi

1. `chrome://extensions/` → aktifkan Developer mode → Load unpacked →
   pilih folder ini.
2. Buka chatgpt.com / gemini.google.com (refresh bila sudah terbuka).
