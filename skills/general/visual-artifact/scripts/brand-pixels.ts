// Reads the saved screenshots back through the page to measure what is actually painted. The DOM
// says which colors are declared; the pixels say how much of each the visitor sees, including
// canvas and WebGL drawing, and they separate the brand's own chrome from its photography.
import { readFile } from 'node:fs/promises'

import { deltaE, hexToLab, type Lab, rgbToHex, rgbToLab } from './brand-color-math.js'
import type { BrandProbe } from './brand-probe.js'
import type { BrandTab } from './brand-screenshots.js'

export interface PixelColor {
  hex: string
  /** Percent of the counted pixels. */
  share: number
}

export interface PagePixels {
  /** Everything outside photos and video: backgrounds, type, buttons, drawings, canvas. */
  chrome: PixelColor[]
  /** Tones of the photography and video. */
  imagery: PixelColor[]
  /** Percent of all sampled pixels that are photos or video. */
  imageryShare: number
  /** Percent of chrome pixels within a perceptual distance of a color. */
  share(hex: string, tolerance?: number): number
  /** Percent of all pixels, photos included, within a perceptual distance: is it on screen at all. */
  visible(hex: string, tolerance?: number): number
}

interface Bin {
  lab: Lab
  count: number
  rgb: [number, number, number]
}

// Runs in the page: decodes each screenshot, samples it at 480 pixels wide, and counts colors in
// 32 steps per channel, separately inside and outside the photo rectangles (fixed ones stay at
// their viewport position on every screen).
const SAMPLE_CODE = `
const decode = async (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return createImageBitmap(new Blob([bytes]));
};
const count = (bins, data, mask, keep) => {
  let total = 0;
  for (let pixel = 0, offset = 0; offset < data.length; pixel++, offset += 4) {
    if (mask[pixel] !== keep) continue;
    const key = ((data[offset] >> 3) << 10) | ((data[offset + 1] >> 3) << 5) | (data[offset + 2] >> 3);
    let bin = bins.get(key);
    if (bin === undefined) { bin = [0, 0, 0, 0]; bins.set(key, bin); }
    bin[0]++; bin[1] += data[offset]; bin[2] += data[offset + 1]; bin[3] += data[offset + 2];
    total++;
  }
  return total;
};
const top = (bins, limit) => [...bins.values()].sort((a, b) => b[0] - a[0]).slice(0, limit)
  .map((bin) => [bin[0], Math.round(bin[1] / bin[0]), Math.round(bin[2] / bin[0]), Math.round(bin[3] / bin[0])]);
const chrome = new Map(), photo = new Map();
let chromeTotal = 0, photoTotal = 0;
for (const shot of input.shots) {
  let bitmap;
  try { bitmap = await decode(shot.data); } catch (error) { continue; }
  const width = 480;
  const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const scale = width / input.viewportWidth;
  const mask = new Uint8Array(width * height);
  for (const [left, rectTop, rectWidth, rectHeight, fixed] of input.media) {
    const offset = fixed === 1 ? 0 : shot.top;
    const x0 = Math.max(0, Math.floor(left * scale)), x1 = Math.min(width, Math.ceil((left + rectWidth) * scale));
    const y0 = Math.max(0, Math.floor((rectTop - offset) * scale)), y1 = Math.min(height, Math.ceil((rectTop - offset + rectHeight) * scale));
    for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + Math.max(x0, x1));
  }
  chromeTotal += count(chrome, data, mask, 0);
  photoTotal += count(photo, data, mask, 1);
}
return JSON.stringify({ chrome: top(chrome, 1500), chromeTotal, photo: top(photo, 800), photoTotal });
`

type RawBin = [number, number, number, number]

function toBins(raw: RawBin[]): Bin[] {
  return raw.map(([count, red, green, blue]) => ({
    count,
    rgb: [red, green, blue],
    lab: rgbToLab([red, green, blue])
  }))
}

/** Groups similar bins (Delta E under 6) into colors, largest first. */
function cluster(bins: Bin[], total: number, limit: number): PixelColor[] {
  const clusters: Array<{ lab: Lab; count: number; sum: [number, number, number] }> = []
  for (const bin of bins) {
    const near = clusters.find((entry) => deltaE(entry.lab, bin.lab) < 6)
    if (near !== undefined) {
      near.count += bin.count
      near.sum = [
        near.sum[0] + bin.rgb[0] * bin.count,
        near.sum[1] + bin.rgb[1] * bin.count,
        near.sum[2] + bin.rgb[2] * bin.count
      ]
    } else
      clusters.push({
        lab: bin.lab,
        count: bin.count,
        sum: [bin.rgb[0] * bin.count, bin.rgb[1] * bin.count, bin.rgb[2] * bin.count]
      })
  }
  return clusters
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((entry) => ({
      hex: rgbToHex([
        entry.sum[0] / entry.count,
        entry.sum[1] / entry.count,
        entry.sum[2] / entry.count
      ]),
      share: Math.round((entry.count / (total || 1)) * 10000) / 100
    }))
}

/** The raw color counts from the page, kept in probe.json so the summary can be recomputed. */
export interface PixelSample {
  chrome: RawBin[]
  chromeTotal: number
  photo: RawBin[]
  photoTotal: number
}

/**
 * Samples the saved screens in the page. Returns null when nothing could be decoded, so callers
 * fall back to the DOM measurements alone.
 */
export async function samplePagePixels(
  tab: BrandTab,
  probe: BrandProbe,
  screens: string[]
): Promise<PixelSample | null> {
  const shots: Array<{ data: string; top: number }> = []
  for (const file of screens) {
    const band = Number(/screen-(\d+)\./.exec(file)?.[1] ?? '1') - 1
    const bytes = await readFile(file).catch(() => null)
    if (bytes !== null)
      shots.push({
        data: bytes.toString('base64'),
        top: Math.min(
          band * probe.viewport.height,
          Math.max(0, probe.pageHeight - probe.viewport.height)
        )
      })
  }
  if (shots.length === 0) return null
  const input = { shots, media: probe.media, viewportWidth: probe.viewport.width }
  try {
    const result = await tab.execute(`const input = ${JSON.stringify(input)};${SAMPLE_CODE}`)
    if (typeof result !== 'string') return null
    const sample: PixelSample = JSON.parse(result)
    return sample.chromeTotal + sample.photoTotal > 0 ? sample : null
  } catch {
    return null
  }
}

/** Percent of the bins' pixels within a perceptual distance of a color. */
function shareOf(bins: Bin[], total: number, hex: string, tolerance: number): number {
  const target = hexToLab(hex)
  const matched = bins
    .filter((bin) => deltaE(bin.lab, target) < tolerance)
    .reduce((sum, bin) => sum + bin.count, 0)
  return (matched / (total || 1)) * 100
}

/** Palettes and a color lookup from the page's pixel counts. */
export function pagePixels(sample: PixelSample): PagePixels {
  const chromeBins = toBins(sample.chrome)
  const photoBins = toBins(sample.photo)
  const allBins = [...chromeBins, ...photoBins]
  return {
    // The largest bins are enough for the palette; share() looks at every bin.
    chrome: cluster(chromeBins.slice(0, 300), sample.chromeTotal, 12),
    imagery: cluster(photoBins.slice(0, 300), sample.photoTotal, 6),
    imageryShare:
      Math.round((sample.photoTotal / (sample.chromeTotal + sample.photoTotal)) * 1000) / 10,
    share: (hex: string, tolerance = 8): number =>
      shareOf(chromeBins, sample.chromeTotal, hex, tolerance),
    visible: (hex: string, tolerance = 8): number =>
      shareOf(allBins, sample.chromeTotal + sample.photoTotal, hex, tolerance)
  }
}
