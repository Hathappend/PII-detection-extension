#!/usr/bin/env node
// fetch-vendor.mjs — Dev-time setup (sekali saja sebelum distribusi).
//
// Mengunduh & mem-bundle transformers.js menjadi SATU file ESM mandiri
// di vendor/, beserta file WASM onnxruntime yang dibutuhkannya.
//
//   node scripts/fetch-vendor.mjs
//
// Kenapa tidak pakai CDN / file dist langsung?
//   1. CSP Manifest V3 melarang remote code -> library WAJIB dibundle
//      lokal di dalam ekstensi.
//   2. dist/transformers.web.js punya external deps (onnxruntime-web)
//      yang tidak bisa di-resolve oleh import() polos -> harus di-bundle
//      jadi satu file dengan esbuild.
//
// Hasil:
//   vendor/transformers.js   (bundle ESM tunggal, ~2MB)
//   vendor/*.wasm             (runtime onnxruntime-web)
//   vendor/VERSION.txt        (versi yang di-pin)
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, cpSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor');
const VERSION = '3.8.1'; // versi API yang terverifikasi (pipeline, env, progress_callback)

function sh(cmd, cwd, extraEnv = {}) {
    console.log('  $', cmd);
    execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

console.log(`[fetch-vendor] transformers.js v${VERSION} -> vendor/`);

// Temp di dalam workspace (bukan /tmp yang hanya 512MB tmpfs).
// Nama tanpa titik di depan (npm init menolak ".vendor-tmp").
const tmp = join(ROOT, 'vendor-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const npmEnv = { TMPDIR: tmp, npm_config_cache: join(tmp, '.npm-cache') };
try {
    sh('npm init -y', tmp, npmEnv);
    sh(`npm install --no-save --no-audit --no-fund esbuild @huggingface/transformers@${VERSION}`, tmp, npmEnv);
    writeFileSync(join(tmp, 'entry.js'), `export * from '@huggingface/transformers';\n`);

    mkdirSync(VENDOR, { recursive: true });
    sh(`npx esbuild entry.js --bundle --format=esm --platform=browser --minify --outfile=${join(VENDOR, 'transformers.js')}`, tmp);

    // File WASM onnxruntime-web (dimuat saat runtime via wasmPaths).
    // CATATAN: selain .wasm, file glue .mjs (Emscripten) juga WAJIB ikut —
    // onnxruntime-web melakukan dynamic import() ke "<nama>.mjs" saat init.
    // Tanpa ini: "no available backend found / Failed to fetch ... .mjs".
    const ortDist = join(tmp, 'node_modules', 'onnxruntime-web', 'dist');
    const wasms = readdirSync(ortDist).filter((f) => f.endsWith('.wasm'));
    if (wasms.length === 0) throw new Error('tidak ada file .wasm di onnxruntime-web/dist');
    for (const w of wasms) cpSync(join(ortDist, w), join(VENDOR, w));
    console.log(`[fetch-vendor] ${wasms.length} file wasm disalin.`);
    const mjsGlue = wasms
        .map((w) => w.replace(/\.wasm$/, '.mjs'))
        .filter((f) => existsSync(join(ortDist, f)));
    for (const f of mjsGlue) cpSync(join(ortDist, f), join(VENDOR, f));
    console.log(`[fetch-vendor] ${mjsGlue.length} file glue .mjs disalin.`);

    writeFileSync(join(VENDOR, 'VERSION.txt'),
        `@huggingface/transformers@${VERSION} (bundle ESM, esbuild)\n` +
        `onnxruntime-web (wasm, dari node_modules paket di atas)\n` +
        `Dibuat: ${new Date().toISOString()}\n`);
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log('[fetch-vendor] Selesai. Isi vendor/:');
for (const f of readdirSync(VENDOR)) console.log('  -', f);
console.log('\nLangkah berikut: reload ekstensi di chrome://extensions (atau Load unpacked ulang).');
