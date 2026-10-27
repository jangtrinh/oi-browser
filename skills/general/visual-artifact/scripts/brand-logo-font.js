"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedLogoFonts = embedLogoFonts;
// Logos with live text (a wordmark set in the brand font, or a mark next to text) are saved as SVG
// with <text>. An SVG used as an image cannot load fonts from the page, so the brand font file is
// embedded in the logo itself and it renders the same anywhere.
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const brand_type_js_1 = require("./brand-type.js");
const MAX_EMBEDDED_BYTES = 400 * 1024;
async function installedFaces(root) {
    let css = '';
    try {
        css = await (0, promises_1.readFile)(node_path_1.default.join(root, 'styles', 'fonts.css'), 'utf8');
    }
    catch {
        return [];
    }
    return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => {
        const body = match[1] ?? '';
        const read = (name) => body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim() ?? '';
        return {
            family: read('font-family').replace(/^["']|["']$/g, ''),
            weight: read('font-weight') || '400',
            style: read('font-style') || 'normal',
            file: node_path_1.default.resolve(root, 'styles', read('src').match(/url\("?([^")]+)"?\)/)?.[1] ?? '')
        };
    })
        // Only files the skill installed are embedded; a family name can come from the page.
        .filter((face) => face.file.startsWith(node_path_1.default.join(root, 'fonts') + node_path_1.default.sep));
}
function weightGap(faceWeight, wanted) {
    const values = faceWeight
        .split(/\s+/)
        .map((part) => (part === 'normal' ? 400 : part === 'bold' ? 700 : Number(part)))
        .filter((value) => Number.isFinite(value));
    const low = values[0] ?? 400;
    const high = values[1] ?? low;
    return wanted >= low && wanted <= high
        ? 0
        : Math.min(Math.abs(wanted - low), Math.abs(wanted - high));
}
/** Embeds the installed brand font used by each <text> of the logo files. */
async function embedLogoFonts(root, files) {
    const faces = await installedFaces(root);
    if (faces.length === 0)
        return;
    for (const file of files) {
        if (!file.endsWith('.svg'))
            continue;
        let markup = await (0, promises_1.readFile)(file, 'utf8');
        if (!/<text[\s>]/.test(markup))
            continue;
        const wanted = new Map();
        // The page's family stack becomes the installed family name, for each <text> style.
        markup = markup.replace(/font-family:([^;"]+);font-size:([^;"]+);font-weight:(\d+);font-style:(\w+)/g, (whole, stack, size, weight, style) => {
            const names = stack.split(',').map((name) => (0, brand_type_js_1.cleanFamily)(name.trim().replace(/^'|'$/g, '')));
            const family = names.find((name) => faces.some((face) => face.family.toLowerCase() === name.toLowerCase()));
            if (family === undefined)
                return whole;
            const candidates = faces.filter((face) => face.family.toLowerCase() === family.toLowerCase());
            const italic = style !== 'normal';
            const sameStyle = candidates.filter((face) => (face.style !== 'normal') === italic);
            const best = [...(sameStyle.length > 0 ? sameStyle : candidates)].sort((left, right) => weightGap(left.weight, Number(weight)) - weightGap(right.weight, Number(weight)))[0];
            if (best !== undefined)
                wanted.set(best.file, best);
            return `font-family:'${family}';font-size:${size};font-weight:${weight};font-style:${style}`;
        });
        const rules = [];
        let total = 0;
        for (const face of wanted.values()) {
            try {
                const bytes = await (0, promises_1.readFile)(face.file);
                total += bytes.byteLength;
                if (total > MAX_EMBEDDED_BYTES)
                    break;
                const format = face.file.endsWith('.woff2')
                    ? 'woff2'
                    : face.file.endsWith('.woff')
                        ? 'woff'
                        : face.file.endsWith('.otf')
                            ? 'opentype'
                            : 'truetype';
                rules.push(`@font-face{font-family:'${face.family}';font-weight:${face.weight};font-style:${face.style};src:url(data:font/${format};base64,${bytes.toString('base64')}) format('${format}')}`);
            }
            catch {
                continue;
            }
        }
        if (rules.length === 0)
            continue;
        // One <style> right inside the outermost <svg> covers nested and recolored copies.
        markup = markup.replace(/<svg\b[^>]*>/i, (tag) => `${tag}<style>${rules.join('')}</style>`);
        await (0, promises_1.writeFile)(file, markup, 'utf8');
    }
}
