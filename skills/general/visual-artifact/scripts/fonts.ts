import { createHash } from 'node:crypto'
import { lookup as lookupHost } from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { type IncomingMessage, request as requestHttp } from 'node:http'
import { request as requestHttps } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

import { resolveArtifactRoot } from './session.js'
import type { InstallGoogleFontsInput, InstallGoogleFontsResult } from './types.js'

// Google Fonts serves woff2 only to browsers it recognizes.
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const KEPT_SUBSETS = new Set(['latin', 'latin-ext'])
const FETCH_TIMEOUT_MS = 15_000
const MAX_FONT_BYTES = 4 * 1024 * 1024
const MAX_CSS_BYTES = 8 * 1024 * 1024
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export interface FontFaceSource {
  family: string
  weight: string
  style: string
  url: string
  unicodeRange?: string
  subset?: string
}

export interface DownloadedFontFace extends FontFaceSource {
  fileName: string
}

export type SniffedFileType =
  | 'woff2'
  | 'woff'
  | 'ttf'
  | 'otf'
  | 'png'
  | 'jpg'
  | 'gif'
  | 'webp'
  | 'avif'
  | 'svg'
  | 'ico'
  | 'other'

/**
 * Downloads Google Fonts families into the artifact and registers them in `styles/fonts.css`,
 * which the scaffolded `styles/root.css` already imports.
 */
export async function installGoogleFonts(
  input: InstallGoogleFontsInput
): Promise<InstallGoogleFontsResult> {
  const root = resolveArtifactRoot(input.artifactId)
  const installed: InstallGoogleFontsResult['installed'] = []
  const failed: InstallGoogleFontsResult['failed'] = []

  // Families download together; styles/fonts.css is then written once per family in turn, since
  // concurrent read-modify-write of one file drops blocks.
  const downloads = await Promise.all(
    input.families.map(async (spec) => {
      try {
        const faces = await loadGoogleFontFaces(spec)
        const files = await downloadFontFaces(root, faces, { 'User-Agent': BROWSER_USER_AGENT })
        return { family: files[0]?.family ?? spec, files }
      } catch (error) {
        failed.push({
          family: spec,
          reason: error instanceof Error ? error.message : String(error)
        })
        return null
      }
    })
  )
  for (const download of downloads) {
    if (download === null) continue
    await writeFontFaceBlock(root, `google ${download.family}`, download.files)
    installed.push({ family: download.family, files: download.files.length })
  }

  return { installed, failed, css: 'styles/fonts.css' }
}

async function loadGoogleFontFaces(spec: string): Promise<FontFaceSource[]> {
  const family = spec.split(':')[0]?.trim() ?? ''
  if (family.length === 0) {
    throw new Error('Font family name is required')
  }
  const urlFor = (candidate: string): string =>
    `https://fonts.googleapis.com/css2?family=${candidate.trim().replace(/ /g, '+')}&display=swap`
  const request = async (candidate: string): Promise<FontFaceSource[] | null> => {
    const url = urlFor(candidate)
    const response = await fetchPublicFile(url, { 'User-Agent': BROWSER_USER_AGENT })
    if (!response.ok) return null
    const css = await readCapped(response, MAX_CSS_BYTES)
    if (css === null) return null
    const faces = parseFontFaceCss(css.toString('utf8'), url).filter(
      (face) => face.subset === undefined || KEPT_SUBSETS.has(face.subset)
    )
    return faces.length > 0 ? faces : null
  }
  const exists = async (candidate: string): Promise<boolean> => {
    const response = await fetchPublicFile(urlFor(candidate), {
      'User-Agent': BROWSER_USER_AGENT
    }).catch(() => null)
    await response?.body?.cancel().catch(() => undefined)
    return response?.ok === true
  }

  if (spec.includes(':')) {
    const faces = await request(spec)
    if (faces !== null) return faces
    throw new Error(`Google Fonts has no "${spec}"`)
  }
  // A bare family name only returns weight 400, so the full variable range is asked for first.
  for (const candidate of [`${family}:ital,wght@0,100..900;1,100..900`, `${family}:wght@100..900`]) {
    const faces = await request(candidate)
    if (faces !== null) return faces
  }
  // Static families and variable ones with a narrower range reject 100..900, and one missing
  // weight fails a whole request, so each weight is tried on its own and the ones Google has are
  // asked for together, with italics where the family has them.
  const weights = (
    await Promise.all(WEIGHTS.map(async (weight) => ((await exists(`${family}:wght@${weight}`)) ? weight : null)))
  ).filter((weight): weight is number => weight !== null)
  if (weights.length > 0) {
    const italics = (
      await Promise.all(
        weights.map(async (weight) => ((await exists(`${family}:ital,wght@1,${weight}`)) ? weight : null))
      )
    ).filter((weight): weight is number => weight !== null)
    const faces = await request(
      italics.length > 0
        ? `${family}:ital,wght@${[...weights.map((weight) => `0,${weight}`), ...italics.map((weight) => `1,${weight}`)].join(';')}`
        : `${family}:wght@${weights.join(';')}`
    )
    if (faces !== null) return faces
  }
  const faces = await request(family)
  if (faces !== null) return faces

  throw new Error(`Google Fonts has no family named "${family}"`)
}

/**
 * Parses `@font-face` blocks and keeps the best source of each: woff2, then woff, then
 * TrueType/OpenType. Sources are ranked by their `format()` hint as well as their extension,
 * because CDNs such as Adobe Fonts serve files from URLs without one.
 */
export function parseFontFaceCss(css: string, baseUrl: string): FontFaceSource[] {
  const faces: FontFaceSource[] = []
  const blockPattern = /(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?@font-face\s*{([^}]*)}/gi

  for (const match of css.matchAll(blockPattern)) {
    const subset = match[1]
    const body = match[2] ?? ''
    const family = readDeclaration(body, 'font-family')?.replace(/^["']|["']$/g, '')
    const src = readDeclaration(body, 'src')
    if (family === undefined || src === undefined) {
      continue
    }

    const preferred = pickFontSource(src)
    if (preferred === null) {
      continue
    }

    let url: string
    try {
      url = new URL(preferred, baseUrl).toString()
    } catch {
      continue
    }

    const unicodeRange = readDeclaration(body, 'unicode-range')
    faces.push({
      family,
      weight: readDeclaration(body, 'font-weight') ?? '400',
      style: readDeclaration(body, 'font-style') ?? 'normal',
      url,
      ...(unicodeRange !== undefined ? { unicodeRange } : {}),
      ...(subset !== undefined ? { subset } : {})
    })
  }

  return faces
}

/** Returns the absolute URLs of `@import` rules, so a stylesheet's imports can be read too. */
export function parseCssImports(css: string, baseUrl: string): string[] {
  const imports: string[] = []
  for (const match of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?[^;]*;/gi)) {
    try {
      imports.push(new URL(match[1] ?? '', baseUrl).toString())
    } catch {
      continue
    }
  }
  return imports
}

function pickFontSource(src: string): string | null {
  let best: string | null = null
  let bestRank = -1
  for (const match of src.matchAll(
    /url\(\s*(["']?)([^"')]+)\1\s*\)(?:\s*format\(\s*["']?([\w-]+)["']?\s*\))?/g
  )) {
    const url = match[2] ?? ''
    const format = (match[3] ?? '').toLowerCase()
    const inline = url.startsWith('data:')
    if (url.length === 0 || (inline && !/^data:(font|application)\//i.test(url))) continue
    let rank = 0
    if (format.startsWith('woff2') || /\.woff2(\?|#|$)/i.test(url) || /^data:[^,]*woff2/i.test(url))
      rank = 3
    else if (format === 'woff' || /\.woff(\?|#|$)/i.test(url) || /^data:[^,]*woff/i.test(url))
      rank = 2
    else if (/truetype|opentype/.test(format) || /\.(ttf|otf)(\?|#|$)/i.test(url)) rank = 1
    if (rank > bestRank) {
      best = url
      bestRank = rank
    }
  }
  return best
}

function readDeclaration(body: string, property: string): string | undefined {
  // A url() can hold semicolons (data:font/woff2;base64,...), so it is read as one piece.
  const match = body.match(
    new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*((?:url\\([^)]*\\)|[^;])+)`, 'i')
  )
  const value = match?.[1]?.trim()
  return value === undefined || value.length === 0 ? undefined : value
}

/**
 * Downloads each face into `fonts/`. Only real font files are kept: a CDN that answers with an
 * HTML error page does not end up in `styles/fonts.css`. Faces that Node cannot download are
 * handed to `fallback` (inspectBrand fetches them through the page). Faces that fail are skipped;
 * all failing is an error.
 */
export async function downloadFontFaces(
  root: string,
  faces: readonly FontFaceSource[],
  headers: Record<string, string>,
  fallback?: (urls: string[]) => Promise<Map<string, Buffer>>
): Promise<DownloadedFontFace[]> {
  const fontsDirectory = path.join(root, 'fonts')
  await mkdir(fontsDirectory, { recursive: true })

  const isFont = (bytes: Buffer): boolean =>
    ['woff2', 'woff', 'ttf', 'otf'].includes(sniffFileType(bytes)) &&
    bytes.byteLength <= MAX_FONT_BYTES
  const fetched = await Promise.all(
    faces.map(async (face): Promise<Buffer | null> => {
      try {
        // One retry covers a dropped connection; an HTTP error is final.
        const response = await fetchPublicFile(face.url, headers).catch(() =>
          fetchPublicFile(face.url, headers)
        )
        if (!response.ok) return null
        const bytes = await readCapped(response, MAX_FONT_BYTES)
        return bytes !== null && isFont(bytes) ? bytes : null
      } catch {
        return null
      }
    })
  )
  const missing = faces.filter((_face, index) => fetched[index] === null).map((face) => face.url)
  const recovered = fallback !== undefined && missing.length > 0 ? await fallback(missing) : null

  const downloaded = await Promise.all(
    faces.map(async (face, index): Promise<DownloadedFontFace | null> => {
      const bytes = fetched[index] ?? recovered?.get(face.url) ?? null
      if (bytes === null || !isFont(bytes)) return null
      // Named by content, so a later install of the same family cannot overwrite these files.
      const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 10)
      const fileName = `${slug(face.family)}-${slug(face.weight)}-${slug(face.style)}-${digest}.${sniffFileType(bytes)}`
      await writeFile(path.join(fontsDirectory, fileName), bytes)
      return { ...face, fileName }
    })
  )

  const files = downloaded.filter((face): face is DownloadedFontFace => face !== null)
  if (files.length === 0) {
    throw new Error('No font files could be downloaded')
  }
  return files
}

/** Replaces this source's block in `styles/fonts.css`, so installing twice stays idempotent. */
export async function writeFontFaceBlock(
  root: string,
  sourceTag: string,
  faces: readonly DownloadedFontFace[]
): Promise<void> {
  const cssPath = path.join(root, 'styles', 'fonts.css')
  await mkdir(path.dirname(cssPath), { recursive: true })
  let existing = ''
  try {
    existing = await readFile(cssPath, 'utf8')
  } catch {
    existing = ''
  }

  const start = `/* fonts: ${sourceTag} */`
  const end = `/* end fonts: ${sourceTag} */`
  const rules = faces.map((face) =>
    [
      '@font-face {',
      // Family names come from the page's CSS; quotes, braces, and semicolons would break out.
      `  font-family: "${face.family.replace(/["\\;{}<>]/g, '')}";`,
      `  src: url("../fonts/${face.fileName}") format("${formatFor(face.fileName)}");`,
      `  font-weight: ${face.weight};`,
      `  font-style: ${face.style};`,
      ...(face.unicodeRange !== undefined ? [`  unicode-range: ${face.unicodeRange};`] : []),
      '  font-display: swap;',
      '}'
    ].join('\n')
  )
  const block = [start, ...rules, end].join('\n')

  const startIndex = existing.indexOf(start)
  const endIndex = existing.indexOf(end)
  const next =
    startIndex !== -1 && endIndex > startIndex
      ? `${existing.slice(0, startIndex)}${block}${existing.slice(endIndex + end.length)}`
      : `${existing.trimEnd()}\n\n${block}\n`

  await writeFile(cssPath, next.trimStart(), 'utf8')
}

/** Identifies a downloaded file by its first bytes instead of trusting the URL or headers. */
export function sniffFileType(bytes: Buffer): SniffedFileType {
  const ascii = bytes.subarray(0, 16).toString('latin1')
  if (ascii.startsWith('wOF2')) return 'woff2'
  if (ascii.startsWith('wOFF')) return 'woff'
  if (ascii.startsWith('OTTO')) return 'otf'
  if (ascii.startsWith('\u0000\u0001\u0000\u0000') || ascii.startsWith('true')) return 'ttf'
  if (ascii.startsWith('\u0089PNG')) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (ascii.startsWith('GIF8')) return 'gif'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp'
  if (ascii.slice(4, 8) === 'ftyp' && /avi[fs]/.test(ascii.slice(8, 12))) return 'avif'
  if (ascii.startsWith('\u0000\u0000\u0001\u0000')) return 'ico'
  const head = bytes
    .subarray(0, 1024)
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    return 'svg'
  }
  return 'other'
}

function formatFor(fileName: string): string {
  if (fileName.endsWith('.woff2')) return 'woff2'
  if (fileName.endsWith('.woff')) return 'woff'
  if (fileName.endsWith('.otf')) return 'opentype'
  return 'truetype'
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Reads a response body, or returns null once it passes maxBytes. The content-length header
 * cannot be trusted to bound it, since chunked responses have none.
 */
export async function readCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (response.body === null) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return Buffer.concat(chunks)
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(Buffer.from(value))
  }
}

// Addresses on this machine and on private networks. The sandbox fetches files that a web page
// names, and unlike the page it is not held to the browser's private-network rules, so without this
// a page could reach a router, a local dev server, or an intranet host through the user's machine.
const PRIVATE_ADDRESSES = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3]
] as const)
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv4')
for (const [network, prefix] of [
  ['::', 127],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const)
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv6')

/** Whether an IP address is on this machine or a private network; anything unparseable counts. */
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]
  if (mapped !== undefined) return PRIVATE_ADDRESSES.check(mapped, 'ipv4')
  const family = isIP(address)
  if (family === 0) return true
  return PRIVATE_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

// Checked on the address each connection actually uses, so a public name that resolves to a
// private address, even only on a later lookup, is refused too.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookupHost(hostname, { ...options, all: true }, (error, addresses) => {
    if (error !== null) {
      callback(error, '', 0)
      return
    }
    const first = addresses[0]
    if (first === undefined || addresses.some((entry) => isPrivateAddress(entry.address))) {
      callback(
        Object.assign(new Error(`${hostname} is a local or private network address`), {
          code: 'EPRIVATEADDRESS'
        }),
        '',
        0
      )
      return
    }
    if (options.all === true) callback(null, addresses)
    else callback(null, first.address, first.family)
  })
}

function requestOnce(
  url: URL,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? requestHttps : requestHttp
    // The headers fetch sends by default; CDNs such as Akamai stall requests without them.
    const defaults = {
      Accept: '*/*',
      'Accept-Language': '*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Mode': 'cors'
    }
    const request = send(
      url,
      { headers: { ...defaults, ...headers }, signal, lookup: publicLookup },
      resolve
    )
    request.on('error', reject)
    request.end()
  })
}

function toResponse(message: IncomingMessage): Response {
  const status = message.statusCode ?? 502
  const headers = new Headers()
  for (const [name, value] of Object.entries(message.headers))
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  if (status < 200 || status > 599 || status === 204 || status === 205 || status === 304) {
    message.resume()
    return new Response(null, { status: status < 200 || status > 599 ? 502 : status, headers })
  }
  // Some CDNs compress even when not asked, and fetch would have decoded the body; the byte limits
  // of the callers then apply to the decoded bytes.
  const encoding = (message.headers['content-encoding'] ?? '').trim().toLowerCase()
  const source: Readable =
    encoding === 'gzip' || encoding === 'x-gzip'
      ? message.pipe(createGunzip())
      : encoding === 'deflate'
        ? message.pipe(createInflate())
        : encoding === 'br'
          ? message.pipe(createBrotliDecompress())
          : message
  // Events can still arrive after the reader cancels, and a closed stream throws on them.
  let finished = false
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const fail = (error: Error): void => {
        if (finished) return
        finished = true
        controller.error(error)
      }
      source.on('data', (chunk: Buffer) => {
        if (finished) return
        controller.enqueue(new Uint8Array(chunk))
        if ((controller.desiredSize ?? 1) <= 0) source.pause()
      })
      source.on('end', () => {
        if (finished) return
        finished = true
        controller.close()
      })
      source.on('error', fail)
      if (source !== message) message.on('error', fail)
    },
    pull() {
      source.resume()
    },
    cancel() {
      finished = true
      source.destroy()
      message.destroy()
    }
  })
  return new Response(body, { status, headers })
}

/**
 * Fetches a file a web page named. Only http and https to public addresses are allowed, checked on
 * every redirect and on the address each connection uses.
 */
export async function fetchPublicFile(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs)
  let current = new URL(url)
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:')
      throw new Error(`Only http and https can be fetched, not ${current.protocol}`)
    // A literal IP address needs no lookup, so it is checked here.
    const host = current.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) !== 0 && isPrivateAddress(host))
      throw new Error(`${host} is a local or private network address`)
    // Behind the sandbox's egress proxy, the proxy decides which hosts are reachable.
    if (
      [process.env.HTTPS_PROXY, process.env.HTTP_PROXY, process.env.https_proxy, process.env.http_proxy].some(
        (value) => value !== undefined && value !== ''
      )
    )
      return fetch(current, { headers, signal })
    const message = await requestOnce(current, headers, signal)
    const location = message.headers.location
    if ([301, 302, 303, 307, 308].includes(message.statusCode ?? 0) && location !== undefined) {
      message.resume()
      current = new URL(location, current)
      continue
    }
    return toResponse(message)
  }
  throw new Error('Too many redirects')
}
