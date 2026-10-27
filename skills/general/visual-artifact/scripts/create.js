"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createArtifact = createArtifact;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const session_js_1 = require("./session.js");
const MAX_ARTIFACT_ID_GENERATION_ATTEMPTS = 250;
const VISUAL_ARTIFACT_PRESET_ALIASES = new Map([
    ['deck', 'deck'],
    ['slides', 'deck'],
    ['slide-deck', 'deck'],
    ['slide deck', 'deck'],
    ['presentation', 'deck'],
    ['slidedeck', 'deck'],
    ['poster', 'poster'],
    ['one-pager', 'one-pager'],
    ['one pager', 'one-pager'],
    ['onepage', 'one-pager'],
    ['one-page', 'one-pager'],
    ['diagram', 'diagram'],
    ['flowchart', 'diagram'],
    ['architecture-diagram', 'diagram'],
    ['architecture diagram', 'diagram'],
    ['infographic', 'infographic'],
    ['info-graphic', 'infographic'],
    ['info graphic', 'infographic'],
    ['app-mockup', 'app-mockup'],
    ['app mockup', 'app-mockup'],
    ['product-mockup', 'app-mockup'],
    ['product mockup', 'app-mockup'],
    ['mockup', 'app-mockup'],
    ['social-graphic', 'social-graphic'],
    ['social graphic', 'social-graphic'],
    ['social-post', 'social-graphic'],
    ['social post', 'social-graphic'],
    ['social', 'social-graphic'],
    ['custom', 'custom']
]);
async function createArtifact(input) {
    const normalizedInput = normalizeCreateArtifactInput(input);
    const rootArtifactsDirectory = (0, session_js_1.getVisualArtifactsRoot)((0, session_js_1.readSessionEnvironment)());
    await (0, promises_1.mkdir)(rootArtifactsDirectory, { recursive: true });
    for (let attempt = 0; attempt < MAX_ARTIFACT_ID_GENERATION_ATTEMPTS; attempt++) {
        const artifactId = await oi.internal.generateSemanticId();
        const artifactDirectory = node_path_1.default.resolve(rootArtifactsDirectory, artifactId);
        if (!(0, session_js_1.isPathInside)(rootArtifactsDirectory, artifactDirectory)) {
            throw new Error('Resolved visual artifact directory escapes the visual artifacts root');
        }
        const tempDirectory = node_path_1.default.join(rootArtifactsDirectory, `.${artifactId}.tmp-${(0, node_crypto_1.randomUUID)()}`);
        try {
            await (0, promises_1.mkdir)(tempDirectory);
            await (0, promises_1.mkdir)(node_path_1.default.join(tempDirectory, 'styles'));
            await (0, promises_1.mkdir)(node_path_1.default.join(tempDirectory, 'frames'));
            await (0, promises_1.mkdir)(node_path_1.default.join(tempDirectory, 'exports'));
            await (0, promises_1.writeFile)(node_path_1.default.join(tempDirectory, 'artifact.md'), buildArtifactMarkdown(normalizedInput), 'utf8');
            await (0, promises_1.writeFile)(node_path_1.default.join(tempDirectory, 'styles', 'root.css'), buildRootCss(normalizedInput), 'utf8');
            await (0, promises_1.writeFile)(node_path_1.default.join(tempDirectory, 'styles', 'fonts.css'), '/* Local @font-face rules. inspectBrand and installGoogleFonts add to this file. */\n', 'utf8');
            if (normalizedInput.multiFrame) {
                await (0, promises_1.writeFile)(node_path_1.default.join(tempDirectory, 'storyboard.md'), buildStoryboardMarkdown(), 'utf8');
            }
            await (0, promises_1.rename)(tempDirectory, artifactDirectory);
            return { artifactId, root: artifactDirectory };
        }
        catch (error) {
            await (0, promises_1.rm)(tempDirectory, { recursive: true, force: true });
            if (error instanceof Error &&
                (isNodeErrorWithCode(error, 'EEXIST') || isNodeErrorWithCode(error, 'ENOTEMPTY'))) {
                continue;
            }
            throw error;
        }
    }
    throw new Error('Unable to reserve a non-colliding visual artifact directory');
}
const isNodeErrorWithCode = (error, code) => 'code' in error && error.code === code;
function normalizeCreateArtifactInput(input) {
    const title = input.title.trim();
    if (title.length === 0) {
        throw new Error('Visual artifact title is required');
    }
    if (!Number.isInteger(input.width) || input.width <= 0) {
        throw new Error('Visual artifact width must be a positive integer');
    }
    if (!Number.isInteger(input.height) || input.height <= 0) {
        throw new Error('Visual artifact height must be a positive integer');
    }
    const preset = normalizeVisualArtifactPreset(input.preset);
    return {
        title,
        width: input.width,
        height: input.height,
        preset,
        multiFrame: input.multiFrame ?? false
    };
}
function buildArtifactMarkdown(input) {
    const frontmatter = [
        '---',
        `title: ${quoteYamlString(input.title)}`,
        `width: ${input.width}`,
        `height: ${input.height}`,
        `preset: ${quoteYamlString(input.preset)}`,
        '---'
    ];
    return `${frontmatter.join('\n')}

# Brief

## Audience and Scene


## Says


## Brand


## Design Direction


## Refuses


## Weird Choice


## Source Material

`;
}
function buildStoryboardMarkdown() {
    return `# Storyboard

Use this file to plan the frame order before writing HTML.

## Frames

1. \`01-title.html\` -
`;
}
// Body size as a fraction of the short edge, and the step ratio between type sizes.
const TYPE_SCALES = {
    deck: { baseDivisor: 38, ratio: 1.333 },
    poster: { baseDivisor: 40, ratio: 1.5 },
    'social-graphic': { baseDivisor: 34, ratio: 1.414 },
    'one-pager': { baseDivisor: 54, ratio: 1.25 },
    infographic: { baseDivisor: 46, ratio: 1.25 },
    diagram: { baseDivisor: 48, ratio: 1.25 },
    'app-mockup': { baseDivisor: 64, ratio: 1.2 },
    custom: { baseDivisor: 44, ratio: 1.333 }
};
function buildRootCss(input) {
    const shortEdge = Math.min(input.width, input.height);
    const scale = TYPE_SCALES[input.preset] ?? { baseDivisor: 44, ratio: 1.333 };
    const base = Math.max(12, Math.round(shortEdge / scale.baseDivisor));
    const step = (power) => `${Math.round(base * scale.ratio ** power)}px`;
    // The critique warns below max(11, short edge / 72) px, so the smallest step never goes under it.
    const smallest = Math.max(11, Math.round(shortEdge / 72));
    return `@import url("fonts.css");

/*
 * Scaffold. Keep --artifact-width and --artifact-height. Every value marked "placeholder" is a
 * deliberately plain gray stand-in, not a suggestion: choose this artifact's own palette and fonts
 * before writing frames.
 * The type scale and spacing are computed for this canvas and preset; tune them if the direction
 * needs it.
 */
:root {
  --artifact-width: ${input.width}px;
  --artifact-height: ${input.height}px;

  --color-bg: #b3b3b3; /* placeholder */
  --color-surface: #c7c7c7; /* placeholder */
  --color-text: #1f1f1f; /* placeholder */
  --color-muted: #595959; /* placeholder */
  --color-accent: #7a7a7a; /* placeholder */
  --color-accent-contrast: #ffffff; /* placeholder */
  --color-line: #8c8c8c; /* placeholder */

  --font-display: ui-serif, Georgia, serif; /* placeholder */
  --font-body: ui-sans-serif, system-ui, sans-serif; /* placeholder */
  --font-mono: ui-monospace, Menlo, monospace; /* placeholder */

  /* Type scale: ${scale.ratio} ratio on a ${base}px body. Nothing smaller than --text-sm. */
  --text-sm: ${Math.max(Math.round(base / scale.ratio), smallest)}px;
  --text-base: ${base}px;
  --text-lg: ${step(1)};
  --text-xl: ${step(2)};
  --text-2xl: ${step(3)};
  --text-3xl: ${step(4)};
  --text-display: ${step(5)};
  --leading-tight: 1;
  --leading-body: 1.4;

  /* Space and grid */
  --space: 8px;
  --margin: ${Math.round(shortEdge * 0.06)}px;
  --gutter: ${Math.round(shortEdge * 0.02)}px;
  --columns: 12;
  --radius: 0px;
}
`;
}
const quoteYamlString = (value) => `"${replaceAllText(replaceAllText(value, '\\', '\\\\'), '"', '\\"')}"`;
const replaceAllText = (value, search, replacement) => value.split(search).join(replacement);
function normalizeVisualArtifactPreset(input) {
    if (input === undefined) {
        return 'custom';
    }
    return VISUAL_ARTIFACT_PRESET_ALIASES.get(normalizePresetToken(input)) ?? 'custom';
}
function normalizePresetToken(input) {
    return input
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-');
}
