const ARTIFACT_ID_PATTERN = /^[a-z]+-[a-z]+-[a-z]+$/

export function isValidArtifactId(artifactId: string): boolean {
  return ARTIFACT_ID_PATTERN.test(artifactId)
}
