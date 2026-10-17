// content.js — Entry point content script PromptGuard.
//
// Alur per pesan: ketikan -> debounce -> Detector.analyze
// -> DOMManager.applyDecision (toast + tombol kirim + Enter).
class ContentScript {
    constructor() {
        this.domManager = new DOMManager(AppConfig);
        this.activePlatform = this.detectPlatform();
        this.isMonitoring = false;
        this.debounceTimer = null;
        this.seq = 0; // penomoran analisis untuk mengabaikan hasil basi
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
        this.setupMessageBridge();
        this.startObserver();
    }

    // Jembatan pesan popup <-> content script untuk unduhan model NER.
    setupMessageBridge() {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === 'PG_NER_STATUS') {
                NerClient.status().then(sendResponse);
                return true;
            }
            if (msg.type === 'PG_NER_WARMUP') {
                this.startWarmup();
                sendResponse({ started: true });
                return false;
            }
            return false;
        });
    }

    async startWarmup() {
        const onProgress = (p) => {
            if (p.status === 'initiate' || p.status === 'progress') {
                chrome.runtime.sendMessage({
                    type: 'PG_NER_PROGRESS',
                    file: p.file || 'model',
                    progress: p.progress ?? 0,
                    loaded: p.loaded ?? 0,
                    total: p.total ?? 0,
                }).catch(() => {}); // popup mungkin sudah ditutup -> abaikan
            }
        };
        let ok = false;
        let error = null;
        try {
            ok = await NerClient.warmup(onProgress);
        } catch (err) {
            error = String((err && err.message) || err);
        }
        chrome.runtime.sendMessage({ type: 'PG_NER_DONE', ok, error }).catch(() => {});
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
        // Analisis di-debounce: regex murah, inferensi NER mahal.
        inputField.addEventListener('input', (e) => {
            const text = e.target.value || e.target.innerText || '';
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.analyzeText(text), ModelConfig.DEBOUNCE_MS);
        });

        // Event 'input' tidak selalu menyala saat paste karena editor situs
        // memprosesnya sendiri: baca isi field setelah paste selesai.
        inputField.addEventListener('paste', () => {
            setTimeout(() => {
                const text = inputField.value || inputField.innerText || '';
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => this.analyzeText(text), ModelConfig.DEBOUNCE_MS);
            }, 0);
        });

        // Cegah pengiriman via Enter saat block atau redact.
        // Saat redact, Enter dibuka lagi setelah user menekan "Abaikan"
        // (override sadar risiko) di toast.
        // Capture phase agar berjalan sebelum handler milik situs.
        inputField.addEventListener('keydown', (e) => {
            const hardBlocked = this.lastDecision === RiskScorer.DECISIONS.BLOCK;
            const softBlocked = this.lastDecision === RiskScorer.DECISIONS.REDACT
                && !this.domManager.overrideArmed;
            if (e.key === 'Enter' && !e.shiftKey && (hardBlocked || softBlocked)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        // Draft yang dipulihkan setelah refresh tidak memicu event:
        // analisis isi awal saat pasang + sekali lagi tunda 2 detik.
        const analyzeExisting = () => {
            const field = document.querySelector(this.activePlatform.inputSelector) || inputField;
            const text = field.value || field.innerText || '';
            if (text.trim()) this.analyzeText(text);
        };
        analyzeExisting();
        setTimeout(analyzeExisting, 2000);
    }

    async analyzeText(text) {
        const mySeq = ++this.seq;
        const sendButton = document.querySelector(this.activePlatform.sendButtonSelector);

        const result = await Detector.analyze(text);

        // Abaikan hasil dari analisis yang sudah kedaluwarsa.
        if (mySeq !== this.seq) return;

        // Log diagnosis: skor + rincian tiap sinyal.
        console.log(`[PromptGuard] "${text.slice(0, 60)}" -> ${result.decision} (${result.score})`);
        for (const b of result.breakdown) {
            if (b.points > 0) console.log(`   [${b.kind}] ${b.label} +${b.points} ${b.detail || ''}`);
        }

        this.lastDecision = result.decision;
        this.domManager.applyDecision(sendButton, result);
    }
}

// Inisialisasi ekstensi.
const app = new ContentScript();
app.init();
