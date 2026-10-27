import { isValidArtifactId } from './ids.js'
import type { ExportArtifactInput, ExportArtifactResult } from './types.js'

declare const oi: {
  internal: {
    exportArtifact(input: ExportArtifactInput): Promise<ExportArtifactResult>
  }
}

const SUPPORTED_TARGETS = new Set(['png', 'pdf'])

export async function exportArtifact(input: ExportArtifactInput): Promise<ExportArtifactResult> {
  validateExportArtifactInput(input)
  return oi.internal.exportArtifact(input)
}

function validateExportArtifactInput(input: ExportArtifactInput): void {
  validateArtifactId(input.artifactId)

  if (input.targets.length === 0) {
    throw new Error('At least one export target is required')
  }

  for (const target of input.targets) {
    if (!SUPPORTED_TARGETS.has(target)) {
      throw new Error(`Unsupported export target: ${target}`)
    }
  }
}

function validateArtifactId(artifactId: string): void {
  if (!isValidArtifactId(artifactId)) {
    throw new Error(`Malformed visual artifact id: ${artifactId}`)
  }
}
