// scoring.config.js — Seluruh parameter tuning untuk risk scorer.
//
// File ini memisahkan data tuning (bobot, ambang, trigger) dari logika
// scoring di risk-scorer.js.
const ScoringConfig = {

    // Ambang keputusan skor 0-100.
    THRESHOLDS: { warn: 20, redact: 55, block: 85 },

    // Bobot tiap pola regex (pattern id -> skor dan kategori).
    // ID terstruktur diberi skor tinggi; atribut kontekstual rendah
    // dan naik lewat ko-okurensi kategori.
    SIGNAL_SCORES: {
        NIK_KK:            { score: 80, category: 'id_number' },
        NIP:               { score: 85, category: 'id_number' },
        KARTU_KREDIT:      { score: 85, category: 'id_number' },
        NPWP:              { score: 80, category: 'id_number' },
        PASPOR:            { score: 80, category: 'id_number' },
        NO_REKENING:       { score: 80, category: 'id_number' },
        TANDA_TANGAN_DIGITAL: { score: 80, category: 'id_number' },
        SIM:               { score: 70, category: 'id_number' },
        NISN:              { score: 70, category: 'id_number' },
        NIM:               { score: 70, category: 'id_number' },
        NO_AKTA_LAHIR:     { score: 55, category: 'id_number' },
        NO_BUKU_NIKAH:     { score: 55, category: 'id_number' },
        NO_HP:             { score: 70, category: 'contact' },
        NO_TELP:           { score: 70, category: 'contact' },
        EMAIL:             { score: 70, category: 'contact' },
        NAMA_KONTEKS:      { score: 55, category: 'name' },
        NAMA_ALIAS:        { score: 55, category: 'name' },
        NAMA_IBU_KANDUNG:  { score: 55, category: 'name' },
        NAMA_AYAH_KANDUNG: { score: 55, category: 'name' },
        TGL_LAHIR:         { score: 45, category: 'birth' },
        TGL_LAHIR_ID:      { score: 45, category: 'birth' },
        TEMPAT_LAHIR:      { score: 30, category: 'birth' },
        PROFESI:           { score: 25, category: 'work' },
        GELAR_AKADEMIK:    { score: 25, category: 'work' },
        AGAMA_KONTEKS:     { score: 15, category: 'personal' },
        STATUS_PERKAWINAN: { score: 15, category: 'personal' },
        GENDER:            { score: 15, category: 'personal' },
        KEWARGANEGARAAN:   { score: 15, category: 'personal' },
        GOL_DARAH:         { score: 15, category: 'personal' },
        CIRI_FISIK:        { score: 15, category: 'personal' },
    },
    DEFAULT_SIGNAL: { score: 30, category: 'other' },

    // Bobot entitas NER. Disengaja rendah: entitas tunggal berisiko
    // rendah; skor naik lewat ko-okurensi dengan sinyal lain.
    NER_SCORES: {
        PER:  { score: 15, category: 'name' },
        LOC:  { score: 10, category: 'location' },
        GPE:  { score: 10, category: 'location' },
        DAT:  { score: 12, category: 'birth' },
        TIM:  { score: 8,  category: 'birth' },
        ORG:  { score: 8,  category: 'org' },
        MISC: { score: 5,  category: 'misc' },
    },
    NER_TOTAL_CAP: 25,

    // Pola konteks personal. Tiap grup yang cocok memberi boost sekali.
    TRIGGER_GROUPS: {
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
        id: [/\bnik\b/i, /\bktp\b/i, /\bkk\b/i, /nuptk/i, /npwp/i, /paspor/i, /no\.?\s*sim\b/i, /\bsim\b/i, /\bnip\b/i, /kartu\s*kredit/i, /kartu\s*debit/i, /\bcc\b/i],
        work: [/pekerjaan/i, /profesi/i, /\bbekerja\b/i],
    },
    TRIGGER_BOOST: 10,
    TRIGGER_BOOST_CAP: 20,

    // Tokoh publik dikecualikan dari skor NER (match case-insensitive).
    PUBLIC_FIGURES: [
        'Joko Widodo', 'Prabowo Subianto', 'Gibran Rakabuming Raka',
        'Megawati Soekarnoputri', 'Jusuf Kalla', 'Anies Baswedan',
        'Ganjar Pranowo', 'Ridwan Kamil',
    ],

    // Deret 16 digit tanpa kata penanda identitas diperlakukan sebagai
    // kandidat meragukan (mis. kode voucher) — skor dibatasi.
    SIXTEEN_DIGIT_RE: /^\d{16}$/,
    NIK_CAPPED_SCORE: 40,

    // Tanggal tanpa penanda kelahiran diperlakukan sebagai tanggal biasa
    // (mis. tanggal rapat) — skor dibatasi dan tidak memicu ko-okurensi.
    BIRTH_TRIGGER_RE: /tanggal\s+lahir|tgl\.?\s*lahir|\blah[iu]r\b|dilahirkan|kelahiran|\bttl\b/i,
    DATE_CAPPED_SCORE: 15,
    NER_DATE_CAPPED_SCORE: 5,

    // Label ramah untuk ditampilkan di toast (tanpa istilah teknis).
    DISPLAY_NAMES: {
        TGL_LAHIR: 'Tanggal lahir',
        TGL_LAHIR_ID: 'Tanggal lahir',
        NAMA_KONTEKS: 'Nama',
        NAMA_ALIAS: 'Nama panggilan',
        NAMA_IBU_KANDUNG: 'Nama ibu',
        NAMA_AYAH_KANDUNG: 'Nama ayah',
        NIK_KK: 'NIK / No. KK',
        NO_HP: 'Nomor HP',
        NO_TELP: 'Nomor telepon',
        NO_REKENING: 'Nomor rekening',
        KARTU_KREDIT: 'Kartu kredit/debit',
        NIP: 'NIP',
        TEMPAT_LAHIR: 'Tempat lahir',
        PER: 'Nama',
        LOC: 'Lokasi',
        GPE: 'Lokasi',
        DAT: 'Tanggal',
        TIM: 'Waktu',
        ORG: 'Nama organisasi',
        MISC: 'Data lain',
    },
};
