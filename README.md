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
└── popup/
    └── popup.html         # status ekstensi
```

File dimuat berurutan sesuai `manifest.json` sebagai script klasik
(global `AppConfig`, `RegexConfig`, `RiskScorer`, dst. — tanpa build step).

## Memasang NER (opsional, sekali saja)

Tanpa langkah ini ekstensi tetap jalan (mode regex + risk scorer).

1. Download bundle `transformers.js` dan simpan sebagai
   `vendor/transformers.js` (jangan pakai CDN — CSP melarangnya).
2. Buka ChatGPT, ketik sesuatu, buka console: `[PromptGuard] Model NER
   siap` berarti model (default: `Xenova/bert-base-multilingual-cased-ner-hrl`,
   ~180MB q8) terunduh & ter-cache.
3. Untuk model lain (mis. hasil fine-tune sendiri), ubah `MODEL_ID` di
   `src/config/model.config.js`.

## Instalasi ekstensi

1. `chrome://extensions/` → aktifkan Developer mode → Load unpacked →
   pilih folder ini.
2. Buka chatgpt.com / gemini.google.com (refresh bila sudah terbuka).
