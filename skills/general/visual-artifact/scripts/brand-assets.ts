// Brand files on disk: the logo (with a variant for the other background when there is one),
// imagery, the OG image, and the app icon. Every download is checked by its first bytes, so an HTML
// error page never lands as an image.
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { hexToRgb } from './brand-color-math.js'
import type { PageFetch } from './brand-fetch.js'
import type { BrandProbe, ProbeLogo } from './brand-probe.js'
import { fetchPublicFile, readCapped, sniffFileType } from './fonts.js'

const MAX_IMAGES = 6
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'

export interface SavedLogo {
  onLight?: string
  onDark?: string
  derived?: 'onLight' | 'onDark'
  text?: string
  icon?: string
  colors: string[]
}

const IMAGE_TYPES = new Set(['png', 'jpg', 'gif', 'webp', 'avif', 'svg', 'ico'])

/** Pixel size from the file header (PNG, GIF, JPEG, WebP, AVIF), or null when it cannot be read. */
function imageSize(bytes: Buffer): { width: number; height: number } | null {
  try {
    const type = sniffFileType(bytes)
    if (type === 'png') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    if (type === 'gif') return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
    if (type === 'jpg') {
      for (let offset = 2; offset + 9 < bytes.length; ) {
        if (bytes[offset] !== 0xff) return null
        const marker = bytes[offset + 1] ?? 0
        const length = bytes.readUInt16BE(offset + 2)
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        )
          return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) }
        offset += 2 + length
      }
      return null
    }
    if (type === 'webp') {
      const chunk = bytes.toString('latin1', 12, 16)
      if (chunk === 'VP8X')
        return {
          width: 1 + (bytes.readUIntLE(24, 3) & 0xffffff),
          height: 1 + (bytes.readUIntLE(27, 3) & 0xffffff)
        }
      if (chunk === 'VP8L') {
        const bits = bytes.readUInt32LE(21)
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }
      }
      if (chunk === 'VP8 ')
        return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }
      return null
    }
    if (type === 'avif') {
      const at = bytes.indexOf('ispe', 0, 'latin1')
      return at < 0
        ? null
        : { width: bytes.readUInt32BE(at + 8), height: bytes.readUInt32BE(at + 12) }
    }
    return null
  } catch {
    return null
  }
}

async function writeImage(
  bytes: Buffer,
  basePath: string,
  minimumSide = 0
): Promise<string | null> {
  const type = sniffFileType(bytes)
  if (bytes.byteLength < 200 || bytes.byteLength > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(type))
    return null
  // Spacer pixels and tiny icons are not imagery.
  const size = minimumSide > 0 ? imageSize(bytes) : null
  if (size !== null && Math.min(size.width, size.height) < minimumSide) return null
  await writeFile(`${basePath}.${type}`, type === 'svg' ? stripActiveSvg(bytes) : bytes)
  return `${basePath}.${type}`
}

/**
 * A downloaded SVG loses what could run if it were inlined into a frame: scripts, foreignObject,
 * event handlers, and javascript: links. Repeated until nothing changes, so a tag rebuilt from
 * the pieces of a removed one is caught too.
 */
function stripActiveSvg(bytes: Buffer): Buffer {
  let markup = bytes.toString('utf8')
  for (let previous = ''; previous !== markup; ) {
    previous = markup
    markup = markup
      .replace(/<script\b[\s\S]*?(?:<\/script\s*>|\/>)/gi, '')
      .replace(/<foreignObject\b[\s\S]*?(?:<\/foreignObject\s*>|\/>)/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(?:xlink:)?href\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
  }
  return Buffer.from(markup, 'utf8')
}

async function fetchImage(url: string, headers: Record<string, string>): Promise<Buffer | null> {
  try {
    const response = await fetchPublicFile(url, { ...headers, Accept: IMAGE_ACCEPT }, 8_000)
    if (!response.ok || Number(response.headers.get('content-length') ?? '0') > MAX_IMAGE_BYTES)
      return null
    const bytes = await readCapped(response, MAX_IMAGE_BYTES)
    return bytes !== null && IMAGE_TYPES.has(sniffFileType(bytes)) ? bytes : null
  } catch {
    return null
  }
}

/**
 * Downloads images in parallel; the ones Node is refused are fetched through the page in one
 * round trip. Returns the saved path (or null) for each entry, in order.
 */
async function downloadImages(
  entries: ReadonlyArray<{ url: string; basePath: string; minimumSide?: number }>,
  headers: Record<string, string>,
  fetchInPage?: PageFetch
): Promise<Array<string | null>> {
  const fetched = await Promise.all(entries.map((entry) => fetchImage(entry.url, headers)))
  const missing = entries.filter((_entry, index) => fetched[index] === null)
  const recovered =
    fetchInPage !== undefined && missing.length > 0
      ? await fetchInPage(missing.map((entry) => entry.url))
      : null
  return Promise.all(
    entries.map((entry, index) => {
      const bytes = fetched[index] ?? recovered?.get(entry.url) ?? null
      return bytes === null ? null : writeImage(bytes, entry.basePath, entry.minimumSide)
    })
  )
}

/** Saves the largest images near the top, inline illustrations, and the OG image. */
export async function saveImages(
  directory: string,
  probe: BrandProbe,
  headers: Record<string, string>,
  fetchInPage?: PageFetch
): Promise<Array<{ file: string; label: string }>> {
  const saved: Array<{ file: string; label: string } | null> = []
  const downloads: Array<{
    url: string
    basePath: string
    minimumSide?: number
    slot: number
    label: string
  }> = []
  for (const [index, image] of probe.images.slice(0, MAX_IMAGES).entries()) {
    const size = `${image.width}x${image.height}`
    if (image.kind === 'svg' && image.svg !== undefined) {
      const file = path.join(directory, `illustration-${index + 1}.svg`)
      await writeFile(file, image.svg, 'utf8')
      saved.push({ file, label: `${size} illustration` })
      continue
    }
    saved.push(null)
    if (image.url !== undefined)
      downloads.push({
        url: image.url,
        basePath: path.join(directory, `image-${index + 1}`),
        minimumSide: 100,
        slot: saved.length - 1,
        label: image.kind === 'img' ? size : `${size} ${image.kind}`
      })
  }
  if (probe.ogImage !== null) {
    saved.push(null)
    downloads.push({
      url: probe.ogImage,
      basePath: path.join(directory, 'og-image'),
      slot: saved.length - 1,
      label: 'og'
    })
  }
  const files = await downloadImages(downloads, headers, fetchInPage)
  downloads.forEach((entry, index) => {
    const file = files[index]
    if (file !== null && file !== undefined) saved[entry.slot] = { file, label: entry.label }
  })
  return saved.filter((result): result is { file: string; label: string } => result !== null)
}

function svgColors(markup: string): string[] {
  return [
    ...markup.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)
  ].map((match) => {
    const value = (match[1] ?? '').toLowerCase()
    return value.length === 3
      ? `#${[...value].map((digit) => digit + digit).join('')}`
      : `#${value}`
  })
}

async function saveLogo(
  logo: ProbeLogo,
  basePath: string,
  headers: Record<string, string>,
  fetchInPage?: PageFetch
): Promise<string | null> {
  if (logo.kind === 'svg' && logo.svg !== undefined && logo.svg.length > 0) {
    await writeFile(`${basePath}.svg`, logo.svg, 'utf8')
    return `${basePath}.svg`
  }
  if (logo.kind !== 'image' || logo.url === undefined) return null
  const [saved = null] = await downloadImages([{ url: logo.url, basePath }], headers, fetchInPage)
  if (saved !== null && logo.mask !== undefined) {
    // A mask logo is its image's shape in the element's color.
    const width = Math.round(logo.width * 100) / 100
    const height = Math.round(logo.height * 100) / 100
    const image = `<image width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="${dataUrl(await readFile(saved))}"/>`
    await writeFile(`${basePath}.svg`, recolored(image, width, height, logo.mask), 'utf8')
    if (saved !== `${basePath}.svg`) await rm(saved, { force: true })
    return `${basePath}.svg`
  }
  if (saved === null || logo.crop === undefined) return saved
  // A CSS sprite becomes a standalone SVG that shows only the logo's part of the sheet.
  const crop = logo.crop
  const bytes = await readFile(saved)
  await writeFile(
    `${basePath}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${crop.width}" height="${crop.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}"><image width="${crop.imageWidth}" height="${crop.imageHeight}" preserveAspectRatio="none" href="${dataUrl(bytes)}" xlink:href="${dataUrl(bytes)}"/></svg>`,
    'utf8'
  )
  if (saved !== `${basePath}.svg`) await rm(saved, { force: true })
  return `${basePath}.svg`
}

function dataUrl(bytes: Buffer): string {
  const type = sniffFileType(bytes)
  const mime = type === 'svg' ? 'image/svg+xml' : type === 'jpg' ? 'image/jpeg' : `image/${type}`
  return `data:${mime};base64,${bytes.toString('base64')}`
}

/**
 * A one-color mark in another color. The whole drawing is flooded with the color through its own
 * alpha, which works however the file spells its colors (currentColor, classes, sprites, rasters).
 */
function recolored(content: string, width: number, height: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="oi-recolor" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><g filter="url(#oi-recolor)">${content}</g></svg>`
}

/**
 * Saves the logo under the background it is drawn for, a real variant for the other background
 * when the page has one (hidden theme twin, dark-mode <picture> source, footer logo), otherwise a
 * recolored copy of a one-color mark. Also saves the best app icon.
 */
export async function saveLogos(
  directory: string,
  probe: BrandProbe,
  text: string,
  headers: Record<string, string>,
  fetchInPage?: PageFetch
): Promise<SavedLogo> {
  const result: SavedLogo = { colors: [] }
  const slot = (ink: 'dark' | 'light'): 'onLight' | 'onDark' =>
    ink === 'dark' ? 'onLight' : 'onDark'
  const [primary, ...alternates] = probe.logos
  if (primary !== undefined) {
    if (primary.text !== undefined) result.text = primary.text
    const file = await saveLogo(primary, path.join(directory, 'logo'), headers, fetchInPage)
    if (file !== null) result[slot(primary.ink)] = file
    // The rendered colors are what the page shows; markup colors are the fallback.
    result.colors =
      primary.palette !== undefined && primary.palette.length > 0
        ? primary.palette.filter((entry) => entry.share >= 0.03).map((entry) => entry.hex)
        : primary.kind === 'svg'
          ? primary.colors
          : file !== null && file.endsWith('.svg') && primary.crop === undefined
            ? svgColors(await readFile(file, 'utf8'))
            : []
    for (const alternate of alternates) {
      const target = slot(alternate.ink)
      if (result[target] !== undefined) continue
      const alternateFile = await saveLogo(
        alternate,
        path.join(directory, target === 'onDark' ? 'logo-on-dark' : 'logo-on-light'),
        headers,
        fetchInPage
      )
      if (alternateFile !== null) result[target] = alternateFile
    }
    const missing = primary.ink === 'dark' ? 'onDark' : 'onLight'
    const [top] = primary.palette ?? []
    const oneColor =
      primary.palette !== undefined
        ? top !== undefined && top.share >= 0.9
        : new Set(primary.colors).size === 1
    if (file !== null && oneColor && result[missing] === undefined && primary.width > 0) {
      // White for dark backgrounds, the darkest page color for light ones.
      const brightness = (hex: string): number =>
        hexToRgb(hex).reduce((sum, channel) => sum + channel, 0)
      const darkest =
        [text, probe.canvas, '#111111'].sort(
          (left, right) => brightness(left) - brightness(right)
        )[0] ?? '#111111'
      const width = Math.round(primary.width * 100) / 100
      const height = Math.round(primary.height * 100) / 100
      // Marks serialized from the page are sized to the logo box; downloaded files keep their own
      // size, so they are placed as an image that scales into the box.
      const content =
        primary.kind === 'svg'
          ? (await readFile(file, 'utf8')).replace(/<\?xml[^>]*>/i, '')
          : `<image width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="${dataUrl(await readFile(file))}"/>`
      const reversed = path.join(
        directory,
        missing === 'onDark' ? 'logo-on-dark.svg' : 'logo-on-light.svg'
      )
      await writeFile(
        reversed,
        recolored(content, width, height, primary.ink === 'dark' ? '#ffffff' : darkest),
        'utf8'
      )
      result[missing] = reversed
      result.derived = missing
    }
  }
  const iconScore = (icon: BrandProbe['icons'][number]): number => {
    const size = Number(icon.sizes.split('x')[0]) || 0
    if (/apple-touch-icon/i.test(icon.rel)) return 1000 + size
    if (/svg/i.test(icon.type) || /\.svg(\?|$)/i.test(icon.url))
      return icon.rel.includes('mask') ? 100 : 900
    return size
  }
  // Icon links often point at files that are gone or refused, so the best of each kind is a
  // candidate: touch icon, SVG, other icons, then /favicon.ico; the page fetches them if Node cannot.
  const kindOf = (icon: BrandProbe['icons'][number]): number =>
    /apple-touch-icon/i.test(icon.rel)
      ? 0
      : /svg/i.test(icon.type) || /\.svg(\?|$)/i.test(icon.url)
        ? 1
        : 2
  const ranked = [...probe.icons].sort((left, right) => iconScore(right) - iconScore(left))
  const iconUrls = [
    ...new Set(
      [0, 1, 2]
        .map((kind) => ranked.find((icon) => kindOf(icon) === kind)?.url)
        .filter((url): url is string => url !== undefined)
        .concat(new URL('/favicon.ico', probe.url).toString())
    )
  ]
  // All candidates are fetched at once; the best one that arrives is kept.
  const fetchedIcons = await Promise.all(iconUrls.map((url) => fetchImage(url, headers)))
  let iconBytes = fetchedIcons.find((bytes): bytes is Buffer => bytes !== null) ?? null
  if (iconBytes === null && fetchInPage !== undefined) {
    const fetched = await fetchInPage(iconUrls)
    iconBytes = iconUrls.map((url) => fetched.get(url)).find((bytes) => bytes !== undefined) ?? null
  }
  if (iconBytes !== null) {
    const iconFile = await writeImage(iconBytes, path.join(directory, 'icon'))
    if (iconFile !== null) result.icon = iconFile
  }
  return result
}
