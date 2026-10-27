// Color math shared by the color roles and the screenshot pixels: sRGB, contrast, CIELAB, and
// perceptual distance (CIEDE2000), so "the same color" means the same thing everywhere.

export type Rgb = [number, number, number]
export type Lab = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ]
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function linear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map(linear)
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

export function contrast(first: string, second: string): number {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function rgbToLab([red, green, blue]: Rgb): Lab {
  const r = linear(red)
  const g = linear(green)
  const b = linear(blue)
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex))
}

/** CIELAB chroma: how colored a color looks, independent of how light it is. */
export function labChroma(hex: string): number {
  const [, a, b] = hexToLab(hex)
  return Math.hypot(a, b)
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180

/** CIEDE2000 color difference: under about 5 reads as the same neutral, under 10 the same hue. */
export function deltaE(first: Lab, second: Lab): number {
  const [L1, a1, b1] = first
  const [L2, a2, b2] = second
  const meanC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1 = Math.hypot(a1p, b1)
  const C2 = Math.hypot(a2p, b2)
  const h1 = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360
  const h2 = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360
  let dh = 0
  if (C1 * C2 !== 0)
    dh = Math.abs(h2 - h1) <= 180 ? h2 - h1 : h2 > h1 ? h2 - h1 - 360 : h2 - h1 + 360
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(radians(dh / 2))
  const meanL = (L1 + L2) / 2
  const meanCp = (C1 + C2) / 2
  let meanH = h1 + h2
  if (C1 * C2 !== 0)
    meanH =
      Math.abs(h1 - h2) <= 180
        ? (h1 + h2) / 2
        : h1 + h2 < 360
          ? (h1 + h2 + 360) / 2
          : (h1 + h2 - 360) / 2
  const T =
    1 -
    0.17 * Math.cos(radians(meanH - 30)) +
    0.24 * Math.cos(radians(2 * meanH)) +
    0.32 * Math.cos(radians(3 * meanH + 6)) -
    0.2 * Math.cos(radians(4 * meanH - 63))
  const theta = 30 * Math.exp(-(((meanH - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2)
  const Sc = 1 + 0.045 * meanCp
  const Sh = 1 + 0.015 * meanCp * T
  const Rt = -Math.sin(radians(2 * theta)) * Rc
  const l = (L2 - L1) / Sl
  const c = (C2 - C1) / Sc
  const h = dH / Sh
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h)
}

export function hexDeltaE(first: string, second: string): number {
  return deltaE(hexToLab(first), hexToLab(second))
}
