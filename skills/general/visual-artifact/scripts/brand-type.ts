// Picks the type roles (display, heading, body, label, button, mono) from the probe's text groups
// and formats them the way CSS reads them.
import { labChroma } from './brand-color-math.js'
import type { ProbeTextGroup } from './brand-probe.js'

export const ROLE_ORDER = ['display', 'heading', 'body', 'label', 'button', 'mono'] as const

const MONO_FAMILY = /mono|code|consol|courier|menlo|jetbrains|fira code|berkeley|commit/i

function distanceOf(first: string, second: string): number {
  const channels = (hex: string): number[] =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  const [a, b] = [channels(first), channels(second)]
  return Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))
}

/**
 * The look with the most characters, summed over groups that share family, size, and weight; it
 * takes the color most of its characters are set in.
 */
function mostUsed(groups: ProbeTextGroup[]): ProbeTextGroup | null {
  const looks = new Map<string, { look: ProbeTextGroup; colors: Map<string, number> }>()
  for (const group of groups) {
    const key = `${group.family}|${group.size}|${group.weight}|${group.transform}`
    const entry = looks.get(key) ?? { look: { ...group, chars: 0 }, colors: new Map() }
    entry.look.chars += group.chars
    entry.colors.set(group.color, (entry.colors.get(group.color) ?? 0) + group.chars)
    looks.set(key, entry)
  }
  const best = [...looks.values()].sort((left, right) => right.look.chars - left.look.chars)[0]
  if (best === undefined) return null
  const color = [...best.colors.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
  return color === undefined ? best.look : { ...best.look, color }
}

export function pickTypeRoles(
  groups: ProbeTextGroup[],
  background: string,
  button: ProbeTextGroup | null
): Record<string, ProbeTextGroup> {
  const roles: Record<string, ProbeTextGroup> = {}
  const content = groups.filter((group) => !group.chrome)
  // The largest text near the top; among equal sizes, the part with the most characters (not a highlighted word).
  const bySize = (left: ProbeTextGroup, right: ProbeTextGroup): number =>
    right.size - left.size || right.chars - left.chars
  // A page whose only text at the top is its navigation shows its display face there.
  const display =
    content.filter((group) => group.hero && group.chars >= 4).sort(bySize)[0] ??
    content.filter((group) => group.heading).sort(bySize)[0] ??
    groups.filter((group) => group.hero && group.chars >= 4).sort(bySize)[0]
  if (display !== undefined) roles.display = display

  const bodyGroups = content.filter(
    (group) => !group.heading && group.size >= 13 && group.size <= 22 && group.chars >= 20
  )
  const chars = (list: ProbeTextGroup[]): number =>
    list.reduce((sum, group) => sum + group.chars, 0)
  // Running text sits on the page's own background, or at least on a neutral one; quotes set on
  // colored cards and captions over photos are not the body.
  const onMain = bodyGroups.filter((group) => distanceOf(group.background, background) <= 24)
  const onNeutral = bodyGroups.filter(
    (group) => !group.onImage && labChroma(group.background) <= 12
  )
  const pool = chars(onMain) >= 200 ? onMain : chars(onNeutral) >= 100 ? onNeutral : bodyGroups
  // The body family is the one that sets the most running text across its sizes and weights; its
  // most used look is the body.
  const families = new Map<string, number>()
  for (const group of pool)
    families.set(group.family, (families.get(group.family) ?? 0) + group.chars)
  const bodyFamily = [...families.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
  const body =
    mostUsed(pool.filter((group) => group.family === bodyFamily)) ??
    mostUsed(groups.filter((group) => group.size <= 22))
  if (body !== null) roles.body = body

  const larger = content.filter(
    (group) =>
      group !== display &&
      group.size >= (body?.size ?? 16) * 1.25 &&
      (display === undefined || group.size < display.size * 0.95 || group.heading)
  )
  const heading = mostUsed(larger.filter((group) => group.heading)) ?? mostUsed(larger)
  if (heading !== null && (display === undefined || heading.size < display.size))
    roles.heading = heading

  const label = mostUsed(
    groups.filter(
      (group) =>
        group.size <= 16 && group.chars >= 3 && (group.transform === 'uppercase' || group.caps)
    )
  )
  if (label !== null && label.chars >= 12) roles.label = label
  if (button !== null) roles.button = button
  const mono = mostUsed(
    groups.filter(
      (group) => MONO_FAMILY.test(group.family) || group.generic === 'monospace' || group.code
    )
  )
  if (mono !== null) roles.mono = mono
  return roles
}

/** Framework aliases such as Next.js `__Inter_a1b2c3` resolve to the real family name. */
export function cleanFamily(family: string): string {
  const aliased = family.match(/^__(.+?)(?:_Fallback)?_[0-9a-f]{5,}$/i)
  return aliased === null ? family : (aliased[1] ?? family).replace(/_/g, ' ')
}

/** The family as CSS needs it: system and generic families unquoted, brand families quoted. */
export function cssFamily(family: string): string {
  const clean = cleanFamily(family)
  if (/^(-apple-system|blinkmacsystemfont|system-ui|ui-sans-serif|ui-rounded)$/i.test(clean))
    return 'system-ui'
  // Chromium has no ui-monospace or ui-serif, so they would fall back to its default serif.
  if (/^ui-(monospace|serif)$/i.test(clean)) return clean.slice(3).toLowerCase()
  if (/^(sans-serif|serif|monospace|cursive)$/i.test(clean)) return clean
  return `'${clean}'`
}

export function formatRole(text: ProbeTextGroup): string {
  const lineHeight = text.lineHeight === null ? '' : `/${text.lineHeight}`
  const tracking = text.tracking === 0 ? '' : ` ${text.tracking}em`
  const transform = text.transform.length > 0 ? ` ${text.transform}` : ''
  return `${cssFamily(text.family)} ${text.weight}${text.italic ? ' italic' : ''} ${text.size}px${lineHeight}${tracking}${transform} ${text.color}`
}
