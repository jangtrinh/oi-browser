export interface CreateArtifactInput {
  title: string
  width: number
  height: number
  preset?: string
  multiFrame?: boolean
}

export interface CreateArtifactResult {
  artifactId: string
  root: string
}

export interface CritiqueArtifactInput {
  artifactId: string
  includeVision?: boolean
  exportTargets?: ExportArtifactTarget[]
}

export interface CritiqueFinding {
  source: 'deterministic' | 'render' | 'visual_qa'
  severity: 'error' | 'warning' | 'info'
  frame?: string
  message: string
  suggestion?: string
}

export interface CritiqueArtifactResult {
  verdict: 'ship' | 'revise'
  findings: CritiqueFinding[]
  contactSheet?: string
  exports?: GeneratedArtifact[]
}

export type ExportArtifactTarget = 'png' | 'pdf'

export interface ExportArtifactInput {
  artifactId: string
  targets: ExportArtifactTarget[]
}

export interface GeneratedArtifact {
  target: ExportArtifactTarget
  frame?: string
  path: string
  mimeType: string
  pages?: number
  pageSize?: string
}

export interface ExportArtifactResult {
  artifacts: GeneratedArtifact[]
}

export interface SessionEnvironment {
  sessionId: string
  sessionsDir: string
  rootFsBasePath: string
}

export interface BuildFrameSkeletonInput {
  title: string
}

export interface InspectBrandInput {
  artifactId: string
  url: string
}

export type Confidence = 'high' | 'medium' | 'low'

/** How far each color role can be trusted; low means look at the screenshots before using it. */
export interface ColorConfidence {
  background: Confidence
  text: Confidence
  accents: Confidence
  cta: Confidence
}

/**
 * Candidates for each uncertain color role, best guess first, as "#hex where it was seen" (for
 * example "#0f766e cta x6, logo 38%"); an accents entry starting with "none" means no accent color.
 */
export interface ColorCheck {
  background?: string[]
  text?: string[]
  accents?: string[]
  cta?: string[]
}

export interface BrandColors {
  background: string
  hero?: string
  surface: string | null
  inverse?: string
  text: string
  muted: string | null
  accents: string[]
  cta: string | null
  tokens: Record<string, string>
  /** Brand-named tokens the page never paints, as "name #hex"; not brand colors on this page. */
  unpainted?: string[]
  /** Dominant tones of the photography and video, when they fill much of the page. */
  imagery?: string[]
  confidence: ColorConfidence
  /** Present when a role is low (accents: low or medium); settle each against the screenshots. */
  check?: ColorCheck
}

export interface BrandFont {
  family: string
  roles: string[]
  status: 'installed' | 'failed' | 'not-found' | 'system'
  weights?: string[]
  source?: 'google' | 'adobe'
  substitute?: string
}

export interface BrandShape {
  button: string | null
  card: string | null
  image: string | null
}

export interface BrandLogo {
  onLight?: string
  onDark?: string
  derived?: 'onLight' | 'onDark'
  text?: string
  icon?: string
}

export interface InspectBrandResult {
  tabId: string
  root: string
  source: { url: string; title: string }
  theme: 'light' | 'dark'
  colors: BrandColors
  type: Record<string, string>
  fonts: BrandFont[]
  shape: BrandShape
  logo: BrandLogo
  images: string[]
  screenshots: { attached: string[]; saved: string[] }
  probe: string
  notes: string[]
}

export interface InstallGoogleFontsInput {
  artifactId: string
  families: string[]
}

export interface InstallGoogleFontsResult {
  installed: Array<{ family: string; files: number }>
  failed: Array<{ family: string; reason: string }>
  css: string
}
