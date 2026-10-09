// manipulasi DOM (Tampilan)
class DOMManager {
    constructor(config) {
        this.config = config;
        this.warningToast = null;
    }

    createWarningToast() {
        if (!this.warningToast) {
            this.warningToast = document.createElement('div');
            this.warningToast.className = 'prompt-guard-toast';
            this.warningToast.innerHTML = `
                <div class="pg-toast-icon">🛡️</div>
                <div class="pg-toast-content">
                    <span class="pg-toast-title">Aksi Diblokir</span>
                    <span class="pg-toast-message"></span>
                </div>
            `;
            // Pasang langsung di body agar posisinya absolut/fixed dan tidak merusak layout ChatGPT
            document.body.appendChild(this.warningToast);
        }
        return this.warningToast;
    }

    showWarning(inputElement, detectedTypes) {
        const toast = this.createWarningToast();
        const messageEl = toast.querySelector('.pg-toast-message');
        
        // Update pesan teks
        messageEl.innerHTML = `Terdapat <b>${detectedTypes.join(', ')}</b>. Mohon hapus sebelum mengirim.`;
        
        // Munculkan toast dengan menambahkan class
        toast.classList.add('pg-show');
    }

    hideWarning(inputElement) {
        if (this.warningToast) {
            this.warningToast.classList.remove('pg-show');
        }
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
