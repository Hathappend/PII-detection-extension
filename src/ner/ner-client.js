// ner-client.js — Loader malas (lazy) untuk model NER via transformers.js.
//
// Prinsip desain:
//   1. Model dimuat SEKALI, saat pertama dibutuhkan (bukan saat halaman
//      dibuka) — menghemat memori & waktu startup.
//   2. Graceful degradation: jika library/model tidak tersedia, fungsi
//      mengembalikan [] dan ekstensi tetap berjalan dengan regex +
//      risk scorer. NER adalah penguat, bukan syarat.
//   3. Semua teks diproses lokal di browser; tidak ada data yang keluar.
//
// CARA PASANG (sekali saja, oleh developer):
//   node scripts/fetch-vendor.mjs   -> mengisi vendor/transformers.js + *.wasm
//   (JANGAN pakai CDN — Content Security Policy ekstensi melarang remote code.)
//
// API:
//   NerClient.extractEntities(text)      -> Promise<[{word, entity_group, score, start, end}]>
//   NerClient.warmup(progressCallback)   -> Promise<boolean> (download model + progress)
//   NerClient.probeVendor()              -> Promise<boolean> (apakah vendor/ ada?)
//   NerClient.status()                   -> Promise<{available, model}>
const NerClient = (() => {

let pipelinePromise = null;
let vendorOk = null; // null = belum dicek

// Cek ringan: apakah file vendor/transformers.js bisa di-import?
// (import di-cache oleh module system, jadi murah untuk dipanggil ulang)
async function probeVendor() {
    if (vendorOk !== null) return vendorOk;
    try {
        await import(chrome.runtime.getURL(ModelConfig.VENDOR_LIB));
        vendorOk = true;
    } catch (err) {
        vendorOk = false;
    }
    return vendorOk;
}

async function createPipeline(progressCallback) {
    const libUrl = chrome.runtime.getURL(ModelConfig.VENDOR_LIB);
    const { pipeline, env } = await import(libUrl);

    // Arahkan onnxruntime ke file .wasm LOKAL di dalam ekstensi.
    // (Default-nya CDN jsdelivr — diblokir CSP & butuh internet tiap sesi.)
    // Sumber: transformers.js v3 src/backends/onnx.js
    //   -> env.backends.onnx = ONNX_ENV (onnxruntime env)
    try {
        if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
            env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
        }
    } catch (err) {
        console.warn('[PromptGuard] Gagal set wasmPaths, pakai default.', err);
    }

    const options = { quantized: ModelConfig.QUANTIZED };
    if (progressCallback) options.progress_callback = progressCallback;

    const pipe = await pipeline('token-classification', ModelConfig.MODEL_ID, options);
    console.log('[PromptGuard] Model NER siap:', ModelConfig.MODEL_ID);
    return pipe;
}

function loadPipeline(progressCallback) {
    if (pipelinePromise) return pipelinePromise;
    pipelinePromise = (async () => {
        try {
            if (!(await probeVendor())) {
                console.warn('[PromptGuard] vendor/transformers.js tidak ada. ' +
                    'Jalankan: node scripts/fetch-vendor.mjs');
                return null;
            }
            const pipe = await createPipeline(progressCallback || null);
            if (pipe) markReady();
            return pipe;
        } catch (err) {
            // Model gagal diunduh / WebAssembly tidak didukung ->
            // NER nonaktif permanen untuk sesi ini.
            console.warn('[PromptGuard] NER tidak tersedia, mode regex-only.', err);
            return null;
        }
    })();
    return pipelinePromise;
}

async function extractEntities(text) {
    const pipe = await loadPipeline(null);
    if (!pipe) return [];
    try {
        const out = await pipe(text, { aggregation_strategy: 'simple' });
        return out.map((e) => ({
            word: e.word,
            entity_group: e.entity_group,
            score: e.score,
            start: e.start,
            end: e.end,
        }));
    } catch (err) {
        console.warn('[PromptGuard] Inferensi NER gagal.', err);
        return [];
    }
}

// warmup: dipanggil dari tombol popup. Mengunduh model (~180MB, sekali
// saja lalu di-cache browser) dengan laporan progres.
// progressCallback menerima { file, progress (0-100), loaded, total, status }.
async function warmup(progressCallback) {
    const pipe = await loadPipeline(progressCallback || null);
    return !!pipe;
}

// Untuk popup & debug dari console. MURAH: tidak memicu download model.
// Status "model siap" dibaca popup dari chrome.storage (di-set setelah
// warmup/inferensi pertama berhasil).
async function status() {
    return { vendorOk: await probeVendor(), model: ModelConfig.MODEL_ID };
}

// Dipanggil internal setelah pipeline terbukti bekerja.
function markReady() {
    try {
        chrome.storage.local.set({ pg_ner_ready: true, pg_ner_ready_at: Date.now() });
    } catch (err) { /* storage tidak tersedia -> abaikan */ }
}

return { extractEntities, warmup, probeVendor, status };

})();
