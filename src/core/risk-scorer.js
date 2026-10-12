// risk-scorer.js — Lapisan keputusan untuk detektor hybrid (regex + NER).
//
// Output NER mentah (PER/LOC/...) bukan vonis PII: "Jakarta" pada
// "Jakarta macet banget" tidak setara risikonya dengan
// "Budi Santoso, 081234567890". Modul ini mengubah kandidat deteksi
// menjadi satu skor risiko 0-100 per pesan.
//
// Alur: regex (ID terstruktur) + NER (nama/lokasi/tanggal) -> kandidat
//       -> scoreMessage -> skor -> pass | warn | redact | block
//
// Seluruh bobot dan ambang baca dari ScoringConfig (src/config/).
// Tanpa dependensi. API publik: scoreMessage, DECISIONS.
const RiskScorer = (() => {

const DECISIONS = {
    PASS: 'pass',
    WARN: 'warn',
    REDACT: 'redact',
    BLOCK: 'block',
};

// ---------------------------------------------------------------------------
// Util internal
// ---------------------------------------------------------------------------

function signalOf(patternId) {
    return ScoringConfig.SIGNAL_SCORES[patternId] || ScoringConfig.DEFAULT_SIGNAL;
}

function overlaps(a, b) {
    return a.start < b.end && b.start < a.end;
}

// Satu span teks dihitung satu sinyal: bila beberapa pola cocok pada span
// yang bertumpuk, dipakai skor tertinggi saja (anti repetisi).
function dedupeOverlapping(hits) {
    const scored = hits.map((h) => ({ ...h, ...signalOf(h.patternId) }));
    scored.sort((a, b) => b.score - a.score || (b.end - b.start) - (a.end - a.start));
    const kept = [];
    for (const h of scored) {
        if (kept.some((k) => overlaps(h, k))) continue;
        kept.push(h);
    }
    return kept;
}

function normValue(word) {
    return String(word).toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Tahap 1: sinyal regex
// ---------------------------------------------------------------------------

function scoreRegexHits(hits, text, ctx) {
    const kept = dedupeOverlapping(hits);
    const idTriggerPresent = ScoringConfig.TRIGGER_GROUPS.id.some((re) => re.test(text));
    const birthTriggerPresent = ScoringConfig.BIRTH_TRIGGER_RE.test(text);
    ctx.birthTriggerPresent = birthTriggerPresent;

    let maxSignal = 0;
    for (const h of kept) {
        let pts = h.score;
        let note = `${h.patternId} "${h.matched}"`;
        let dateCapped = false;

        if (h.patternId === 'NIK_KK'
            && ScoringConfig.SIXTEEN_DIGIT_RE.test(h.matched.replace(/\D/g, ''))
            && !idTriggerPresent) {
            pts = Math.min(pts, ScoringConfig.NIK_CAPPED_SCORE);
            note += ' [16 digit tanpa penanda identitas -> dibatasi]';
        }
        if ((h.patternId === 'TGL_LAHIR' || h.patternId === 'TGL_LAHIR_ID') && !birthTriggerPresent) {
            pts = Math.min(pts, ScoringConfig.DATE_CAPPED_SCORE);
            note += ' [tanggal tanpa penanda kelahiran -> dibatasi]';
            dateCapped = true;
        }

        ctx.breakdown.push({ kind: 'regex', label: h.patternId, points: pts, detail: note, dateCapped });
        if (pts > maxSignal) maxSignal = pts;
        if (!dateCapped) ctx.categories.add(h.category);
    }
    return maxSignal;
}

// ---------------------------------------------------------------------------
// Tahap 2: sinyal NER (dengan deduplikasi nilai yang sama)
// ---------------------------------------------------------------------------

function scoreNerEntities(entities, ctx) {
    const allow = ctx.allowlist;
    const seen = new Set();
    let total = 0;

    for (const e of entities) {
        const conf = e.score ?? 0;
        const grp = ScoringConfig.NER_SCORES[e.entity_group];
        if (!grp) continue;

        if (conf < ModelConfig.CONFIDENCE_MIN) {
            ctx.breakdown.push({ kind: 'ner', label: e.entity_group, points: 0,
                detail: `'${e.word}' dibuang (confidence ${conf.toFixed(2)})` });
            continue;
        }
        if (allow.has(normValue(e.word))) {
            ctx.breakdown.push({ kind: 'ner', label: e.entity_group, points: 0,
                detail: `'${e.word}' dikecualikan (tokoh publik)` });
            continue;
        }
        const key = `${e.entity_group}::${normValue(e.word)}`;
        if (seen.has(key)) {
            ctx.breakdown.push({ kind: 'ner', label: e.entity_group, points: 0,
                detail: `'${e.word}' duplikat -> tidak dihitung lagi` });
            continue;
        }
        seen.add(key);

        let pts = grp.score;
        let note = `'${e.word}' (${conf.toFixed(2)})`;
        let dateCapped = false;
        if ((e.entity_group === 'DAT' || e.entity_group === 'TIM') && !ctx.birthTriggerPresent) {
            pts = Math.min(pts, ScoringConfig.NER_DATE_CAPPED_SCORE);
            note += ' [tanggal tanpa penanda kelahiran -> dibatasi]';
            dateCapped = true;
        }

        total += pts;
        if (!dateCapped) ctx.categories.add(grp.category);
        ctx.breakdown.push({ kind: 'ner', label: e.entity_group, points: pts, detail: note });
    }

    if (total > ScoringConfig.NER_TOTAL_CAP) {
        ctx.breakdown.push({ kind: 'ner', label: 'CAP', points: 0,
            detail: `total NER ${total} dibatasi ${ScoringConfig.NER_TOTAL_CAP}` });
        total = ScoringConfig.NER_TOTAL_CAP;
    }
    return total;
}

// ---------------------------------------------------------------------------
// Tahap 3: ko-okurensi kategori berbeda
// ---------------------------------------------------------------------------

function scoreCooccurrence(ctx) {
    const n = ctx.categories.size;
    const pts = Math.min(45, 15 * Math.max(0, n - 1));
    if (pts > 0) {
        ctx.breakdown.push({ kind: 'cooccur', label: 'CO-OCCURRENCE', points: pts,
            detail: `${n} kategori berbeda: ${[...ctx.categories].join(', ')}` });
    }
    return pts;
}

// ---------------------------------------------------------------------------
// Tahap 4: boost konteks personal
// ---------------------------------------------------------------------------

const SELF_ID_RE = /\b(saya|aku|gue|gw)\b/i;

function scoreTriggers(text, nerEntities, ctx) {
    let boost = 0;

    for (const [group, patterns] of Object.entries(ScoringConfig.TRIGGER_GROUPS)) {
        if (patterns.some((re) => re.test(text))) {
            boost += ScoringConfig.TRIGGER_BOOST;
            ctx.breakdown.push({ kind: 'trigger', label: 'TRIGGER',
                points: ScoringConfig.TRIGGER_BOOST, detail: `konteks personal: ${group}` });
        }
    }

    const nameTriggerFired = ScoringConfig.TRIGGER_GROUPS.name.some((re) => re.test(text));
    const hasPerEntity = nerEntities.some(
        (e) => e.entity_group === 'PER'
            && (e.score ?? 0) >= ModelConfig.CONFIDENCE_MIN
            && !ctx.allowlist.has(normValue(e.word))
    );
    if (hasPerEntity && SELF_ID_RE.test(text) && !nameTriggerFired) {
        boost += ScoringConfig.TRIGGER_BOOST;
        ctx.breakdown.push({ kind: 'trigger', label: 'TRIGGER',
            points: ScoringConfig.TRIGGER_BOOST,
            detail: 'identifikasi diri: kata ganti orang pertama + nama (PER)' });
    }

    if (boost > ScoringConfig.TRIGGER_BOOST_CAP) {
        ctx.breakdown.push({ kind: 'trigger', label: 'CAP', points: 0,
            detail: `boost trigger ${boost} dibatasi ${ScoringConfig.TRIGGER_BOOST_CAP}` });
        boost = ScoringConfig.TRIGGER_BOOST_CAP;
    }
    return boost;
}

// ---------------------------------------------------------------------------
// API utama
// ---------------------------------------------------------------------------

function scoreMessage(text, options = {}) {
    const {
        regexHits = [],
        nerEntities = [],
        thresholds = ScoringConfig.THRESHOLDS,
        publicFigures = ScoringConfig.PUBLIC_FIGURES,
    } = options;

    const ctx = {
        breakdown: [],
        categories: new Set(),
        birthTriggerPresent: false,
        allowlist: new Set(publicFigures.map((n) => n.toLowerCase())),
    };

    const regexMax = scoreRegexHits(regexHits, text, ctx);
    const nerTotal = scoreNerEntities(nerEntities, ctx);
    const cooccur = scoreCooccurrence(ctx);
    const trigBoost = scoreTriggers(text, nerEntities, ctx);

    const maxSignal = Math.max(regexMax, nerTotal);
    const score = Math.min(100, maxSignal + cooccur + trigBoost);
    const decision =
        score >= thresholds.block ? DECISIONS.BLOCK :
        score >= thresholds.redact ? DECISIONS.REDACT :
        score >= thresholds.warn ? DECISIONS.WARN : DECISIONS.PASS;

    return { score, decision, breakdown: ctx.breakdown, categories: [...ctx.categories] };
}

return { DECISIONS, scoreMessage };

})();
