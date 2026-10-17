// AppConfig — Selector DOM per platform AI yang didukung.
//
// PromptGuard berjalan sebagai content script di situs-situs ini.
// Selector tombol kirim ditulis berlapis (dipisah koma): querySelector
// memakai yang pertama cocok, sisanya sebagai fallback bila situs
// mengubah DOM.
const AppConfig = {
    PLATFORMS: [
        {
            name: 'ChatGPT',
            host: 'chatgpt.com',
            inputSelector: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
            sendButtonSelector: 'button[aria-label="Send"], #composer-submit-button, [data-testid="send-button"], button[aria-label="Send prompt"]'
        },
        {
            name: 'Gemini',
            host: 'gemini.google.com',
            inputSelector: 'rich-textarea, .ql-editor',
            sendButtonSelector: 'button[aria-label="Send message"], button[aria-label="Kirim pesan"]'
        }
    ],
};
