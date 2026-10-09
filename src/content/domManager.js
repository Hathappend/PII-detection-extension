// domManager.js — Manipulasi DOM: toast peringatan & kontrol tombol kirim.
//
// Keputusan dari Detector.analyze dipetakan ke aksi UI:
//   pass   -> tidak ada toast, tombol aktif
//   warn   -> toast kuning, tombol tetap aktif (user memutuskan sendiri)
//   redact -> toast merah, tombol mati, ADA tombol override "Tetap kirim"
//   block  -> toast merah, tombol mati, tanpa override (wajib hapus PII)
class DOMManager {
    constructor(config) {
        this.config = config;
        this.warningToast = null;
        this.overrideButton = null;
        // Dipakai untuk menonaktifkan blokir sementara setelah user
        // menekan "Tetap kirim" (redact). Direset setiap analisis baru.
        this.overrideArmed = false;
    }

    createWarningToast() {
        if (!this.warningToast) {
            this.warningToast = document.createElement('div');
            this.warningToast.className = 'prompt-guard-toast';
            this.warningToast.innerHTML = `
                <div class="pg-toast-icon">🛡️</div>
                <div class="pg-toast-content">
                    <span class="pg-toast-title"></span>
                    <span class="pg-toast-message"></span>
                </div>
                <button class="pg-toast-override" style="display:none">Tetap kirim</button>
            `;
            document.body.appendChild(this.warningToast);
            this.overrideButton = this.warningToast.querySelector('.pg-toast-override');
        }
        return this.warningToast;
    }

    // Dipanggil setiap selesai analisis -> override selalu direset.
    applyDecision(buttonElement, result) {
        this.overrideArmed = false;
        const { decision, score, summary } = result;

        if (decision === RiskScorer.DECISIONS.PASS) {
            this.hideWarning();
            this.enableSendButton(buttonElement);
            return;
        }

        const detail = summary.length > 0 ? summary.join(', ') : 'data sensitif';
        if (decision === RiskScorer.DECISIONS.WARN) {
            this.showWarning('warn', 'Perhatian', `Terdeteksi: <b>${detail}</b> (skor ${score}). Periksa sebelum mengirim.`);
            this.enableSendButton(buttonElement);
        } else if (decision === RiskScorer.DECISIONS.REDACT) {
            this.showWarning('block', 'Aksi Ditahan', `Terdeteksi: <b>${detail}</b> (skor ${score}). Hapus data sensitif, atau kirim dengan risiko sendiri.`);
            this.disableSendButton(buttonElement);
            this.armOverride(buttonElement);
        } else { // BLOCK
            this.showWarning('block', 'Aksi Diblokir', `Terdeteksi: <b>${detail}</b> (skor ${score}). Mohon hapus sebelum mengirim.`);
            this.disableSendButton(buttonElement);
        }
    }

    showWarning(severity, title, messageHtml) {
        const toast = this.createWarningToast();
        toast.classList.remove('pg-warn', 'pg-block');
        toast.classList.add(severity === 'warn' ? 'pg-warn' : 'pg-block');
        toast.querySelector('.pg-toast-title').textContent = title;
        toast.querySelector('.pg-toast-message').innerHTML = messageHtml;
        this.overrideButton.style.display = 'none';
        toast.classList.add('pg-show');
    }

    hideWarning() {
        if (this.warningToast) {
            this.warningToast.classList.remove('pg-show');
        }
    }

    // Override "Tetap kirim": user sadar risiko -> tombol aktif sampai
    // teks berubah (analisis berikutnya meresetnya).
    armOverride(buttonElement) {
        this.overrideButton.style.display = '';
        this.overrideButton.onclick = () => {
            this.overrideArmed = true;
            this.enableSendButton(buttonElement);
            this.hideWarning();
        };
    }

    disableSendButton(buttonElement) {
        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.style.opacity = '0.3';
            buttonElement.style.cursor = 'not-allowed';
            buttonElement.style.pointerEvents = 'none';
        }
    }

    enableSendButton(buttonElement) {
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.style.opacity = '1';
            buttonElement.style.cursor = 'pointer';
            buttonElement.style.pointerEvents = 'auto';
        }
    }
}
