// RegexConfig — Kamus pola regex untuk deteksi data sensitif.
//
// Setiap pola: { id, name, regex }. Regex bersifat global; Detector
// me-reset lastIndex sebelum dipakai. Pola yang membutuhkan kata
// penanda (trigger) mencantumkannya di komentar.
const RegexConfig = {
    PATTERNS: [
        // A. Nama & hubungan keluarga
        {
            id: 'NAMA_KONTEKS',
            name: 'Nama Lengkap',
            // Menangkap nama setelah kata penanda eksplisit: "nama saya",
            // "namaku", "nama pasien", dsb. Maksimal 3 kata.
            regex: /(?:nama\s(?:saya|aku|adalah|lengkap|pasien)|namaku)\s+([a-zA-Z]+(?:\s[a-zA-Z]+){0,2})/gi
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

        // B. Nomor identitas resmi
        {
            id: 'NIK_KK',
            name: 'NIK / No. KK',
            regex: /\b([1-9][1-9]\d{14})\b/g
        },
        {
            id: 'NIP',
            name: 'NIP (Pegawai Negeri)',
            // 18 digit: YYYYMMDD (tgl lahir) + YYYYMM (TMT) + gender (1)
            // + nomor urut (3). Cukup distinctive tanpa trigger.
            regex: /\b\d{18}\b/g
        },
        {
            id: 'KARTU_KREDIT',
            name: 'Kartu Kredit/Debit',
            // Wajib trigger: 16 digit tanpa konteks bertabrakan dengan NIK.
            // Menerima 16 digit utuh atau dikelompokkan per 4 (spasi/strip).
            regex: /(?:kartu\s*kredit|kartu\s*debit|\bcc\b|credit\s*card|debit\s*card|no\.?\s*kartu|nomor\s*kartu)\s*(?:saya\s+)?[:\-]?\s*(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})/gi
        },
        {
            id: 'NPWP',
            name: 'Nomor NPWP',
            // Format 2-3-3-1-3-3 digit, pemisah titik/strip opsional.
            regex: /\b\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-]?\d{1}[\.\-]?\d{3}[\.\-]?\d{3}\b/g
        },
        {
            id: 'PASPOR',
            name: 'Nomor Paspor',
            // Format Indonesia: 1-2 huruf + 6-7 digit.
            regex: /\b[A-Za-z]{1,2}\d{6,7}\b/g
        },
        {
            id: 'SIM',
            name: 'Nomor SIM',
            // Wajib trigger "sim": deret 12 digit tanpa konteks bertabrakan
            // dengan nomor HP. Menerima 12 digit (format lama) atau 16 digit
            // (format baru sejak Jul 2024 = NIK). Urutan alternation penting:
            // \d{16} harus sebelum \d{12} agar tidak terpotong.
            regex: /(?:\bsim\b\s*(?:saya\s+)?(?:no\.?|nomor)?\s*[:\-]?\s*)(\d{16}|\d{12})/gi
        },
        {
            id: 'NISN',
            name: 'NISN',
            // Wajib trigger "nisn": 10 digit tanpa konteks rawan false positive.
            regex: /(?:\bnisn\b\s*(?:saya\s+)?(?:no\.?|nomor)?\s*[:\-]?\s*)(\d{10})/gi
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

        // C. Data demografi
        {
            id: 'TEMPAT_LAHIR',
            name: 'Tempat Lahir',
            regex: /(?:tempat\s+lahir(?:\s+saya)?\s+(?:di|adalah)?\s*)([A-Z][a-zA-Z]+)/gi
        },
        {
            id: 'TGL_LAHIR',
            name: 'Tanggal Lahir',
            // Format numerik DD/MM/YYYY atau YYYY/MM/DD.
            regex: /\b(?:0[1-9]|[12][0-9]|3[01])[\/\-](?:0[1-9]|1[012])[\/\-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[\/\-](?:0[1-9]|1[012])[\/\-](?:0[1-9]|[12][0-9]|3[01])\b/g
        },
        {
            id: 'TGL_LAHIR_ID',
            name: 'Tanggal Lahir (nama bulan Indonesia)',
            // Format "12 Mei 1998" — nama bulan Indonesia.
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
            // Profesi 1-3 kata setelah kata penanda. "bekerja/kerja" wajib
            // diikuti "sebagai" untuk menghindari false positive
            // ("saya kerja di Jakarta" bukan profesi).
            regex: /(?:(?:pekerjaan|profesi)(?:\s+saya)?(?:\s+adalah)?\s+(?:sebagai\s+)?|(?:bekerja|kerja)\s+sebagai\s+)([a-zA-Z]+(?:\s[a-zA-Z]+){0,2})/gi
        },

        // D. Identifikasi spesifik lainnya
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

        // E. Kontak & keuangan
        {
            id: 'NO_HP',
            name: 'Nomor HP',
            // Format 08xx/62xx/+62xx, 10-14 digit, pemisah opsional.
            // \b di ujung mencegah 16 digit ikut tercocok.
            regex: /\b(?:\+62|62|0)8\d{2}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/g
        },
        {
            id: 'NO_TELP',
            name: 'Nomor Telepon (Rumah/Kantor)',
            // Kode area 0XX/0XXX + 5-8 digit, mis. 021-5551234, (022) 5551234.
            // (?!8) mengecualikan 08xx agar tidak bertabrakan dengan NO_HP.
            regex: /\(?\b0(?!8)\d{2,3}\)?[\s\-.]?\d{5,8}\b/g
        },
        {
            id: 'EMAIL',
            name: 'Alamat Email',
            regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g
        },
        {
            id: 'NO_REKENING',
            name: 'Nomor Rekening',
            // Wajib trigger: 10-16 digit tanpa konteks rawan false positive.
            regex: /(?:no\.?\s*(?:rekening|rek)|nomor\s+rekening)\s*[:\-]?\s*(\d{10,16})/gi
        }
    ]
};
