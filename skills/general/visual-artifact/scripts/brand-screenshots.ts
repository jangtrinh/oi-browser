// Screenshots. Ổi Browser's tab screenshot is viewport-only, and each capture happens after the
// executed code returns, so every scroll position is its own `tab.execute`. Up to four screens down
// the page are saved to `brand/assets/screens/`; only the top of the page and the most distinctive
// section further down are attached, which keeps the image cost to two.
import path from 'node:path'

import { hexToRgb } from './brand-color-math.js'
import { type BrandProbe, hideOverlays } from './brand-probe.js'

export type TabValue = string | number | boolean | null | TabValue[] | { [key: string]: TabValue }

export interface BrandTab {
  execute(code: string): Promise<TabValue>
}

/** The screen below the fold that shows the most brand: color fields, imagery, a change of background. */
function pickSection(probe: BrandProbe): number {
  const hero = hexToRgb(probe.bands[0]?.background ?? '#ffffff')
  let pick = 0
  let best = -Infinity
  probe.bands.forEach((band, index) => {
    if (index === 0) return
    const [red, green, blue] = hexToRgb(band.background)
    const differs = Math.hypot(red - hero[0], green - hero[1], blue - hero[2]) > 30 ? 0.4 : 0
    const score = band.colorful * 2 + band.imagery * 1.5 + differs + (band.chars > 60 ? 0.2 : -0.6)
    if (score > best) {
      best = score
      pick = index
    }
  })
  return pick
}

// Scroll, give lazy images a moment to paint, and hide banners that appeared late. Reveal
// animations were already started by the probe's scroll through the page.
function scrollCode(top: number, wait: number): string {
  return `const scroller = document.querySelector('[data-oi-scroller]'); const target = scroller === null || scroller === document.documentElement || scroller === document.body ? window : scroller; target.scrollTo({ top: ${top}, behavior: 'instant' }); await new Promise((resolve) => setTimeout(resolve, ${wait})); (${hideOverlays.toString()})();`
}

/** Saves and attaches one screen; when saving is refused, it is still attached. */
async function capture(
  tab: BrandTab,
  code: string,
  file: string | null,
  attach: boolean,
  notes: string[]
): Promise<boolean> {
  const shots = `${file !== null ? `oi.screenshot({ saveTo: ${JSON.stringify(file)} });` : ''}${attach ? ' oi.screenshot();' : ''}`
  try {
    await tab.execute(`${code} ${shots} return 'captured'`)
    return true
  } catch (error) {
    if (file === null) return false
    notes.push(
      `Screenshots were not saved: ${error instanceof Error ? error.message : String(error)}`
    )
    if (attach)
      await tab.execute(`${code} oi.screenshot(); return 'captured'`).catch(() => null)
    return false
  }
}

/**
 * Every probed screen is saved; the top of the page and the most distinctive section are attached. The
 * top is captured last, so entrance animations that started at page load have finished and the tab
 * ends at the top.
 */
export async function captureScreens(
  tab: BrandTab,
  probe: BrandProbe,
  directory: string,
  notes: string[]
): Promise<{ attached: string[]; saved: string[] }> {
  const attached: string[] = []
  const saved: string[] = []
  const section = pickSection(probe)
  let saving = true
  const order = [...probe.bands.keys()].slice(1).concat(0)
  for (const band of order) {
    const attach = band === 0 || band === section
    if (!saving && !attach) continue
    const file = path.join(directory, 'screens', `screen-${band + 1}.jpg`)
    const ok = await capture(
      tab,
      scrollCode(Math.round(band * probe.viewport.height), band === 0 ? 100 : 150),
      saving ? file : null,
      attach,
      notes
    )
    if (ok && saving) saved.push(file)
    if (!ok && saving) saving = false
    if (attach)
      attached.push(band === 0 ? 'top of the page' : `${band} screen${band > 1 ? 's' : ''} down`)
  }
  return { attached, saved: saved.sort() }
}
