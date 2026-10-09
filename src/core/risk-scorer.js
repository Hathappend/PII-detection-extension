// risk-scorer.js — Decision layer untuk detektor hybrid (regex + NER).
//
// Masalah yang dipecahkan: output NER mentah (PER/LOC/...) BUKAN vonis PII.
// "Jakarta" di "Jakarta macet banget" tidak setara risikonya dengan
// "Budi Santoso, 081234567890". Modul ini mengubah kandidat deteksi
// menjadi SATU skor risiko 0-100 per pesan.
//
//   regex (ID terstruktur, presisi tinggi) + NER (nama/lokasi/tanggal)
//     -> kandidat -> RiskScorer.scoreMessage -> skor -> pass|warn|redact|block
//
// Tanpa dependensi. Bentuk IIFE agar tidak mengotori global scope;
// API publik: RiskScorer.scoreMessage, RiskScorer.DEFAULT_THRESHOLDS,
// RiskScorer.DECISIONS.
const RiskScorer = (() => {

const DECISIONS = {
    PASS: 'pass',     // bukan PII / risiko dapat diabaikan
    WARN: 'warn',      // beri peringatan, biarkan user memutuskan
    REDACT: 'redact', // sensor / minta konfirmasi sebelum kirim
    BLOCK: 'block',   // tahan: tombol kirim + Enter dimatikan
};

// Threshold default. Dibias ke recall (firewall prompt): lebih baik
// warn berlebihan daripada satu NIK lolos.
const DEFAULT_THRESHOLDS = { warn: 20, redact: 55, block: 85 };

// ---------------------------------------------------------------------------
// Skor sinyal per pola regex (pattern id -> {score, category}).
// ID terstruktur = skor langsung tinggi. Nama/lokasi kontekstual = skor
// menengah, naik lewat ko-okurensi. Atribut Tier-3 = skor rendah.
// ---------------------------------------------------------------------------
const SIGNAL_SCORES = {
    // --- ID terstruktur: vonis hampir pasti ---
    NIK_KK:            { score: 80, category: 'id_number' },
    NPWP:              { score: 80, category: 'id_number' },
    PASPOR:            { score: 80, category: 'id_number' },
    NO_REKENING:       { score: 80, category: 'id_number' },
    TANDA_TANGAN_DIGITAL: { score: 80, category: 'id_number' },
    // Pola digit longgar (overlap dengan nomor HP) -> 70, bukan 80.
    SIM:               { score: 70, category: 'id_number' },
    NISN:              { score: 70, category: 'id_number' },
    NIM:               { score: 70, category: 'id_number' },
    NO_AKTA_LAHIR:     { score: 55, category: 'id_number' },
    NO_BUKU_NIKAH:     { score: 55, category: 'id_number' },
    // --- Kontak ---
    NO_HP:             { score: 70, category: 'contact' },
    EMAIL:             { score: 70, category: 'contact' },
    // --- Nama kontekstual (butuh NER/konteks sebagai penguat) ---
    NAMA_KONTEKS:      { score: 55, category: 'name' },
    NAMA_ALIAS:        { score: 55, category: 'name' },
    NAMA_IBU_KANDUNG:  { score: 55, category: 'name' },
    NAMA_AYAH_KANDUNG: { score: 55, category: 'name' },
    // --- Kelahiran ---
    TGL_LAHIR:         { score: 45, category: 'birth' },
    TGL_LAHIR_ID:      { score: 45, category: 'birth' },
    TEMPAT_LAHIR:      { score: 30, category: 'birth' },
    // --- Pekerjaan / atribut ---
    PROFESI:           { score: 25, category: 'work' },
    GELAR_AKADEMIK:    { score: 25, category: 'work' },
    AGAMA_KONTEKS:     { score: 15, category: 'personal' },
    STATUS_PERKAWINAN: { score: 15, category: 'personal' },
    GENDER:            { score: 15, category: 'personal' },
    KEWARGANEGARAAN:   { score: 15, category: 'personal' },
    GOL_DARAH:         { score: 15, category: 'personal' },
    CIRI_FISIK:        { score: 15, category: 'personal' },
};
const DEFAULT_SIGNAL = { score: 30, category: 'other' };

// Skor entitas NER. Disengaja RENDAH: nama/lokasi/tanggal yang berdiri
// sendiri = risiko rendah; naik lewat ko-okurensi. Mencakup label Xenova
// (PER/ORG/LOC/MISC) dan label tambahan model cahya (GPE/DAT/TIM).
const NER_SCORES = {
    PER:  { score: 15, category: 'name' },
    LOC:  { score: 10, category: 'location' },
    GPE:  { score: 10, category: 'location' },
    DAT:  { score: 12, category: 'birth' },
    TIM:  { score: 8,  category: 'birth' },
    ORG:  { score: 8,  category: 'org' },
    MISC: { score: 5,  category: 'misc' },
};
const NER_TOTAL_CAP = 25; // kontribusi NER dibatasi agar tidak dominan

// ---------------------------------------------------------------------------
// Trigger konteks personal: menaikkan skor kandidat yang berdekatan.
// Satu grup trigger = +10, total boost dibatasi +20.
// ---------------------------------------------------------------------------
const TRIGGER_GROUPS = {
    name: [
        /\bnamaku\b/i,
        /nama\s+(saya|aku|gw|gue)\b/i,
        /nama\s+(ibu|ayah)/i,
        /\bibu\s+saya\b/i,
        /panggil\s+(saya|aku)\b/i,
    ],
    contact: [
        /hubungi/i,
        /kontak\s+(saya|aku)/i,
        /\bemail\s+(saya|aku)\b/i,
        /\bemailku\b/i,
        /nomor\s+(hp|telepon|telp|wa)\b/i,
    ],
    address: [/\btinggal di\b/i, /\balamat\b/i, /domisili/i],
    birth: [/tanggal\s+lahir/i, /\blah[iu]r\b/i, /dilahirkan/i, /kota kelahiran/i, /\bttl\b/i],
    id: [/\bnik\b/i, /\bktp\b/i, /\bkk\b/i, /nuptk/i, /npwp/i, /paspor/i, /no\.?\s*sim\b/i],
    work: [/pekerjaan/i, /profesi/i, /\bbekerja\b/i],
};
const TRIGGER_BOOST = 10;
const TRIGGER_BOOST_CAP = 20;

// ---------------------------------------------------------------------------
// Allowlist tokoh publik (SAMPEL — ganti dengan daftar produksi dari
// Wikipedia/knowledge base). Entitas NER yang cocok persis
// (case-insensitive) dikecualikan dari skor.
// ---------------------------------------------------------------------------
const PUBLIC_FIGURES = [
    'Joko Widodo', 'Prabowo Subianto', 'Gibran Rakabuming Raka',
    'Megawati Soekarnoputri', 'Jusuf Kalla', 'Anies Baswedan',
    'Ganjar Pranowo', 'Ridwan Kamil',
];

// Aturan 16-digit: NIK/KK tanpa trigger identitas ("nik", "kk", "ktp",
// "nuptk") diperlakukan sebagai kandidat meragukan — skornya dibatasi.
// Menangkal kasus seperti kode voucher/member 16 digit.
const SIXTEEN_DIGITS = /^\d{16}$/;
const NIK_CAPPED_SCORE = 40;

// ---------------------------------------------------------------------------
// Util internal
// ---------------------------------------------------------------------------
function signalOf(patternId) {
    return SIGNAL_SCORES[patternId] || DEFAULT_SIGNAL;
}

function overlaps(a, b) {
    return a.start < b.end && b.start < a.end;
}

// Satu span teks = satu sinyal: bila beberapa pola match span yang
// bertumpuk (mis. SIM dan NO_HP pada nomor yang sama), dipakai skor
// tertinggi saja.
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

// Normalisasi nilai entitas untuk deduplikasi.
function normValue(word) {
    return String(word).toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// scoreMessage(text, { regexHits, nerEntities, thresholds, publicFigures })
//
// regexHits:   [{ patternId, start, end, matched }] — dari Detector.
// nerEntities: [{ word, entity_group, score }] — dari NER (sudah
//              dibersihkan oleh NerPostprocess).
// ---------------------------------------------------------------------------
function scoreMessage(text, options = {}) {
    const {
        regexHits = [],
        nerEntities = [],
        thresholds = DEFAULT_THRESHOLDS,
        publicFigures = PUBLIC_FIGURES,
    } = options;

    const breakdown = [];
    const allow = new Set(publicFigures.map((n) => n.toLowerCase()));

    // --- 1. Sinyal regex (dedupe span bertumpuk; pakai MAX bukan sum
    // agar repetisi tidak menggelembungkan skor) ---
    const kept = dedupeOverlapping(regexHits);
    const idTriggerPresent = TRIGGER_GROUPS.id.some((re) => re.test(text));

    let maxSignal = 0;
    const categories = new Set();
    for (const h of kept) {
        let pts = h.score;
        let note = `${h.patternId} "${h.matched}"`;
        if (h.patternId === 'NIK_KK' && SIXTEEN_DIGITS.test(h.matched.replace(/\D/g, '')) && !idTriggerPresent) {
            pts = Math.min(pts, NIK_CAPPED_SCORE);
            note += ' [16-digit tanpa trigger identitas -> dibatasi 40]';
        }
        breakdown.push({ kind: 'regex', label: h.patternId, points: pts, detail: note });
        if (pts > maxSignal) maxSignal = pts;
        categories.add(h.category);
    }

    // --- 2. Sinyal NER ---
    // DEDUP: entitas yang sama (nilai ternormalisasi + grup) hanya dihitung
    // sekali — "Budi Santoso" x5 tetap 15 poin, bukan 75. Entitas BERBEDA
    // tetap dihitung masing-masing.
    const seenEntities = new Set();
    let nerTotal = 0;
    for (const e of nerEntities) {
        const conf = e.score ?? 0;
        const grp = NER_SCORES[e.entity_group];
        if (!grp) continue;
        if (conf < ModelConfig.CONFIDENCE_MIN) {
            breakdown.push({ kind: 'ner', label: e.entity_group, points: 0,
                detail: `'${e.word}' dibuang (confidence ${conf.toFixed(2)})` });
            continue;
        }
        if (allow.has(normValue(e.word))) {
            breakdown.push({ kind: 'ner', label: e.entity_group, points: 0,
                detail: `'${e.word}' allowlisted (tokoh publik)` });
            continue;
        }
        const key = `${e.entity_group}::${normValue(e.word)}`;
        if (seenEntities.has(key)) {
            breakdown.push({ kind: 'ner', label: e.entity_group, points: 0,
                detail: `'${e.word}' duplikat -> tidak dihitung lagi` });
            continue;
        }
        seenEntities.add(key);
        nerTotal += grp.score;
        categories.add(grp.category);
        breakdown.push({ kind: 'ner', label: e.entity_group, points: grp.score,
            detail: `'${e.word}' (${conf.toFixed(2)})` });
    }
    if (nerTotal > NER_TOTAL_CAP) {
        breakdown.push({ kind: 'ner', label: 'CAP', points: 0,
            detail: `total NER ${nerTotal} dibatasi ${NER_TOTAL_CAP}` });
        nerTotal = NER_TOTAL_CAP;
    }
    if (nerTotal > maxSignal) maxSignal = nerTotal;

    // --- 3. Ko-okurensi: tiap kategori BERBEDA di luar yang pertama = +15.
    // "Budi Santoso" saja (1 kategori) != "Budi Santoso, 081234567890"
    // (2 kategori). Dihitung dari SET kategori -> aman dari repetisi.
    const nCat = categories.size;
    const cooccur = Math.min(45, 15 * Math.max(0, nCat - 1));
    if (cooccur > 0) {
        breakdown.push({ kind: 'cooccur', label: 'CO-OCCURRENCE', points: cooccur,
            detail: `${nCat} kategori berbeda: ${[...categories].join(', ')}` });
    }

    // --- 4. Boost trigger konteks personal (sekali per grup -> aman
    // dari repetisi) ---
    let trigBoost = 0;
    for (const [group, patterns] of Object.entries(TRIGGER_GROUPS)) {
        if (patterns.some((re) => re.test(text))) {
            trigBoost += TRIGGER_BOOST;
            breakdown.push({ kind: 'trigger', label: 'TRIGGER', points: TRIGGER_BOOST,
                detail: `konteks personal: ${group}` });
        }
    }
    if (trigBoost > TRIGGER_BOOST_CAP) {
        breakdown.push({ kind: 'trigger', label: 'CAP', points: 0,
            detail: `boost trigger ${trigBoost} dibatasi ${TRIGGER_BOOST_CAP}` });
        trigBoost = TRIGGER_BOOST_CAP;
    }

    const score = Math.min(100, maxSignal + cooccur + trigBoost);
    const decision =
        score >= thresholds.block ? DECISIONS.BLOCK :
        score >= thresholds.redact ? DECISIONS.REDACT :
        score >= thresholds.warn ? DECISIONS.WARN : DECISIONS.PASS;

    return { score, decision, breakdown, categories: [...categories] };
}

return { DECISIONS, DEFAULT_THRESHOLDS, PUBLIC_FIGURES, scoreMessage };

})();
