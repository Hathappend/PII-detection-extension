// Kamus Pola Deteksi (Regex) untuk Data Sensitif
// Ter-Update FULL sesuai Dokumen 1_Data_Identitas_Utama.md
const RegexConfig = {
    PATTERNS: [
        // ============================================
        // A. NAMA & HUBUNGAN KELUARGA
        // ============================================
        {
            id: 'NAMA_KONTEKS',
            name: 'Nama Lengkap',
            // Strict Mode: Hanya menangkap jika ada kata eksplisit "nama"
            // Menangkap: nama saya, nama aku, namaku, nama lengkap, nama adalah
            regex: /(?:nama\s(?:saya|aku|adalah|lengkap)|namaku)\s+([a-zA-Z]+(?:\s[a-zA-Z]+){0,2})/gi
        },
        {
            id: 'NAMA_ALIAS',
            name: 'Nama Alias/Panggilan',
            regex: /(?:nama\s(?:panggilan|alias)(?:\ssaya)?(?:\sadalah)?\s+)([A-Za-z]+)/gi
        },
        {
            id: 'NAMA_IBU_KANDUNG',
            name: 'Nama Ibu Kandung',
            regex: /(?:nama\s+ibu(?:\s+kandung)?(?:\s+saya)?(?:\s+adalah)?\s+)([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/gi
        },
        {
            id: 'NAMA_AYAH_KANDUNG',
            name: 'Nama Ayah Kandung',
            regex: /(?:nama\s+ayah(?:\s+kandung)?(?:\s+saya)?(?:\s+adalah)?\s+)([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/gi
        },
        {
            id: 'GELAR_AKADEMIK',
            name: 'Gelar Akademik/Keagamaan',
            regex: /\b(Prof\.|Dr\.|dr\.|Ir\.|H\.|Hj\.|S\.Kom|S\.T\.|S\.E\.|S\.Pd|M\.T\.|M\.Kom|M\.Sc|Ph\.D)\s+[A-Z][a-z]+/gi
        },

        // ============================================
        // B. NOMOR IDENTITAS RESMI NEGARA
        // ============================================
        {
            id: 'NIK_KK',
            name: 'NIK / No. KK',
            regex: /\b([1-9][1-9]\d{14})\b/g
        },
        {
            id: 'NPWP',
            name: 'Nomor NPWP',
            regex: /\b\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-]?\d{1}[\.\-]?\d{3}[\.\-]?\d{3}\b/g
        },
        {
            id: 'PASPOR',
            name: 'Nomor Paspor',
            regex: /\b[A-Za-z]\d{7}\b/g
        },
        {
            id: 'SIM',
            name: 'Nomor SIM',
            // Dijangkar trigger: \d{12} polos juga match nomor HP 12 digit
            // (false positive). Contoh match: "SIM 123456789012", "no sim: ..."
            regex: /(?:\bsim\b\s*(?:no\.?|nomor)?\s*[:\-]?\s*)(\d{12})/gi
        },
        {
            id: 'NISN',
            name: 'NISN',
            regex: /\b\d{10}\b/g
        },
        {
            id: 'NIM',
            name: 'NIM',
            regex: /\b101\d{2}\d{3}\b/g
        },
        {
            id: 'NO_AKTA_LAHIR',
            name: 'No. Akta Kelahiran',
            regex: /(?:nomor|no\.?)\s+akta\s+kelahiran\s*[:\-]?\s*([a-zA-Z0-9\/\-]+)/gi
        },
        {
            id: 'NO_BUKU_NIKAH',
            name: 'No. Buku Nikah',
            regex: /(?:nomor|no\.?)\s+(?:buku\s+nikah|akta\s+perkawinan)\s*[:\-]?\s*([a-zA-Z0-9\/\-]+)/gi
        },

        // ============================================
        // C. DATA DEMOGRAFI DASAR
        // ============================================
        {
            id: 'TEMPAT_LAHIR',
            name: 'Tempat Lahir',
            regex: /(?:tempat\s+lahir(?:\s+saya)?\s+(?:di|adalah)?\s*)([A-Z][a-zA-Z]+)/gi
        },
        {
            id: 'TGL_LAHIR',
            name: 'Tanggal Lahir',
            regex: /\b(?:0[1-9]|[12][0-9]|3[01])[\/\-](?:0[1-9]|1[012])[\/\-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[\/\-](?:0[1-9]|1[012])[\/\-](?:0[1-9]|[12][0-9]|3[01])\b/g
        },
        {
            id: 'TGL_LAHIR_ID',
            name: 'Tanggal Lahir (nama bulan Indonesia)',
            regex: /\b([12]?\d|3[01])\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+((?:19|20)\d{2})\b/gi
        },
        {
            id: 'GENDER',
            name: 'Jenis Kelamin',
            regex: /(?:jenis\s+kelamin(?:\s+saya)?\s+(?:adalah)?\s*)(pria|wanita|laki-laki|perempuan)/gi
        },
        {
            id: 'KEWARGANEGARAAN',
            name: 'Kewarganegaraan',
            regex: /(?:kewarganegaraan|kebangsaan)(?:\s+saya)?(?:\s+adalah)?\s+(WNI|WNA|Indonesia|asing)/gi
        },
        {
            id: 'STATUS_PERKAWINAN',
            name: 'Status Perkawinan',
            regex: /(?:status\s+(?:perkawinan|pernikahan|saya)?\s*(?:adalah)?\s*)(belum\s+kawin|kawin|cerai\s+hidup|cerai\s+mati|lajang|menikah)/gi
        },
        {
            id: 'AGAMA_KONTEKS',
            name: 'Data Agama',
            regex: /(?:agama\s(?:saya\s)?(?:adalah\s)?|beragama\s)(islam|kristen|katolik|hindu|buddha|konghucu)/gi
        },
        {
            id: 'GOL_DARAH',
            name: 'Golongan Darah',
            regex: /(?:golongan\s+darah(?:\s+saya)?\s+(?:adalah)?\s*)(A|B|AB|O)(?:\s*[+-])?/gi
        },
        {
            id: 'PROFESI',
            name: 'Pekerjaan/Profesi',
            // Menangkap profesi 1-3 kata setelah kata pancingan.
            // Varian "bekerja|kerja" WAJIB diikuti "sebagai" agar tidak
            // false positive pada "saya kerja di Jakarta" (-> "di").
            // Masih gap (butuh model): "kerjaan gw kuli" tanpa "sebagai".
            regex: /(?:(?:pekerjaan|profesi)(?:\s+saya)?(?:\s+adalah)?\s+(?:sebagai\s+)?|(?:bekerja|kerja)\s+sebagai\s+)([a-zA-Z]+(?:\s[a-zA-Z]+){0,2})/gi
        },

        // ============================================
        // D. DATA IDENTIFIKASI SPESIFIK LAINNYA
        // ============================================
        {
            id: 'TANDA_TANGAN_DIGITAL',
            name: 'Tanda Tangan Digital',
            regex: /\b(?:BEGIN (?:PGP|RSA) (?:SIGNATURE|PRIVATE KEY))\b/gi
        },
        {
            id: 'CIRI_FISIK',
            name: 'Ciri Fisik Khusus',
            regex: /(?:tinggi\s+badan|berat\s+badan)(?:\s+saya)?\s*[:\-]?\s*\d+\s*(cm|kg)/gi
        },

        // ============================================
        // E. DATA KONTAK & KEUANGAN (Tier-1)
        // Ditambahkan 2026-10-10: sebelumnya tidak ada pola kontak
        // sama sekali — nomor HP & email lolos tanpa terdeteksi.
        // ============================================
        {
            id: 'NO_HP',
            name: 'Nomor HP',
            // Format: 08xx (10-14 digit), 62xxx, +62xxx, dengan/tanpa
            // pemisah spasi/strip/titik. \b di ujung mencegah 16 digit
            // (kode voucher) ikut ke-match.
            regex: /\b(?:\+62|62|0)8\d{2}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/g
        },
        {
            id: 'EMAIL',
            name: 'Alamat Email',
            regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g
        },
        {
            id: 'NO_REKENING',
            name: 'Nomor Rekening',
            // WAJIB ada trigger ("no rekening"): deret 10-16 digit polos
            // terlalu berisiko false positive tanpa konteks.
            regex: /(?:no\.?\s*(?:rekening|rek)|nomor\s+rekening)\s*[:\-]?\s*(\d{10,16})/gi
        }
    ]
};
