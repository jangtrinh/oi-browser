"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distance = distance;
exports.isColorful = isColorful;
exports.isAccent = isAccent;
exports.rankAccents = rankAccents;
// Ranks the page's candidate brand colors by how salient each is: the logo first, then the call
// to action and repeated filled buttons, the theme-color tag, a colored page, painted design
// tokens, headings, colored areas, and colored text.
const brand_color_math_js_1 = require("./brand-color-math.js");
function distance(first, second) {
    const a = (0, brand_color_math_js_1.hexToRgb)(first);
    const b = (0, brand_color_math_js_1.hexToRgb)(second);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function isColorful(hex) {
    const channels = (0, brand_color_math_js_1.hexToRgb)(hex);
    const max = Math.max(...channels);
    const min = Math.min(...channels);
    const lightness = (max + min) / 510;
    const saturation = max === min ? 0 : (max - min) / 255 / (1 - Math.abs(2 * lightness - 1) || 1);
    return max - min >= 40 && saturation >= 0.25;
}
/**
 * Near-black and near-white read as ink or paper, never as an accent. Deep brand colors such as
 * aubergine or navy are dark but clearly colored, so the floor is low.
 */
function isAccent(hex) {
    const channels = (0, brand_color_math_js_1.hexToRgb)(hex);
    return isColorful(hex) && Math.max(...channels) >= 50 && Math.min(...channels) <= 225;
}
function rankAccents(input) {
    const { probe, background, cta, headingColors, logoColors, tokens } = input;
    // Accents, weighted by where each color shows up.
    const evidence = new Map();
    const add = (hex, score, source) => {
        // Unstyled links keep the browser's own blue and purple, which say nothing about the brand.
        if (hex === '#0000ee' || hex === '#551a8b')
            return;
        if (hex === null || hex === undefined || !isAccent(hex) || score <= 0)
            return;
        const entry = evidence.get(hex) ?? { score: 0, sources: new Set() };
        entry.score += score;
        entry.sources.add(source);
        evidence.set(hex, entry);
    };
    // The logo is the strongest brand signal, in proportion to how much of the mark a color covers.
    const palette = probe.logos[0]?.palette;
    const logoShares = palette !== undefined &&
        palette.length > 0 &&
        logoColors.every((hex) => palette.some((entry) => entry.hex === hex))
        ? palette.filter((entry) => logoColors.includes(entry.hex))
        : [...new Set(logoColors)].map((hex) => ({
            hex,
            share: 1 / Math.max(1, new Set(logoColors).size)
        }));
    for (const entry of logoShares.slice(0, 4))
        add(entry.hex, 25 + 35 * entry.share, 'logo');
    if (cta !== null)
        add(cta.background ?? cta.color, cta.background !== null ? 40 : 25, 'cta');
    // Other filled buttons repeat the brand's UI color.
    for (const other of probe.buttons.filter((entry) => entry.style === 'filled').slice(0, 4))
        if (other.background !== null && other.background !== cta?.background)
            add(other.background, 10, 'cta');
    // A theme-color meta tag is the site's own statement of its color; a colored page is its color.
    add(probe.themeColor, 25, 'meta');
    add(background, 35, 'background');
    const tokenHexes = new Set();
    const unpainted = [];
    for (const token of tokens.slice(0, 60)) {
        // States, statuses, charts, and embedded widgets name their own "primary" and "accent" colors.
        const other = /(^|-)(hover|active|focus|pressed|disabled|visited|warning|error|danger|success|info|positive|negative|sentiment|feedback|critical|caution|alert|decoration|decorative|infographic|chart|chat|messenger|third-party|checkbox|facebook|twitter|linkedin|instagram|youtube|whatsapp)(-|$)/i.test(token.name);
        const exact = !other && /(^--|-)(brand|primary|accent)(-color)?$/i.test(token.name);
        if (tokenHexes.has(token.hex) ||
            other ||
            (!exact && !(token.used && /brand|primary|accent|cta|highlight/i.test(token.name))))
            continue;
        tokenHexes.add(token.hex);
        // A primary token the page never paints (a framework default, a sub-brand theme, a color kept
        // for later) is not the brand's color on this page; it is listed apart.
        if (exact && !token.used) {
            if (isAccent(token.hex) && unpainted.length < 3)
                unpainted.push(`${token.name} ${token.hex}`);
        }
        else
            add(token.hex, exact ? 14 : 6, 'token');
    }
    for (const hex of headingColors)
        add(hex, 20, 'heading');
    for (const entry of probe.colorfulArea)
        add(entry.hex, Math.min(45, entry.share * 2), 'area');
    const totalChars = probe.text.reduce((sum, group) => sum + group.chars, 0) || 1;
    const colorfulChars = new Map();
    for (const group of probe.text)
        if (isColorful(group.color))
            colorfulChars.set(group.color, (colorfulChars.get(group.color) ?? 0) + group.chars);
    for (const [hex, chars] of colorfulChars)
        add(hex, Math.min(25, (chars / totalChars) * 120), 'text');
    const accents = [];
    for (const [hex, entry] of [...evidence.entries()].sort((left, right) => right[1].score - left[1].score)) {
        const near = accents.find((accent) => distance(accent.hex, hex) < 28);
        if (near === undefined)
            accents.push({
                hex,
                score: entry.score,
                sources: [...entry.sources]
            });
        else {
            near.score += entry.score;
            for (const source of entry.sources)
                if (!near.sources.includes(source))
                    near.sources.push(source);
        }
    }
    accents.sort((left, right) => right.score - left.score);
    return {
        accents,
        unpainted,
        logoShares,
        logoColorful: logoShares.some((entry) => isAccent(entry.hex) && entry.share >= 0.1)
    };
}
