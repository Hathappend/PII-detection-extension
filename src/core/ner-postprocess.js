// ner-postprocess.js — Pembersihan output NER sebelum masuk risk scorer.
//
// Model NER (terutama yang dilatih di teks berita formal) punya pola
// false positive yang sistematis di chat informal. File ini menanganinya
// dengan aturan murah dan dapat dijelaskan:
//
//   1. PRONOUN_STOPLIST — model kadang menandai pronomina sebagai PER
//      ("gw" -> PER 0.98). Pronomina tidak pernah nama orang.
//   2. MERGE_ADJACENT — tanggal numerik sering terfragmentasi
//      ("12-05-98" -> DAT '12','05','98'); gabungkan entitas segrup
//      yang bersebelahan.
//
// API: NerPostprocess.clean(entities) -> entities (format sama).
// entities: [{ word, entity_group, score, start?, end? }]
const NerPostprocess = (() => {

// Pronomina Indonesia tidak pernah merupakan nama orang/lokasi.
// Perbandingan case-insensitive, match persis seluruh kata.
const PRONOUN_STOPLIST = new Set([
    'gw', 'gue', 'aku', 'saya', 'kamu', 'kau', 'anda',
    'dia', 'ia', 'beliau', 'mereka', 'kami', 'kita',
    'lo', 'lu', 'elu', 'elo',
]);

// Jarak maksimum (karakter) antar dua entitas segrup agar digabung.
// 2 mencakup pemisah "-" dan " " pada "12-05-98" -> "12-05-98".
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
    // 1. Buang pronomina yang salah ditandai sebagai entitas.
    const filtered = entities.filter((e) => !isPronoun(e.word));
    // 2. Gabungkan fragment yang bersebelahan.
    return mergeAdjacent(filtered);
}

return { clean, PRONOUN_STOPLIST };

})();
