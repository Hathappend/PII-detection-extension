// Konfigurasi model NER (Named Entity Recognition).
//
// Model berjalan 100% di dalam browser via transformers.js — tidak ada
// data yang dikirim ke server mana pun (syarat privasi PromptGuard).
const ModelConfig = {
    // Model default: siap pakai hari ini (sudah tersedia dalam format ONNX
    // untuk transformers.js). Teruji: NAMA 6/7, ALAMAT 4/4 di 30 kalimat uji.
    MODEL_ID: 'Xenova/bert-base-multilingual-cased-ner-hrl',

    // Kandidat pengganti (lebih akurat utk bahasa Indonesia + punya label
    // tanggal DAT): 'cahya/bert-base-indonesian-NER'. Syarat: konversi dulu
    // ke ONNX via optimum lalu hosting/letakkan lokal. Lihat README.
    // MODEL_ID: 'cahya/bert-base-indonesian-NER',

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
