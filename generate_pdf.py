import sys
import subprocess

def install_and_import(package):
    try:
        __import__(package)
    except ImportError:
        print(f"Installing {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Ensure fpdf is installed
install_and_import('fpdf')
from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 16)
        self.cell(0, 10, 'Panduan Penggunaan - Prompt Guard (Versi 1)', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Halaman {self.page_no()}', 0, 0, 'C')

pdf = PDF()
pdf.add_page()
pdf.set_font('Arial', '', 12)

# Menggunakan multi_cell untuk teks yang panjang agar otomatis wrap
content = [
    ("1. PENDAHULUAN\n", 'B'),
    ("Prompt Guard (Versi 1) adalah ekstensi Google Chrome yang berjalan secara lokal untuk mencegah pengiriman data sensitif/pribadi (PII) secara tidak sengaja ke platform AI seperti ChatGPT dan Google Gemini. Ekstensi ini menjamin privasi 100% karena tidak ada data yang dikirim ke server pihak ketiga manapun.\n\nData yang saat ini dideteksi meliputi:\n- NIK (Nomor Induk Kependudukan - 16 Digit)\n- NIM (Nomor Induk Mahasiswa)\n- Tanggal Lahir\n- Konteks Nama (misal: 'nama saya Budi')\n\n", ''),
    
    ("2. CARA INSTALASI EKSTENSI\n", 'B'),
    ("1. Buka browser Google Chrome.\n2. Ketik chrome://extensions/ pada kolom URL (address bar), lalu tekan Enter.\n3. Pada pojok kanan atas halaman, aktifkan mode pengembang dengan menyalakan saklar 'Developer mode'.\n4. Akan muncul tiga tombol baru di pojok kiri atas. Klik tombol 'Load unpacked'.\n5. Pada jendela yang terbuka, cari dan pilih folder instalasi ekstensi (folder 'PromptingProtection').\n6. Selesai! Ekstensi Prompt Guard akan langsung muncul di daftar ekstensi Anda.\n\n", ''),
    
    ("3. CARA PENGGUNAAN\n", 'B'),
    ("1. Buka platform AI target, yaitu https://chatgpt.com atau https://gemini.google.com.\n2. Jika Anda sudah membuka halaman tersebut sebelum menginstal ekstensi, wajib refresh (tekan F5) halamannya terlebih dahulu.\n3. Mulailah mengetik prompt (pesan) seperti biasa di kotak percakapan.\n4. Deteksi Real-time: Jika Anda mengetikkan data sensitif (misalnya 16 angka acak yang menyerupai NIK), sistem akan langsung merespons dalam hitungan milidetik.\n5. Anda akan melihat Notifikasi Toast berwarna merah melayang di tengah atas layar, bertuliskan peringatan data apa saja yang terdeteksi.\n6. Pencegahan: Tombol 'Send' / 'Kirim' pada platform AI tersebut akan otomatis diburamkan dan dimatikan. Anda tidak akan bisa menekan tombol kirim ataupun menggunakan tombol Enter.\n7. Pemulihan: Cukup hapus atau samarkan bagian teks sensitif tersebut. Notifikasi akan hilang secara otomatis dan tombol 'Send' akan menyala kembali, memungkinkan Anda melanjutkan pekerjaan dengan aman.\n\n", ''),
    
    ("4. PEMELIHARAAN\n", 'B'),
    ("Jika ChatGPT atau Gemini melakukan pembaruan tampilan web yang membuat ekstensi berhenti bekerja, Anda tidak perlu merombak seluruh kode. Cukup buka file 'src/config/app.config.js' dan perbarui class target sesuai perubahan terbaru dari pihak platform AI.\n", '')
]

for text, style in content:
    if style == 'B':
        pdf.set_font('Arial', 'B', 12)
    else:
        pdf.set_font('Arial', '', 11)
    
    # Menulis teks, menggunakan multi_cell untuk word wrap otomatis
    pdf.multi_cell(0, 6, text)

# Output PDF
output_path = "C:/KULIAH/PromptingProtection/Panduan_Penggunaan_PromptGuard.pdf"
pdf.output(output_path)
print(f"PDF berhasil dibuat di: {output_path}")
