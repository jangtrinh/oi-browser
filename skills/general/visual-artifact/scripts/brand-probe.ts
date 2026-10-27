// The in-page half of inspectBrand. Both functions run inside the brand page through
// `tab.execute` and are serialized with `toString()`, so neither may reference anything outside its
// own body. The probe only measures; brand-colors.ts, brand-type.ts, and the other modules turn the
// measurements into roles.

export interface ProbeTextGroup {
  family: string
  webFont: boolean
  generic: string
  weight: string
  italic: boolean
  size: number
  lineHeight: number | null
  tracking: number
  transform: string
  color: string
  background: string
  sample: string
  chars: number
  heading: boolean
  chrome: boolean
  hero: boolean
  code: boolean
  caps: boolean
  /** Set over a photo or video, where the measured background is not what the text sits on. */
  onImage: boolean
}

export interface ProbeButton {
  text: string
  style: 'filled' | 'outline'
  background: string | null
  color: string
  border: string | null
  radius: number
  height: number
  shadow: string | null
  inChrome: boolean
  font: ProbeTextGroup
}

export interface ProbeLogo {
  kind: 'svg' | 'image' | 'text'
  place: 'header' | 'hidden' | 'picture' | 'footer'
  svg?: string
  url?: string
  /** The fill of a CSS mask-image logo: the image is its shape, painted in this color. */
  mask?: string
  crop?: {
    x: number
    y: number
    width: number
    height: number
    imageWidth: number
    imageHeight: number
  }
  text?: string
  font?: string
  fontWeight?: string
  /** Set when parts of the mark were caught mid-animation (scaled away or faded out). */
  animating?: boolean
  /** Where the primary logo sits on the page (left, top), for checking it against the screen. */
  at?: [number, number]
  width: number
  height: number
  colors: string[]
  /** Colors of the rendered mark by share of its solid pixels, when its pixels can be read. */
  palette?: ProbeShare[]
  ink: 'dark' | 'light'
}

export interface ProbeImage {
  kind: 'img' | 'background' | 'svg' | 'poster'
  url?: string
  svg?: string
  width: number
  height: number
  top: number
}

export interface ProbeBand {
  top: number
  background: string
  colorful: number
  imagery: number
  chars: number
}

export interface ProbeFace {
  family: string
  weight: string
  style: string
  url: string
  unicodeRange?: string
}

export interface ProbeShare {
  hex: string
  share: number
}

export interface BrandProbe {
  url: string
  title: string
  description: string | null
  blocked: string | null
  viewport: { width: number; height: number }
  pageHeight: number
  hidden: string[]
  themeHints: string[]
  themeColor: string | null
  canvas: string
  backgrounds: ProbeShare[]
  colorfulArea: ProbeShare[]
  bands: ProbeBand[]
  text: ProbeTextGroup[]
  buttons: ProbeButton[]
  tokens: Array<{ name: string; hex: string }>
  cards: {
    total: number
    radii: Record<string, number>
    borders: Record<string, number>
    shadows: Record<string, number>
  }
  imageRadii: Record<string, number>
  /** Photos and video on the screens, [left, top, width, height, fixed] in page pixels (fixed ones
   * in viewport pixels, fixed = 1), so screenshot pixels split into chrome and photography. */
  media: number[][]
  /** Share of the first screen covered by canvas drawing (WebGL), whose colors the DOM cannot read. */
  canvasCover: number
  logos: ProbeLogo[]
  /** The best-scoring logo candidates, for diagnosing a missing or wrong logo. */
  logoCandidates: Array<{ label: string; score: number; box: string; empty?: boolean }>
  images: ProbeImage[]
  icons: Array<{ url: string; rel: string; sizes: string; type: string }>
  ogImage: string | null
  fontFaces: ProbeFace[]
  /** Families whose @font-face only points at an installed system font with local(). */
  localFamilies: string[]
  fontResources: string[]
  unreadableStylesheets: string[]
  timings: Record<string, number>
}

/**
 * Hides consent banners, modal backdrops, and region popups so they do not cover the screenshots or
 * skew the colors. It only changes display, so nothing is accepted or declined. A stylesheet rule
 * backs up the inline style because consent scripts re-show their banners by setting inline styles.
 */
export function hideOverlays(): string[] {
  const hidden: string[] = []
  if (document.getElementById('oi-hidden-style') === null) {
    const rule = document.createElement('style')
    rule.id = 'oi-hidden-style'
    // The unused id list inside :is() lifts the rule above the page's own !important id rules.
    rule.textContent =
      ':is(#oi #oi #oi, [data-oi-hidden]) { display: none !important; } :is(#oi #oi #oi, [data-oi-unlocked]) { overflow: visible !important; position: static !important; top: auto !important; height: auto !important; }'
    document.head.appendChild(rule)
  }
  // Not a bare "cmp-": Adobe Experience Manager prefixes every component class with it.
  const consentLabel =
    /cookie|consent|gdpr|onetrust|didomi|usercentrics|cookiebot|osano|truste|transcend|termly|sp_message|qc-cmp|cmpbox|cmp-?(banner|popup|dialog|modal|root|app)\b|(^|\s)cmp(\s|$)|privacy-banner/i
  const popupLabel =
    /popup|modal|interstitial|newsletter|market-?selector|geo-?(ip|location)|locale-?(selector|suggest)|country-?(selector|picker)/i
  const modalText =
    /choose (a |your )?(country|region|location)|select (a |your )?(country|region|location|language)|newsletter|subscribe|sign up for|% off|ship(ping)? to|you('re| are) (visiting|browsing)|take me to|continue to|stay on|go to .{2,30} (site|store)/i
  const hide = (element: Element, reason: string): void => {
    if (element instanceof HTMLElement || element instanceof SVGElement)
      element.style.setProperty('display', 'none', 'important')
    element.setAttribute('data-oi-hidden', reason)
    hidden.push(reason)
  }
  const viewportArea = window.innerWidth * window.innerHeight
  // Consent managers sometimes attach their host to <html>, outside <body>.
  for (const element of document.querySelectorAll(
    'body *, html > :not(head):not(body), html > :not(head):not(body) *'
  )) {
    if (
      (element.parentElement?.closest('[data-oi-hidden]') ?? null) !== null ||
      element.hasAttribute('data-oi-hidden')
    )
      continue
    const style = getComputedStyle(element)
    if (style.display === 'none') continue
    const pinned = style.position === 'fixed' || style.position === 'sticky'
    const dialog = element.matches('[role="dialog"], [aria-modal="true"], dialog[open]')
    // Consent tools that render in an iframe are recognized by the frame's name and source.
    const frames = pinned
      ? [...element.querySelectorAll('iframe')]
          .slice(0, 3)
          .map((frame) => `${frame.id} ${frame.title} ${frame.getAttribute('src') ?? ''}`)
      : []
    const label = `${element.id} ${element.getAttribute('class') ?? ''} ${element.getAttribute('aria-label') ?? ''} ${frames.join(' ')}`
    const consentNamed = consentLabel.test(label)
    if (!pinned && !dialog && !consentNamed) continue
    const rect = element.getBoundingClientRect()
    if (element.matches('header, nav, [role="banner"], [role="navigation"]') && rect.height < 240)
      continue
    if (
      pinned &&
      rect.top < 8 &&
      rect.height < 180 &&
      element.querySelector('nav, a[href="/"]') !== null
    )
      continue
    const text = element instanceof HTMLElement ? element.innerText.slice(0, 3000) : ''
    // A banner explains cookies in its prose; page content only links to a cookie policy.
    let prose = ''
    if (/cookie|consent/i.test(text) && text.length < 3000) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      for (
        let node = walker.nextNode(), visited = 0;
        node !== null && visited < 400;
        node = walker.nextNode(), visited++
      )
        if (node.parentElement?.closest('a, button, [role="button"], label') === null)
          prose += ` ${node.textContent ?? ''}`
    }
    const mentionsConsent = /cookie|consent/i.test(prose)
    if (!pinned && !dialog) {
      // In-flow consent banners (for example at the very top of the page) are hidden too.
      // Consent-named hosts with no readable text render into a closed shadow root.
      if (
        consentNamed &&
        ((mentionsConsent && text.length > 60 && rect.height < window.innerHeight * 0.8) ||
          (text.trim().length === 0 &&
            element.children.length > 0 &&
            element.querySelector('img, svg, picture, video, canvas') === null))
      )
        hide(element, 'consent banner')
      continue
    }
    const channels = style.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? []
    const alpha = channels.length === 4 ? (channels[3] ?? 1) : channels.length === 3 ? 1 : 0
    const dialogInside =
      dialog || element.querySelector('[aria-modal="true"], [role="dialog"], dialog[open]') !== null
    if (consentNamed || mentionsConsent) hide(element, 'consent banner')
    else if (
      rect.width * rect.height > viewportArea * 0.6 &&
      text.trim().length < 20 &&
      alpha > 0.05 &&
      alpha < 0.95
    )
      hide(element, 'modal backdrop')
    else if (
      ((dialogInside || popupLabel.test(label)) && modalText.test(text) && text.length < 3000) ||
      // An open modal over the middle of the screen at load is a gate or popup in any language.
      ((dialogInside || popupLabel.test(label)) &&
        pinned &&
        rect.left < window.innerWidth / 2 &&
        rect.right > window.innerWidth / 2 &&
        rect.top < window.innerHeight / 2 &&
        rect.bottom > window.innerHeight / 2 &&
        text.length < 3000)
    )
      hide(element, 'popup')
  }
  // Banners rendered inside open shadow roots. Their text can sit in the shadow tree (after its
  // own <style>) or in light-DOM children slotted into it, and the host's tag often names it.
  for (const host of document.querySelectorAll('*')) {
    const shadow = host.shadowRoot
    if (shadow === null || host.hasAttribute('data-oi-hidden')) continue
    // Site headers built as web components often link to the cookie policy.
    if (
      /header|nav|menu/i.test(host.tagName) ||
      host.matches('header, nav, [role="banner"], [role="navigation"]')
    )
      continue
    const shadowText = [...shadow.querySelectorAll(':not(style):not(script)')]
      .flatMap((element) => [...element.childNodes])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .slice(0, 6000)
    if (
      !consentLabel.test(`${host.tagName} ${host.id} ${host.getAttribute('class') ?? ''}`) &&
      !/cookie|consent/i.test(`${shadowText} ${(host.textContent ?? '').slice(0, 6000)}`)
    )
      continue
    if (
      /fixed|sticky/.test(getComputedStyle(host).position) ||
      [...shadow.querySelectorAll('*')].some(
        (element) =>
          /fixed|sticky/.test(getComputedStyle(element).position) ||
          element.matches('dialog[open], [aria-modal="true"]')
      )
    )
      hide(host, 'consent banner')
  }
  // Consent walls and pending modals lock scrolling (overflow hidden, or a fixed body offset by the
  // scroll position). Unlock only when the content is taller than the screen; the stylesheet rule
  // keeps it unlocked when the script re-applies the lock.
  const scrolling = document.scrollingElement ?? document.documentElement
  if (
    scrolling.scrollHeight <= window.innerHeight + 100 &&
    document.body.scrollHeight > window.innerHeight + 100
  ) {
    for (const element of [document.documentElement, document.body]) {
      element.setAttribute('data-oi-unlocked', '')
      for (const property of ['overflow', 'position', 'top', 'height'])
        element.style.setProperty(
          property,
          property === 'overflow' ? 'visible' : property === 'position' ? 'static' : 'auto',
          'important'
        )
    }
  }
  return hidden
}

/**
 * Measures the brand page: painted colors, text styles, buttons, cards, tokens, font faces, the
 * logo, and imagery. It waits for the page to settle, reads the logo while the header is at rest,
 * then scrolls through the first screens so lazy images and reveal animations load before measuring.
 */
export async function probeBrandPage(hideOverlays: () => string[]): Promise<string> {
  type Rgba = [number, number, number, number]
  type Rgb = [number, number, number]
  interface Paint {
    top: number
    left: number
    bottom: number
    right: number
    kind: 'color' | 'image'
    stops: Rgba[]
  }

  const started = performance.now()
  const timings: Record<string, number> = {}
  const mark = (name: string): void => {
    timings[name] = Math.round(performance.now() - started)
  }
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
  const meta = (selector: string): string | null =>
    document.querySelector(selector)?.getAttribute('content')?.trim() || null
  const unquote = (value: string): string => value.trim().replace(/^["']|["']$/g, '')
  const absolute = (value: string | null | undefined): string | null => {
    if (!value || value.startsWith('data:') || value.startsWith('blob:')) return null
    try {
      return new URL(value, location.href).toString()
    } catch {
      return null
    }
  }

  for (let waited = 0; document.readyState !== 'complete' && waited < 3000; waited += 100)
    await sleep(100)
  await Promise.race([document.fonts.ready, sleep(1500)])
  // Bot checks usually clear on their own within a few seconds in a real browser.
  const botCheck =
    /just a moment|attention required|access (to this page (has been )?)?denied|you don'?t have permission to access|(you('ve| have) been|has been|request (was )?) blocked|verify (that )?you are (a )?human|are you a (robot|human)|captcha|pardon our interruption|request unsuccessful|security check|checking (your browser|your connection|connection|if the site connection)|unusual (traffic|activity) from|access (is |has been )?(temporarily )?restricted|trying to access is restricted/i
  const blockedReason = (): string | null => {
    const text = (document.body?.innerText ?? '').trim()
    if (botCheck.test(document.title)) return document.title
    if (text.length < 600 && botCheck.test(text)) return text.replace(/\s+/g, ' ').slice(0, 80)
    const challenge = document.querySelector(
      'iframe[src*="captcha" i], iframe[src*="challenge" i], iframe[src*="datadome" i]'
    )
    if (text.length < 200 && challenge !== null) return 'captcha'
    // Challenge interstitials often render nothing at all until they reload the page.
    // Pages built from web components keep their text in shadow roots, out of innerText.
    return text.length === 0 &&
      document.querySelector('img, svg, video, canvas, iframe') === null &&
      ![...document.querySelectorAll('body *')].some((element) => element.shadowRoot !== null)
      ? 'an empty page'
      : null
  }
  for (let waited = 0; blockedReason() !== null && waited < 8000; waited += 500)
    await sleep(500)
  const blocked = blockedReason()
  if (blocked !== null)
    return JSON.stringify({ blocked, url: location.href, title: document.title })
  // Script-rendered pages keep adding content after load; wait until the DOM stops growing.
  for (let waited = 0, last = -1; waited < 2000; waited += 150) {
    const size = document.getElementsByTagName('*').length + document.images.length
    if (size === last) break
    last = size
    await sleep(150)
  }
  mark('settled')

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const hidden = hideOverlays()
  const main = document.scrollingElement ?? document.documentElement
  let scroller: Element = main
  if (main.scrollHeight <= viewportHeight + 100) {
    let bestArea = 0
    for (const element of document.querySelectorAll('body *')) {
      if (
        element.scrollHeight <= element.clientHeight + 100 ||
        element.clientHeight < viewportHeight * 0.5
      )
        continue
      const overflowY = getComputedStyle(element).overflowY
      if (overflowY !== 'auto' && overflowY !== 'scroll') continue
      if (element.clientWidth * element.clientHeight > bestArea) {
        scroller = element
        bestArea = element.clientWidth * element.clientHeight
      }
    }
  }
  const innerScroller = scroller !== main
  scroller.setAttribute('data-oi-scroller', '')
  const scrollTop = innerScroller ? scroller.scrollTop : window.scrollY
  const scrollToY = (top: number): void =>
    (innerScroller ? scroller : window).scrollTo({ top, behavior: 'instant' })

  // Colors: every CSS color syntax (oklch, lab, color()) is converted through a canvas.
  const pen = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgbaCache = new Map<string, Rgba | null>()
  const toRgba = (value: string): Rgba | null => {
    const cached = rgbaCache.get(value)
    if (cached !== undefined) return cached
    let result: Rgba | null = null
    const simple = value.match(
      /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
    )
    if (simple !== null) {
      const alphaText = simple[4]
      const alpha =
        alphaText === undefined
          ? 1
          : alphaText.endsWith('%')
            ? parseFloat(alphaText) / 100
            : parseFloat(alphaText)
      result = [Number(simple[1]), Number(simple[2]), Number(simple[3]), alpha]
    } else if (value === 'transparent' || value === 'none' || value === '') {
      result = [0, 0, 0, 0]
    } else if (pen !== null && value.length < 160 && !/var\(|url\(|gradient/i.test(value)) {
      pen.fillStyle = '#010203'
      pen.fillStyle = value
      if (pen.fillStyle !== '#010203' || /^#010203$/i.test(value)) {
        pen.clearRect(0, 0, 1, 1)
        pen.fillRect(0, 0, 1, 1)
        const data = pen.getImageData(0, 0, 1, 1).data
        result = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, (data[3] ?? 0) / 255]
      }
    }
    rgbaCache.set(value, result)
    return result
  }
  const hexOf = (color: Rgb | Rgba): string =>
    `#${[color[0], color[1], color[2]]
      .map((channel) =>
        Math.max(0, Math.min(255, Math.round(channel)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')}`
  const blend = (top: Rgba, bottom: Rgb): Rgb => [
    top[0] * top[3] + bottom[0] * (1 - top[3]),
    top[1] * top[3] + bottom[1] * (1 - top[3]),
    top[2] * top[3] + bottom[2] * (1 - top[3])
  ]
  const luminance = (color: Rgb | Rgba): number => {
    const linear = [color[0], color[1], color[2]].map((channel) => {
      const value = channel / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
  }
  const distance = (first: Rgb | Rgba, second: Rgb | Rgba): number =>
    Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2])
  const isColorful = (color: Rgb | Rgba): boolean => {
    const max = Math.max(color[0], color[1], color[2])
    const min = Math.min(color[0], color[1], color[2])
    const lightness = (max + min) / 510
    const saturation = max === min ? 0 : (max - min) / 255 / (1 - Math.abs(2 * lightness - 1) || 1)
    return max - min >= 40 && saturation >= 0.25
  }
  // Stops of a gradient that is actually painted (hover wipes often use a zero-size gradient).
  const gradientStops = (style: CSSStyleDeclaration): Rgba[] => {
    if (
      !style.backgroundImage.includes('gradient(') ||
      /^0(px|%)?\s/.test(`${style.backgroundSize} `)
    )
      return []
    const stops: Rgba[] = []
    for (const match of style.backgroundImage.matchAll(
      /(rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|transparent|(?:oklch|oklab|lab|lch|hsla?|color)\([^)]*\))/gi
    )) {
      const rgba = toRgba(match[1] ?? '')
      if (rgba !== null) stops.push(rgba)
    }
    return stops
  }
  const shadowText = (value: string): string | null => {
    if (value === 'none' || value === '') return null
    const first = value.split(/,(?![^(]*\))/)[0] ?? value
    const colorMatch = first.match(
      /(rgba?\([^)]*\)|#[0-9a-f]{3,8}|(?:oklch|oklab|lab|lch|color)\([^)]*\))/i
    )
    const rgba = colorMatch === null ? null : toRgba(colorMatch[1] ?? '')
    const rest = first
      .replace(colorMatch?.[1] ?? '', '')
      .replace(/\s+/g, ' ')
      .trim()
    if ((rgba !== null && rgba[3] < 0.03) || /^(inset )?(0(px)? ?)+$/.test(rest)) return null
    return rgba === null
      ? rest
      : `${rest} ${hexOf(rgba)}${rgba[3] < 1 ? `/${Math.round(rgba[3] * 100)}%` : ''}`
  }

  const opacityCache = new Map<Element, number>()
  const opacityOf = (element: Element | null): number => {
    if (element === null) return 1
    const cached = opacityCache.get(element)
    if (cached !== undefined) return cached
    const value = Number(getComputedStyle(element).opacity) * opacityOf(element.parentElement)
    opacityCache.set(element, value)
    return value
  }
  // Sites built from web components keep their header, logo, or whole page in open shadow roots.
  const shadowRoots: ShadowRoot[] = []
  const findShadowRoots = (): void => {
    shadowRoots.length = 0
    const visit = (root: Document | ShadowRoot): void => {
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot === null) continue
        shadowRoots.push(element.shadowRoot)
        visit(element.shadowRoot)
      }
    }
    visit(document)
  }
  const queryAll = (selector: string): Element[] => [
    ...document.querySelectorAll(selector),
    ...shadowRoots.flatMap((root) => [...root.querySelectorAll(selector)])
  ]
  /** Every element inside the container, shadow trees included, each right after its host. */
  const descendants = (container: Element): Element[] => {
    const found: Element[] = []
    const visit = (root: Element | ShadowRoot): void => {
      for (const element of root.querySelectorAll('*')) {
        found.push(element)
        if (element.shadowRoot !== null) visit(element.shadowRoot)
      }
    }
    if (container.shadowRoot !== null) visit(container.shadowRoot)
    visit(container)
    return found
  }
  const closestAcross = (element: Element, selector: string): Element | null => {
    for (let node: Element | null = element; node !== null; ) {
      const hit = node.closest(selector)
      if (hit !== null) return hit
      const root = node.getRootNode()
      node = root instanceof ShadowRoot ? root.host : null
    }
    return null
  }
  const isShown = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    return (
      rect.width >= 1 &&
      rect.height >= 1 &&
      getComputedStyle(element).visibility !== 'hidden' &&
      opacityOf(element) > 0.1
    )
  }
  // Fixed layers stay put while the page scrolls, so they show on every screenshot.
  const fixedAncestor = (element: Element): boolean => {
    for (let node: Element | null = element; node !== null; node = node.parentElement)
      if (getComputedStyle(node).position === 'fixed') return true
    return false
  }
  const isChrome = (element: Element): boolean => {
    if (closestAcross(element, 'nav, footer, [role="navigation"], [role="contentinfo"]') !== null)
      return true
    const header = closestAcross(element, 'header, [role="banner"]')
    if (header === null) return false
    const position = getComputedStyle(header).position
    return (
      header.getBoundingClientRect().height < 220 || position === 'fixed' || position === 'sticky'
    )
  }

  // The first family of a stack that has @font-face rules (or is a system font) is the one that renders.
  const faceFamilies = new Set<string>()
  const faceRanges = new Map<string, string[]>()
  for (const face of document.fonts) {
    const family = unquote(face.family).toLowerCase()
    faceFamilies.add(family)
    faceRanges.set(family, [...(faceRanges.get(family) ?? []), face.unicodeRange])
  }
  // Whether a web font has a face for this character (subset fonts often cover a few blocks only).
  const coversCharacter = (family: string, codePoint: number): boolean =>
    (faceRanges.get(family) ?? []).some((ranges) =>
      ranges.split(',').some((range) => {
        const match = range.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i)
        if (match === null) return false
        const first = match[1] ?? '0'
        const start = parseInt(first.replace(/\?/g, '0'), 16)
        const end = parseInt(match[2] ?? first.replace(/\?/g, 'f'), 16)
        return codePoint >= start && codePoint <= end
      })
    )
  const systemFamily =
    /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|sans-serif|serif|monospace|georgia|times new roman|times|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|sf pro text|sf pro display|sf mono|menlo|monaco|consolas|courier new|courier|verdana|tahoma|trebuchet ms|cursive|fantasy|noto sans)$/i
  const familyCache = new Map<string, { family: string; webFont: boolean; generic: string }>()
  // A local font is installed when text set in it measures differently from the fallback alone.
  const measure = document.createElement('canvas').getContext('2d')
  const isInstalled = (name: string, text: string): boolean => {
    if (measure === null) return true
    return ['monospace', 'serif'].some((base) => {
      measure.font = `72px ${base}`
      const plain = measure.measureText(text).width
      measure.font = `72px "${name}", ${base}`
      return measure.measureText(text).width !== plain
    })
  }
  const otherScript = /[\u0590-\u06ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/
  const resolveFamily = (
    stack: string,
    sample = ''
  ): { family: string; webFont: boolean; generic: string } => {
    const codePoint = sample.match(otherScript)?.[0]?.codePointAt(0) ?? 0
    const script = codePoint > 0
    const key = `${codePoint >> 8}|${stack}`
    const cached = familyCache.get(key)
    if (cached !== undefined) return cached
    const names = stack
      .split(',')
      .map(unquote)
      .filter((name) => name.length > 0)
    const generic =
      names.find((name) =>
        /^(serif|sans-serif|monospace|cursive|system-ui|ui-monospace|ui-serif)$/i.test(name)
      ) ?? 'sans-serif'
    let result = { family: names[0] ?? 'sans-serif', webFont: false, generic }
    if (script) {
      // Latin fonts, the system UI font included, have no glyphs for CJK, Hangul, Arabic, or Hebrew
      // text: the browser moves on to the first web font with a face for it or a font made for the
      // script, and only then to the operating system's fallback.
      const scriptSystem =
        /pingfang|hiragino|yahei|jhenghei|noto (sans|serif) (cjk|sc|tc|jp|kr|arabic|hebrew)|source han|apple sd gothic|malgun|nanum|meiryo|yu gothic|ms gothic|simsun|simhei|heiti|songti|geeza|arial hebrew|david/i
      result = { family: generic, webFont: false, generic }
      for (const name of names) {
        const lower = name.toLowerCase()
        const webFont = faceFamilies.has(lower)
        if (
          webFont
            ? coversCharacter(lower, codePoint)
            : scriptSystem.test(name) && isInstalled(name, String.fromCodePoint(codePoint))
        ) {
          result = { family: name, webFont, generic }
          break
        }
      }
    } else {
      for (const name of names) {
        if (faceFamilies.has(name.toLowerCase()) || systemFamily.test(name)) {
          result = { family: name, webFont: faceFamilies.has(name.toLowerCase()), generic }
          break
        }
      }
    }
    familyCache.set(key, result)
    return result
  }
  const textGroup = (
    style: CSSStyleDeclaration,
    color: Rgb,
    background: Rgb,
    sample: string,
    chars: number
  ): ProbeTextGroup => {
    const size = parseFloat(style.fontSize) || 16
    const lineHeight = parseFloat(style.lineHeight)
    const tracking = parseFloat(style.letterSpacing)
    const resolved = resolveFamily(style.fontFamily, sample)
    return {
      ...resolved,
      weight: style.fontWeight,
      italic: style.fontStyle !== 'normal',
      size: Math.round(size * 10) / 10,
      lineHeight: Number.isFinite(lineHeight) ? Math.round((lineHeight / size) * 100) / 100 : null,
      tracking: Number.isFinite(tracking) ? Math.round((tracking / size) * 1000) / 1000 : 0,
      transform: style.textTransform === 'none' ? '' : style.textTransform,
      color: hexOf(color),
      background: hexOf(background),
      sample: sample.slice(0, 40),
      chars,
      heading: false,
      chrome: false,
      hero: false,
      code: false,
      caps: /[A-Z]{3}/.test(sample) && !/[a-z]/.test(sample),
      onImage: false
    }
  }

  // ---- Logo: the site's own home link or logo element, serialized so it renders alone. ----
  const brandTokens = new Set<string>()
  // A compound public suffix is a second-level label such as co or com under a country code
  // (co.uk, com.au, ne.jp); a short brand name such as gap.com or cos.com is not one.
  const compoundSuffix = (parts: string[]): boolean =>
    parts.length > 2 &&
    (parts[parts.length - 1]?.length ?? 0) === 2 &&
    /^(ac|biz|co|com|edu|go|gob|gov|gv|ltd|mil|ne|net|nic|or|org|plc|sch)$/.test(
      parts[parts.length - 2] ?? ''
    )
  const hostParts = location.hostname.replace(/^www\./, '').split('.')
  const hostName = compoundSuffix(hostParts)
    ? hostParts[hostParts.length - 3]
    : hostParts[hostParts.length - 2]
  for (const candidate of [
    hostName ?? '',
    meta('meta[property="og:site_name"]') ?? '',
    ...document.title.split(/[|\u2013\u2014:\u00b7\u2022]| - /)
  ]) {
    const normalized = candidate.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normalized.length >= 2 && normalized.length <= 24) brandTokens.add(normalized)
  }
  // The registrable part of a host name: shop.brand.com and brand.com are one site.
  const siteOf = (host: string): string => {
    const parts = host.split('.')
    return parts.slice(compoundSuffix(parts) ? -3 : -2).join('.')
  }
  const mentionsBrand = (value: string): boolean => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '')
    return [...brandTokens].some((token) => normalized.includes(token))
  }
  const isHomeLink = (anchor: HTMLAnchorElement): boolean => {
    if ((anchor.getAttribute('href') ?? '').startsWith('#')) return false
    try {
      const url = new URL(anchor.href, location.href)
      return (
        url.hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '') &&
        url.hash.length <= 1 &&
        (url.pathname === location.pathname ||
          // Locale roots such as /de, /en-gb, /us/eng, or /home.
          /^((\/([a-z]{2}([-_][a-z]{2,4})?|home|global|intl?|www|start)){1,2}(\/[a-z]{3})?|(\/([a-z]{2}([-_][a-z]{2,4})?|home|global|intl?|www|start)){0,2})\/?(index\.(html?|php|aspx?))?$/i.test(
            url.pathname
          ))
      )
    } catch {
      return false
    }
  }
  const labelOf = (element: Element): string =>
    [element, ...descendants(element).filter((node) => node.matches('img, svg, [aria-label]'))]
      .slice(0, 5)
      .map(
        (node) =>
          ['id', 'class', 'aria-label', 'title', 'alt', 'src', 'data-testid']
            .map((name) => node.getAttribute(name) ?? '')
            .join(' ') + (node.querySelector('title')?.textContent ?? '')
      )
      .join(' ')

  const paintProperties = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'fill-rule',
    'clip-rule',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'stop-color',
    'stop-opacity',
    'clip-path',
    'mask'
  ]
  const localUrl = (value: string): string =>
    value.replace(/url\(\s*["']?[^"')#]*#([^"')\s]+)["']?\s*\)/g, 'url(#$1)')
  // Copies computed paint onto a clone, pulls in referenced defs and sprites, and resolves
  // currentColor and CSS variables, so the file renders the way the page shows it.
  // Page markup ends up in saved files, so it loses what could run there: scripts,
  // foreignObject, event handlers, and javascript: links. Inline SVG, the sprites and defs it
  // pulls in, and SVG from data: URIs all go through it.
  const cleanSvg = (markup: string): string | null => {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const root = parsed.documentElement
    if (root.tagName !== 'svg' || parsed.getElementsByTagName('parsererror').length > 0) return null
    for (const element of [...root.querySelectorAll('*')])
      if (/^(script|foreignObject)$/i.test(element.tagName)) element.remove()
    for (const element of [root, ...root.querySelectorAll('*')])
      for (const name of element.getAttributeNames())
        if (
          /^on/i.test(name) ||
          (/href$/i.test(name) && /^\s*javascript:/i.test(element.getAttribute(name) ?? ''))
        )
          element.removeAttribute(name)
    return new XMLSerializer().serializeToString(root)
  }
  const serializeSvg = async (
    svg: SVGSVGElement,
    offset: { x: number; y: number } | null
  ): Promise<{
    markup: string
    colors: string[]
    width: number
    height: number
    animating: boolean
  }> => {
    const clone = svg.cloneNode(true)
    if (!(clone instanceof SVGSVGElement))
      return { markup: '', colors: [], width: 0, height: 0, animating: false }
    // Entrance animations scale or fade the parts of a mark; one caught midway is read again later.
    let animating = false
    const originals = [svg, ...svg.querySelectorAll('*')]
    const copies = [clone, ...clone.querySelectorAll('*')]
    const colors: string[] = []
    const removals: Element[] = []
    originals.forEach((original, index) => {
      const copy = copies[index]
      if (copy === undefined) return
      const style = getComputedStyle(original)
      if (index > 0 && /^(path|rect|circle|ellipse|polygon|g|text|use)$/i.test(original.tagName)) {
        const matrix = style.transform
          .match(/^matrix\(([^)]+)\)/)?.[1]
          ?.split(',')
          .map(Number)
        if (
          Number(style.opacity) < 0.3 ||
          (matrix !== undefined &&
            Math.abs((matrix[0] ?? 1) * (matrix[3] ?? 1) - (matrix[1] ?? 0) * (matrix[2] ?? 0)) <
              0.1)
        )
          animating = true
      }
      if (
        (index > 0 && style.display === 'none') ||
        /^(script|foreignObject)$/i.test(original.tagName)
      ) {
        removals.push(copy)
        return
      }
      for (const attribute of copy.getAttributeNames())
        if (/^on/i.test(attribute)) copy.removeAttribute(attribute)
      const declarations: string[] = []
      for (const property of paintProperties) {
        let value = style.getPropertyValue(property).trim()
        if (
          value === '' ||
          value === 'normal' ||
          ((property === 'clip-path' || property === 'mask') && value === 'none')
        )
          continue
        if ((property === 'opacity' || property.endsWith('-opacity')) && value === '1') continue
        if (value.startsWith('url(')) {
          value = localUrl(value)
        } else if (
          (property === 'fill' || property === 'stroke' || property === 'stop-color') &&
          value !== 'none'
        ) {
          const rgba = toRgba(value)
          if (rgba === null || rgba[3] === 0) {
            value = 'none'
          } else {
            value = hexOf(rgba)
            if (rgba[3] < 1)
              declarations.push(
                `${property === 'stop-color' ? 'stop' : property}-opacity:${Math.round(rgba[3] * 100) / 100}`
              )
            if (
              property !== 'stop-color' &&
              /^(path|rect|circle|ellipse|polygon|polyline|line|text|tspan|use)$/i.test(
                original.tagName
              )
            )
              colors.push(value)
          }
        }
        declarations.push(`${property}:${value}`)
      }
      if (/^(text|tspan)$/i.test(original.tagName))
        declarations.push(
          `font-family:${style.fontFamily}`,
          `font-size:${style.fontSize}`,
          `font-weight:${style.fontWeight}`
        )
      if (index > 0 && style.transform !== 'none' && !original.hasAttribute('transform')) {
        declarations.push(
          `transform:${style.transform}`,
          `transform-origin:${style.transformOrigin}`,
          `transform-box:${style.getPropertyValue('transform-box') || 'view-box'}`
        )
      }
      if (index === 0) copy.removeAttribute('style')
      copy.setAttribute(
        'style',
        `${index === 0 ? '' : (copy.getAttribute('style') ?? '')};${declarations.join(';')}`.replace(
          /^;+/,
          ''
        )
      )
    })
    for (const element of removals) element.remove()
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    for (let pass = 0; pass < 3; pass++) {
      let added = 0
      for (const node of [clone, ...clone.querySelectorAll('*')]) {
        for (const attribute of node.getAttributeNames()) {
          const value = node.getAttribute(attribute) ?? ''
          const ids = [...value.matchAll(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g)].map(
            (match) => match[1] ?? ''
          )
          if ((attribute === 'href' || attribute === 'xlink:href') && value.startsWith('#'))
            ids.push(value.slice(1))
          for (const id of ids) {
            if (
              id.length === 0 ||
              clone.querySelector(`[id="${CSS.escape(id)}"]`) !== null ||
              defs.querySelector(`[id="${CSS.escape(id)}"]`) !== null
            )
              continue
            const scope = svg.getRootNode()
            const source =
              (scope instanceof ShadowRoot ? scope.getElementById(id) : null) ??
              document.getElementById(id)
            if (source === null) continue
            defs.appendChild(source.cloneNode(true))
            added++
          }
        }
      }
      if (added === 0) break
      if (defs.parentNode === null) clone.insertBefore(defs, clone.firstChild)
    }
    for (const use of clone.querySelectorAll('use')) {
      const href = use.getAttribute('href') ?? use.getAttribute('xlink:href') ?? ''
      if (href.startsWith('#') || !href.includes('#')) continue
      try {
        const response = await fetch(new URL(href, location.href).toString(), {
          signal: AbortSignal.timeout(2000)
        })
        const symbol = new DOMParser()
          .parseFromString(await response.text(), 'image/svg+xml')
          .getElementById(href.slice(href.indexOf('#') + 1))
        if (symbol === null) continue
        defs.appendChild(document.importNode(symbol, true))
        if (defs.parentNode === null) clone.insertBefore(defs, clone.firstChild)
        use.setAttribute('href', `#${symbol.id}`)
        use.removeAttribute('xlink:href')
      } catch {
        continue
      }
    }
    const rect = svg.getBoundingClientRect()
    let width = Math.round(rect.width * 100) / 100
    let height = Math.round(rect.height * 100) / 100
    if (!clone.hasAttribute('viewBox')) {
      // Without a viewBox the drawing is in pixels of the box the page gives it, and
      // preserveAspectRatio does nothing there; kept beside the viewBox added here, it would stretch.
      clone.removeAttribute('preserveAspectRatio')
      const attributeWidth = parseFloat(svg.getAttribute('width') ?? '')
      const attributeHeight = parseFloat(svg.getAttribute('height') ?? '')
      let box = { x: 0, y: 0, width: attributeWidth, height: attributeHeight }
      if (!(attributeWidth > 0 && attributeHeight > 0)) {
        try {
          box = svg.getBBox()
        } catch {
          box = { x: 0, y: 0, width, height }
        }
      }
      // getBBox measures a <use> of a sprite by the sprite's full viewport (a 100 x 100 square for a
      // wide wordmark), far past the box the mark is drawn in and of another shape; then the drawn
      // box is used. A tighter box is the mark itself, and a larger one of the same shape is a mark
      // scaled down by CSS, so both stay.
      if (
        width >= 1 &&
        height >= 1 &&
        (box.width > width * 1.5 || box.height > height * 1.5) &&
        Math.abs(box.width / box.height / (width / height) - 1) > 0.05
      )
        box = { x: 0, y: 0, width, height }
      if (box.width > 0 && box.height > 0)
        clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
    }
    if (width < 1 || height < 1) {
      const viewBox = (clone.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
      width = viewBox[2] ?? 0
      height = viewBox[3] ?? 0
    }
    // A mark drawn with preserveAspectRatio="none" (common in site builders such as Framer) only
    // looks right at the exact size the page gives it, and any other size squashes it. The stretch
    // is baked into the drawing so the file keeps the shape the page shows at any size.
    const [boxX = 0, boxY = 0, boxWidth = 0, boxHeight = 0] = (clone.getAttribute('viewBox') ?? '')
      .split(/[\s,]+/)
      .map(Number)
    if (
      /^none\b/.test((clone.getAttribute('preserveAspectRatio') ?? '').trim()) &&
      boxWidth > 0 &&
      boxHeight > 0 &&
      width > 0 &&
      height > 0
    ) {
      const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      drawing.setAttribute(
        'transform',
        `scale(${width / boxWidth} ${height / boxHeight}) translate(${-boxX} ${-boxY})`
      )
      while (clone.firstChild !== null) drawing.appendChild(clone.firstChild)
      clone.appendChild(drawing)
      clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
      clone.removeAttribute('preserveAspectRatio')
    }
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    clone.removeAttribute('class')
    if (offset !== null) {
      clone.setAttribute('x', String(Math.round(offset.x * 100) / 100))
      clone.setAttribute('y', String(Math.round(offset.y * 100) / 100))
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    const rootColor = toRgba(getComputedStyle(svg).color)
    const rootStyle = getComputedStyle(document.documentElement)
    const serialized = new XMLSerializer()
      .serializeToString(clone)
      .replace(/currentColor/gi, rootColor === null ? '#000000' : hexOf(rootColor))
      .replace(
        // The fallback can hold one level of parentheses, as in var(--ink, rgb(255, 255, 255)).
        /var\((--[\w-]+)(?:,\s*((?:[^()]|\([^()]*\))+))?\)/g,
        (_match: string, name: string, fallback: string | undefined) => {
          const value = rootStyle.getPropertyValue(name).trim() || fallback || ''
          const rgba = toRgba(value)
          // A hex color has no alpha, so transparent and translucent values stay as written.
          return rgba === null || rgba[3] < 1 ? value : hexOf(rgba)
        }
      )
    const markup = cleanSvg(serialized) ?? ''
    return { markup, colors, width, height, animating }
  }
  // Which background a logo is drawn for, and its colors as drawn. Rendered pixels decide, because
  // marks mix colors and their markup can name colors that are never painted.
  const renderInk = async (
    source: string,
    crossOrigin: boolean,
    crop?: ProbeLogo['crop']
  ): Promise<{ ink: 'dark' | 'light'; palette: ProbeShare[] } | null> => {
    try {
      const image = new Image()
      if (crossOrigin) image.crossOrigin = 'anonymous'
      image.src = source
      // One stalled image server must not hold up the whole inspection.
      await Promise.race([
        image.decode(),
        sleep(8000).then(() => Promise.reject(new Error('The logo image did not load in time.')))
      ])
      const surface = document.createElement('canvas')
      // A sprite is read only where the logo's part of the sheet is.
      const scaleX = crop === undefined ? 1 : (image.naturalWidth || 1) / crop.imageWidth
      const scaleY = crop === undefined ? 1 : (image.naturalHeight || 1) / crop.imageHeight
      const sourceWidth = crop === undefined ? image.naturalWidth || 1 : crop.width * scaleX
      const sourceHeight = crop === undefined ? image.naturalHeight || 1 : crop.height * scaleY
      surface.width = 96
      surface.height = Math.max(4, Math.min(96, Math.round((96 * sourceHeight) / sourceWidth)))
      const context = surface.getContext('2d', { willReadFrequently: true })
      if (context === null) return null
      if (crop === undefined) context.drawImage(image, 0, 0, surface.width, surface.height)
      else
        context.drawImage(
          image,
          crop.x * scaleX,
          crop.y * scaleY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          surface.width,
          surface.height
        )
      const data = context.getImageData(0, 0, surface.width, surface.height).data
      let onWhite = 0
      let onBlack = 0
      let solid = 0
      const buckets = new Map<number, { count: number; red: number; green: number; blue: number }>()
      for (let index = 0; index + 3 < data.length; index += 4) {
        const alpha = (data[index + 3] ?? 0) / 255
        if (alpha < 0.3) continue
        const red = data[index] ?? 0
        const green = data[index + 1] ?? 0
        const blue = data[index + 2] ?? 0
        const level = luminance([red, green, blue])
        onWhite += alpha * (1 - level)
        onBlack += alpha * level
        if (alpha < 0.8) continue
        solid++
        const key = ((red >> 5) << 6) | ((green >> 5) << 3) | (blue >> 5)
        const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 }
        bucket.count++
        bucket.red += red
        bucket.green += green
        bucket.blue += blue
        buckets.set(key, bucket)
      }
      if (onWhite + onBlack < 1) return null
      const palette = [...buckets.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 5)
        .map((bucket) => ({
          hex: hexOf([
            bucket.red / bucket.count,
            bucket.green / bucket.count,
            bucket.blue / bucket.count
          ]),
          share: Math.round((bucket.count / (solid || 1)) * 100) / 100
        }))
        .filter((entry) => entry.share >= 0.02)
      return { ink: onWhite >= onBlack ? 'dark' : 'light', palette }
    } catch {
      return null
    }
  }
  const colorInk = (colors: string[]): 'dark' | 'light' => {
    const light = colors.filter(
      (hex) =>
        luminance([
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16)
        ]) > 0.6
    ).length
    return colors.length > 0 && light > colors.length / 2 ? 'light' : 'dark'
  }
  const bestFromSrcset = (srcset: string): string | null => {
    let best: string | null = null
    let bestWidth = 0
    let smallest: string | null = null
    let smallestWidth = Infinity
    // Candidates are separated by a comma after a descriptor ("a.jpg 100w,b.jpg 200w") or by a
    // comma and a space; a bare comma can be part of a URL (w_100,h_200).
    for (const part of srcset.split(/(?<=\s\d+(?:\.\d+)?[wx])\s*,\s*|,\s+/)) {
      const [url, descriptor] = part.trim().split(/\s+/)
      if (url === undefined || url.length === 0) continue
      const width = descriptor?.endsWith('w')
        ? parseInt(descriptor, 10)
        : descriptor?.endsWith('x')
          ? parseFloat(descriptor) * 1000
          : 1
      if (width <= 2600 && width > bestWidth) {
        best = url
        bestWidth = width
      }
      if (width < smallestWidth) {
        smallest = url
        smallestWidth = width
      }
    }
    return absolute(best ?? smallest)
  }
  const imageUrl = (image: HTMLImageElement): string | null => {
    if (image.parentElement?.tagName === 'PICTURE') {
      for (const source of image.parentElement.querySelectorAll('source')) {
        const media = source.getAttribute('media')
        const srcset = source.getAttribute('srcset') ?? source.getAttribute('data-srcset')
        if ((media !== null && !matchMedia(media).matches) || srcset === null) continue
        const url = bestFromSrcset(srcset)
        if (url !== null) return url
      }
    }
    const srcset = image.getAttribute('srcset') ?? image.getAttribute('data-srcset')
    return (
      (srcset === null ? null : bestFromSrcset(srcset)) ??
      absolute(image.currentSrc) ??
      absolute(image.getAttribute('src')) ??
      absolute(
        image.getAttribute('data-src') ??
          image.getAttribute('data-lazy-src') ??
          image.getAttribute('data-original')
      )
    )
  }
  // url() values can contain parentheses and escaped quotes, which data: SVGs often do.
  // Splits a comma-separated CSS list at the top level, so commas inside gradients stay put.
  const backgroundLayers = (value: string): string[] => {
    const parts: string[] = []
    let depth = 0
    let start = 0
    for (let index = 0; index < value.length; index++) {
      const character = value[index]
      if (character === '(') depth++
      else if (character === ')') depth--
      else if (character === ',' && depth === 0) {
        parts.push(value.slice(start, index).trim())
        start = index + 1
      }
    }
    parts.push(value.slice(start).trim())
    return parts
  }
  const cssUrls = (value: string): string[] =>
    [
      ...value.matchAll(/url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)'"\s]*))\s*\)/g)
    ].map((match) => (match[1] ?? match[2] ?? match[3] ?? '').replace(/\\(.)/g, '$1'))
  const dataSvg = (url: string): string | null => {
    if (!/^data:image\/svg\+xml/i.test(url)) return null
    const comma = url.indexOf(',')
    try {
      const markup = /;base64/i.test(url.slice(0, comma))
        ? atob(url.slice(comma + 1))
        : decodeURIComponent(url.slice(comma + 1))
      return /<svg[\s>]/i.test(markup) ? cleanSvg(markup) : null
    } catch {
      return null
    }
  }
  const svgSourceOf = (element: Element): string | null => {
    if (element instanceof HTMLImageElement) return dataSvg(element.currentSrc || element.src)
    for (const url of cssUrls(getComputedStyle(element).backgroundImage)) {
      const markup = dataSvg(url)
      if (markup !== null) return markup
    }
    return null
  }
  const nestedSvg = (element: Element): boolean =>
    element.tagName === 'svg' && (element.parentElement?.closest('svg') ?? null) !== null
  const visualParts = (container: Element): Element[] => {
    if (container.tagName === 'svg' || container.tagName === 'IMG') return [container]
    // CSS-drawn marks: a mask or background image on the element or its ::before/::after.
    const painted = (element: Element): boolean => {
      const box = element.getBoundingClientRect()
      if (element instanceof SVGElement || box.width > 480 || box.height > 200) return false
      return [null, '::before', '::after'].some((pseudo) => {
        const style = getComputedStyle(element, pseudo)
        if (pseudo !== null && style.content === 'none') return false
        return /url\(/.test(
          `${style.backgroundImage} ${style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image')}`
        )
      })
    }
    // The container's own background counts too (a logo span drawn by its background image).
    return [container, ...descendants(container)].filter((element) => {
      if (element === container && !painted(element)) return false
      if (nestedSvg(element)) return false
      if (
        element.tagName !== 'svg' &&
        element.tagName !== 'IMG' &&
        !painted(element) &&
        (element instanceof SVGElement || svgSourceOf(element) === null)
      )
        return false
      const rect = element.getBoundingClientRect()
      return rect.width * rect.height >= 60 && isShown(element)
    })
  }
  // Screen-reader-only text (clipped, in a 1px box, or pushed off screen) and skip links.
  const skipLink =
    /^(skip|jump) to|^zum (haupt)?inhalt|^aller au contenu|^ir al contenido|^hoppa till|^g\u00e5 til/i
  const visuallyHidden = (element: Element, rect: DOMRect): boolean => {
    if (
      rect.width < 2 ||
      rect.height < 4 ||
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > viewportWidth
    )
      return true
    for (
      let node: Element | null = element, depth = 0;
      node !== null && depth < 4;
      node = node.parentElement, depth++
    ) {
      const style = getComputedStyle(node)
      if (style.position === 'absolute' && style.clip !== 'auto' && style.clip !== '') return true
      if (/inset\(\s*(50|100)%/.test(style.clipPath)) return true
      const box = node.getBoundingClientRect()
      if (style.overflow !== 'visible' && (box.width <= 2 || box.height <= 2)) return true
    }
    return false
  }
  const textParts = (
    container: Element
  ): Array<{ text: string; rect: DOMRect; style: CSSStyleDeclaration }> => {
    const parts: Array<{ text: string; rect: DOMRect; style: CSSStyleDeclaration }> = []
    const scopes: Array<Element | ShadowRoot> = [container]
    for (const element of [container, ...descendants(container)])
      if (element.shadowRoot !== null) scopes.push(element.shadowRoot)
    for (const scope of scopes) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
        const parent = node.parentElement
        if (
          value.length === 0 ||
          value.length > 40 ||
          parent === null ||
          parent.closest('svg') !== null ||
          skipLink.test(value) ||
          getComputedStyle(parent).visibility === 'hidden' ||
          opacityOf(parent) <= 0.1
        )
          continue
        // The text's own box decides, since an inline-block of zero height still paints its text.
        const range = document.createRange()
        range.selectNodeContents(node)
        const rect = range.getBoundingClientRect()
        if (!visuallyHidden(parent, rect))
          parts.push({ text: value, rect, style: getComputedStyle(parent) })
      }
    }
    return parts
  }

  // Icon fonts draw a mark as a private-use glyph in ::before or ::after, set in a web font.
  const iconGlyphs = (
    container: Element
  ): Array<{ text: string; rect: DOMRect; style: CSSStyleDeclaration }> => {
    const glyphs: Array<{ text: string; rect: DOMRect; style: CSSStyleDeclaration }> = []
    for (const element of [container, ...descendants(container)].slice(0, 20)) {
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        const glyph = style.content.replace(/^["']|["']$/g, '')
        const family = unquote(style.fontFamily.split(',')[0] ?? '').toLowerCase()
        const rect = element.getBoundingClientRect()
        if (
          /^[\ue000-\uf8ff]{1,3}$/.test(glyph) &&
          faceFamilies.has(family) &&
          rect.width >= 8 &&
          isShown(element)
        )
          glyphs.push({ text: glyph, rect, style })
      }
    }
    return glyphs
  }
  // Pieces of one word styled apart ("@" and "name") touch; a gap or a new line is a space.
  const joinWords = (words: Array<{ text: string; rect: DOMRect }>): string =>
    words
      .map((word, index) => {
        const previous = words[index - 1]
        if (previous === undefined) return word.text
        const sameLine = Math.abs(word.rect.top - previous.rect.top) < word.rect.height / 2
        return sameLine && word.rect.left - previous.rect.right < 2 ? word.text : ` ${word.text}`
      })
      .join('')

  const logos: ProbeLogo[] = []
  // Logos whose pixels cannot be read are judged later by the painted background behind them.
  const pendingInk = new Map<ProbeLogo, { x: number; y: number }>()
  const round = (value: number): number => Math.round(value * 100) / 100
  const describeLogo = async (
    container: Element,
    place: ProbeLogo['place']
  ): Promise<ProbeLogo | null> => {
    const parts = visualParts(container)
    // A nav label next to the mark inside the home link ("Home", "Etusivu") is not part of the logo.
    const words = textParts(container).filter(
      (word) =>
        parts.length === 0 ||
        !/^(home|home ?page|front ?page|etusivu|startseite|startsida|forside|hjem|accueil|inicio|p\u00e1gina inicial)$/i.test(
          word.text
        )
    )
    // Icon-font logos draw a private-use glyph in ::before; it is set as text in that web font.
    if (parts.length === 0 && words.length === 0) words.push(...iconGlyphs(container))
    const svgs = parts.filter((part) => part instanceof SVGSVGElement || svgSourceOf(part) !== null)
    // Icons drawn as a CSS mask of an inline SVG, painted with the element's background color.
    const maskOf = (element: Element): { markup: string; fill: string } | null => {
      if (element instanceof SVGElement) return null
      const style = getComputedStyle(element)
      const url = cssUrls(
        style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image')
      )[0]
      const markup = url === undefined ? null : dataSvg(url)
      const fill = toRgba(style.backgroundColor)
      return markup === null || fill === null || fill[3] < 0.5
        ? null
        : { markup, fill: hexOf(fill) }
    }
    const masked = parts.filter((part) => maskOf(part) !== null)
    const images = parts.filter(
      (part): part is HTMLImageElement =>
        part instanceof HTMLImageElement && svgSourceOf(part) === null
    )
    const box = container.getBoundingClientRect()
    const finish = async (logo: ProbeLogo, source: string | null): Promise<ProbeLogo> => {
      const rendered =
        source === null
          ? null
          : await renderInk(
              logo.kind === 'svg'
                ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
                : source,
              logo.kind !== 'svg',
              logo.crop
            )
      if (rendered !== null) logo.palette = rendered.palette
      logo.ink =
        rendered?.ink ??
        (logo.url !== undefined && /white|light|inverse|negative|reverse/i.test(logo.url)
          ? 'light'
          : colorInk(logo.colors))
      if (rendered === null && place !== 'hidden')
        pendingInk.set(logo, {
          x: box.left > 10 ? box.left - 6 : box.right + 6,
          y: box.top + scrollTop + box.height / 2
        })
      return logo
    }
    // Filled boxes behind a mark (an app-icon square, a colored badge) are part of the logo.
    const boxes: Array<{ rect: DOMRect; fill: string; radius: number }> = []
    const seenBoxes = new Set<Element>()
    for (const part of svgs) {
      const partRect = part.getBoundingClientRect()
      for (
        let node = part.parentElement;
        node !== null && node !== container.parentElement;
        node = node.parentElement
      ) {
        const nodeRect = node.getBoundingClientRect()
        if (nodeRect.width * nodeRect.height > partRect.width * partRect.height * 4) break
        const nodeStyle = getComputedStyle(node)
        const fill = toRgba(nodeStyle.backgroundColor)
        if (seenBoxes.has(node) || fill === null || fill[3] < 0.5) continue
        seenBoxes.add(node)
        boxes.unshift({
          rect: nodeRect,
          fill: hexOf(fill),
          radius: parseFloat(nodeStyle.borderTopLeftRadius) || 0
        })
      }
    }
    // Live-text wordmarks become an SVG too, so the logo is a file (its font is embedded later).
    if (
      ((svgs.length > 0 || masked.length > 0) && images.length === 0) ||
      (parts.length === 0 && words.length > 0)
    ) {
      const single = svgs[0]
      if (
        svgs.length === 1 &&
        masked.length === 0 &&
        words.length === 0 &&
        boxes.length === 0 &&
        single instanceof SVGSVGElement
      ) {
        const serialized = await serializeSvg(single, null)
        return finish(
          {
            kind: 'svg',
            place,
            svg: serialized.markup,
            width: serialized.width,
            height: serialized.height,
            colors: serialized.colors,
            ink: 'dark',
            ...(serialized.animating ? { animating: true } : {})
          },
          serialized.markup
        )
      }
      // Several marks, live wordmark text, and boxes become one composite SVG in page coordinates.
      const rects = [
        ...svgs.map((svg) => svg.getBoundingClientRect()),
        ...masked.map((part) => part.getBoundingClientRect()),
        ...words.map((word) => word.rect),
        ...boxes.map((entry) => entry.rect)
      ]
      const left = Math.min(...rects.map((rect) => rect.left))
      const top = Math.min(...rects.map((rect) => rect.top))
      const width = Math.max(...rects.map((rect) => rect.right)) - left
      const height = Math.max(...rects.map((rect) => rect.bottom)) - top
      const pieces: string[] = []
      const colors: string[] = []
      let animating = false
      for (const entry of boxes) {
        colors.push(entry.fill)
        pieces.push(
          `<rect x="${round(entry.rect.left - left)}" y="${round(entry.rect.top - top)}" width="${round(entry.rect.width)}" height="${round(entry.rect.height)}" rx="${round(Math.min(entry.radius, entry.rect.height / 2))}" fill="${entry.fill}"/>`
        )
      }
      for (const svg of svgs) {
        const rect = svg.getBoundingClientRect()
        if (svg instanceof SVGSVGElement) {
          const serialized = await serializeSvg(svg, { x: rect.left - left, y: rect.top - top })
          pieces.push(serialized.markup)
          colors.push(...serialized.colors)
          animating = animating || serialized.animating
          continue
        }
        const markup = svgSourceOf(svg)
        if (markup === null) continue
        for (const match of markup.matchAll(
          /(?:fill|stroke)\s*[:=]\s*["']?(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi
        )) {
          const rgba = toRgba(match[1] ?? '')
          if (rgba !== null && rgba[3] > 0) colors.push(hexOf(rgba))
        }
        const position = `x="${round(rect.left - left)}" y="${round(rect.top - top)}" width="${round(rect.width)}" height="${round(rect.height)}" preserveAspectRatio="none"`
        pieces.push(
          markup
            .replace(/<\?xml[^>]*>/i, '')
            .replace(
              /<svg\b([^>]*)>/i,
              (_tag: string, attributes: string) =>
                `<svg${attributes.replace(/\s(width|height|x|y)="[^"]*"/g, '')} ${position}>`
            )
        )
      }
      masked.forEach((part, index) => {
        const mask = maskOf(part)
        if (mask === null) return
        const rect = part.getBoundingClientRect()
        colors.push(mask.fill)
        const id = `oi-mask-${index}`
        pieces.push(
          `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feFlood flood-color="${mask.fill}"/><feComposite in2="SourceAlpha" operator="in"/></filter><image x="${round(rect.left - left)}" y="${round(rect.top - top)}" width="${round(rect.width)}" height="${round(rect.height)}" preserveAspectRatio="xMidYMid meet" filter="url(#${id})" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(mask.markup)}"/>`
        )
      })
      let font = ''
      for (const word of words) {
        const fill = toRgba(word.style.color)
        const fillHex = fill === null ? '#000000' : hexOf(fill)
        colors.push(fillHex)
        // Only a web font has a file to install and embed.
        const resolved = resolveFamily(word.style.fontFamily, word.text)
        if (resolved.webFont) font = resolved.family
        const transform = word.style.textTransform
        const shown =
          transform === 'uppercase'
            ? word.text.toUpperCase()
            : transform === 'lowercase'
              ? word.text.toLowerCase()
              : word.text
        pieces.push(
          `<text x="${round(word.rect.left - left)}" y="${round(word.rect.top - top)}" dominant-baseline="text-before-edge" style="font-family:${word.style.fontFamily.replace(/"/g, "'")};font-size:${word.style.fontSize};font-weight:${word.style.fontWeight};font-style:${word.style.fontStyle};letter-spacing:${word.style.letterSpacing};fill:${fillHex}">${shown.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
        )
      }
      const markup = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}">${pieces.join('')}</svg>`
      return finish(
        {
          kind: 'svg',
          place,
          svg: markup,
          width,
          height,
          colors,
          ink: 'dark',
          ...(animating ? { animating: true } : {}),
          ...(words.length > 0
            ? {
                // Icon glyphs are drawing, not words to quote.
                ...(/^[\ue000-\uf8ff]*$/.test(joinWords(words)) ? {} : { text: joinWords(words) }),
                ...(font.length > 0 ? { font } : {}),
                fontWeight: words[0]?.style.fontWeight ?? '400'
              }
            : {})
        },
        markup
      )
    }
    // Lazy-loading placeholders (empty.gif, spacer, 1x1) stand in for the real file.
    const placeholder = /(^|\/)(empty|blank|spacer|placeholder|transparent|pixel|1x1)[^/]*$/i
    const image = images.find((candidate) => {
      const url = imageUrl(candidate)
      return url !== null && !placeholder.test(new URL(url).pathname)
    })
    if (image !== undefined) {
      const url = imageUrl(image)
      const rect = image.getBoundingClientRect()
      return url === null
        ? null
        : finish(
            {
              kind: 'image',
              place,
              url,
              width: rect.width,
              height: rect.height,
              colors: [],
              ink: 'dark'
            },
            url
          )
    }
    // CSS mask logos: the image gives the shape and the element's background color paints it.
    for (const element of [container, ...descendants(container)].slice(0, 20)) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        if (pseudo !== null && style.content === 'none') continue
        const maskValue =
          style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image')
        const url = absolute(cssUrls(maskValue)[0])
        const fill = toRgba(style.backgroundColor)
        if (url === null || fill === null || fill[3] < 0.5) continue
        const rect = element.getBoundingClientRect()
        const width = parseFloat(style.width) || rect.width
        const height = parseFloat(style.height) || rect.height
        if (width < 8 || height < 6) continue
        const colors = [hexOf(fill)]
        return {
          kind: 'image',
          place,
          url,
          mask: hexOf(fill),
          width,
          height,
          colors,
          ink: colorInk(colors)
        }
      }
    }
    // CSS background logos, including ::before sprites cropped to the visible part.
    for (const element of [container, ...descendants(container)].slice(0, 20)) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        if (pseudo !== null && style.content === 'none') continue
        // With several background layers (a gradient over a sprite), position and size are per layer.
        const layer = backgroundLayers(style.backgroundImage).findIndex((value) =>
          value.startsWith('url(')
        )
        const url = absolute(cssUrls(backgroundLayers(style.backgroundImage)[layer] ?? '')[0])
        if (url === null) continue
        const width = parseFloat(style.width) || element.getBoundingClientRect().width
        const height = parseFloat(style.height) || element.getBoundingClientRect().height
        const position = backgroundLayers(style.backgroundPosition)[layer] ?? ''
        const sizeValue = backgroundLayers(style.backgroundSize)[layer] ?? 'auto'
        const [x = NaN, y = NaN] = position
          .split(' ')
          .map((part) => (part.endsWith('px') ? parseFloat(part) : part === '0%' ? 0 : NaN))
        let size = sizeValue
          .split(' ')
          .map((part) => (part.endsWith('px') ? parseFloat(part) : NaN))
        if (/^auto( auto)?$/.test(sizeValue)) {
          const natural = new Image()
          natural.src = url
          size = await Promise.race([
            natural.decode().then(
              () => [natural.naturalWidth, natural.naturalHeight],
              () => [NaN, NaN]
            ),
            sleep(8000).then(() => [NaN, NaN])
          ])
        }
        const [imageWidth = NaN, imageHeight = NaN] = size
        const sprite =
          [x, y, imageWidth, imageHeight].every(Number.isFinite) &&
          (imageWidth > width + 1 || imageHeight > height + 1)
        return finish(
          {
            kind: 'image',
            place,
            url,
            width,
            height,
            colors: [],
            ink: 'dark',
            ...(sprite ? { crop: { x: -x, y: -y, width, height, imageWidth, imageHeight } } : {})
          },
          url
        )
      }
    }
    const first = words[0]
    if (first === undefined) return null
    const fill = toRgba(first.style.color)
    const colors = fill === null ? [] : [hexOf(fill)]
    return {
      kind: 'text',
      place,
      text: joinWords(words),
      ...(resolveFamily(first.style.fontFamily, first.text).webFont
        ? { font: resolveFamily(first.style.fontFamily, first.text).family }
        : {}),
      width: box.width,
      height: box.height,
      colors,
      ink: colorInk(colors)
    }
  }

  const candidates: Array<{ element: Element; score: number; top: number; empty?: boolean }> = []
  // Logos are read before scrolling, while header animations are at rest; a logo that is still
  // fading in is read again after the scroll.
  const detectLogos = async (): Promise<Element | null> => {
    // Each read sees the page as it is now; a header fading in was cached at opacity 0 before.
    opacityCache.clear()
    logos.length = 0
    candidates.length = 0
    pendingInk.clear()
    const seen = new Set<Element>()
    const consider = (target: Element, home: boolean, bonus = 0): void => {
      // A logo class on a <g> or <path> stands for the whole drawing.
      const element =
        target instanceof SVGElement && target.tagName !== 'svg'
          ? (target.closest('svg') ?? target)
          : target
      const outer = element.getBoundingClientRect()
      if (
        seen.has(element) ||
        outer.width < 12 ||
        outer.height < 8 ||
        outer.right < 0 ||
        outer.left > viewportWidth ||
        outer.bottom + scrollTop < 0 ||
        outer.width > viewportWidth * 0.95 ||
        outer.height > 320 ||
        !isShown(element)
      )
        return
      seen.add(element)
      const shownParts = visualParts(element).map((part) => part.getBoundingClientRect())
      const visuals =
        shownParts.length > 0 ? shownParts : iconGlyphs(element).map((glyph) => glyph.rect)
      // A text-only candidate is as big as its text, not its (often full-width) box.
      const boxes = visuals.length > 0 ? visuals : textParts(element).map((part) => part.rect)
      const rect =
        boxes.length === 0
          ? outer
          : new DOMRect(
              Math.min(...boxes.map((box) => box.left)),
              Math.min(...boxes.map((box) => box.top)),
              Math.max(...boxes.map((box) => box.right)) -
                Math.min(...boxes.map((box) => box.left)),
              Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top))
            )
      const top = rect.top + scrollTop
      const inHeader =
        closestAcross(element, 'header, nav, [role="banner"], [role="navigation"]') !== null
      const label = labelOf(element)
      const text = textParts(element)
        .map((part) => part.text)
        .join(' ')
      const aspect = rect.width / rect.height
      let score = bonus + (home ? 4 : 0) + (visuals.length > 0 ? 3 : -2)
      // "Go to the home page" in the link's own label, in the languages sites commonly use.
      if (
        /home ?page|go (to )?(the )?home|back to home|^home$|startseite|startsida|forside|etusivu|accueil|p[a\u00e1]gina (de )?inicio|p\u00e1gina inicial/i.test(
          `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`.trim()
        )
      )
        score += 2
      // Utility classes such as text-brand-500 or hover:bg-brand name a color, not a logo.
      const named = label
        .split(/\s+/)
        .filter(
          (token) =>
            !/^([a-z-]+:)*(text|bg|border|fill|stroke|from|to|via|ring|outline|decoration|shadow|accent|divide|caret)-/i.test(
              token
            )
        )
        .join(' ')
      // One of a list of same-sized, same-class images (project, customer, or product icons) is an
      // item, not the site's logo, even when every alt text ends in the brand's name.
      const className = element.getAttribute('class')
      const listed =
        (element instanceof HTMLImageElement || element instanceof SVGSVGElement) &&
        className !== null &&
        className.length > 0 &&
        queryAll(element.tagName.toLowerCase()).filter((other) => {
          if (other.getAttribute('class') !== className) return false
          const box = other.getBoundingClientRect()
          return Math.abs(box.width - outer.width) < 2 && Math.abs(box.height - outer.height) < 2
        }).length >= 4
      if (listed) score -= 4
      if (/logo|brand|wordmark/i.test(named)) score += 3
      // A house icon for "home" or a menu button links home too, but it is not the brand's mark.
      else if (/home[-_ ]?(button|icon)|icon[-_ ]?home|menu[-_ ]?(icon|button)/i.test(named))
        score -= 10
      if (mentionsBrand(label) && !listed) score += 3
      if (inHeader || top < 160) score += 3
      if (rect.left < viewportWidth * 0.4 && top < 160) score += 1
      if (aspect >= 1.5 && aspect <= 12) score += aspect >= 2.2 ? 2 : 1
      if (rect.width < 20 || rect.height < 12) score -= 3
      // Big hero wordmarks are logos too; other large boxes are not.
      if (rect.height > 200 || (rect.width > 480 && aspect < 3)) score -= 4
      else if (rect.width > 480 || rect.height > 160) score -= 2
      // Partner, sponsor, customer, press, and payment logos sit in containers named for them.
      for (
        let node = element.parentElement, depth = 0;
        node !== null && depth < 5;
        node = node.parentElement, depth++
      ) {
        if (
          /sponsor|partner|client|customer|trusted|press|investor|award|certif|payment|funded|supported/i.test(
            `${node.id} ${node.getAttribute('class') ?? ''} ${node.getAttribute('aria-label') ?? ''}`
          )
        ) {
          score -= 4
          break
        }
      }
      if (closestAcross(element, 'footer, [role="contentinfo"]') !== null) score -= 3
      // Logos are read at the top of the page, so one further down is someone else's.
      if (top > viewportHeight) score -= 5
      // A logo that links to another site is a partner, customer, or sponsor, unless the link is the
      // brand's own profile there (x.com/brand, youtube.com/@brand); one that links deep into this
      // site (/projects/name) is an item's picture.
      const link = closestAcross(element, 'a[href]')
      if (link instanceof HTMLAnchorElement && /^https?:/.test(link.href)) {
        const target = new URL(link.href)
        const segments = target.pathname.split('/').filter((segment) => segment.length > 0)
        const profile = segments
          .slice(0, 2)
          .some((segment) => brandTokens.has(segment.toLowerCase().replace(/[^a-z0-9]/g, '')))
        if (siteOf(target.hostname) !== siteOf(location.hostname)) {
          if (!profile) score -= 4
        } else if (segments.length >= 2 && !isHomeLink(link)) score -= 3
      }
      if (closestAcross(element, 'button') !== null) score -= 2
      if (
        closestAcross(
          element,
          '[role="tab"], [role="tablist"], [role="menuitem"], [role="menu"], [role="option"]'
        ) !== null
      )
        score -= 5
      score -= text.length > 40 ? 5 : text.length > 24 ? 2 : 0
      candidates.push({ element, score, top })
    }
    findShadowRoots()
    for (const anchor of queryAll('a[href]'))
      if (anchor instanceof HTMLAnchorElement && isHomeLink(anchor)) consider(anchor, true)
    for (const element of queryAll(
      '[class*="logo" i], [id*="logo" i], [aria-label*="logo" i], img[alt*="logo" i], img[src*="logo" i], [data-testid*="logo" i], svg[aria-label], [class*="brand" i]'
    )) {
      const anchor = closestAcross(element, 'a')
      consider(element, anchor instanceof HTMLAnchorElement && isHomeLink(anchor))
    }
    // Unlabelled marks at the top of the page count too, but only a wordmark shape clears the bar.
    for (const element of queryAll('img, svg')) {
      if (nestedSvg(element)) continue
      const rect = element.getBoundingClientRect()
      if (rect.top + scrollTop > 140 || rect.bottom + scrollTop < 0 || rect.height > 120) continue
      const anchor = closestAcross(element, 'a')
      consider(element, anchor instanceof HTMLAnchorElement && isHomeLink(anchor), -3)
    }
    // Personal sites and plain text wordmarks have no logo element: as a last resort, a short line
    // at the top that starts with the site's name is the logo, in its own font.
    if (!candidates.some((candidate) => candidate.score >= 5)) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (
        let node = walker.nextNode(), visited = 0;
        node !== null && visited < 3000;
        node = walker.nextNode(), visited++
      ) {
        const value = (node.textContent ?? '').trim()
        const parent = node.parentElement
        if (value.length < 2 || value.length > 30 || parent === null) continue
        const rect = parent.getBoundingClientRect()
        if (rect.top + scrollTop > 200 || rect.left > viewportWidth * 0.6) continue
        const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '')
        if ([...brandTokens].some((token) => token.length >= 3 && normalized.startsWith(token)))
          consider(parent, false, 3)
      }
    }
    // Ties go to the logo higher on the page.
    candidates.sort((left, right) => right.score - left.score || left.top - right.top)
    // The best candidate that yields a logo; a skip link or an empty box yields none.
    let chosen: { element: Element; score: number; top: number; empty?: boolean } | undefined
    // A logo drawn as several pictures side by side ("de" over "zeen") is read from their parent.
    const wholeLogo = (candidate: (typeof candidates)[number]): Element => {
      const element = candidate.element
      if (!(element instanceof SVGSVGElement || element instanceof HTMLImageElement)) return element
      // The home link around the picture, scored about as high, holds every part of the logo.
      const link = candidates.find(
        (other) =>
          other !== candidate &&
          other.score >= candidate.score - 3 &&
          other.element instanceof HTMLAnchorElement &&
          other.element.contains(element)
      )
      if (link !== undefined) {
        const outer = link.element.getBoundingClientRect()
        if (outer.width <= 600 && outer.height <= 250 && visualParts(link.element).length > 1)
          return link.element
      }
      const box = element.getBoundingClientRect()
      const pieces = candidates.filter((other) => {
        if (other === candidate || other.score < candidate.score - 3) return false
        if (!(other.element instanceof SVGSVGElement || other.element instanceof HTMLImageElement))
          return false
        const near = other.element.getBoundingClientRect()
        return (
          near.left <= box.right + 24 &&
          near.right >= box.left - 24 &&
          near.top <= box.bottom + 24 &&
          near.bottom >= box.top - 24
        )
      })
      if (pieces.length === 0) return element
      let parent = element.parentElement
      for (let depth = 0; parent !== null && depth < 3; depth++, parent = parent.parentElement) {
        const outer = parent.getBoundingClientRect()
        if (outer.width > 600 || outer.height > 250) break
        if (pieces.every((piece) => parent?.contains(piece.element) === true)) return parent
      }
      return element
    }
    for (const candidate of candidates.filter((entry) => entry.score >= 5).slice(0, 4)) {
      candidate.element = wholeLogo(candidate)
      const primary = await describeLogo(candidate.element, 'header')
      candidate.empty = primary === null
      if (primary === null) continue
      const shown = visualParts(candidate.element).map((part) => part.getBoundingClientRect())
      const boxes = shown.length > 0 ? shown : [candidate.element.getBoundingClientRect()]
      primary.at = [
        Math.round(Math.min(...boxes.map((rect) => rect.left))),
        Math.round(Math.min(...boxes.map((rect) => rect.top)) + scrollTop)
      ]
      logos.push(primary)
      chosen = candidate
      break
    }
    if (chosen !== undefined) {
      // Theme variants: hidden siblings in the home link and <picture> sources for dark mode.
      const home = closestAcross(chosen.element, 'a') ?? chosen.element
      for (const alternate of descendants(home)
        .filter((element) => element.matches('svg, img'))
        .filter(
          (element) =>
            !nestedSvg(element) &&
            (element.getBoundingClientRect().width < 1 ||
              getComputedStyle(element).visibility === 'hidden')
        )
        .slice(0, 2)) {
        if (alternate instanceof SVGSVGElement) {
          const serialized = await serializeSvg(alternate, null)
          const ink =
            (
              await renderInk(
                `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized.markup)}`,
                false
              )
            )?.ink ?? colorInk(serialized.colors)
          if (serialized.markup.length > 0 && serialized.markup !== logos[0]?.svg)
            logos.push({
              kind: 'svg',
              place: 'hidden',
              svg: serialized.markup,
              width: serialized.width,
              height: serialized.height,
              colors: serialized.colors,
              ink
            })
        } else if (alternate instanceof HTMLImageElement) {
          const url = imageUrl(alternate)
          // A twin that is the same file, or whose ink cannot be read, says nothing new.
          const ink =
            url === null
              ? null
              : ((await renderInk(url, true))?.ink ??
                (/white|light|inverse|negative|reverse/i.test(url)
                  ? 'light'
                  : /black|dark/i.test(url)
                    ? 'dark'
                    : null))
          if (url !== null && ink !== null && url !== logos[0]?.url)
            logos.push({
              kind: 'image',
              place: 'hidden',
              url,
              width: 0,
              height: 0,
              colors: [],
              ink
            })
        }
      }
      for (const source of home.querySelectorAll('picture source[media*="prefers-color-scheme"]')) {
        const srcset = source.getAttribute('srcset')
        const url = srcset === null ? null : bestFromSrcset(srcset)
        if (url !== null)
          logos.push({
            kind: 'image',
            place: 'picture',
            url,
            width: 0,
            height: 0,
            colors: [],
            ink: /dark/i.test(source.getAttribute('media') ?? '') ? 'light' : 'dark'
          })
      }
    }
    // The footer often carries the reversed logo. Payment, app-store, social, and certification
    // badges sit there too, so it must link home or name the brand, and share the logo's shape.
    const primaryLogo = logos[0]
    const primaryAspect =
      primaryLogo !== undefined && primaryLogo.height > 0
        ? primaryLogo.width / primaryLogo.height
        : null
    for (const element of queryAll(
      'footer a[href], [role="contentinfo"] a[href], footer [class*="logo" i]'
    )) {
      const anchor = closestAcross(element, 'a')
      const rect = element.getBoundingClientRect()
      const linksAway =
        anchor instanceof HTMLAnchorElement &&
        !isHomeLink(anchor) &&
        !(anchor.getAttribute('href') ?? '').startsWith('#')
      if (
        linksAway ||
        (!(anchor instanceof HTMLAnchorElement && isHomeLink(anchor)) &&
          !mentionsBrand(labelOf(element))) ||
        textParts(element)
          .map((part) => part.text)
          .join(' ').length > 12
      )
        continue
      if (
        (element.querySelector('svg, img') === null && element.tagName !== 'svg') ||
        rect.width < 20 ||
        rect.width > 480 ||
        rect.height > 160
      )
        continue
      const footerLogo = await describeLogo(element, 'footer')
      if (footerLogo === null || footerLogo.kind === 'text') continue
      const aspect = footerLogo.height > 0 ? footerLogo.width / footerLogo.height : 0
      if (primaryAspect !== null && (aspect > primaryAspect * 1.6 || aspect < primaryAspect / 1.6))
        continue
      logos.push(footerLogo)
      break
    }
    chosenScore = chosen?.score ?? 0
    return chosen?.element ?? null
  }
  let chosenScore = 0
  let logoElement = await detectLogos()
  mark('logos')

  // Pages that restyle themselves per section ease their colors back once scrolled to the top, so
  // the page colors at the top are kept to compare with before measuring.
  const pageColors = (): string =>
    [document.documentElement, document.body]
      .map((element) => getComputedStyle(element).backgroundColor)
      .join()
  const topColors = pageColors()

  // Scroll through the first screens so lazy images and reveal animations load, then measure.
  const pageHeight = scroller.scrollHeight
  const bandCount = Math.max(1, Math.min(4, Math.round(pageHeight / viewportHeight)))
  // A short stop at each screen is enough for lazy-load observers to start the requests.
  for (let band = 1; band < bandCount; band++) {
    scrollToY(band * viewportHeight)
    await sleep(60)
  }
  if (bandCount > 1) {
    scrollToY(0)
    await sleep(100)
  }
  hidden.push(...hideOverlays())
  // A missing or weak logo is read again once entrance animations have finished, and a mark caught
  // mid-animation is read until it settles (at most about a second).
  if (logos.length === 0 || chosenScore < 9) logoElement = await detectLogos()
  for (let tries = 0; tries < 4 && logos[0]?.animating === true; tries++) {
    await sleep(250)
    logoElement = await detectLogos()
  }
  // A preloader can hold the header back for a few seconds after load; while a home link at the
  // top is still faded out, it is waited on a little longer.
  const headerFading = (): boolean =>
    queryAll('a[href]').some((anchor) => {
      if (!(anchor instanceof HTMLAnchorElement) || !isHomeLink(anchor)) return false
      const rect = anchor.getBoundingClientRect()
      return rect.width >= 12 && rect.top < 200 && rect.bottom > 0 && !isShown(anchor)
    })
  for (
    let tries = 0;
    tries < 8 && logos.length === 0 && (tries < 4 || headerFading());
    tries++
  ) {
    await sleep(350)
    logoElement = await detectLogos()
  }
  mark('scrolled')

  // Measuring in the middle of such a fade would record a color between two themes.
  const easing = (): boolean =>
    document.getAnimations().some((animation) => {
      const effect = animation.effect
      if (
        animation.playState !== 'running' ||
        !(effect instanceof KeyframeEffect) ||
        effect.getTiming().iterations === Infinity ||
        !(effect.target instanceof Element)
      )
        return false
      // Sections on the first screen count; a fixed overlay or a placeholder fading further down
      // is not the page's color.
      const target = effect.target
      const box = target.getBoundingClientRect()
      const section =
        box.width >= viewportWidth * 0.8 &&
        box.top < viewportHeight &&
        box.bottom > 0 &&
        getComputedStyle(target).position !== 'fixed' &&
        closestAcross(target, '[data-oi-hidden]') === null &&
        isShown(target)
      return (
        (target === document.documentElement || target === document.body || section) &&
        effect.getKeyframes().some((frame) => 'backgroundColor' in frame || 'background' in frame)
      )
    })
  for (let waited = 0, last = '', steady = 0; waited < 1500; waited += 100) {
    const colors = pageColors()
    steady = colors === last ? steady + 1 : 0
    if (!easing() && (colors === topColors || steady >= 3)) break
    last = colors
    await sleep(100)
  }

  // ---- One pass over the page: painted boxes, text, cards, and image candidates. ----
  opacityCache.clear()
  const scanBottom = bandCount * viewportHeight
  const imageBottom = Math.max(scanBottom, viewportHeight * 5)
  // The body's own fill covers the html canvas when the body spans the screen.
  const bodyBox = document.body.getBoundingClientRect()
  const bodyCovers = bodyBox.width >= viewportWidth * 0.9 && bodyBox.height >= viewportHeight * 0.9
  const canvasRgba =
    (bodyCovers
      ? [document.body, document.documentElement]
      : [document.documentElement, document.body]
    )
      .map((element) => toRgba(getComputedStyle(element).backgroundColor))
      .find((rgba): rgba is Rgba => rgba !== null && rgba[3] > 0.5) ?? ([255, 255, 255, 1] as Rgba)
  const canvasRgb: Rgb = [canvasRgba[0], canvasRgba[1], canvasRgba[2]]
  const paints: Paint[] = []
  const texts: Array<{
    element: Element
    style: CSSStyleDeclaration
    chars: number
    sample: string
    top: number
    rect: DOMRect
    scale: number
  }> = []
  const cards = {
    total: 0,
    radii: {} as Record<string, number>,
    borders: {} as Record<string, number>,
    shadows: {} as Record<string, number>
  }
  const count = (record: Record<string, number>, key: string): void => {
    record[key] = (record[key] ?? 0) + 1
  }
  const imageElements: Array<{ element: Element; rect: DOMRect; style: CSSStyleDeclaration }> = []
  // Photos waiting for a reveal animation (faded out until scrolled into view) are imagery too.
  const revealImages: Array<{ element: Element; rect: DOMRect; style: CSSStyleDeclaration }> = []
  findShadowRoots()
  for (const element of descendants(document.body)) {
    const tag = element.tagName
    // Text drawn in an SVG counts as text, except in the logo, which is drawing.
    const svgText =
      element instanceof SVGTextContentElement &&
      logoElement?.contains(element) !== true &&
      closestAcross(element, '[class*="logo" i], [id*="logo" i]') === null
    if (
      /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK)$/.test(tag) ||
      (element instanceof SVGElement && tag !== 'svg' && !svgText)
    )
      continue
    const rect = element.getBoundingClientRect()
    const top = rect.top + scrollTop
    if (rect.width < 1 || rect.height < 1 || top > imageBottom || rect.bottom + scrollTop < 0)
      continue
    const style = getComputedStyle(element)
    if (style.visibility === 'hidden') continue
    if (opacityOf(element) <= 0.1) {
      if (
        element instanceof HTMLImageElement &&
        element.naturalWidth >= 200 &&
        rect.width * rect.height >= 20000
      )
        revealImages.push({ element, rect, style })
      // A headline still fading in on the first screen counts for type, not for color.
      if (top < viewportHeight && (parseFloat(style.fontSize) || 0) >= 24) {
        const value = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
          .join(' ')
          .trim()
        if (value.length > 0)
          texts.push({
            element,
            style,
            chars: value.length,
            sample: value.slice(0, 40),
            top,
            rect,
            scale: 1
          })
      }
      continue
    }
    const area = rect.width * rect.height
    const replaced = /^(IMG|VIDEO|CANVAS|IFRAME|svg|PICTURE)$/.test(tag)
    if (replaced && area >= 2500) imageElements.push({ element, rect, style })
    if (top > scanBottom) continue
    const box = { top, left: rect.left, bottom: rect.bottom + scrollTop, right: rect.right }
    const background = toRgba(style.backgroundColor)
    const stops = gradientStops(style)
    // Layers that are fading in or out paint only as much as their opacity.
    const opacity = opacityOf(element)
    const faded = (color: Rgba): Rgba => [color[0], color[1], color[2], color[3] * opacity]
    if (replaced && area >= 6400 && tag !== 'svg') {
      if (opacity >= 0.5) paints.push({ ...box, kind: 'image', stops: [] })
    } else if (style.backgroundImage.includes('url(') && area >= 6400) {
      if (opacity >= 0.5) paints.push({ ...box, kind: 'image', stops: [] })
      if (area >= 60000) imageElements.push({ element, rect, style })
    } else if (stops.length > 0 && stops.every((stop) => stop[3] >= 0.9)) {
      paints.push({ ...box, kind: 'color', stops: stops.map(faded) })
    } else if (background !== null && background[3] > 0.02) {
      paints.push({ ...box, kind: 'color', stops: [faded(background)] })
    }
    // Cards: boxes that stand apart from the page by a border, a shadow, or their own fill.
    if (
      /^(DIV|SECTION|ARTICLE|LI|A|FIGURE|ASIDE)$/.test(tag) &&
      rect.width >= 120 &&
      rect.width <= 960 &&
      rect.height >= 80 &&
      rect.height <= 900 &&
      (element.textContent ?? '').trim().length > 0
    ) {
      const borderWidth = parseFloat(style.borderTopWidth) || 0
      const borderColor = toRgba(style.borderTopColor)
      const border =
        borderWidth >= 1 &&
        borderColor !== null &&
        borderColor[3] >= 0.15 &&
        style.borderTopStyle !== 'none'
          ? `${Math.round(borderWidth)}px ${style.borderTopStyle} ${hexOf(borderColor)}`
          : null
      const shadow = shadowText(style.boxShadow)
      if (
        border !== null ||
        shadow !== null ||
        (background !== null && background[3] >= 0.5 && distance(background, canvasRgb) > 8)
      ) {
        cards.total++
        count(cards.radii, String(Math.round(parseFloat(style.borderTopLeftRadius) || 0)))
        if (border !== null) count(cards.borders, border)
        if (shadow !== null) count(cards.shadows, shadow)
      }
    }
    let chars = 0
    let sample = ''
    let slotted: HTMLSlotElement | null = null
    for (const node of element.childNodes) {
      if (!(node instanceof Text)) continue
      const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      chars += value.length
      if (sample.length < 40) sample += `${sample.length > 0 ? ' ' : ''}${value}`
      if (value.length > 0 && node.assignedSlot !== null) slotted = node.assignedSlot
    }
    // Text slotted into a web component is styled by the component, through its slot. Screen-reader
    // text (a 1px clipped box) is not seen, so it does not decide the body font.
    if (
      chars > 0 &&
      tag !== 'OPTION' &&
      tag !== 'TITLE' &&
      !(rect.width <= 2 && rect.height <= 2 && style.overflow !== 'visible')
    )
      texts.push({
        element,
        style: slotted === null ? style : getComputedStyle(slotted),
        chars,
        sample,
        top,
        rect,
        // Text drawn in an SVG (a nav set as one drawing) is scaled with it.
        scale:
          element instanceof SVGTextContentElement
            ? (element.ownerSVGElement?.getScreenCTM()?.a ?? 1)
            : 1
      })
  }

  // The painted background at a point: the deepest box that covers it, blended down to an opaque
  // color. Gradients pick the stop at the point's height; translucent layers over an image count as
  // their own color only when they mostly cover it.
  const bucketHeight = 300
  const buckets: Paint[][] = Array.from(
    { length: Math.ceil(scanBottom / bucketHeight) + 1 },
    () => []
  )
  for (const paint of paints) {
    for (
      let index = Math.max(0, Math.floor(paint.top / bucketHeight));
      index <= Math.min(buckets.length - 1, Math.floor(paint.bottom / bucketHeight));
      index++
    )
      buckets[index]?.push(paint)
  }
  const pointPaint = (x: number, y: number): { rgb: Rgb; image: boolean } => {
    const bucket =
      buckets[Math.max(0, Math.min(buckets.length - 1, Math.floor(y / bucketHeight)))] ?? []
    const layers: Rgba[] = []
    let image = false
    let cover = 0
    for (let index = bucket.length - 1; index >= 0; index--) {
      const paint = bucket[index]
      if (
        paint === undefined ||
        x < paint.left ||
        x >= paint.right ||
        y < paint.top ||
        y >= paint.bottom
      )
        continue
      if (paint.kind === 'image') {
        image = cover < 0.5
        break
      }
      const position = (y - paint.top) / Math.max(1, paint.bottom - paint.top)
      const layer =
        paint.stops[Math.min(paint.stops.length - 1, Math.floor(position * paint.stops.length))] ??
        paint.stops[0]
      if (layer === undefined) continue
      layers.push(layer)
      cover = 1 - (1 - cover) * (1 - layer[3])
      if (layer[3] >= 0.95) break
    }
    let color = canvasRgb
    for (let index = layers.length - 1; index >= 0; index--) {
      const layer = layers[index]
      if (layer !== undefined) color = blend(layer, color)
    }
    return { rgb: color, image }
  }
  for (const [logo, point] of pendingInk) {
    const behind = pointPaint(point.x, point.y)
    if (!behind.image) {
      logo.ink = luminance(behind.rgb) < 0.4 ? 'light' : 'dark'
      continue
    }
    // Over a photo or video, the header's own text color shows which ink it uses.
    const levels = texts
      .filter(
        (text) => Math.abs(text.top + text.rect.height / 2 - point.y) < 60 && isChrome(text.element)
      )
      .map((text) => toRgba(text.style.color))
      .filter((rgba): rgba is Rgba => rgba !== null && rgba[3] > 0.5)
      .map((rgba) => luminance(rgba))
      .sort((left, right) => left - right)
    const middle = levels[Math.floor(levels.length / 2)]
    if (middle !== undefined) logo.ink = middle > 0.5 ? 'light' : 'dark'
  }

  const shares = (counts: Map<string, number>, total: number): ProbeShare[] =>
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([hex, value]) => ({ hex, share: Math.round((value / (total || 1)) * 1000) / 10 }))
  const step = 40
  const bands: ProbeBand[] = []
  const backgroundCounts = new Map<string, number>()
  const colorfulCounts = new Map<string, number>()
  let sampled = 0
  let sampledColor = 0
  for (let band = 0; band < bandCount; band++) {
    const counts = new Map<string, number>()
    let points = 0
    let colorful = 0
    let imagery = 0
    for (let y = band * viewportHeight + step / 2; y < (band + 1) * viewportHeight; y += step) {
      for (let x = step / 2; x < viewportWidth; x += step) {
        const paint = pointPaint(x, y)
        points++
        if (paint.image) {
          imagery++
          continue
        }
        const hex = hexOf(paint.rgb)
        counts.set(hex, (counts.get(hex) ?? 0) + 1)
        // The first screen counts a little more, since it sets the tone.
        backgroundCounts.set(hex, (backgroundCounts.get(hex) ?? 0) + (band === 0 ? 1.25 : 1))
        sampledColor += band === 0 ? 1.25 : 1
        if (isColorful(paint.rgb)) {
          colorful++
          colorfulCounts.set(hex, (colorfulCounts.get(hex) ?? 0) + 1)
        }
      }
    }
    sampled += points
    bands.push({
      top: band * viewportHeight,
      background:
        [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? hexOf(canvasRgb),
      colorful: Math.round((colorful / (points || 1)) * 100) / 100,
      imagery: Math.round((imagery / (points || 1)) * 100) / 100,
      chars: texts
        .filter(
          (text) => text.top >= band * viewportHeight && text.top < (band + 1) * viewportHeight
        )
        .reduce((sum, text) => sum + text.chars, 0)
    })
  }

  // Text, grouped by look, with the color actually painted behind it.
  const groups = new Map<string, ProbeTextGroup>()
  for (const text of texts) {
    const paint = pointPaint(
      text.rect.left + Math.min(text.rect.width / 2, 20),
      text.top + text.rect.height / 2
    )
    const behind = paint.rgb
    const color = blend(toRgba(text.style.color) ?? [0, 0, 0, 1], behind)
    const group = textGroup(text.style, color, behind, text.sample, text.chars)
    group.size = Math.round(group.size * text.scale * 10) / 10
    group.onImage = paint.image
    group.heading =
      /^H[1-6]$/.test(text.element.tagName) || text.element.getAttribute('role') === 'heading'
    group.chrome = isChrome(text.element)
    group.hero = text.top < viewportHeight * 1.5
    group.code = /^(CODE|PRE|KBD|SAMP)$/.test(text.element.tagName)
    const key = [
      group.family,
      group.size,
      group.weight,
      group.italic,
      group.transform,
      group.color,
      group.background,
      group.heading,
      group.chrome,
      group.hero,
      group.code,
      group.caps,
      group.onImage
    ].join('|')
    const existing = groups.get(key)
    if (existing === undefined) groups.set(key, group)
    else existing.chars += group.chars
  }

  // Buttons near the top. The visible fill can sit on the element, a covering child, a pseudo-element,
  // or a same-size wrapper around an invisible link.
  const ctaPattern =
    /get started|start|sign ?up|try|buy|shop|download|join|book|contact|request|demo|free|subscribe|order|explore|create|open account|apply|discover|learn more|watch|play|install/i
  const buttons: Array<ProbeButton & { score: number }> = []
  for (const element of queryAll(
    'a, button, [role="button"], input[type="submit"], input[type="button"]'
  )) {
    if (!(element instanceof HTMLElement)) continue
    const rect = element.getBoundingClientRect()
    if (
      rect.top + scrollTop > viewportHeight * 2.5 ||
      rect.width < 40 ||
      rect.width > 480 ||
      rect.height < 24 ||
      rect.height > 90 ||
      !isShown(element)
    )
      continue
    const label = (
      element.innerText ||
      (element instanceof HTMLInputElement ? element.value : '') ||
      element.getAttribute('aria-label') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
    // Skip links are filled buttons that show only on keyboard focus.
    if (label.length < 1 || label.length > 40 || skipLink.test(label)) continue
    // Where the label sits: a fill layer behind it is the button's fill, an icon beside it is not.
    const labelWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let labelNode = labelWalker.nextNode()
    while (labelNode !== null && (labelNode.textContent ?? '').trim().length === 0)
      labelNode = labelWalker.nextNode()
    const labelRange = document.createRange()
    if (labelNode !== null) labelRange.selectNodeContents(labelNode)
    const labelBox = labelNode === null ? rect : labelRange.getBoundingClientRect()
    const labelX = labelBox.left + labelBox.width / 2
    const labelY = labelBox.top + labelBox.height / 2
    const covers = (layer: Element): boolean => {
      const layerRect = layer.getBoundingClientRect()
      const width = Math.min(layerRect.right, rect.right) - Math.max(layerRect.left, rect.left)
      const height = Math.min(layerRect.bottom, rect.bottom) - Math.max(layerRect.top, rect.top)
      const share = width > 0 && height > 0 ? (width * height) / (rect.width * rect.height) : 0
      // A fill layer inside a padded link can be smaller than the link's box, as long as the label
      // sits on it.
      const underLabel =
        labelX >= layerRect.left &&
        labelX <= layerRect.right &&
        labelY >= layerRect.top &&
        labelY <= layerRect.bottom
      return (share >= 0.75 || (share >= 0.5 && underLabel)) && isShown(layer)
    }
    const opaque = (style: CSSStyleDeclaration): Rgba | null => {
      const fill =
        gradientStops(style).find((stop) => stop[3] >= 0.9) ?? toRgba(style.backgroundColor)
      return fill !== null && fill[3] >= 0.5 ? fill : null
    }
    let style = getComputedStyle(element)
    let fill = opaque(style)
    for (const child of [...element.querySelectorAll('*')].slice(0, 12)) {
      const childFill = covers(child) ? opaque(getComputedStyle(child)) : null
      if (childFill !== null) {
        style = getComputedStyle(child)
        fill = childFill
      }
    }
    for (
      let wrapper = element.parentElement, level = 0;
      fill === null && wrapper !== null && level < 3;
      wrapper = wrapper.parentElement, level++
    ) {
      const wrapperRect = wrapper.getBoundingClientRect()
      if (
        Math.abs(wrapperRect.width - rect.width) > rect.width * 0.2 ||
        Math.abs(wrapperRect.height - rect.height) > rect.height * 0.3
      )
        break
      for (const layer of [wrapper, ...wrapper.querySelectorAll('*')].slice(0, 16)) {
        const layerFill =
          layer === element || element.contains(layer) || !covers(layer)
            ? null
            : opaque(getComputedStyle(layer))
        if (layerFill !== null) {
          style = getComputedStyle(layer)
          fill = layerFill
          break
        }
      }
    }
    // A pseudo-element fill counts when it is drawn: hover fills often wait at scale 0 or opacity 0.
    const drawn = (pseudoStyle: CSSStyleDeclaration): boolean => {
      const matrix = /matrix\(([^)]+)\)/.exec(pseudoStyle.transform)?.[1]?.split(',').map(Number)
      const collapsed =
        matrix !== undefined &&
        Math.abs((matrix[0] ?? 1) * (matrix[3] ?? 1) - (matrix[1] ?? 0) * (matrix[2] ?? 0)) < 0.25
      const width = parseFloat(pseudoStyle.width)
      const height = parseFloat(pseudoStyle.height)
      return (
        !collapsed &&
        Number(pseudoStyle.opacity) > 0.1 &&
        pseudoStyle.visibility !== 'hidden' &&
        !(Number.isFinite(width) && width < rect.width * 0.5) &&
        !(Number.isFinite(height) && height < rect.height * 0.5)
      )
    }
    for (const pseudo of fill === null ? ['::before', '::after'] : []) {
      const pseudoStyle = getComputedStyle(element, pseudo)
      const pseudoFill =
        pseudoStyle.content === 'none' || !drawn(pseudoStyle) ? null : opaque(pseudoStyle)
      if (pseudoFill !== null && fill === null) {
        style = pseudoStyle
        fill = pseudoFill
      }
    }
    const around = pointPaint(
      rect.left > 12 ? rect.left - 8 : rect.right + 8,
      rect.top + scrollTop + rect.height / 2
    )
    const behind = around.rgb
    const filledColor = fill === null ? null : blend(fill, behind)
    // Over a photo the color behind is unknown, and an opaque fill stands out from it.
    const filled =
      filledColor !== null &&
      (distance(filledColor, behind) > 18 || (around.image && fill !== null && fill[3] >= 0.9))
    const borderWidth = parseFloat(style.borderTopWidth) || 0
    const borderColor = toRgba(style.borderTopColor)
    const border =
      borderWidth >= 1 &&
      borderColor !== null &&
      borderColor[3] >= 0.2 &&
      style.borderTopStyle !== 'none'
        ? `${Math.round(borderWidth)}px ${style.borderTopStyle} ${hexOf(borderColor)}`
        : null
    if (
      !filled &&
      !(
        border !== null &&
        borderColor !== null &&
        borderColor[3] >= 0.4 &&
        distance(blend(borderColor, behind), behind) > 30
      )
    )
      continue
    // The label style comes from the largest visible text inside, or from the wrapper's visible text.
    let labelElement: Element = element
    let labelChars = 0
    for (const scope of [element, element.parentElement?.parentElement ?? element]) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement
        const chars = (node.textContent ?? '').trim().length
        const box = parent?.getBoundingClientRect()
        if (
          parent === null ||
          box === undefined ||
          chars <= labelChars ||
          box.width <= 2 ||
          !isShown(parent)
        )
          continue
        const centerX = box.left + box.width / 2
        const centerY = box.top + box.height / 2
        if (
          centerX < rect.left ||
          centerX > rect.right ||
          centerY < rect.top ||
          centerY > rect.bottom
        )
          continue
        labelElement = parent
        labelChars = chars
      }
      if (labelChars > 0) break
    }
    const surface = filled && filledColor !== null ? filledColor : behind
    const font = textGroup(
      getComputedStyle(labelElement),
      blend(toRgba(getComputedStyle(labelElement).color) ?? [0, 0, 0, 1], surface),
      surface,
      label,
      label.length
    )
    const inChrome = isChrome(element)
    buttons.push({
      text: label.slice(0, 30),
      style: filled ? 'filled' : 'outline',
      background: filled && filledColor !== null ? hexOf(filledColor) : null,
      color: font.color,
      border,
      radius: Math.round(parseFloat(style.borderTopLeftRadius) || 0),
      height: Math.round(rect.height),
      shadow: shadowText(style.boxShadow),
      inChrome,
      font,
      score:
        (filled ? 4 : 1) +
        (ctaPattern.test(label) ? 3 : 0) +
        (inChrome ? 0 : 1) +
        ((filled && filledColor !== null && isColorful(filledColor)) ||
        (!filled && borderColor !== null && isColorful(borderColor))
          ? 3
          : 0) +
        Math.min(2, (rect.width * rect.height) / 5000) -
        // Buttons further down still show the style, but the first screen's call to action leads.
        (rect.top + scrollTop > viewportHeight * 1.5 ? 3 : 0)
    })
  }
  buttons.sort((left, right) => right.score - left.score)

  // Custom properties as the page resolves them, which covers tokens from cross-origin stylesheets.
  const skippedToken =
    /^--(tw-|swiper|toastify|rsbs|onetrust|ot-|cc-|cky|fa-|wp--preset--(gradient|font|spacing|shadow)|chakra-(ring|shadow)|radix-|vaul|sonner|react-|lenis|plyr|ck-|intercom|hs-|drift|reach-|mantine-(?!color-(primary|brand))|bs-(?!primary|secondary|body|link|emphasis))/i
  const paletteToken =
    /^--(color-)?(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-\d{2,3}$/i
  const tokens: Array<{ name: string; hex: string }> = []
  const bodyStyle = getComputedStyle(document.body)
  for (let index = 0; index < bodyStyle.length && tokens.length < 300; index++) {
    const name = bodyStyle[index] ?? ''
    if (!name.startsWith('--') || skippedToken.test(name) || paletteToken.test(name)) continue
    const value = bodyStyle.getPropertyValue(name).trim()
    let rgba: Rgba | null = null
    if (/^\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*,\s*|\s+)\d{1,3}$/.test(value))
      rgba = toRgba(`rgb(${value.split(/[\s,]+/).join(',')})`)
    else if (/^\d+(\.\d+)?(deg)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(value))
      rgba = toRgba(`hsl(${value})`)
    else if (/^(#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(value) && value.length <= 60)
      rgba = toRgba(value)
    if (rgba !== null && rgba[3] >= 0.5) tokens.push({ name, hex: hexOf(rgba) })
  }

  // Imagery: large photos, background images, inline illustrations, and video posters.
  const images: Array<ProbeImage & { score: number }> = []
  const seenUrls = new Set<string>()
  const imageRadii: Record<string, number> = {}
  let illustrations = 0
  // Customer, partner, and press logo walls are rows of small images of one height, or sit in a
  // container named for them; they are not the brand's imagery.
  const wallLabel = /logo|customer|client|partner|sponsor|trusted|press|marquee|investor/i
  const inWall = (element: Element, rect: DOMRect): boolean => {
    if (rect.height > 200) return false
    const center = rect.top + rect.height / 2
    const neighbors = imageElements.filter(
      (other) =>
        other.element !== element &&
        Math.abs(other.rect.top + other.rect.height / 2 - center) < 10 &&
        Math.abs(other.rect.height / rect.height - 1) < 0.35
    ).length
    if (rect.height <= 120 && neighbors >= 3) return true
    let node = element.parentElement
    for (let depth = 0; node !== null && depth < 6; depth++, node = node.parentElement)
      if (
        wallLabel.test(
          `${node.id} ${node.getAttribute('class') ?? ''} ${node.getAttribute('aria-label') ?? ''}`
        )
      )
        return true
    return false
  }
  for (const { element, rect, style } of [...imageElements, ...revealImages.slice(0, 12)]) {
    const top = rect.top + scrollTop
    const area = rect.width * rect.height
    if (element instanceof HTMLImageElement && rect.width >= 200) {
      const parent = element.parentElement
      let radius = parseFloat(style.borderTopLeftRadius) || 0
      if (
        radius === 0 &&
        parent !== null &&
        getComputedStyle(parent).overflow !== 'visible' &&
        Math.abs(parent.getBoundingClientRect().width - rect.width) < 8
      )
        radius = parseFloat(getComputedStyle(parent).borderTopLeftRadius) || 0
      count(imageRadii, String(Math.round(radius)))
    }
    if (logoElement !== null && (logoElement.contains(element) || element.contains(logoElement)))
      continue
    if (closestAcross(element, 'header, nav, button, [role="banner"]') !== null && area < 150000)
      continue
    if (
      /logo|avatar|icon|badge|flag|emoji|sprite|pixel|spacer|tracking|placeholder/i.test(
        labelOf(element)
      ) &&
      area < 120000
    )
      continue
    if (inWall(element, rect)) continue
    // Thin strips (ad banners, dividers, marquees) are not imagery a design can use.
    if (rect.width / rect.height > 6 || rect.height / rect.width > 6) continue
    let entry: ProbeImage | null = null
    if (element instanceof HTMLImageElement) {
      const url =
        rect.width >= 100 &&
        rect.height >= 80 &&
        !(element.naturalWidth > 0 && element.naturalWidth < 60)
          ? imageUrl(element)
          : null
      if (url !== null)
        entry = {
          kind: 'img',
          url,
          width: element.naturalWidth || Math.round(rect.width),
          height: element.naturalHeight || Math.round(rect.height),
          top: Math.round(top)
        }
    } else if (element instanceof HTMLVideoElement) {
      const url = absolute(element.getAttribute('poster'))
      if (url !== null)
        entry = {
          kind: 'poster',
          url,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(top)
        }
    } else if (element instanceof SVGSVGElement) {
      if (
        area < 40000 ||
        illustrations >= 2 ||
        element.querySelectorAll('path, circle, rect, ellipse, polygon').length < 10
      )
        continue
      const serialized = await serializeSvg(element, null)
      if (serialized.markup.length > 300000) continue
      illustrations++
      entry = {
        kind: 'svg',
        svg: serialized.markup,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(top)
      }
    } else if (!/^(CANVAS|IFRAME|PICTURE)$/.test(element.tagName)) {
      const url = absolute(cssUrls(style.backgroundImage)[0])
      if (url !== null && area >= 60000)
        entry = {
          kind: 'background',
          url,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(top)
        }
    }
    const key = entry?.url ?? `svg-${images.length}`
    if (entry === null || seenUrls.has(key)) continue
    seenUrls.add(key)
    // Textures, noise, particles, masks, and placeholders are decorative layers that look blank on
    // their own; they go last, so they are saved only when the page has little else.
    const file = decodeURIComponent((entry.url ?? '').split(/[?#]/)[0]?.split('/').pop() ?? '')
    const decorative =
      /noise|texture|grain|particle|pattern|grid|placeholder|lazy|empty|overlay|mask|glow|gradient|blur|shadow|swoosh|signature|(^|[-_ .])bg([-_ .\d]|$)/i.test(
        file
      )
    images.push({
      ...entry,
      score:
        Math.min(area, 1200000) *
        (top < viewportHeight ? 1.6 : top < viewportHeight * 2 ? 1.2 : 1) *
        (decorative ? 0.01 : 1)
    })
  }
  images.sort((left, right) => right.score - left.score)

  // Font faces from every readable stylesheet (including @import and @layer/@media blocks) for the
  // families the page renders; cross-origin sheets are read in Node.
  const usedFamilies = new Set<string>(
    [...groups.values()].map((group) => group.family.toLowerCase())
  )
  for (const button of buttons) usedFamilies.add(button.font.family.toLowerCase())
  for (const logo of logos) if (logo.font !== undefined) usedFamilies.add(logo.font.toLowerCase())
  const fontFaces: ProbeFace[] = []
  const localFamilies = new Set<string>()
  const unreadableStylesheets: string[] = []
  const pickSource = (src: string, base: string): string | null => {
    let best: string | null = null
    let bestRank = -1
    for (const match of src.matchAll(
      /url\(\s*(["']?)([^"')]+)\1\s*\)(?:\s*format\(\s*["']?([\w-]+)["']?\s*\))?/g
    )) {
      const url = match[2] ?? ''
      const format = (match[3] ?? '').toLowerCase()
      // Bundlers inline small fonts as data: URLs; those are kept (they need no download).
      const inline = url.startsWith('data:')
      if (
        url.length === 0 ||
        (inline && (!/^data:(font|application)\//i.test(url) || url.length > 700000))
      )
        continue
      const rank =
        format.startsWith('woff2') || /\.woff2(\?|#|$)/i.test(url) || /^data:[^,]*woff2/i.test(url)
          ? 3
          : format === 'woff' || /\.woff(\?|#|$)/i.test(url) || /^data:[^,]*woff/i.test(url)
            ? 2
            : /truetype|opentype/.test(format) || /\.(ttf|otf)(\?|#|$)/i.test(url)
              ? 1
              : 0
      if (rank > bestRank) {
        best = url
        bestRank = rank
      }
    }
    try {
      return best === null ? null : new URL(best, base).toString()
    } catch {
      return null
    }
  }
  const visitSheet = (sheet: CSSStyleSheet, depth: number): void => {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      if (sheet.href !== null && unreadableStylesheets.length < 80)
        unreadableStylesheets.push(sheet.href)
      return
    }
    const visitRules = (list: CSSRuleList): void => {
      for (const rule of list) {
        if (rule instanceof CSSImportRule) {
          if (rule.styleSheet !== null && depth < 4) visitSheet(rule.styleSheet, depth + 1)
        } else if (rule instanceof CSSFontFaceRule) {
          const family = unquote(rule.style.getPropertyValue('font-family'))
          const url = usedFamilies.has(family.toLowerCase())
            ? pickSource(rule.style.getPropertyValue('src'), sheet.href ?? location.href)
            : null
          const unicodeRange = rule.style.getPropertyValue('unicode-range').trim()
          if (
            url === null &&
            usedFamilies.has(family.toLowerCase()) &&
            /local\(/.test(rule.style.getPropertyValue('src'))
          )
            localFamilies.add(family)
          if (url !== null)
            fontFaces.push({
              family,
              weight: rule.style.getPropertyValue('font-weight').trim() || '400',
              style: rule.style.getPropertyValue('font-style').trim() || 'normal',
              url,
              ...(unicodeRange.length > 0 ? { unicodeRange } : {})
            })
        } else if ('cssRules' in rule && rule.cssRules instanceof CSSRuleList) {
          visitRules(rule.cssRules)
        }
      }
    }
    visitRules(rules)
  }
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets])
    visitSheet(sheet, 0)

  const themeHints: string[] = []
  for (const element of [document.documentElement, document.body]) {
    const classMatch = (element.getAttribute('class') ?? '').match(
      /\b(dark|light)(-mode|-theme)?\b/i
    )
    if (classMatch !== null) themeHints.push(`${element.tagName.toLowerCase()}.${classMatch[0]}`)
    for (const attribute of ['data-theme', 'data-color-scheme', 'data-mode']) {
      const value = element.getAttribute(attribute)
      if (value !== null) themeHints.push(`${attribute}=${value}`)
    }
  }
  const themeColor = meta('meta[name="theme-color"]')
  const themeRgba = themeColor === null ? null : toRgba(themeColor)
  mark('measured')

  const probe: BrandProbe = {
    url: location.href,
    title: document.title,
    description: meta('meta[name="description"]') ?? meta('meta[property="og:description"]'),
    blocked: null,
    viewport: { width: viewportWidth, height: viewportHeight },
    pageHeight,
    hidden,
    themeHints,
    themeColor: themeRgba === null ? null : hexOf(themeRgba),
    canvas: hexOf(canvasRgb),
    backgrounds: shares(backgroundCounts, sampledColor),
    colorfulArea: shares(colorfulCounts, sampled),
    bands,
    text: [...groups.values()].sort((left, right) => right.chars - left.chars).slice(0, 150),
    buttons: buttons.slice(0, 10).map(({ score: _score, ...button }) => button),
    tokens,
    cards,
    imageRadii,
    media: imageElements
      .filter(
        ({ element, rect }) =>
          element.tagName !== 'svg' &&
          element.tagName !== 'CANVAS' &&
          rect.width >= 120 &&
          rect.height >= 90 &&
          rect.width * rect.height >= 20000 &&
          (logoElement === null || !logoElement.contains(element))
      )
      .map(({ element, rect }) => {
        const fixed = fixedAncestor(element)
        return [
          rect.left,
          fixed ? rect.top : rect.top + scrollTop,
          rect.width,
          rect.height,
          fixed ? 1 : 0
        ].map(Math.round)
      })
      .sort((left, right) => (right[2] ?? 0) * (right[3] ?? 0) - (left[2] ?? 0) * (left[3] ?? 0))
      .slice(0, 80),
    canvasCover:
      Math.round(
        Math.min(
          1,
          imageElements
            .filter(({ element }) => element.tagName === 'CANVAS')
            .reduce((sum, { rect }) => {
              const width = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
              const height = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
              return sum + Math.max(0, width) * Math.max(0, height)
            }, 0) /
            (viewportWidth * viewportHeight)
        ) * 100
      ) / 100,
    logos,
    logoCandidates: candidates.slice(0, 4).map((candidate) => {
      const rect = candidate.element.getBoundingClientRect()
      return {
        label: `${candidate.element.tagName.toLowerCase()} ${labelOf(candidate.element)}`
          .replace(/\s+/g, ' ')
          .slice(0, 70),
        score: candidate.score,
        box: [rect.left, rect.top, rect.width, rect.height].map(Math.round).join(','),
        ...(candidate.empty === true ? { empty: true } : {})
      }
    }),
    images: images.slice(0, 10).map(({ score: _score, ...image }) => image),
    icons: [
      ...document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]'
      )
    ]
      .map((link) => ({
        url: absolute(link.getAttribute('href')) ?? '',
        rel: link.rel,
        sizes: link.getAttribute('sizes') ?? '',
        type: link.type
      }))
      .filter((icon) => icon.url.length > 0)
      .slice(0, 10),
    ogImage: absolute(
      meta('meta[property="og:image"]') ??
        meta('meta[name="og:image"]') ??
        meta('meta[name="twitter:image"]') ??
        meta('meta[property="twitter:image"]')
    ),
    fontFaces: fontFaces.slice(0, 300),
    localFamilies: [...localFamilies],
    fontResources: performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter(
        (name) => /\.(woff2?|ttf|otf)(\?|#|$)/i.test(name) || /typekit|fonts\.gstatic/i.test(name)
      )
      .slice(0, 30),
    unreadableStylesheets,
    timings
  }
  return JSON.stringify(probe)
}
