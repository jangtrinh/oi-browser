import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { getVisualArtifactsRoot, isPathInside, readSessionEnvironment } from './session.js'
import type { CreateArtifactInput, CreateArtifactResult } from './types.js'

declare const oi: {
  internal: {
    generateSemanticId(): Promise<string>
  }
}

const MAX_ARTIFACT_ID_GENERATION_ATTEMPTS = 250
const VISUAL_ARTIFACT_PRESET_ALIASES = new Map<string, string>([
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
])

export async function createArtifact(input: CreateArtifactInput): Promise<CreateArtifactResult> {
  const normalizedInput = normalizeCreateArtifactInput(input)
  const rootArtifactsDirectory = getVisualArtifactsRoot(readSessionEnvironment())

  await mkdir(rootArtifactsDirectory, { recursive: true })

  for (let attempt = 0; attempt < MAX_ARTIFACT_ID_GENERATION_ATTEMPTS; attempt++) {
    const artifactId = await oi.internal.generateSemanticId()
    const artifactDirectory = path.resolve(rootArtifactsDirectory, artifactId)
    if (!isPathInside(rootArtifactsDirectory, artifactDirectory)) {
      throw new Error('Resolved visual artifact directory escapes the visual artifacts root')
    }

    const tempDirectory = path.join(rootArtifactsDirectory, `.${artifactId}.tmp-${randomUUID()}`)

    try {
      await mkdir(tempDirectory)
      await mkdir(path.join(tempDirectory, 'styles'))
      await mkdir(path.join(tempDirectory, 'frames'))
      await mkdir(path.join(tempDirectory, 'exports'))

      await writeFile(
        path.join(tempDirectory, 'artifact.md'),
        buildArtifactMarkdown(normalizedInput),
        'utf8'
      )
      await writeFile(
        path.join(tempDirectory, 'styles', 'root.css'),
        buildRootCss(normalizedInput),
        'utf8'
      )
      await writeFile(
        path.join(tempDirectory, 'styles', 'fonts.css'),
        '/* Local @font-face rules. inspectBrand and installGoogleFonts add to this file. */\n',
        'utf8'
      )

      if (normalizedInput.multiFrame) {
        await writeFile(
          path.join(tempDirectory, 'storyboard.md'),
          buildStoryboardMarkdown(),
          'utf8'
        )
      }

      await rename(tempDirectory, artifactDirectory)
      return { artifactId, root: artifactDirectory }
    } catch (error) {
      await rm(tempDirectory, { recursive: true, force: true })

      if (
        error instanceof Error &&
        (isNodeErrorWithCode(error, 'EEXIST') || isNodeErrorWithCode(error, 'ENOTEMPTY'))
      ) {
        continue
      }

      throw error
    }
  }

  throw new Error('Unable to reserve a non-colliding visual artifact directory')
}

const isNodeErrorWithCode = (error: Error, code: string): boolean =>
  'code' in error && error.code === code

function normalizeCreateArtifactInput(input: CreateArtifactInput): Required<CreateArtifactInput> {
  const title = input.title.trim()

  if (title.length === 0) {
    throw new Error('Visual artifact title is required')
  }

  if (!Number.isInteger(input.width) || input.width <= 0) {
    throw new Error('Visual artifact width must be a positive integer')
  }

  if (!Number.isInteger(input.height) || input.height <= 0) {
    throw new Error('Visual artifact height must be a positive integer')
  }

  const preset = normalizeVisualArtifactPreset(input.preset)

  return {
    title,
    width: input.width,
    height: input.height,
    preset,
    multiFrame: input.multiFrame ?? false
  }
}

function buildArtifactMarkdown(input: Required<CreateArtifactInput>): string {
  const frontmatter = [
    '---',
    `title: ${quoteYamlString(input.title)}`,
    `width: ${input.width}`,
    `height: ${input.height}`,
    `preset: ${quoteYamlString(input.preset)}`,
    '---'
  ]

  return `${frontmatter.join('\n')}

# Brief

## Audience and Scene


## Says


## Brand


## Design Direction


## Refuses


## Weird Choice


## Source Material

`
}

function buildStoryboardMarkdown(): string {
  return `# Storyboard

Use this file to plan the frame order before writing HTML.

## Frames

1. \`01-title.html\` -
`
}

interface TypeScale {
  baseDivisor: number
  ratio: number
}

// Body size as a fraction of the short edge, and the step ratio between type sizes.
const TYPE_SCALES: Record<string, TypeScale> = {
  deck: { baseDivisor: 38, ratio: 1.333 },
  poster: { baseDivisor: 40, ratio: 1.5 },
  'social-graphic': { baseDivisor: 34, ratio: 1.414 },
  'one-pager': { baseDivisor: 54, ratio: 1.25 },
  infographic: { baseDivisor: 46, ratio: 1.25 },
  diagram: { baseDivisor: 48, ratio: 1.25 },
  'app-mockup': { baseDivisor: 64, ratio: 1.2 },
  custom: { baseDivisor: 44, ratio: 1.333 }
}

function buildRootCss(input: Required<CreateArtifactInput>): string {
  const shortEdge = Math.min(input.width, input.height)
  const scale = TYPE_SCALES[input.preset] ?? { baseDivisor: 44, ratio: 1.333 }
  const base = Math.max(12, Math.round(shortEdge / scale.baseDivisor))
  const step = (power: number): string => `${Math.round(base * scale.ratio ** power)}px`
  // The critique warns below max(11, short edge / 72) px, so the smallest step never goes under it.
  const smallest = Math.max(11, Math.round(shortEdge / 72))

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
`
}

const quoteYamlString = (value: string): string =>
  `"${replaceAllText(replaceAllText(value, '\\', '\\\\'), '"', '\\"')}"`

const replaceAllText = (value: string, search: string, replacement: string): string =>
  value.split(search).join(replacement)

function normalizeVisualArtifactPreset(input: string | undefined): string {
  if (input === undefined) {
    return 'custom'
  }

  return VISUAL_ARTIFACT_PRESET_ALIASES.get(normalizePresetToken(input)) ?? 'custom'
}

function normalizePresetToken(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}
