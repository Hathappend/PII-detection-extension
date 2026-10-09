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
// CARA PASANG (sekali saja, lihat README.md):
//   1. Download bundle transformers.js -> vendor/transformers.js
//      (JANGAN pakai CDN — Content Security Policy ekstensi melarangnya).
//   2. Model ONNX diunduh otomatis dari HuggingFace saat pertama dipakai
//      lalu di-cache browser (butuh internet sekali saja).
//
// API: NerClient.extractEntities(text) -> Promise<[{word, entity_group,
//   score, start, end}]> (format pipeline transformers.js, aggregated).
const NerClient = (() => {

let pipelinePromise = null;

async function loadPipeline() {
    if (pipelinePromise) return pipelinePromise;

    pipelinePromise = (async () => {
        try {
            const libUrl = chrome.runtime.getURL(ModelConfig.VENDOR_LIB);
            const { pipeline, env } = await import(libUrl);

            // Model di-cache di dalam browser; izinkan eksekusi multithread
            // bila tersedia (fallback otomatis ke single-thread).
            env.allowLocalModels = false;

            const pipe = await pipeline(
                'token-classification',
                ModelConfig.MODEL_ID,
                { quantized: ModelConfig.QUANTIZED }
            );
            console.log('[PromptGuard] Model NER siap:', ModelConfig.MODEL_ID);
            return pipe;
        } catch (err) {
            // Library tidak ada / model gagal diunduh / WebGPU tidak
            // didukung -> NER nonaktif permanen untuk sesi ini.
            console.warn('[PromptGuard] NER tidak tersedia, mode regex-only.', err);
            return null;
        }
    })();

    return pipelinePromise;
}

async function extractEntities(text) {
    const pipe = await loadPipeline();
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

// Untuk pengujian / debug dari console.
async function status() {
    const pipe = await loadPipeline();
    return { available: !!pipe, model: ModelConfig.MODEL_ID };
}

return { extractEntities, status };

})();
