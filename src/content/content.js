// Entry Point Content Script — PromptGuard.
//
// Alur per pesan:
//   ketikan -> debounce -> Detector.analyze (regex + NER + risk scorer)
//   -> DOMManager.applyDecision (toast + tombol kirim + Enter)
class ContentScript {
    constructor() {
        this.domManager = new DOMManager(AppConfig);
        this.activePlatform = this.detectPlatform();
        this.isMonitoring = false;
        this.debounceTimer = null;
        this.seq = 0;              // penjaga race-condition hasil async
        this.lastDecision = 'pass';
    }

    detectPlatform() {
        const currentHost = window.location.hostname;
        return AppConfig.PLATFORMS.find((platform) => currentHost.includes(platform.host)) || null;
    }

    init() {
        if (!this.activePlatform) {
            console.log('[PromptGuard] Web ini tidak didukung.');
            return;
        }
        console.log(`[PromptGuard] Inisialisasi untuk ${this.activePlatform.name} berhasil.`);
        this.startObserver();
    }

    startObserver() {
        const observer = new MutationObserver(() => {
            const inputField = document.querySelector(this.activePlatform.inputSelector);

            if (inputField && !this.isMonitoring) {
                this.isMonitoring = true;
                this.attachInputListener(inputField);
                console.log(`[PromptGuard] Memantau ketikan di ${this.activePlatform.name}...`);
            } else if (!inputField && this.isMonitoring) {
                this.isMonitoring = false;
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    attachInputListener(inputField) {
        // Analisis di-debounce: regex murah, tapi inferensi NER mahal —
        // hanya jalan setelah user berhenti mengetik sejenak.
        inputField.addEventListener('input', (e) => {
            const text = e.target.value || e.target.innerText || '';
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.analyzeText(text), ModelConfig.DEBOUNCE_MS);
        });

        // Cegah pengiriman via Enter saat keputusan = block.
        // Capture phase agar berjalan SEBELUM handler milik situs.
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && this.lastDecision === RiskScorer.DECISIONS.BLOCK) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    async analyzeText(text) {
        const mySeq = ++this.seq;
        const sendButton = document.querySelector(this.activePlatform.sendButtonSelector);

        const result = await Detector.analyze(text);

        // Abaikan hasil basi (user sudah mengetik lagi selagi NER jalan).
        if (mySeq !== this.seq) return;

        this.lastDecision = result.decision;
        this.domManager.applyDecision(sendButton, result);
    }
}

// Menjalankan ekstensi
const app = new ContentScript();
app.init();
