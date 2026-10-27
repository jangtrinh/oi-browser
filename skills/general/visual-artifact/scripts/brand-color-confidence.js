"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateColors = rateColors;
// How far each color role can be trusted. Low means the evidence is thin or contradicted by the
// screenshots, so the companion should look at them before using the role.
const brand_color_math_js_1 = require("./brand-color-math.js");
function rateBackground(input) {
    if (input.canvasCover >= 0.5)
        return 'low';
    const pixels = input.pixels;
    if (pixels === null)
        return input.backgroundShare >= 50 ? 'high' : 'medium';
    // The most painted color in the screenshots, photos aside, should be the background.
    const top = pixels.chrome[0];
    if (top !== undefined && (0, brand_color_math_js_1.hexDeltaE)(top.hex, input.background) < 5)
        return 'high';
    return pixels.share(input.background, 8) >= 20 ? 'medium' : 'low';
}
function rateAccents(input) {
    const leader = input.leader;
    if (leader === null) {
        if (input.logo.colorful)
            return 'low';
        // A monochrome brand: nothing colored in the logo and hardly anything in the screenshots.
        const colored = input.pixels?.chrome
            .filter((entry) => (0, brand_color_math_js_1.labChroma)(entry.hex) >= 25)
            .reduce((sum, entry) => sum + entry.share, 0) ?? 100;
        return input.logo.present && colored < 1 ? 'high' : 'medium';
    }
    if (leader.score < 12)
        return 'low';
    return leader.sources.includes('logo') ||
        leader.sources.includes('background') ||
        leader.sources.length >= 3
        ? 'high'
        : 'medium';
}
function rateCta(input) {
    const fill = input.cta?.fill ?? null;
    if (input.cta === null)
        return 'low';
    if (fill === null)
        return 'medium';
    // A fill the screenshots do not show belongs to a hidden layer or a screen further down; a
    // white or pale gray fill is often a secondary button.
    if (input.pixels !== null && input.pixels.visible(fill, 8) < 0.005)
        return 'medium';
    if ((0, brand_color_math_js_1.labChroma)(fill) < 8 && (0, brand_color_math_js_1.hexDeltaE)(fill, input.background) < 12)
        return 'medium';
    return 'high';
}
function rateColors(input) {
    return {
        background: rateBackground(input),
        text: !input.hasCopy
            ? 'low'
            : input.textShare >= 40
                ? 'high'
                : input.textShare >= 15
                    ? 'medium'
                    : 'low',
        accents: rateAccents(input),
        cta: rateCta(input)
    };
}
