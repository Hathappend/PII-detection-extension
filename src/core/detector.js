// detector.js — Orkestrator deteksi: regex + NER -> RiskScorer.
//
// Alur:
//   analyze(text)
//     1. scanRegex(text)      -> hits pola RegexConfig (dengan span)
//     2. Jika sinyal regex saja sudah mencapai BLOCK -> selesai (hemat:
//        inferensi NER tidak akan mengubah keputusan).
//     3. NerClient.extractEntities(text) -> NerPostprocess.clean(...)
//     4. RiskScorer.scoreMessage(...) -> { score, decision, breakdown }
//
// API:
//   Detector.scanRegex(text) -> [{ patternId, name, start, end, matched }]
//   Detector.analyze(text)   -> Promise<{ score, decision, breakdown,
//                                         categories, summary }>
const Detector = (() => {

// Regex global itu stateful (lastIndex) -> selalu reset sebelum dipakai.
function scanRegex(text) {
    const hits = [];
    for (const p of RegexConfig.PATTERNS) {
        p.regex.lastIndex = 0;
        let m;
        while ((m = p.regex.exec(text)) !== null) {
            if (m[0].length === 0) { p.regex.lastIndex++; continue; }
            hits.push({
                patternId: p.id,
                name: p.name,
                start: m.index,
                end: m.index + m[0].length,
                matched: m[0],
            });
        }
    }
    return hits;
}

// Nama ramah untuk label di breakdown (regex id -> nama Indonesia,
// grup NER -> nama Indonesia).
const NER_GROUP_NAMES = {
    PER: 'Nama (NER)', LOC: 'Lokasi (NER)', GPE: 'Lokasi (NER)',
    DAT: 'Tanggal (NER)', TIM: 'Waktu (NER)',
    ORG: 'Organisasi (NER)', MISC: 'Lainnya (NER)',
};

function summarize(result, regexHits) {
    const names = new Map();
    for (const h of regexHits) names.set(h.patternId, h.name);
    const parts = [];
    for (const b of result.breakdown) {
        if (b.points <= 0) continue;
        if (b.kind === 'regex') parts.push(names.get(b.label) || b.label);
        else if (b.kind === 'ner') parts.push(NER_GROUP_NAMES[b.label] || b.label);
    }
    // Unik, maksimal 3 jenis.
    return [...new Set(parts)].slice(0, 3);
}

async function analyze(text) {
    const clean = String(text || '');
    if (!clean.trim()) {
        return { score: 0, decision: RiskScorer.DECISIONS.PASS, breakdown: [], categories: [], summary: [] };
    }

    const regexHits = scanRegex(clean);

    // Jalur cepat: sinyal regex saja sudah BLOCK -> NER tidak akan
    // mengubah keputusan (skor hanya bisa naik). Hemat inferensi.
    const fast = RiskScorer.scoreMessage(clean, { regexHits, nerEntities: [] });
    if (fast.decision === RiskScorer.DECISIONS.BLOCK) {
        return { ...fast, summary: summarize(fast, regexHits), nerSkipped: true };
    }

    // Jalur penuh: regex + NER.
    let nerEntities = [];
    let nerRawCount = -1;
    if (clean.length >= ModelConfig.MIN_CHARS_FOR_NER) {
        try {
            const raw = await NerClient.extractEntities(clean);
            nerRawCount = raw.length;
            nerEntities = NerPostprocess.clean(raw);
            if (raw.length > 0) {
                console.log('[PromptGuard] NER mentah:', JSON.stringify(raw.map((e) => [e.entity_group, e.word, +e.score.toFixed(2)])));
            }
        } catch (err) {
            console.warn('[PromptGuard] NER gagal, lanjut dengan regex saja.', err);
        }
    }
    if (nerRawCount === 0) console.log('[PromptGuard] NER: tidak ada entitas terdeteksi.');

    const result = RiskScorer.scoreMessage(clean, { regexHits, nerEntities });
    return { ...result, summary: summarize(result, regexHits), nerSkipped: false };
}

return { scanRegex, analyze };

})();
