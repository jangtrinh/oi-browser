// How far each color role can be trusted. Low means the evidence is thin or contradicted by the
// screenshots, so the companion should look at them before using the role.
import { hexDeltaE, labChroma } from './brand-color-math.js'
import type { PagePixels } from './brand-pixels.js'
import type { ColorConfidence, Confidence } from './types.js'

export interface ConfidenceInput {
  background: string
  /** Share of the DOM-measured background area that has the background color. */
  backgroundShare: number
  /** Share of the first screen drawn in a canvas. */
  canvasCover: number
  /** Share of the copy set in the text color. */
  textShare: number
  hasCopy: boolean
  leader: { score: number; sources: string[] } | null
  logo: { present: boolean; colorful: boolean }
  cta: { fill: string | null } | null
  pixels: PagePixels | null
}

function rateBackground(input: ConfidenceInput): Confidence {
  if (input.canvasCover >= 0.5) return 'low'
  const pixels = input.pixels
  if (pixels === null) return input.backgroundShare >= 50 ? 'high' : 'medium'
  // The most painted color in the screenshots, photos aside, should be the background.
  const top = pixels.chrome[0]
  if (top !== undefined && hexDeltaE(top.hex, input.background) < 5) return 'high'
  return pixels.share(input.background, 8) >= 20 ? 'medium' : 'low'
}

function rateAccents(input: ConfidenceInput): Confidence {
  const leader = input.leader
  if (leader === null) {
    if (input.logo.colorful) return 'low'
    // A monochrome brand: nothing colored in the logo and hardly anything in the screenshots.
    const colored =
      input.pixels?.chrome
        .filter((entry) => labChroma(entry.hex) >= 25)
        .reduce((sum, entry) => sum + entry.share, 0) ?? 100
    return input.logo.present && colored < 1 ? 'high' : 'medium'
  }
  if (leader.score < 12) return 'low'
  return leader.sources.includes('logo') ||
    leader.sources.includes('background') ||
    leader.sources.length >= 3
    ? 'high'
    : 'medium'
}

function rateCta(input: ConfidenceInput): Confidence {
  const fill = input.cta?.fill ?? null
  if (input.cta === null) return 'low'
  if (fill === null) return 'medium'
  // A fill the screenshots do not show belongs to a hidden layer or a screen further down; a
  // white or pale gray fill is often a secondary button.
  if (input.pixels !== null && input.pixels.visible(fill, 8) < 0.005) return 'medium'
  if (labChroma(fill) < 8 && hexDeltaE(fill, input.background) < 12) return 'medium'
  return 'high'
}

export function rateColors(input: ConfidenceInput): ColorConfidence {
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
  }
}
