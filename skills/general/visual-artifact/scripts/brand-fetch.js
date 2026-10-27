"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchThroughPage = fetchThroughPage;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;
/** Fetches the files in the page with its cookies and returns their bytes by URL; failures are left out. */
async function fetchThroughPage(tab, urls) {
    const files = new Map();
    const unique = [...new Set(urls)].slice(0, 24);
    if (unique.length === 0)
        return files;
    const code = `const urls = ${JSON.stringify(unique)}; const out = {}; let total = 0;
await Promise.all(urls.map(async (url) => {
  try {
    const response = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(4000) });
    if (!response.ok) return;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > ${MAX_FILE_BYTES} || total + bytes.length > ${MAX_TOTAL_BYTES}) return;
    total += bytes.length;
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    out[url] = btoa(binary);
  } catch (error) {}
}));
return JSON.stringify(out)`;
    try {
        const raw = await tab.execute(code);
        if (typeof raw !== 'string')
            return files;
        const parsed = JSON.parse(raw);
        for (const [url, base64] of Object.entries(parsed))
            if (typeof base64 === 'string')
                files.set(url, Buffer.from(base64, 'base64'));
    }
    catch {
        return files;
    }
    return files;
}
