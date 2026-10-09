// Entry Point Content Script
class ContentScript {
    constructor() {
        this.domManager = new DOMManager(AppConfig);
        this.isMonitoring = false;
        // Mendeteksi sedang berada di website mana berdasarkan URL
        this.activePlatform = this.detectPlatform();
    }

    detectPlatform() {
        const currentHost = window.location.hostname;
        return AppConfig.PLATFORMS.find(platform => currentHost.includes(platform.host)) || null;
    }

    init() {
        if (!this.activePlatform) {
            console.log("[PromptGuard] Web ini tidak didukung.");
            return;
        }
        
        console.log(`[PromptGuard] Inisialisasi Ekstensi untuk ${this.activePlatform.name} Berhasil...`);
        this.startObserver();
    }

    startObserver() {
        const observer = new MutationObserver(() => {
            // Mencari input text sesuai konfigurasi platform saat ini
            const inputField = document.querySelector(this.activePlatform.inputSelector);
            
            if (inputField && !this.isMonitoring) {
                this.isMonitoring = true;
                this.attachInputListener(inputField);
                console.log(`[PromptGuard] Input box ${this.activePlatform.name} ditemukan, mulai memantau ketikan...`);
            } else if (!inputField && this.isMonitoring) {
                this.isMonitoring = false;
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    attachInputListener(inputField) {
        inputField.addEventListener('input', (e) => {
            // Mengambil teks dari value atau innerText 
            const text = e.target.value || e.target.innerText || "";
            this.analyzeText(text, inputField);
        });
    }

    analyzeText(text, inputField) {
        // Mencari tombol kirim sesuai konfigurasi platform saat ini
        const sendButton = document.querySelector(this.activePlatform.sendButtonSelector);
        let detectedTypes = new Set();

        RegexConfig.PATTERNS.forEach(pattern => {
            pattern.regex.lastIndex = 0; 
            if (pattern.regex.test(text)) {
                detectedTypes.add(pattern.name);
            }
        });

        const detectedArray = Array.from(detectedTypes);

        if (detectedArray.length > 0) {
            this.domManager.showWarning(inputField, detectedArray);
            this.domManager.disableSendButton(sendButton);
        } else {
            this.domManager.hideWarning(inputField);
            this.domManager.enableSendButton(sendButton);
        }
    }
}

// Menjalankan ekstensi
const app = new ContentScript();
app.init();
