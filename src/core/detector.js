// detector.js — Orkestrasi deteksi: regex + NER -> RiskScorer.
//
//   analyze(text):
//     1. scanRegex        -> kandidat pola RegexConfig (dengan span)
//     2. Jalur cepat: bila regex saja sudah BLOCK, NER dilewati
//        (skor hanya bisa naik, keputusan tak berubah)
//     3. NER -> NerPostprocess.clean -> kandidat entitas
//     4. RiskScorer.scoreMessage -> { score, decision, breakdown }
//
// API: scanRegex(text), analyze(text) -> Promise<hasil + summary>
const Detector = (() => {

// Regex global menyimpan lastIndex antar pemakaian -> selalu di-reset.
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

// Label ramah untuk ringkasan toast (tanpa istilah teknis).
// Definisi di ScoringConfig.DISPLAY_NAMES.
function friendlyName(label, fallback) {
    return ScoringConfig.DISPLAY_NAMES[label] || fallback;
}

function summarize(result, regexHits) {
    const names = new Map();
    for (const h of regexHits) names.set(h.patternId, h.name);
    const parts = [];
    for (const b of result.breakdown) {
        if (b.points <= 0) continue;
        if (b.kind === 'regex') {
            // Tanggal yang dibatasi (bukan tanggal lahir) tampilkan
            // sebagai "Tanggal" saja agar tidak menyesatkan.
            if (b.dateCapped) {
                parts.push('Tanggal');
            } else {
                parts.push(friendlyName(b.label, names.get(b.label) || b.label));
            }
        }
        else if (b.kind === 'ner') parts.push(friendlyName(b.label, b.label));
    }
    return [...new Set(parts)];
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
    // let nerRawCount = -1;
    if (clean.length >= ModelConfig.MIN_CHARS_FOR_NER) {
        try {
            const raw = await NerClient.extractEntities(clean);
            // nerRawCount = raw.length;
            nerEntities = NerPostprocess.clean(raw);
            // if (raw.length > 0) {
            //     console.log('[PromptGuard] NER mentah:', JSON.stringify(raw.map((e) => [e.entity_group, e.word, +e.score.toFixed(2)])));
            // }
        } catch (err) {
            console.warn('[PromptGuard] NER gagal, lanjut dengan regex saja.', err);
        }
    }
    // if (nerRawCount === 0) console.log('[PromptGuard] NER: tidak ada entitas terdeteksi.');

    const result = RiskScorer.scoreMessage(clean, { regexHits, nerEntities });
    return { ...result, summary: summarize(result, regexHits), nerSkipped: false };
}

return { scanRegex, analyze };

})();
