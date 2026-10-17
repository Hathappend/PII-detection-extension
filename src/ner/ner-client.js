// ner-client.js — Pemuatan model NER via transformers.js.
//
// Model dimuat sekali saat pertama dibutuhkan (bukan saat halaman dibuka).
// Bila library atau model tidak tersedia, fungsi mengembalikan [] dan
// ekstensi tetap berjalan dengan regex + risk scorer. Semua teks diproses
// lokal di browser; tidak ada data yang keluar.
//
// API:
//   NerClient.extractEntities(text)      -> Promise<[{word, entity_group, score, start, end}]>
//   NerClient.warmup(progressCallback)   -> Promise<boolean> (unduh model + progres)
//   NerClient.probeVendor()              -> Promise<boolean> (apakah vendor/ tersedia?)
//   NerClient.status()                   -> Promise<{available, model}>
const NerClient = (() => {

let pipelinePromise = null;
let vendorOk = null;
let vendorError = null;

// Memastikan vendor/transformers.js dapat di-import.
// Pengecekan dibagi dua tahap agar penyebab kegagalan teridentifikasi:
// file tidak tersedia vs modul gagal dievaluasi.
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

    // onnxruntime diarahkan ke file .wasm lokal di dalam ekstensi
    // (bawaan transformers.js menunjuk ke CDN yang diblokir CSP).
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
    // console.log('[PromptGuard] Model NER siap:', ModelConfig.MODEL_ID);
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
            // NER tidak tersedia untuk sesi ini; deteksi lanjut dengan regex.
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
        // transformers.js v3 mengembalikan token mentah tanpa agregasi
        // (tanpa entity_group/start/end): [{ entity: 'B-LOC'|'I-LOC'|'O', score, word }].
        // Agregasi BIO menjadi entitas dilakukan manual di bawah.
        const tokens = await pipe(text);
        return aggregateBio(tokens);
    } catch (err) {
        console.warn('[PromptGuard] Inferensi NER gagal.', err);
        return [];
    }
}

// Menggabungkan token BIO ("B-LOC","I-LOC",...) menjadi entitas utuh,
// termasuk penanganan subword BERT ("##ati") dan tanda baca.
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

// Mengunduh model (~110MB, sekali saja lalu di-cache browser)
// dengan laporan progres via callback.
async function warmup(progressCallback) {
    const pipe = await loadPipeline(progressCallback || null);
    return !!pipe;
}

// Status untuk popup dan debug console. Tidak memicu unduhan model;
// status "model siap" dibaca dari chrome.storage.
async function status() {
    return { vendorOk: await probeVendor(), vendorError, model: ModelConfig.MODEL_ID };
}

// Menandai model siap di storage setelah pipeline terbukti bekerja.
function markReady() {
    try {
        chrome.storage.local.set({ pg_ner_ready: true, pg_ner_ready_at: Date.now() });
    } catch (err) { /* storage tidak tersedia -> abaikan */ }
}

return { extractEntities, warmup, probeVendor, status };

})();
