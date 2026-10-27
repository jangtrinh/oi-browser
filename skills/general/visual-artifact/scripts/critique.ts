import { isValidArtifactId } from './ids.js'
import type { CritiqueArtifactInput, CritiqueArtifactResult } from './types.js'

declare const oi: {
  internal: {
    critiqueArtifact(input: RequiredCritiqueArtifactInput): Promise<CritiqueArtifactResult>
  }
}

type RequiredCritiqueArtifactInput = CritiqueArtifactInput & {
  includeVision: boolean
}

export async function critiqueArtifact(
  input: CritiqueArtifactInput
): Promise<CritiqueArtifactResult> {
  const normalizedInput = normalizeCritiqueArtifactInput(input)
  return oi.internal.critiqueArtifact(normalizedInput)
}

function normalizeCritiqueArtifactInput(
  input: CritiqueArtifactInput
): RequiredCritiqueArtifactInput {
  validateArtifactId(input.artifactId)

  if (input.includeVision !== undefined && typeof input.includeVision !== 'boolean') {
    throw new Error('includeVision must be a boolean when provided')
  }

  for (const target of input.exportTargets ?? []) {
    if (target !== 'png' && target !== 'pdf') {
      throw new Error(`Unsupported export target: ${target}`)
    }
  }

  return {
    artifactId: input.artifactId,
    includeVision: input.includeVision ?? false,
    ...(input.exportTargets !== undefined && input.exportTargets.length > 0
      ? { exportTargets: input.exportTargets }
      : {})
  }
}

function validateArtifactId(artifactId: string): void {
  if (!isValidArtifactId(artifactId)) {
    throw new Error(`Malformed visual artifact id: ${artifactId}`)
  }
}
