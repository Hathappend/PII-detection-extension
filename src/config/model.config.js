// Konfigurasi model NER (Named Entity Recognition).
//
// Model berjalan 100% di dalam browser via transformers.js — tidak ada
// data yang dikirim ke server mana pun (syarat privasi PromptGuard).
const ModelConfig = {
    // Model default: cahya/bert-base-indonesian-NER (uncased, 110MB q8).
    // Dikonversi ke ONNX int8 2026-10-11, teruji unggul utk chat informal
    // Indonesia: lowercase terdeteksi, "jl melati no 10 sby" -> LOC.
    MODEL_ID: 'hathappend/cahya-bert-base-indonesian-ner-onnx',

    // Model lama (multilingual cased, ~180MB) sebagai cadangan:
    // MODEL_ID: 'Xenova/bert-base-multilingual-cased-ner-hrl',

    QUANTIZED: true,          // pakai varian q8 (~180MB) agar unduhan ringan
    CONFIDENCE_MIN: 0.5,     // entitas di bawah ini dibuang
    DEBOUNCE_MS: 700,        // jeda setelah berhenti mengetik sebelum NER jalan
    MIN_CHARS_FOR_NER: 12,   // teks lebih pendek dari ini: regex saja cukup

    // Lokasi bundle transformers.js (WAJIB dibundle lokal di folder
    // vendor/ — jangan pakai CDN agar lolos Content Security Policy).
    // Jika file tidak ada, NER nonaktif diam-diam (mode degradasi:
    // regex + risk scorer tetap berjalan).
    VENDOR_LIB: 'vendor/transformers.js',
};
