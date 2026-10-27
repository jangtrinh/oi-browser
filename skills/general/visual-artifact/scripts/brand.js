"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectBrand = inspectBrand;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const brand_assets_js_1 = require("./brand-assets.js");
const brand_colors_js_1 = require("./brand-colors.js");
const brand_fetch_js_1 = require("./brand-fetch.js");
const brand_fonts_js_1 = require("./brand-fonts.js");
const brand_logo_font_js_1 = require("./brand-logo-font.js");
const brand_pixels_js_1 = require("./brand-pixels.js");
const brand_probe_js_1 = require("./brand-probe.js");
const brand_screenshots_js_1 = require("./brand-screenshots.js");
const brand_type_js_1 = require("./brand-type.js");
const fonts_js_1 = require("./fonts.js");
const session_js_1 = require("./session.js");
/**
 * Opens a brand website in an agent tab and captures its design system in one call: color roles,
 * type roles with the brand's font files, logo files, imagery, shape language, and screenshots.
 * Fonts are registered in `styles/fonts.css`; files are saved under `brand/`, and every returned
 * path is relative to the artifact root. The top of the page and one distinctive section further
 * down are attached for you to look at; up to four screens are saved in `brand/assets/screens/`.
 */
async function inspectBrand(input) {
    const started = Date.now();
    const root = (0, session_js_1.resolveArtifactRoot)(input.artifactId);
    const assets = node_path_1.default.join(root, 'brand', 'assets');
    await (0, promises_1.mkdir)(node_path_1.default.join(assets, 'screens'), { recursive: true });
    const notes = [];
    // Without focus the tab does not add a live screenshot to every later request.
    const { tabId } = await oi.openTab({
        url: input.url,
        controlled_by: 'agent',
        focus: false
    });
    const tab = oi.tab(tabId);
    const probeCode = `return (${brand_probe_js_1.probeBrandPage.toString()})(${brand_probe_js_1.hideOverlays.toString()})`;
    let raw;
    try {
        raw = await tab.execute(probeCode);
    }
    catch {
        // Pages that redirect or re-render right after load can drop the first run.
        raw = await tab.execute(probeCode);
    }
    if (typeof raw !== 'string')
        throw new Error('The brand page did not return a readable probe; inspect it manually');
    const probe = JSON.parse(raw);
    if (typeof probe.blocked === 'string') {
        throw new Error(`${probe.url} showed ${probe.blocked === 'an empty page' ? 'an empty page, usually a bot check,' : `a bot check ("${probe.blocked}")`} instead of the site. Ask the user to open it in a tab and pass the check, then call inspectBrand again.`);
    }
    const probed = Date.now();
    const firstPass = (0, brand_colors_js_1.summarizeColors)(probe, [], probe.logos[0]?.colors ?? []);
    const roles = (0, brand_type_js_1.pickTypeRoles)(probe.text, firstPass.colors.background, firstPass.cta?.font ?? null);
    const headingColors = [roles.display?.color, roles.heading?.color].filter((color) => color !== undefined);
    const headers = { 'User-Agent': fonts_js_1.BROWSER_USER_AGENT, Referer: probe.url };
    // Files that bot protection refuses to Node are fetched by the page, one call at a time and only
    // after the screenshots, so the page is not scrolled or busy while a screen is captured.
    let screensDone = () => { };
    let pageQueue = new Promise((resolve) => {
        screensDone = () => resolve(null);
    });
    const fetchInPage = (urls) => {
        const run = pageQueue.then(() => (0, brand_fetch_js_1.fetchThroughPage)(tab, urls));
        pageQueue = run.catch(() => null);
        return run;
    };
    // Downloads run while the screenshots are taken.
    let downloaded = 0;
    const downloads = Promise.all([
        (0, brand_fonts_js_1.installBrandFonts)(root, probe, roles, headers, notes, fetchInPage),
        (0, brand_assets_js_1.saveImages)(assets, probe, headers, fetchInPage),
        (0, brand_assets_js_1.saveLogos)(assets, probe, firstPass.colors.text, headers, fetchInPage)
    ]).then((results) => {
        downloaded = Date.now();
        return results;
    });
    let screenshots;
    try {
        screenshots = await (0, brand_screenshots_js_1.captureScreens)(tab, probe, assets, notes);
    }
    finally {
        screensDone();
    }
    const captured = Date.now();
    // The saved screens, read back through the page, check the colors against what is painted; this
    // runs while the downloads finish.
    let sampled = captured;
    const pixelRun = pageQueue
        .then(() => (0, brand_pixels_js_1.samplePagePixels)(tab, probe, screenshots.saved))
        .catch(() => null)
        .then((sample) => {
        sampled = Date.now();
        return sample;
    });
    pageQueue = pixelRun.then(() => null);
    const [fonts, images, logo] = await downloads;
    const pixelSample = await pixelRun;
    const pixels = pixelSample === null ? null : (0, brand_pixels_js_1.pagePixels)(pixelSample);
    const { theme, colors, cta, candidates } = (0, brand_colors_js_1.summarizeColors)(probe, headingColors, logo.colors, pixels);
    await (0, brand_logo_font_js_1.embedLogoFonts)(root, [logo.onLight, logo.onDark].filter((file) => file !== undefined));
    const probePath = node_path_1.default.join(root, 'brand', 'probe.json');
    const timings = {
        ...probe.timings,
        probe: probed - started,
        screenshots: captured - probed,
        downloads: downloaded - probed,
        pixels: sampled - captured
    };
    // Inline font data is already in fonts/; probe.json keeps its size readable.
    const fontFaces = probe.fontFaces.map((face) => face.url.startsWith('data:') ? { ...face, url: 'data: (inline font)' } : face);
    await (0, promises_1.writeFile)(probePath, JSON.stringify({
        ...probe,
        fontFaces,
        timings,
        colorCandidates: candidates,
        pixels: pixelSample
    }, null, 2), 'utf8');
    if (probe.hidden.length > 0)
        notes.push(`Hid ${[...new Set(probe.hidden)].join(' and ')} before measuring; nothing was accepted.`);
    if (logo.text !== undefined)
        notes.push(`The logo includes live text "${logo.text}"; keep its font installed.`);
    if (logo.onLight === undefined && logo.onDark === undefined)
        notes.push('No logo file was found; use the og image or the icon, or ask the user for a logo.');
    const relative = (file) => node_path_1.default.relative(root, file).split(node_path_1.default.sep).join('/');
    const type = {};
    for (const role of brand_type_js_1.ROLE_ORDER) {
        const group = roles[role];
        if (group !== undefined)
            type[role] = (0, brand_type_js_1.formatRole)(group);
    }
    const result = {
        tabId,
        root,
        source: { url: probe.url, title: probe.title.slice(0, 90) },
        theme,
        colors,
        type,
        fonts,
        shape: summarizeShape(probe, cta),
        logo: {
            ...(logo.onLight !== undefined ? { onLight: relative(logo.onLight) } : {}),
            ...(logo.onDark !== undefined ? { onDark: relative(logo.onDark) } : {}),
            ...(logo.derived !== undefined ? { derived: logo.derived } : {}),
            ...(logo.text !== undefined ? { text: logo.text } : {}),
            ...(logo.icon !== undefined ? { icon: relative(logo.icon) } : {})
        },
        images: images.map((image) => `${relative(image.file)} ${image.label}`),
        screenshots: { attached: screenshots.attached, saved: screenshots.saved.map(relative) },
        probe: relative(probePath),
        notes: notes.slice(0, 6)
    };
    // The summary stays small; the design tokens and the notes are the first to shorten, since
    // probe.json keeps everything.
    const bytes = () => Buffer.byteLength(JSON.stringify(result));
    for (const keep of [5, 3, 0]) {
        if (bytes() <= 2500)
            break;
        result.colors.tokens = Object.fromEntries(Object.entries(result.colors.tokens).slice(0, keep));
        result.notes = result.notes.slice(0, Math.max(2, keep));
    }
    const check = result.colors.check;
    if (check !== undefined && bytes() > 2500)
        for (const role of ['background', 'text', 'accents', 'cta'])
            if (check[role] !== undefined)
                check[role] = check[role].slice(0, 2);
    // Long token names and paths can still leave it over; the lists that probe.json repeats go last.
    if (bytes() > 2500) {
        result.notes = result.notes.slice(0, 1);
        if (result.colors.unpainted !== undefined)
            result.colors.unpainted = result.colors.unpainted.slice(0, 1);
        if (result.colors.imagery !== undefined)
            result.colors.imagery = result.colors.imagery.slice(0, 2);
    }
    if (bytes() > 2500)
        result.images = result.images.slice(0, 4);
    return result;
}
function mostCommon(counts, minimum) {
    const [key, count] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] ?? [
        null,
        0
    ];
    return key !== null && count >= minimum ? key : null;
}
function summarizeShape(probe, cta) {
    let button = null;
    if (cta !== null) {
        const radius = cta.radius >= cta.height / 2 - 1 ? 'pill' : `${cta.radius}px radius`;
        const extras = [
            cta.border !== null && cta.style === 'filled' ? `${cta.border} border` : '',
            cta.shadow !== null ? `shadow ${cta.shadow}` : ''
        ].filter((part) => part.length > 0);
        button = [`${cta.style} ${radius}`, `${cta.height}px tall`, ...extras].join(', ');
    }
    const cards = probe.cards;
    const radius = cards.total >= 2 ? mostCommon(cards.radii, 1) : null;
    // A border or shadow counts as the card style when a good share of the cards use it.
    const border = mostCommon(cards.borders, Math.max(2, cards.total * 0.3));
    const shadow = mostCommon(cards.shadows, Math.max(2, cards.total * 0.2));
    const imageRadius = mostCommon(probe.imageRadii, 1);
    return {
        button,
        card: radius === null
            ? null
            : `${radius}px radius, ${border ?? 'no border'}, ${shadow === null ? 'no shadow' : `shadow ${shadow}`}`,
        image: imageRadius === null ? null : `${imageRadius}px radius`
    };
}
