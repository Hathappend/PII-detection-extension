// domManager.js — Toast peringatan dan kontrol tombol kirim.
//
// Pemetaan keputusan -> UI:
//   pass   -> tanpa toast, tombol aktif
//   warn   -> toast kuning, tombol tetap aktif
//   redact -> toast merah, tombol mati, ada override "Tetap kirim"
//   block  -> toast merah, tombol mati, tanpa override
class DOMManager {
    constructor(config) {
        this.config = config;
        this.warningToast = null;
        this.overrideButton = null;
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

    // Menerapkan hasil analisis ke UI. Override selalu direset di sini.
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
            this.showWarning('warn', 'Perhatian', `Pesan Anda mengandung <b>${detail}</b>. Periksa kembali sebelum mengirim.`);
            this.enableSendButton(buttonElement);
        } else if (decision === RiskScorer.DECISIONS.REDACT) {
            this.showWarning('block', 'Tunggu Dulu', `Pesan Anda mengandung <b>${detail}</b>. Hapus data tersebut, atau kirim dengan risiko Anda sendiri.`);
            this.disableSendButton(buttonElement);
            this.armOverride(buttonElement);
        } else { // BLOCK
            this.showWarning('block', 'Tidak Bisa Dikirim', `Pesan Anda mengandung <b>${detail}</b>. Hapus data tersebut sebelum mengirim.`);
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

    // Override "Tetap kirim": user memilih sadar risiko. Berlaku sampai
    // teks berubah (analisis berikutnya me-reset).
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
