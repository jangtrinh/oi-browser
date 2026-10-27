"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.colorCandidates = colorCandidates;
// Candidate colors for each color role, best guess first, each with where it was seen. When a role
// is uncertain the companion settles it by comparing these few candidates with the screenshots.
const brand_accents_js_1 = require("./brand-accents.js");
const brand_color_math_js_1 = require("./brand-color-math.js");
const percent = (value) => `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10}%`;
/** Same swatch to a designer: tighter for neutrals than for colors. */
function same(first, second) {
    const limit = (0, brand_color_math_js_1.labChroma)(first) >= 15 && (0, brand_color_math_js_1.labChroma)(second) >= 15 ? 10 : 5;
    return (0, brand_color_math_js_1.hexDeltaE)(first, second) < limit;
}
/** Adds a candidate, or its clue to a candidate already listed as the same swatch. */
function collect(list, hex, clue) {
    if (hex === null || hex === undefined)
        return;
    const near = list.find((entry) => same(entry.hex, hex));
    if (near === undefined)
        list.push({ hex, clues: [clue] });
    else if (!near.clues.includes(clue))
        near.clues.push(clue);
}
const shorten = (name) => (name.length > 30 ? `${name.slice(0, 27)}...` : name);
const format = (entry) => `${entry.hex} ${entry.clues.slice(0, 3).join(', ')}`;
function backgroundCandidates(input) {
    const { probe, pixels } = input;
    // The pick, what the screenshots show most (photos aside), the DOM's largest areas, the hero, and
    // the canvas, each described by all of its evidence.
    const hexes = [];
    const add = (hex) => {
        if (!hexes.some((kept) => same(kept, hex)))
            hexes.push(hex);
    };
    add(input.background);
    for (const entry of pixels?.chrome.slice(0, 3) ?? [])
        if (entry.share >= 5)
            add(entry.hex);
    for (const entry of input.backgrounds.slice(0, 3))
        if (entry.share >= 5)
            add(entry.hex);
    add(input.hero);
    add(probe.canvas);
    return hexes.map((hex) => {
        const page = input.backgrounds
            .filter((entry) => same(entry.hex, hex))
            .reduce((sum, entry) => sum + entry.share, 0);
        const clues = [
            page >= 0.5 ? `page ${percent(page)}` : '',
            pixels !== null ? `screens ${percent(pixels.share(hex, 5))}` : '',
            same(hex, input.hero) && !same(hex, input.background) ? 'hero' : '',
            same(hex, probe.canvas) ? 'canvas' : ''
        ].filter((clue) => clue.length > 0);
        return `${hex} ${clues.join(', ')}`;
    });
}
function textCandidates(input) {
    // The pick, the most used colors of the copy on the page's own ground, the main headings, and
    // copy anywhere on the page (colored sections too), by how much of it each sets.
    const hexes = [];
    const add = (hex) => {
        if (!hexes.some((kept) => same(kept, hex)))
            hexes.push(hex);
    };
    add(input.text);
    for (const entry of input.textColors.slice(0, 4))
        if (entry.share >= 3)
            add(entry.hex);
    for (const entry of input.headings)
        add(entry.hex);
    const all = new Map();
    for (const group of input.probe.text)
        all.set(group.color, (all.get(group.color) ?? 0) + group.chars);
    const total = [...all.values()].reduce((sum, chars) => sum + chars, 0) || 1;
    for (const [hex] of [...all.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3))
        add(hex);
    return hexes.map((hex) => {
        const copy = input.textColors
            .filter((entry) => same(entry.hex, hex))
            .reduce((sum, entry) => sum + entry.share, 0);
        const anywhere = [...all.entries()]
            .filter(([color]) => same(color, hex))
            .reduce((sum, [, chars]) => sum + chars, 0);
        const clues = [
            copy >= 0.5
                ? `copy ${percent(copy)}`
                : anywhere > 0
                    ? `all text ${percent((anywhere / total) * 100)}`
                    : '',
            input.headings.some((entry) => same(entry.hex, hex)) ? 'headings' : ''
        ].filter((clue) => clue.length > 0);
        return `${hex} ${clues.join(', ')}`;
    });
}
function ctaCandidates(input) {
    const list = [];
    const filled = input.probe.buttons.filter((button) => button.style === 'filled');
    const count = (hex) => filled.filter((button) => button.background !== null && same(button.background, hex)).length;
    const fill = input.cta?.background ?? null;
    if (input.cta !== null)
        collect(list, 
        // An outline button's border reads like "1px solid #1a2b3c"; its color is the candidate.
        fill ?? input.cta.border?.match(/#[0-9a-f]{3,8}\b/i)?.[0] ?? input.cta.color, fill === null ? 'outline' : count(fill) > 1 ? `cta x${count(fill)}` : 'cta');
    for (const button of filled)
        if (button.background !== null) {
            const n = count(button.background);
            collect(list, button.background, n > 1 ? `buttons x${n}` : 'button');
        }
    // The brand color is the usual fill when no button was found or the found one is secondary.
    const leader = input.accents[0];
    if (leader !== undefined && leader.score >= 6)
        collect(list, leader.hex, 'brand color');
    // A brand color kept in a token the page does not paint here is often the button color elsewhere.
    for (const entry of input.unpainted) {
        const hex = /#[0-9a-f]{6}/i.exec(entry)?.[0];
        if (hex !== undefined)
            collect(list, hex, 'unpainted token');
    }
    return list.map(format);
}
/** Where an accent shows up, most telling first. */
function accentClues(hex, input) {
    const { probe, cta } = input;
    const near = (other) => other !== null && other !== undefined && (0, brand_accents_js_1.distance)(other, hex) < 28;
    const clues = [];
    const logo = input.logoShares.filter((entry) => near(entry.hex)).reduce((s, e) => s + e.share, 0);
    if (logo > 0)
        clues.push(`logo ${percent(logo * 100)}`);
    const buttons = probe.buttons.filter((button) => button.style === 'filled' && near(button.background)).length;
    const isCta = cta !== null && near(cta.background ?? cta.color);
    if (isCta)
        clues.push(buttons > 1 ? `cta x${buttons}` : 'cta');
    else if (buttons > 0)
        clues.push(buttons > 1 ? `buttons x${buttons}` : 'button');
    if (near(probe.themeColor))
        clues.push('theme-color');
    if (near(input.background))
        clues.push('page');
    if (input.headingColors.some(near))
        clues.push('headings');
    const area = probe.colorfulArea
        .filter((entry) => near(entry.hex))
        .reduce((s, e) => s + e.share, 0);
    if (area >= 0.5)
        clues.push(`area ${percent(area)}`);
    const total = probe.text.reduce((sum, group) => sum + group.chars, 0) || 1;
    const chars = probe.text.filter((group) => near(group.color)).reduce((s, g) => s + g.chars, 0);
    if (chars > 0)
        clues.push(`text ${percent((chars / total) * 100)}`);
    const token = probe.tokens.find((entry) => /brand|primary|accent|cta|highlight/i.test(entry.name) && near(entry.hex));
    if (token !== undefined)
        clues.push(`token ${shorten(token.name)}`);
    if (clues.length === 0 && input.pixels !== null)
        clues.push(`screens ${percent(input.pixels.share(hex, 10))}`);
    return clues;
}
function accentCandidates(input) {
    const { pixels } = input;
    const list = [];
    const add = (hex, clues) => {
        if (list.some((entry) => entry.hex !== '' && same(entry.hex, hex)))
            return;
        list.push({ hex, clues });
    };
    const reported = input.accents.slice(0, input.reported);
    // A black-and-white logo leaves room for a brand with no accent color at all.
    const monochrome = !input.logoColorful;
    const none = {
        hex: '',
        clues: [
            input.logoShares.length > 0 ? 'none: the logo has no color' : 'none: no logo color found'
        ]
    };
    const leader = reported[0];
    if (leader === undefined)
        list.push(none);
    else {
        add(leader.hex, accentClues(leader.hex, input));
        if (monochrome)
            list.push(none);
    }
    for (const accent of input.accents.slice(0, 6))
        add(accent.hex, accentClues(accent.hex, input));
    for (const entry of input.unpainted) {
        const hex = /#[0-9a-f]{6}/i.exec(entry)?.[0];
        if (hex !== undefined)
            add(hex, [`unpainted token ${shorten(entry.split(' ')[0] ?? '')}`]);
    }
    // Colors painted where the DOM cannot see them: canvas, images of UI, and backgrounds in SVG.
    for (const entry of pixels?.chrome ?? [])
        if (entry.share >= 0.5 &&
            (0, brand_color_math_js_1.labChroma)(entry.hex) >= 25 &&
            (0, brand_accents_js_1.isAccent)(entry.hex) &&
            !list.some((kept) => kept.hex !== '' && (0, brand_color_math_js_1.hexDeltaE)(kept.hex, entry.hex) < 5))
            list.push({ hex: entry.hex, clues: [`screens ${percent(entry.share)}`] });
    return list.map((entry) => (entry.hex === '' ? (entry.clues[0] ?? 'none') : format(entry)));
}
/** Up to three candidates per role, best guess first. */
function colorCandidates(input) {
    return {
        background: backgroundCandidates(input).slice(0, 3),
        text: textCandidates(input).slice(0, 3),
        accents: accentCandidates(input).slice(0, 3),
        cta: ctaCandidates(input).slice(0, 3)
    };
}
