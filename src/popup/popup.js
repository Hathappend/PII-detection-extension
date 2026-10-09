// popup.js — Logika popup: status model NER + tombol unduh.
//
// Berkomunikasi dengan content script di tab aktif via pesan:
//   popup -> content : { type: 'PG_NER_STATUS' }  -> { vendorOk, model }
//   popup -> content : { type: 'PG_NER_WARMUP' }  -> { started: true|false }
//   content -> popup: { type: 'PG_NER_PROGRESS', file, progress, loaded, total }
//   content -> popup: { type: 'PG_NER_DONE', ok, error? }
//
// Status "model siap" dibaca dari chrome.storage (di-set content script
// setelah warmup/inferensi pertama berhasil).
(function () {
    const $ = (id) => document.getElementById(id);
    const statusEl = $('ner-status');
    const progressWrap = $('ner-progress-wrap');
    const progressFill = $('ner-progress-fill');
    const progressText = $('ner-progress-text');
    const downloadBtn = $('ner-download-btn');
    const recheckBtn = $('ner-recheck-btn');
    const noteEl = $('ner-note');

    function setStatus(html, cls) {
        statusEl.innerHTML = html;
        statusEl.className = 'ner-status' + (cls ? ' ' + cls : '');
    }

    async function getActiveTab() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
    }

    // Kirim pesan ke content script; null bila tidak ada penerima
    // (popup dibuka di luar situs yang didukung).
    async function sendToContent(message) {
        const tab = await getActiveTab();
        if (!tab) return null;
        try {
            return await chrome.tabs.sendMessage(tab.id, message);
        } catch (err) {
            return null; // "Could not establish connection" -> bukan tab didukung
        }
    }

    function fmtMB(bytes) {
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    async function refresh() {
        setStatus('Memeriksa…');
        downloadBtn.hidden = true;
        recheckBtn.hidden = true;
        progressWrap.hidden = true;
        noteEl.hidden = true;

        const res = await sendToContent({ type: 'PG_NER_STATUS' });
        if (!res) {
            setStatus('Buka <b>chatgpt.com</b> atau <b>gemini.google.com</b> ' +
                'di tab ini, lalu buka popup lagi.', 'warn');
            return;
        }
        if (!res.vendorOk) {
            setStatus('Library NER belum terpasang di ekstensi ini.<br>' +
                'Developer: jalankan <code>node scripts/fetch-vendor.mjs</code> ' +
                'lalu Load unpacked ulang.', 'warn');
            return;
        }

        const stored = await chrome.storage.local.get(['pg_ner_ready', 'pg_ner_ready_at']);
        if (stored.pg_ner_ready) {
            const when = stored.pg_ner_ready_at
                ? new Date(stored.pg_ner_ready_at).toLocaleDateString('id-ID')
                : '';
            setStatus(`✓ Model NER siap${when ? ' (sejak ' + when + ')' : ''}.`, 'ok');
            recheckBtn.hidden = false;
        } else {
            setStatus(`Model NER (<b>${res.model}</b>) belum diunduh.<br>` +
                'Diperlukan sekali saja (±180MB), lalu tersimpan di browser.');
            downloadBtn.hidden = false;
        }
    }

    downloadBtn.addEventListener('click', async () => {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Menghubungi…';
        const res = await sendToContent({ type: 'PG_NER_WARMUP' });
        if (!res || !res.started) {
            setStatus('Gagal memulai unduhan. Pastikan tab situs AI masih terbuka.', 'warn');
            downloadBtn.disabled = false;
            downloadBtn.textContent = '⬇ Download Model NER';
            return;
        }
        downloadBtn.hidden = true;
        progressWrap.hidden = false;
        noteEl.hidden = false;
        progressFill.style.width = '0%';
        progressText.textContent = 'Menyiapkan…';
    });

    recheckBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['pg_ner_ready', 'pg_ner_ready_at']);
        refresh();
    });

    // Terima laporan progres dari content script.
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'PG_NER_PROGRESS') {
            const pct = Math.round(msg.progress || 0);
            progressFill.style.width = pct + '%';
            const size = msg.total ? `${fmtMB(msg.loaded)} / ${fmtMB(msg.total)}` : '';
            progressText.textContent = `${msg.file || 'model'} — ${pct}% ${size}`.trim();
        } else if (msg.type === 'PG_NER_DONE') {
            progressWrap.hidden = true;
            noteEl.hidden = true;
            if (msg.ok) {
                refresh();
            } else {
                setStatus(`Unduhan gagal: ${msg.error || 'unknown'}. Coba lagi.`, 'warn');
                downloadBtn.hidden = false;
                downloadBtn.disabled = false;
                downloadBtn.textContent = '⬇ Download Model NER';
            }
        }
    });

    document.addEventListener('DOMContentLoaded', refresh);
})();
