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
let vendorError = null; // pesan error terakhir (untuk diagnostik)

// Cek ringan: apakah file vendor/transformers.js bisa di-import?
// (import di-cache oleh module system, jadi murah untuk dipanggil ulang)
// Dibagi dua langkah agar penyebab kegagalan jelas: file tidak diserve
// (butuh Reload di chrome://extensions) vs modul gagal dievaluasi.
async function probeVendor() {
    if (vendorOk !== null) return vendorOk;
    const url = chrome.runtime.getURL(ModelConfig.VENDOR_LIB);
    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) {
            vendorError = `fetch vendor: HTTP ${res.status} (${url}) — klik Reload di chrome://extensions`;
            console.warn('[PromptGuard]', vendorError);
            vendorOk = false;
            return vendorOk;
        }
    } catch (err) {
        vendorError = `fetch vendor gagal: ${err && err.message} (${url})`;
        console.warn('[PromptGuard]', vendorError);
        vendorOk = false;
        return vendorOk;
    }
    try {
        await import(url);
        vendorOk = true;
        vendorError = null;
    } catch (err) {
        vendorError = `import vendor gagal: ${err && err.message}`;
        console.warn('[PromptGuard]', vendorError);
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
                // Detail penyebabnya sudah di-log oleh probeVendor().
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
        // transformers.js v3 TIDAK mendukung aggregation_strategy —
        // output selalu token mentah: [{ entity: 'B-LOC'|'I-LOC'|'O', score, word }].
        // Agregasi BIO -> entitas dilakukan manual di sini.
        const tokens = await pipe(text);
        return aggregateBio(tokens);
    } catch (err) {
        console.warn('[PromptGuard] Inferensi NER gagal.', err);
        return [];
    }
}

// Gabungkan token BIO ("B-LOC","I-LOC",...) menjadi entitas utuh.
// Menangani subword BERT ("##ati" -> "ati", tanpa spasi) dan tanda baca.
function aggregateBio(tokens) {
    const entities = [];
    let cur = null;
    const flush = () => { if (cur) { entities.push(cur); cur = null; } };
    for (const t of tokens || []) {
        const label = String(t.entity || '');
        if (!label || label === 'O' || label === 'LABEL_0') { flush(); continue; }
        const dash = label.indexOf('-');
        const prefix = dash > 0 ? label.slice(0, dash) : '';
        const type = dash > 0 ? label.slice(dash + 1) : label;
        if (prefix === 'B' || !cur || cur.type !== type) {
            flush();
            cur = { type, parts: [t.word], scores: [t.score] };
        } else {
            cur.parts.push(t.word);
            cur.scores.push(t.score);
        }
    }
    flush();
    return entities.map((e) => ({
        word: joinWordParts(e.parts),
        entity_group: e.type,
        score: Math.max(...e.scores),
        start: null,
        end: null,
    }));
}

function joinWordParts(parts) {
    let out = '';
    for (const w of parts) {
        const word = String(w || '');
        if (word.startsWith('##')) out += word.slice(2);
        else if (out === '' || /^[.,;:!?)\]}%'"]/.test(word)) out += word;
        else out += ' ' + word;
    }
    return out;
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
    return { vendorOk: await probeVendor(), vendorError, model: ModelConfig.MODEL_ID };
}

// Dipanggil internal setelah pipeline terbukti bekerja.
function markReady() {
    try {
        chrome.storage.local.set({ pg_ner_ready: true, pg_ner_ready_at: Date.now() });
    } catch (err) { /* storage tidak tersedia -> abaikan */ }
}

return { extractEntities, warmup, probeVendor, status };

})();
