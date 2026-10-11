// Konfigurasi Selector DOM dan Pengaturan UI
const AppConfig = {
    // Pengaturan Selector per Platform AI
    PLATFORMS: [
        {
            name: 'ChatGPT',
            host: 'chatgpt.com',
            inputSelector: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
            // Selector berlapis (dipisah koma, querySelector ambil yg pertama cocok):
            // #composer-submit-button = selector utama 2026,
            // [data-testid="send-button"] = legacy, aria-label = fallback.
            sendButtonSelector: '#composer-submit-button, [data-testid="send-button"], button[aria-label="Send prompt"]'
        },
        {
            name: 'Gemini',
            host: 'gemini.google.com',
            inputSelector: 'rich-textarea, .ql-editor', 
            sendButtonSelector: 'button[aria-label="Send message"], button[aria-label="Kirim pesan"]'
        }
    ],
    
    // Konfigurasi Tampilan
    UI: {
        WARNING_COLOR: '#ef4444', 
        WARNING_TEXT: '⚠️ Terdapat data sensitif terdeteksi!'
    }
};
