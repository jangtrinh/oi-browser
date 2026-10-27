"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installBrandFonts = installBrandFonts;
// Brand fonts: which families the page renders and at which weights, where their files live
// (readable CSS, cross-origin CSS and its @imports, or files loaded through the FontFace API), and
// downloading them into `fonts/` with one block in `styles/fonts.css`.
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_zlib_1 = require("node:zlib");
const brand_type_js_1 = require("./brand-type.js");
const fonts_js_1 = require("./fonts.js");
const MAX_FONT_TABLE_BYTES = 64 * 1024 * 1024;
const MAX_STYLESHEETS = 60;
const MAX_FONT_FILES = 18;
const MAX_FACES_PER_FAMILY = 6;
// Closest Google Fonts for common commercial families, offered when a brand font cannot be downloaded.
const FONT_SUBSTITUTES = [
    [
        /berkeley mono|sf mono|menlo|consolas|operator mono|commit ?mono|input mono|monaco/i,
        'JetBrains Mono'
    ],
    [
        /s[o\u00f6]hne|sohne|gt america|abc diatype|diatype|aktiv grotesk|neue haas|haas grotesk/i,
        'Inter Tight'
    ],
    [
        /helvetica|arial|sf pro|san francisco|system-ui|apple-system|blinkmac|segoe|suisse|untitled sans/i,
        'Inter'
    ],
    [/graphik|atlas grotesk|calibre|basis grotesque/i, 'Hanken Grotesk'],
    [/circular|cereal|gt walsheim|walsheim|apercu|sofia pro|product sans|google sans/i, 'DM Sans'],
    [/proxima|gotham|montserrat|brandon|avenir|nunito/i, 'Montserrat'],
    [/futura|jost|century gothic|twentieth/i, 'Jost'],
    [/founders grotesk|national|favorit|replica|maison neue/i, 'Schibsted Grotesk'],
    [/tiempos|lyon|publico|georgia|times|cheltenham|imperial|charter/i, 'Source Serif 4'],
    [/canela|domaine|recoleta|gt super|editorial new|ogg|freight big|chronicle/i, 'Fraunces'],
    [/garamond|caslon|baskerville|mercury/i, 'EB Garamond']
];
function substituteFor(family, generic) {
    for (const [pattern, substitute] of FONT_SUBSTITUTES)
        if (pattern.test(family))
            return substitute;
    if (/monospace/.test(generic))
        return 'JetBrains Mono';
    if (/serif/.test(generic) && !/sans/.test(generic))
        return 'Source Serif 4';
    return 'Inter';
}
/** Role families plus any family that sets a large share of the page, with the weights it uses. */
function planFamilies(roles, groups, logoFont, logoWeight) {
    const plans = new Map();
    const add = (group, role) => {
        const key = group.family.toLowerCase();
        const plan = plans.get(key) ?? {
            family: group.family,
            roles: [],
            weights: new Set(),
            italic: false,
            webFont: group.webFont,
            generic: group.generic
        };
        if (role !== null && !plan.roles.includes(role))
            plan.roles.push(role);
        const weight = Number(group.weight);
        if (Number.isFinite(weight))
            plan.weights.add(weight);
        plan.webFont = plan.webFont || group.webFont;
        plans.set(key, plan);
    };
    for (const [role, group] of Object.entries(roles))
        add(group, role);
    const total = groups.reduce((sum, group) => sum + group.chars, 0) || 1;
    const byFamily = new Map();
    for (const group of groups)
        byFamily.set(group.family.toLowerCase(), [
            ...(byFamily.get(group.family.toLowerCase()) ?? []),
            group
        ]);
    for (const [key, familyGroups] of byFamily) {
        const chars = familyGroups.reduce((sum, group) => sum + group.chars, 0);
        if (chars / total < 0.08 && !plans.has(key))
            continue;
        const weights = new Map();
        for (const group of familyGroups)
            weights.set(group.weight, (weights.get(group.weight) ?? 0) + group.chars);
        for (const group of familyGroups)
            if ((weights.get(group.weight) ?? 0) / chars >= 0.03)
                add(group, null);
        const plan = plans.get(key);
        if (plan !== undefined)
            plan.italic =
                familyGroups.filter((group) => group.italic).reduce((sum, group) => sum + group.chars, 0) /
                    chars >
                    0.05;
    }
    if (logoFont !== undefined)
        add({
            family: logoFont,
            weight: logoWeight ?? '400',
            italic: false,
            webFont: true,
            generic: 'sans-serif'
        }, 'logo');
    return [...plans.values()];
}
/** Reads cross-origin stylesheets (and their @imports) until every missing family has faces. */
async function loadRemoteFaces(probe, wanted, headers) {
    const queue = [...probe.unreadableStylesheets];
    const seen = new Set(queue);
    const faces = [];
    const found = new Set();
    let fetched = 0;
    const worker = async () => {
        while (queue.length > 0 && found.size < wanted.size && fetched < MAX_STYLESHEETS) {
            const href = queue.shift();
            if (href === undefined)
                break;
            fetched++;
            try {
                const response = await (0, fonts_js_1.fetchPublicFile)(href, { ...headers, Accept: 'text/css,*/*;q=0.1' }, 6_000);
                if (!response.ok)
                    continue;
                const body = await (0, fonts_js_1.readCapped)(response, 8 * 1024 * 1024);
                if (body === null)
                    continue;
                const css = body.toString('utf8');
                for (const face of (0, fonts_js_1.parseFontFaceCss)(css, href)) {
                    if (!wanted.has(face.family.toLowerCase()))
                        continue;
                    faces.push(face);
                    found.add(face.family.toLowerCase());
                }
                for (const imported of (0, fonts_js_1.parseCssImports)(css, href)) {
                    if (seen.has(imported))
                        continue;
                    seen.add(imported);
                    queue.push(imported);
                }
            }
            catch {
                continue;
            }
        }
    };
    await Promise.all(Array.from({ length: 8 }, () => worker()));
    return faces;
}
/**
 * Pages that load fonts with the JavaScript FontFace API leave no @font-face rule to read, so the
 * font files the page downloaded are matched to missing families by the names stored inside them.
 */
async function identifyFontResources(probe, known, missing, headers) {
    const knownUrls = new Set(known.map((face) => face.url));
    const squash = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const faces = await Promise.all(probe.fontResources
        .filter((url) => !knownUrls.has(url))
        .slice(0, 10)
        .map(async (url) => {
        try {
            const response = await (0, fonts_js_1.fetchPublicFile)(url, headers, 8_000);
            const bytes = response.ok ? await (0, fonts_js_1.readCapped)(response, 4 * 1024 * 1024) : null;
            const info = bytes === null ? null : readFontFileInfo(bytes);
            if (info === null)
                return null;
            const internal = squash(info.family.replace(/\s*(italic|oblique)$/i, ''));
            const family = [...missing].find((name) => {
                const css = squash(name);
                return (css.length > 2 &&
                    (css === internal || internal.startsWith(css) || css.startsWith(internal)));
            });
            if (family === undefined)
                return null;
            const original = probe.text.find((group) => group.family.toLowerCase() === family)?.family ?? family;
            return {
                family: original,
                weight: info.weight,
                style: info.italic || /italic|oblique/i.test(info.family) ? 'italic' : 'normal',
                url
            };
        }
        catch {
            return null;
        }
    }));
    return faces.filter((face) => face !== null);
}
function coversLatin(unicodeRange) {
    if (unicodeRange === undefined)
        return true;
    return unicodeRange.split(',').some((part) => {
        const match = part.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
        if (match === null)
            return false;
        const startText = match[1] ?? '';
        const start = parseInt(startText.replace(/\?/g, '0'), 16);
        const end = match[2] !== undefined ? parseInt(match[2], 16) : parseInt(startText.replace(/\?/g, 'f'), 16);
        return start <= 0x61 && end >= 0x61;
    });
}
function weightGap(faceWeight, wanted) {
    const keyword = { normal: 400, bold: 700 };
    const values = faceWeight
        .split(/\s+/)
        .map((part) => keyword[part] ?? Number(part))
        .filter((value) => Number.isFinite(value));
    const low = values[0] ?? 400;
    const high = values[1] ?? low;
    return wanted >= low && wanted <= high
        ? 0
        : Math.min(Math.abs(wanted - low), Math.abs(wanted - high));
}
/** The Latin faces closest to each weight and style the page uses, with every slice of a split face. */
function chooseFaces(plan, faces) {
    const own = faces.filter((face) => face.family.toLowerCase() === plan.family.toLowerCase());
    const latin = own.filter((face) => coversLatin(face.unicodeRange));
    const pool = latin.length > 0 ? latin : own;
    const chosen = new Map();
    for (const italic of plan.italic ? [false, true] : [false]) {
        for (const weight of plan.weights.size > 0 ? plan.weights : [400]) {
            const sameStyle = pool.filter((face) => /italic|oblique/i.test(face.style) === italic);
            const candidates = sameStyle.length > 0 ? sameStyle : pool;
            const best = [...candidates].sort((left, right) => weightGap(left.weight, weight) - weightGap(right.weight, weight))[0];
            for (const face of candidates)
                if (best !== undefined && face.weight === best.weight && face.style === best.style)
                    chosen.set(face.url, face);
        }
    }
    return [...chosen.values()].slice(0, MAX_FACES_PER_FAMILY);
}
function sourceOf(url) {
    if (/typekit\.(net|com)|adobe/i.test(url))
        return 'adobe';
    return /fonts\.gstatic\.com|fonts\.googleapis\.com/i.test(url) ? 'google' : null;
}
async function installBrandFonts(root, probe, roles, headers, notes, fetchInPage) {
    const plans = planFamilies(roles, probe.text, probe.logos[0]?.font, probe.logos[0]?.fontWeight);
    const faces = probe.fontFaces.map((face) => ({ ...face }));
    const missing = new Set(plans
        .filter((plan) => plan.webFont &&
        !faces.some((face) => face.family.toLowerCase() === plan.family.toLowerCase()))
        .map((plan) => plan.family.toLowerCase()));
    if (missing.size > 0) {
        const remote = await loadRemoteFaces(probe, missing, headers);
        faces.push(...remote);
        for (const face of remote)
            missing.delete(face.family.toLowerCase());
    }
    if (missing.size > 0)
        faces.push(...(await identifyFontResources(probe, faces, missing, headers)));
    // Every family's files are downloaded in one batch, so faces refused to Node are fetched through
    // the page in a single round trip.
    let budget = MAX_FONT_FILES;
    const planned = [...plans]
        .sort((left, right) => right.roles.length - left.roles.length)
        .map((plan) => {
        const chosen = chooseFaces(plan, faces).slice(0, Math.max(0, budget));
        budget -= chosen.length;
        return { plan, family: (0, brand_type_js_1.cssFamily)(plan.family).replace(/^'|'$/g, ''), chosen };
    });
    const wanted = planned.flatMap(({ family, chosen }) => chosen.map((face) => ({ ...face, family })));
    let downloaded = [];
    if (wanted.length > 0) {
        try {
            downloaded = await (0, fonts_js_1.downloadFontFaces)(root, wanted, { ...headers, Origin: new URL(probe.url).origin }, fetchInPage);
        }
        catch {
            downloaded = [];
        }
    }
    // A variable file declared at one weight still covers its whole range.
    for (const file of downloaded) {
        const info = readFontFileInfo(await (0, promises_1.readFile)(node_path_1.default.join(root, 'fonts', file.fileName)));
        if (info !== null && info.weight.includes(' ') && !file.weight.includes(' '))
            file.weight = info.weight;
    }
    const fonts = [];
    for (const { plan, family, chosen } of planned) {
        const substitute = substituteFor(plan.family, plan.generic);
        if (chosen.length === 0) {
            // A face that only names an installed font with local() is a system font on this machine.
            const local = probe.localFamilies.some((name) => name.toLowerCase() === plan.family.toLowerCase());
            if (plan.webFont && !local)
                fonts.push({ family, roles: plan.roles, status: 'not-found', substitute });
            else if (plan.roles.length > 0)
                fonts.push({ family, roles: plan.roles, status: 'system', substitute });
            continue;
        }
        const source = sourceOf(chosen[0]?.url ?? '');
        const files = downloaded.filter((file) => file.family === family);
        if (files.length > 0) {
            fonts.push({
                family,
                roles: plan.roles,
                status: 'installed',
                weights: [...new Set(files.map((file) => file.weight))],
                ...(source !== null ? { source } : {})
            });
            continue;
        }
        fonts.push({
            family,
            roles: plan.roles,
            status: 'failed',
            ...(source !== null ? { source } : {}),
            substitute
        });
        notes.push(`${source === 'adobe' ? 'Adobe Fonts' : 'The font host'} refused "${family}"; install ${substitute} with installGoogleFonts instead.`);
    }
    if (downloaded.length > 0)
        await (0, fonts_js_1.writeFontFaceBlock)(root, `brand ${new URL(probe.url).hostname}`, downloaded);
    const order = [...brand_type_js_1.ROLE_ORDER, 'logo'];
    const rank = (font) => Math.min(99, ...font.roles.map((role) => order.indexOf(role)).filter((index) => index >= 0));
    return fonts
        .filter((font) => font.roles.length > 0 || font.status === 'installed')
        .sort((left, right) => rank(left) - rank(right))
        .slice(0, 6);
}
// WOFF2 names its tables by index into this list (only the ones read here matter).
const WOFF2_KNOWN_TAGS = [
    'cmap',
    'head',
    'hhea',
    'hmtx',
    'maxp',
    'name',
    'OS/2',
    'post',
    'cvt ',
    'fpgm',
    'glyf',
    'loca',
    'prep',
    'CFF ',
    'VORG',
    'EBDT',
    'EBLC',
    'gasp',
    'hdmx',
    'kern',
    'LTSH',
    'PCLT',
    'VDMX',
    'vhea',
    'vmtx',
    'BASE',
    'GDEF',
    'GPOS',
    'GSUB',
    'EBSC',
    'JSTF',
    'MATH',
    'CBDT',
    'CBLC',
    'COLR',
    'CPAL',
    'SVG ',
    'sbix',
    'acnt',
    'avar',
    'bdat',
    'bloc',
    'bsln',
    'cvar',
    'fdsc',
    'feat',
    'fmtx',
    'fvar',
    'gvar',
    'hsty',
    'just',
    'lcar',
    'mort',
    'morx',
    'opbd',
    'prop',
    'trak',
    'Zapf',
    'Silf',
    'Glat',
    'Gloc',
    'Feat',
    'Sill'
];
/**
 * Reads the family name, weight, and style stored inside a font file. Pages that load fonts with
 * the JavaScript FontFace API leave no @font-face rule to read, so their downloaded files are
 * matched to CSS families by the names inside them.
 */
function readFontFileInfo(bytes) {
    try {
        const tables = readFontTables(bytes);
        const name = tables.get('name');
        if (name === undefined)
            return null;
        const family = readFontName(name);
        if (family === null)
            return null;
        const os2 = tables.get('OS/2');
        let weight = os2 !== undefined && os2.length >= 6 ? String(os2.readUInt16BE(4)) : '400';
        const italic = os2 !== undefined && os2.length >= 64 ? (os2.readUInt16BE(62) & 1) === 1 : false;
        const fvar = tables.get('fvar');
        if (fvar !== undefined && fvar.length >= 16) {
            const axesOffset = fvar.readUInt16BE(4);
            const axisCount = fvar.readUInt16BE(8);
            const axisSize = fvar.readUInt16BE(10);
            for (let index = 0; index < axisCount; index++) {
                const start = axesOffset + index * axisSize;
                if (start + 16 > fvar.length)
                    break;
                if (fvar.toString('latin1', start, start + 4) === 'wght') {
                    weight = `${Math.round(fvar.readInt32BE(start + 4) / 65536)} ${Math.round(fvar.readInt32BE(start + 12) / 65536)}`;
                }
            }
        }
        return { family, weight, italic };
    }
    catch {
        return null;
    }
}
function readFontTables(bytes) {
    const tables = new Map();
    const signature = bytes.toString('latin1', 0, 4);
    const wanted = new Set(['name', 'OS/2', 'fvar']);
    if (signature === 'wOF2') {
        const tableCount = bytes.readUInt16BE(12);
        const compressedLength = bytes.readUInt32BE(20);
        let offset = 48;
        const readBase128 = () => {
            let value = 0;
            for (let index = 0; index < 5; index++) {
                const byte = bytes[offset++] ?? 0;
                value = value * 128 + (byte & 0x7f);
                if ((byte & 0x80) === 0)
                    return value;
            }
            return value;
        };
        const entries = [];
        for (let index = 0; index < tableCount; index++) {
            const flags = bytes[offset++] ?? 0;
            let tag = WOFF2_KNOWN_TAGS[flags & 0x3f] ?? '';
            if ((flags & 0x3f) === 63) {
                tag = bytes.toString('latin1', offset, offset + 4);
                offset += 4;
            }
            const version = flags >> 6;
            const originalLength = readBase128();
            const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
            const length = transformed ? readBase128() : originalLength;
            entries.push({ tag, length });
        }
        // A crafted font must not expand without limit; real fonts stay far below this.
        const stream = (0, node_zlib_1.brotliDecompressSync)(bytes.subarray(offset, offset + compressedLength), {
            maxOutputLength: MAX_FONT_TABLE_BYTES
        });
        let position = 0;
        for (const entry of entries) {
            if (wanted.has(entry.tag))
                tables.set(entry.tag, stream.subarray(position, position + entry.length));
            position += entry.length;
        }
        return tables;
    }
    if (signature === 'wOFF') {
        const tableCount = bytes.readUInt16BE(12);
        for (let index = 0; index < tableCount; index++) {
            const entry = 44 + index * 20;
            const tag = bytes.toString('latin1', entry, entry + 4);
            if (!wanted.has(tag))
                continue;
            const offset = bytes.readUInt32BE(entry + 4);
            const compressed = bytes.readUInt32BE(entry + 8);
            const original = bytes.readUInt32BE(entry + 12);
            const data = bytes.subarray(offset, offset + compressed);
            tables.set(tag, compressed < original
                ? (0, node_zlib_1.inflateSync)(data, { maxOutputLength: MAX_FONT_TABLE_BYTES })
                : data);
        }
        return tables;
    }
    const tableCount = bytes.readUInt16BE(4);
    for (let index = 0; index < tableCount; index++) {
        const entry = 12 + index * 16;
        const tag = bytes.toString('latin1', entry, entry + 4);
        if (!wanted.has(tag))
            continue;
        const offset = bytes.readUInt32BE(entry + 8);
        tables.set(tag, bytes.subarray(offset, offset + bytes.readUInt32BE(entry + 12)));
    }
    return tables;
}
function readFontName(table) {
    const count = table.readUInt16BE(2);
    const storage = table.readUInt16BE(4);
    const found = new Map();
    for (let index = 0; index < count; index++) {
        const record = 6 + index * 12;
        const platform = table.readUInt16BE(record);
        const nameId = table.readUInt16BE(record + 6);
        if (nameId !== 1 && nameId !== 16)
            continue;
        const length = table.readUInt16BE(record + 8);
        const start = storage + table.readUInt16BE(record + 10);
        const raw = table.subarray(start, start + length);
        let value = '';
        if (platform === 3 || platform === 0) {
            for (let offset = 0; offset + 1 < raw.length; offset += 2)
                value += String.fromCharCode(raw.readUInt16BE(offset));
        }
        else if (platform === 1) {
            value = raw.toString('latin1');
        }
        if (value.length > 0 && (!found.has(nameId) || platform === 3))
            found.set(nameId, value);
    }
    return found.get(16) ?? found.get(1) ?? null;
}
