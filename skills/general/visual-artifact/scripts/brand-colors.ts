// Turns the probe's painted-color measurements into color roles: background, surface, text, muted
// text, accents with the evidence behind each, the call-to-action button, and design tokens.
import { distance, isColorful, rankAccents } from './brand-accents.js'
import { colorCandidates } from './brand-color-check.js'
import { rateColors } from './brand-color-confidence.js'
import {
  contrast,
  hexDeltaE,
  hexToLab,
  hexToRgb,
  labChroma,
  luminance
} from './brand-color-math.js'
import type { PagePixels } from './brand-pixels.js'
import type { BrandProbe, ProbeButton, ProbeShare, ProbeTextGroup } from './brand-probe.js'
import type { BrandColors, ColorCheck } from './types.js'

export interface ColorRoles {
  theme: 'light' | 'dark'
  colors: BrandColors
  cta: ProbeButton | null
  /** Candidates for every role, kept in probe.json; the summary lists only uncertain roles. */
  candidates: Required<ColorCheck>
}

function chroma(hex: string): number {
  const channels = hexToRgb(hex)
  return Math.max(...channels) - Math.min(...channels)
}

/** Merges near-identical colors (anti-aliasing, 1-step variants) into the most common one. */
function merge(entries: ProbeShare[], threshold: number): ProbeShare[] {
  const merged: ProbeShare[] = []
  for (const entry of [...entries].sort((left, right) => right.share - left.share)) {
    const near = merged.find((kept) => distance(kept.hex, entry.hex) <= threshold)
    if (near !== undefined) near.share = Math.round((near.share + entry.share) * 10) / 10
    else merged.push({ ...entry })
  }
  return merged
}

function sharesOf(groups: ProbeTextGroup[]): ProbeShare[] {
  const counts = new Map<string, number>()
  for (const group of groups) counts.set(group.color, (counts.get(group.color) ?? 0) + group.chars)
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1
  return merge(
    [...counts.entries()].map(([hex, chars]) => ({
      hex,
      share: Math.round((chars / total) * 1000) / 10
    })),
    10
  )
}

/** The page's own canvas color wins over a large colored section unless the section clearly dominates. */
function domBackground(probe: BrandProbe, backgrounds: ProbeShare[]): string {
  const top = backgrounds[0]
  const canvas = backgrounds.find((entry) => distance(entry.hex, probe.canvas) <= 6)
  return canvas !== undefined && top !== undefined && canvas.share >= top.share * 0.6
    ? canvas.hex
    : (top?.hex ?? probe.canvas)
}

/** The call to action is the strongest button near the top, filled ones first. */
function firstButton(probe: BrandProbe): ProbeButton | null {
  return probe.buttons.find((candidate) => candidate.style === 'filled') ?? probe.buttons[0] ?? null
}

/** Design tokens scored by name and by whether the page paints them. */
function scoreTokens(
  probe: BrandProbe,
  backgrounds: ProbeShare[]
): Array<{ name: string; hex: string; used: boolean; score: number }> {
  // Names are only a hint; a token the page actually paints counts most.
  const used = new Set([
    ...backgrounds.map((entry) => entry.hex),
    ...probe.text.map((group) => group.color),
    ...probe.buttons.flatMap((entry) => [entry.background ?? '', entry.color])
  ])
  return probe.tokens
    .map((token) => ({
      ...token,
      used: used.has(token.hex),
      score:
        (/brand|primary|accent|cta|highlight/i.test(token.name) ? 2 : 0) +
        (/background|bg|surface|foreground|fg|text|muted|border|base|canvas|ink|paper/i.test(
          token.name
        )
          ? 1
          : 0) +
        (used.has(token.hex) ? 3 : 0) +
        (isColorful(token.hex) ? 1 : 0) -
        (/hover|active|focus|disabled|shadow|overlay|alpha|opacity|transparent|scrim|half|always|unknown|legacy|deprecated/i.test(
          token.name
        )
          ? 2
          : 0)
    }))
    .sort((left, right) => right.score - left.score)
}

export function summarizeColors(
  probe: BrandProbe,
  headingColors: string[],
  logoColors: string[],
  pixels: PagePixels | null = null
): ColorRoles {
  const backgrounds = merge(probe.backgrounds, 6)
  let background = domBackground(probe, backgrounds)
  // On a page drawn in a canvas (WebGL) the DOM cannot see the colors, so the screenshots decide
  // what fills the page. The DOM's exact value is kept when one is close.
  const painted = pixels?.chrome[0]
  if (
    pixels !== null &&
    painted !== undefined &&
    probe.canvasCover >= 0.5 &&
    painted.share >= 30 &&
    hexDeltaE(painted.hex, background) > 5 &&
    pixels.share(background, 5) < painted.share / 2
  )
    background =
      [probe.canvas, ...backgrounds.map((entry) => entry.hex)].find(
        (hex) => hexDeltaE(hex, painted.hex) < 5
      ) ?? painted.hex
  const theme: 'light' | 'dark' = luminance(background) < 0.2 ? 'dark' : 'light'
  const hero = probe.bands[0]?.background ?? background

  let surface: string | null = null
  let inverse: string | null = null
  for (const entry of backgrounds.slice(1)) {
    if (chroma(entry.hex) > 24 || entry.share < 1.5) continue
    const gap = Math.abs(luminance(entry.hex) - luminance(background))
    if (surface === null && gap < 0.3 && distance(entry.hex, background) > 4) surface = entry.hex
    if (inverse === null && gap >= 0.5 && entry.share >= 3) inverse = entry.hex
  }

  // Text on neutral grounds on the page's side of light and dark decides the text roles (white
  // cards on a gray page count, inverse sections do not). Text over a photo counts when it would
  // also read on the page itself, like dark copy over a light product shot, not white over a photo.
  const dark = luminance(background) < 0.2
  const sameSide = (hex: string): boolean => labChroma(hex) <= 12 && luminance(hex) < 0.2 === dark
  const readsOnMain = (group: ProbeTextGroup): boolean =>
    (!group.onImage || contrast(group.color, background) >= 3) &&
    (sameSide(group.background) || distance(group.background, background) <= 24)
  const onMain = probe.text.filter(readsOnMain)
  const plain = probe.text.filter((group) => !group.onImage)
  const pool = onMain.length > 0 ? onMain : plain.length > 0 ? plain : probe.text
  const textColors = sharesOf(pool.filter((group) => group.size <= 24))
  // The main heading color counts too, unless it is one stray line (under 1% of the copy).
  const poolChars = pool.reduce((sum, group) => sum + group.chars, 0) || 1
  const headingGroups = onMain.filter((group) => group.size > 24 || group.heading)
  const headings = sharesOf(headingGroups).filter(
    (entry) =>
      entry.share >= 25 &&
      headingGroups
        .filter((group) => group.color === entry.hex)
        .reduce((sum, group) => sum + group.chars, 0) >=
        poolChars * 0.01
  )
  // Ink is neutral, or a dark tint that still reads as ink (navy, forest green, aubergine); a
  // saturated or light colored text is a link, a highlight, or a brand-colored heading.
  const [groundLightness = 50] = hexToLab(background)
  const isInk = (hex: string): boolean => {
    const [lightness = 50] = hexToLab(hex)
    const tint = labChroma(hex)
    return tint <= 20 || (groundLightness > 50 && lightness < 35 && tint <= 60)
  }
  const common = [...textColors.filter((entry) => entry.share >= 10), ...headings].filter(
    (entry) => isInk(entry.hex) && contrast(entry.hex, background) >= 3
  )
  const byContrast = (left: ProbeShare, right: ProbeShare): number =>
    contrast(right.hex, background) - contrast(left.hex, background)
  const readable = [...textColors].sort(byContrast)[0]
  const text =
    [...common].sort(byContrast)[0]?.hex ??
    (readable !== undefined && contrast(readable.hex, background) >= 3
      ? readable.hex
      : theme === 'dark'
        ? '#ffffff'
        : '#000000')
  const muted =
    textColors.find(
      (entry) =>
        entry.hex !== text &&
        entry.share >= 4 &&
        !isColorful(entry.hex) &&
        contrast(entry.hex, background) >= 1.8 &&
        contrast(entry.hex, background) < contrast(text, background) * 0.7
    )?.hex ?? null

  // The call to action is the strongest button near the top; a label that does not contrast with
  // its fill was read from a hidden layer, so the readable one of black and white is used instead.
  const button = firstButton(probe)
  const cta = button === null ? null : { ...button }
  if (cta !== null && cta.background !== null && contrast(cta.color, cta.background) < 1.6) {
    cta.color =
      contrast('#ffffff', cta.background) >= contrast('#000000', cta.background)
        ? '#ffffff'
        : '#000000'
  }

  const tokens = scoreTokens(probe, backgrounds)

  const { accents, unpainted, logoShares, logoColorful } = rankAccents({
    probe,
    background,
    cta,
    headingColors,
    logoColors,
    tokens
  })

  const tokenSummary: Record<string, string> = {}
  const listed = new Set<string>()
  for (const token of tokens.filter((entry) => entry.score >= 4)) {
    if (listed.has(token.hex) || listed.size >= 8) continue
    listed.add(token.hex)
    tokenSummary[token.name] = token.hex
  }
  const reported = accents.filter((accent) => accent.score >= 6).slice(0, 4)

  const leader = reported[0]
  const confidence = rateColors({
    background,
    backgroundShare: backgrounds.find((entry) => distance(entry.hex, background) <= 6)?.share ?? 0,
    canvasCover: probe.canvasCover,
    textShare: textColors.find((entry) => distance(entry.hex, text) <= 10)?.share ?? 0,
    hasCopy: onMain.length > 0,
    leader: leader === undefined ? null : { score: leader.score, sources: leader.sources },
    logo: { present: probe.logos.length > 0, colorful: logoColorful },
    cta: cta === null ? null : { fill: cta.background },
    pixels
  })
  const candidates = colorCandidates({
    probe,
    background,
    backgrounds,
    hero,
    text,
    textColors,
    headings,
    cta,
    accents,
    reported: reported.length,
    unpainted,
    logoShares,
    logoColorful,
    headingColors,
    pixels
  })
  const check: ColorCheck = {}
  for (const role of ['background', 'text', 'accents', 'cta'] as const)
    if (
      (confidence[role] === 'low' || (role === 'accents' && confidence[role] === 'medium')) &&
      candidates[role].length > 0
    )
      check[role] = candidates[role]
  // Photography carries its own tones; they are reported apart so they do not become brand colors.
  const imagery =
    pixels !== null && pixels.imageryShare >= 20
      ? pixels.imagery.slice(0, 4).map((entry) => entry.hex)
      : []

  return {
    theme,
    cta,
    candidates,
    colors: {
      background,
      ...(hero !== background && distance(hero, background) > 6 ? { hero } : {}),
      surface,
      ...(inverse !== null ? { inverse } : {}),
      text,
      muted,
      accents: reported.map((accent) => `${accent.hex} ${accent.sources.join('+')}`),
      cta:
        cta === null
          ? null
          : cta.background !== null
            ? `${cta.background} fill, ${cta.color} text`
            : `outline ${cta.border ?? ''}, ${cta.color} text`,
      tokens: tokenSummary,
      ...(unpainted.length > 0 ? { unpainted } : {}),
      ...(imagery.length > 0 ? { imagery } : {}),
      confidence,
      ...(Object.keys(check).length > 0 ? { check } : {})
    }
  }
}
