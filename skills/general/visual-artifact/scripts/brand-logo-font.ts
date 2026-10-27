// Logos with live text (a wordmark set in the brand font, or a mark next to text) are saved as SVG
// with <text>. An SVG used as an image cannot load fonts from the page, so the brand font file is
// embedded in the logo itself and it renders the same anywhere.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { cleanFamily } from './brand-type.js'

const MAX_EMBEDDED_BYTES = 400 * 1024

interface InstalledFace {
  family: string
  weight: string
  style: string
  file: string
}

async function installedFaces(root: string): Promise<InstalledFace[]> {
  let css = ''
  try {
    css = await readFile(path.join(root, 'styles', 'fonts.css'), 'utf8')
  } catch {
    return []
  }
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => {
    const body = match[1] ?? ''
    const read = (name: string): string =>
      body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim() ?? ''
    return {
      family: read('font-family').replace(/^["']|["']$/g, ''),
      weight: read('font-weight') || '400',
      style: read('font-style') || 'normal',
      file: path.resolve(root, 'styles', read('src').match(/url\("?([^")]+)"?\)/)?.[1] ?? '')
    }
  })
    // Only files the skill installed are embedded; a family name can come from the page.
    .filter((face) => face.file.startsWith(path.join(root, 'fonts') + path.sep))
}

function weightGap(faceWeight: string, wanted: number): number {
  const values = faceWeight
    .split(/\s+/)
    .map((part) => (part === 'normal' ? 400 : part === 'bold' ? 700 : Number(part)))
    .filter((value) => Number.isFinite(value))
  const low = values[0] ?? 400
  const high = values[1] ?? low
  return wanted >= low && wanted <= high
    ? 0
    : Math.min(Math.abs(wanted - low), Math.abs(wanted - high))
}

/** Embeds the installed brand font used by each <text> of the logo files. */
export async function embedLogoFonts(root: string, files: readonly string[]): Promise<void> {
  const faces = await installedFaces(root)
  if (faces.length === 0) return
  for (const file of files) {
    if (!file.endsWith('.svg')) continue
    let markup = await readFile(file, 'utf8')
    if (!/<text[\s>]/.test(markup)) continue
    const wanted = new Map<string, InstalledFace>()
    // The page's family stack becomes the installed family name, for each <text> style.
    markup = markup.replace(
      /font-family:([^;"]+);font-size:([^;"]+);font-weight:(\d+);font-style:(\w+)/g,
      (whole: string, stack: string, size: string, weight: string, style: string) => {
        const names = stack.split(',').map((name) => cleanFamily(name.trim().replace(/^'|'$/g, '')))
        const family = names.find((name) =>
          faces.some((face) => face.family.toLowerCase() === name.toLowerCase())
        )
        if (family === undefined) return whole
        const candidates = faces.filter(
          (face) => face.family.toLowerCase() === family.toLowerCase()
        )
        const italic = style !== 'normal'
        const sameStyle = candidates.filter((face) => (face.style !== 'normal') === italic)
        const best = [...(sameStyle.length > 0 ? sameStyle : candidates)].sort(
          (left, right) =>
            weightGap(left.weight, Number(weight)) - weightGap(right.weight, Number(weight))
        )[0]
        if (best !== undefined) wanted.set(best.file, best)
        return `font-family:'${family}';font-size:${size};font-weight:${weight};font-style:${style}`
      }
    )
    const rules: string[] = []
    let total = 0
    for (const face of wanted.values()) {
      try {
        const bytes = await readFile(face.file)
        total += bytes.byteLength
        if (total > MAX_EMBEDDED_BYTES) break
        const format = face.file.endsWith('.woff2')
          ? 'woff2'
          : face.file.endsWith('.woff')
            ? 'woff'
            : face.file.endsWith('.otf')
              ? 'opentype'
              : 'truetype'
        rules.push(
          `@font-face{font-family:'${face.family}';font-weight:${face.weight};font-style:${face.style};src:url(data:font/${format};base64,${bytes.toString('base64')}) format('${format}')}`
        )
      } catch {
        continue
      }
    }
    if (rules.length === 0) continue
    // One <style> right inside the outermost <svg> covers nested and recolored copies.
    markup = markup.replace(/<svg\b[^>]*>/i, (tag) => `${tag}<style>${rules.join('')}</style>`)
    await writeFile(file, markup, 'utf8')
  }
}
