// ner-postprocess.js — Pembersihan output NER sebelum masuk risk scorer.
//
// Menangani dua pola false positive yang sistematis pada chat informal:
//
//   1. Pronomina yang salah ditandai sebagai PER ("gw" -> PER).
//      Daftar kata di PRONOUN_STOPLIST.
//   2. Fragmentasi tanggal numerik ("12-05-98" -> '12','05','98').
//      Entitas segrup yang bersebelahan digabung kembali.
//
// API: NerPostprocess.clean(entities) -> entities (format sama).
const NerPostprocess = (() => {

// Pronomina tidak pernah merupakan nama orang/lokasi.
// Pencocokan case-insensitive pada seluruh kata.
const PRONOUN_STOPLIST = new Set([
    'gw', 'gue', 'aku', 'saya', 'kamu', 'kau', 'anda',
    'dia', 'ia', 'beliau', 'mereka', 'kami', 'kita',
    'lo', 'lu', 'elu', 'elo',
]);

// Jarak maksimum (karakter) antar entitas segrup agar digabung.
const MERGE_GAP_MAX = 2;

function isPronoun(word) {
    return PRONOUN_STOPLIST.has(String(word).toLowerCase().trim());
}

function mergeAdjacent(entities) {
    const sorted = [...entities].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    const merged = [];
    for (const e of sorted) {
        const last = merged[merged.length - 1];
        const gap = (e.start != null && last && last.end != null)
            ? e.start - last.end
            : Infinity;
        if (last && last.entity_group === e.entity_group && gap <= MERGE_GAP_MAX && gap >= 0) {
            last.word = last.word + ' ' + e.word;
            last.end = e.end;
            last.score = Math.max(last.score, e.score);
        } else {
            merged.push({ ...e });
        }
    }
    return merged;
}

function clean(entities) {
    if (!entities || entities.length === 0) return [];
    const filtered = entities.filter((e) => !isPronoun(e.word));
    return mergeAdjacent(filtered);
}

return { clean, PRONOUN_STOPLIST };

})();
