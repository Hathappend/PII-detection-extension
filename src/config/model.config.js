// ModelConfig — Konfigurasi model NER.
//
// Model berjalan di dalam browser via transformers.js; tidak ada data
// yang dikirim ke server.
const ModelConfig = {
    // cahya/bert-base-indonesian-NER (uncased, 110MB terkuantisasi).
    // Dikonversi ke ONNX int8 2026-10-11. Cocok untuk chat informal
    // Indonesia: nama lowercase terdeteksi, "jl melati no 10 sby" -> LOC.
    MODEL_ID: 'hathappend/cahya-bert-base-indonesian-ner-onnx',

    // Cadangan (multilingual cased, ~180MB):
    // MODEL_ID: 'Xenova/bert-base-multilingual-cased-ner-hrl',

    QUANTIZED: true,          // varian terkuantisasi agar unduhan ringan
    CONFIDENCE_MIN: 0.5,     // entitas di bawah ambang ini dibuang
    DEBOUNCE_MS: 700,        // jeda setelah berhenti mengetik sebelum NER jalan
    MIN_CHARS_FOR_NER: 12,   // teks lebih pendek dari ini: regex saja cukup

    // Bundle transformers.js lokal di folder vendor/ (CSP memblokir CDN).
    // Bila file tidak ada, NER nonaktif dan deteksi berjalan dengan regex saja.
    VENDOR_LIB: 'vendor/transformers.js',
};
