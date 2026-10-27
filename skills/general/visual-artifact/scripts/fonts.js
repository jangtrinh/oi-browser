"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROWSER_USER_AGENT = void 0;
exports.installGoogleFonts = installGoogleFonts;
exports.parseFontFaceCss = parseFontFaceCss;
exports.parseCssImports = parseCssImports;
exports.downloadFontFaces = downloadFontFaces;
exports.writeFontFaceBlock = writeFontFaceBlock;
exports.sniffFileType = sniffFileType;
exports.readCapped = readCapped;
exports.isPrivateAddress = isPrivateAddress;
exports.fetchPublicFile = fetchPublicFile;
const node_crypto_1 = require("node:crypto");
const node_dns_1 = require("node:dns");
const promises_1 = require("node:fs/promises");
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const node_net_1 = require("node:net");
const node_path_1 = __importDefault(require("node:path"));
const node_zlib_1 = require("node:zlib");
const session_js_1 = require("./session.js");
// Google Fonts serves woff2 only to browsers it recognizes.
exports.BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const KEPT_SUBSETS = new Set(['latin', 'latin-ext']);
const FETCH_TIMEOUT_MS = 15_000;
const MAX_FONT_BYTES = 4 * 1024 * 1024;
const MAX_CSS_BYTES = 8 * 1024 * 1024;
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
/**
 * Downloads Google Fonts families into the artifact and registers them in `styles/fonts.css`,
 * which the scaffolded `styles/root.css` already imports.
 */
async function installGoogleFonts(input) {
    const root = (0, session_js_1.resolveArtifactRoot)(input.artifactId);
    const installed = [];
    const failed = [];
    // Families download together; styles/fonts.css is then written once per family in turn, since
    // concurrent read-modify-write of one file drops blocks.
    const downloads = await Promise.all(input.families.map(async (spec) => {
        try {
            const faces = await loadGoogleFontFaces(spec);
            const files = await downloadFontFaces(root, faces, { 'User-Agent': exports.BROWSER_USER_AGENT });
            return { family: files[0]?.family ?? spec, files };
        }
        catch (error) {
            failed.push({
                family: spec,
                reason: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }));
    for (const download of downloads) {
        if (download === null)
            continue;
        await writeFontFaceBlock(root, `google ${download.family}`, download.files);
        installed.push({ family: download.family, files: download.files.length });
    }
    return { installed, failed, css: 'styles/fonts.css' };
}
async function loadGoogleFontFaces(spec) {
    const family = spec.split(':')[0]?.trim() ?? '';
    if (family.length === 0) {
        throw new Error('Font family name is required');
    }
    const urlFor = (candidate) => `https://fonts.googleapis.com/css2?family=${candidate.trim().replace(/ /g, '+')}&display=swap`;
    const request = async (candidate) => {
        const url = urlFor(candidate);
        const response = await fetchPublicFile(url, { 'User-Agent': exports.BROWSER_USER_AGENT });
        if (!response.ok)
            return null;
        const css = await readCapped(response, MAX_CSS_BYTES);
        if (css === null)
            return null;
        const faces = parseFontFaceCss(css.toString('utf8'), url).filter((face) => face.subset === undefined || KEPT_SUBSETS.has(face.subset));
        return faces.length > 0 ? faces : null;
    };
    const exists = async (candidate) => {
        const response = await fetchPublicFile(urlFor(candidate), {
            'User-Agent': exports.BROWSER_USER_AGENT
        }).catch(() => null);
        await response?.body?.cancel().catch(() => undefined);
        return response?.ok === true;
    };
    if (spec.includes(':')) {
        const faces = await request(spec);
        if (faces !== null)
            return faces;
        throw new Error(`Google Fonts has no "${spec}"`);
    }
    // A bare family name only returns weight 400, so the full variable range is asked for first.
    for (const candidate of [`${family}:ital,wght@0,100..900;1,100..900`, `${family}:wght@100..900`]) {
        const faces = await request(candidate);
        if (faces !== null)
            return faces;
    }
    // Static families and variable ones with a narrower range reject 100..900, and one missing
    // weight fails a whole request, so each weight is tried on its own and the ones Google has are
    // asked for together, with italics where the family has them.
    const weights = (await Promise.all(WEIGHTS.map(async (weight) => ((await exists(`${family}:wght@${weight}`)) ? weight : null)))).filter((weight) => weight !== null);
    if (weights.length > 0) {
        const italics = (await Promise.all(weights.map(async (weight) => ((await exists(`${family}:ital,wght@1,${weight}`)) ? weight : null)))).filter((weight) => weight !== null);
        const faces = await request(italics.length > 0
            ? `${family}:ital,wght@${[...weights.map((weight) => `0,${weight}`), ...italics.map((weight) => `1,${weight}`)].join(';')}`
            : `${family}:wght@${weights.join(';')}`);
        if (faces !== null)
            return faces;
    }
    const faces = await request(family);
    if (faces !== null)
        return faces;
    throw new Error(`Google Fonts has no family named "${family}"`);
}
/**
 * Parses `@font-face` blocks and keeps the best source of each: woff2, then woff, then
 * TrueType/OpenType. Sources are ranked by their `format()` hint as well as their extension,
 * because CDNs such as Adobe Fonts serve files from URLs without one.
 */
function parseFontFaceCss(css, baseUrl) {
    const faces = [];
    const blockPattern = /(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?@font-face\s*{([^}]*)}/gi;
    for (const match of css.matchAll(blockPattern)) {
        const subset = match[1];
        const body = match[2] ?? '';
        const family = readDeclaration(body, 'font-family')?.replace(/^["']|["']$/g, '');
        const src = readDeclaration(body, 'src');
        if (family === undefined || src === undefined) {
            continue;
        }
        const preferred = pickFontSource(src);
        if (preferred === null) {
            continue;
        }
        let url;
        try {
            url = new URL(preferred, baseUrl).toString();
        }
        catch {
            continue;
        }
        const unicodeRange = readDeclaration(body, 'unicode-range');
        faces.push({
            family,
            weight: readDeclaration(body, 'font-weight') ?? '400',
            style: readDeclaration(body, 'font-style') ?? 'normal',
            url,
            ...(unicodeRange !== undefined ? { unicodeRange } : {}),
            ...(subset !== undefined ? { subset } : {})
        });
    }
    return faces;
}
/** Returns the absolute URLs of `@import` rules, so a stylesheet's imports can be read too. */
function parseCssImports(css, baseUrl) {
    const imports = [];
    for (const match of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?[^;]*;/gi)) {
        try {
            imports.push(new URL(match[1] ?? '', baseUrl).toString());
        }
        catch {
            continue;
        }
    }
    return imports;
}
function pickFontSource(src) {
    let best = null;
    let bestRank = -1;
    for (const match of src.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)(?:\s*format\(\s*["']?([\w-]+)["']?\s*\))?/g)) {
        const url = match[2] ?? '';
        const format = (match[3] ?? '').toLowerCase();
        const inline = url.startsWith('data:');
        if (url.length === 0 || (inline && !/^data:(font|application)\//i.test(url)))
            continue;
        let rank = 0;
        if (format.startsWith('woff2') || /\.woff2(\?|#|$)/i.test(url) || /^data:[^,]*woff2/i.test(url))
            rank = 3;
        else if (format === 'woff' || /\.woff(\?|#|$)/i.test(url) || /^data:[^,]*woff/i.test(url))
            rank = 2;
        else if (/truetype|opentype/.test(format) || /\.(ttf|otf)(\?|#|$)/i.test(url))
            rank = 1;
        if (rank > bestRank) {
            best = url;
            bestRank = rank;
        }
    }
    return best;
}
function readDeclaration(body, property) {
    // A url() can hold semicolons (data:font/woff2;base64,...), so it is read as one piece.
    const match = body.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*((?:url\\([^)]*\\)|[^;])+)`, 'i'));
    const value = match?.[1]?.trim();
    return value === undefined || value.length === 0 ? undefined : value;
}
/**
 * Downloads each face into `fonts/`. Only real font files are kept: a CDN that answers with an
 * HTML error page does not end up in `styles/fonts.css`. Faces that Node cannot download are
 * handed to `fallback` (inspectBrand fetches them through the page). Faces that fail are skipped;
 * all failing is an error.
 */
async function downloadFontFaces(root, faces, headers, fallback) {
    const fontsDirectory = node_path_1.default.join(root, 'fonts');
    await (0, promises_1.mkdir)(fontsDirectory, { recursive: true });
    const isFont = (bytes) => ['woff2', 'woff', 'ttf', 'otf'].includes(sniffFileType(bytes)) &&
        bytes.byteLength <= MAX_FONT_BYTES;
    const fetched = await Promise.all(faces.map(async (face) => {
        try {
            // One retry covers a dropped connection; an HTTP error is final.
            const response = await fetchPublicFile(face.url, headers).catch(() => fetchPublicFile(face.url, headers));
            if (!response.ok)
                return null;
            const bytes = await readCapped(response, MAX_FONT_BYTES);
            return bytes !== null && isFont(bytes) ? bytes : null;
        }
        catch {
            return null;
        }
    }));
    const missing = faces.filter((_face, index) => fetched[index] === null).map((face) => face.url);
    const recovered = fallback !== undefined && missing.length > 0 ? await fallback(missing) : null;
    const downloaded = await Promise.all(faces.map(async (face, index) => {
        const bytes = fetched[index] ?? recovered?.get(face.url) ?? null;
        if (bytes === null || !isFont(bytes))
            return null;
        // Named by content, so a later install of the same family cannot overwrite these files.
        const digest = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex').slice(0, 10);
        const fileName = `${slug(face.family)}-${slug(face.weight)}-${slug(face.style)}-${digest}.${sniffFileType(bytes)}`;
        await (0, promises_1.writeFile)(node_path_1.default.join(fontsDirectory, fileName), bytes);
        return { ...face, fileName };
    }));
    const files = downloaded.filter((face) => face !== null);
    if (files.length === 0) {
        throw new Error('No font files could be downloaded');
    }
    return files;
}
/** Replaces this source's block in `styles/fonts.css`, so installing twice stays idempotent. */
async function writeFontFaceBlock(root, sourceTag, faces) {
    const cssPath = node_path_1.default.join(root, 'styles', 'fonts.css');
    await (0, promises_1.mkdir)(node_path_1.default.dirname(cssPath), { recursive: true });
    let existing = '';
    try {
        existing = await (0, promises_1.readFile)(cssPath, 'utf8');
    }
    catch {
        existing = '';
    }
    const start = `/* fonts: ${sourceTag} */`;
    const end = `/* end fonts: ${sourceTag} */`;
    const rules = faces.map((face) => [
        '@font-face {',
        // Family names come from the page's CSS; quotes, braces, and semicolons would break out.
        `  font-family: "${face.family.replace(/["\\;{}<>]/g, '')}";`,
        `  src: url("../fonts/${face.fileName}") format("${formatFor(face.fileName)}");`,
        `  font-weight: ${face.weight};`,
        `  font-style: ${face.style};`,
        ...(face.unicodeRange !== undefined ? [`  unicode-range: ${face.unicodeRange};`] : []),
        '  font-display: swap;',
        '}'
    ].join('\n'));
    const block = [start, ...rules, end].join('\n');
    const startIndex = existing.indexOf(start);
    const endIndex = existing.indexOf(end);
    const next = startIndex !== -1 && endIndex > startIndex
        ? `${existing.slice(0, startIndex)}${block}${existing.slice(endIndex + end.length)}`
        : `${existing.trimEnd()}\n\n${block}\n`;
    await (0, promises_1.writeFile)(cssPath, next.trimStart(), 'utf8');
}
/** Identifies a downloaded file by its first bytes instead of trusting the URL or headers. */
function sniffFileType(bytes) {
    const ascii = bytes.subarray(0, 16).toString('latin1');
    if (ascii.startsWith('wOF2'))
        return 'woff2';
    if (ascii.startsWith('wOFF'))
        return 'woff';
    if (ascii.startsWith('OTTO'))
        return 'otf';
    if (ascii.startsWith('\u0000\u0001\u0000\u0000') || ascii.startsWith('true'))
        return 'ttf';
    if (ascii.startsWith('\u0089PNG'))
        return 'png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'jpg';
    if (ascii.startsWith('GIF8'))
        return 'gif';
    if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP')
        return 'webp';
    if (ascii.slice(4, 8) === 'ftyp' && /avi[fs]/.test(ascii.slice(8, 12)))
        return 'avif';
    if (ascii.startsWith('\u0000\u0000\u0001\u0000'))
        return 'ico';
    const head = bytes
        .subarray(0, 1024)
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
        return 'svg';
    }
    return 'other';
}
function formatFor(fileName) {
    if (fileName.endsWith('.woff2'))
        return 'woff2';
    if (fileName.endsWith('.woff'))
        return 'woff';
    if (fileName.endsWith('.otf'))
        return 'opentype';
    return 'truetype';
}
function slug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
/**
 * Reads a response body, or returns null once it passes maxBytes. The content-length header
 * cannot be trusted to bound it, since chunked responses have none.
 */
async function readCapped(response, maxBytes) {
    if (response.body === null)
        return Buffer.alloc(0);
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            return Buffer.concat(chunks);
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            return null;
        }
        chunks.push(Buffer.from(value));
    }
}
// Addresses on this machine and on private networks. The sandbox fetches files that a web page
// names, and unlike the page it is not held to the browser's private-network rules, so without this
// a page could reach a router, a local dev server, or an intranet host through the user's machine.
const PRIVATE_ADDRESSES = new node_net_1.BlockList();
for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 3]
])
    PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
    ['::', 127],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8]
])
    PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv6');
/** Whether an IP address is on this machine or a private network; anything unparseable counts. */
function isPrivateAddress(address) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
    if (mapped !== undefined)
        return PRIVATE_ADDRESSES.check(mapped, 'ipv4');
    const family = (0, node_net_1.isIP)(address);
    if (family === 0)
        return true;
    return PRIVATE_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
// Checked on the address each connection actually uses, so a public name that resolves to a
// private address, even only on a later lookup, is refused too.
const publicLookup = (hostname, options, callback) => {
    (0, node_dns_1.lookup)(hostname, { ...options, all: true }, (error, addresses) => {
        if (error !== null) {
            callback(error, '', 0);
            return;
        }
        const first = addresses[0];
        if (first === undefined || addresses.some((entry) => isPrivateAddress(entry.address))) {
            callback(Object.assign(new Error(`${hostname} is a local or private network address`), {
                code: 'EPRIVATEADDRESS'
            }), '', 0);
            return;
        }
        if (options.all === true)
            callback(null, addresses);
        else
            callback(null, first.address, first.family);
    });
};
function requestOnce(url, headers, signal) {
    return new Promise((resolve, reject) => {
        const send = url.protocol === 'https:' ? node_https_1.request : node_http_1.request;
        // The headers fetch sends by default; CDNs such as Akamai stall requests without them.
        const defaults = {
            Accept: '*/*',
            'Accept-Language': '*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Mode': 'cors'
        };
        const request = send(url, { headers: { ...defaults, ...headers }, signal, lookup: publicLookup }, resolve);
        request.on('error', reject);
        request.end();
    });
}
function toResponse(message) {
    const status = message.statusCode ?? 502;
    const headers = new Headers();
    for (const [name, value] of Object.entries(message.headers))
        if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    if (status < 200 || status > 599 || status === 204 || status === 205 || status === 304) {
        message.resume();
        return new Response(null, { status: status < 200 || status > 599 ? 502 : status, headers });
    }
    // Some CDNs compress even when not asked, and fetch would have decoded the body; the byte limits
    // of the callers then apply to the decoded bytes.
    const encoding = (message.headers['content-encoding'] ?? '').trim().toLowerCase();
    const source = encoding === 'gzip' || encoding === 'x-gzip'
        ? message.pipe((0, node_zlib_1.createGunzip)())
        : encoding === 'deflate'
            ? message.pipe((0, node_zlib_1.createInflate)())
            : encoding === 'br'
                ? message.pipe((0, node_zlib_1.createBrotliDecompress)())
                : message;
    // Events can still arrive after the reader cancels, and a closed stream throws on them.
    let finished = false;
    const body = new ReadableStream({
        start(controller) {
            const fail = (error) => {
                if (finished)
                    return;
                finished = true;
                controller.error(error);
            };
            source.on('data', (chunk) => {
                if (finished)
                    return;
                controller.enqueue(new Uint8Array(chunk));
                if ((controller.desiredSize ?? 1) <= 0)
                    source.pause();
            });
            source.on('end', () => {
                if (finished)
                    return;
                finished = true;
                controller.close();
            });
            source.on('error', fail);
            if (source !== message)
                message.on('error', fail);
        },
        pull() {
            source.resume();
        },
        cancel() {
            finished = true;
            source.destroy();
            message.destroy();
        }
    });
    return new Response(body, { status, headers });
}
/**
 * Fetches a file a web page named. Only http and https to public addresses are allowed, checked on
 * every redirect and on the address each connection uses.
 */
async function fetchPublicFile(url, headers, timeoutMs = FETCH_TIMEOUT_MS) {
    const signal = AbortSignal.timeout(timeoutMs);
    let current = new URL(url);
    for (let redirects = 0; redirects <= 5; redirects++) {
        if (current.protocol !== 'http:' && current.protocol !== 'https:')
            throw new Error(`Only http and https can be fetched, not ${current.protocol}`);
        // A literal IP address needs no lookup, so it is checked here.
        const host = current.hostname.replace(/^\[|\]$/g, '');
        if ((0, node_net_1.isIP)(host) !== 0 && isPrivateAddress(host))
            throw new Error(`${host} is a local or private network address`);
        // Behind the sandbox's egress proxy, the proxy decides which hosts are reachable.
        if ([process.env.HTTPS_PROXY, process.env.HTTP_PROXY, process.env.https_proxy, process.env.http_proxy].some((value) => value !== undefined && value !== ''))
            return fetch(current, { headers, signal });
        const message = await requestOnce(current, headers, signal);
        const location = message.headers.location;
        if ([301, 302, 303, 307, 308].includes(message.statusCode ?? 0) && location !== undefined) {
            message.resume();
            current = new URL(location, current);
            continue;
        }
        return toResponse(message);
    }
    throw new Error('Too many redirects');
}
