import path from 'node:path'

import { isValidArtifactId } from './ids.js'
import type { SessionEnvironment } from './types.js'

export function readSessionEnvironment(): SessionEnvironment {
  const sessionId = process.env.SESSION_ID
  const sessionsDir = process.env.SESSIONS_DIR

  if (!sessionId) {
    throw new Error('SESSION_ID is required to create a visual artifact')
  }

  if (!sessionsDir) {
    throw new Error('SESSIONS_DIR is required to create a visual artifact')
  }

  const rootFsBasePath = getRootSessionId(sessionId)

  if (!rootFsBasePath) {
    throw new Error('SESSION_ID does not contain a root session id')
  }

  if (!isSafeRelativePath(rootFsBasePath)) {
    throw new Error('SESSION_ID root session path is malformed')
  }

  return {
    sessionId,
    sessionsDir,
    rootFsBasePath
  }
}

export function getRootSessionId(sessionId: string): string {
  const [rootFsBasePath] = sessionId.split('/agents/')

  if (!rootFsBasePath) {
    throw new Error('SESSION_ID does not contain a root session id')
  }

  if (!isSafeRelativePath(rootFsBasePath)) {
    throw new Error('SESSION_ID root session path is malformed')
  }

  return rootFsBasePath
}

export function getVisualArtifactsRoot(environment: SessionEnvironment): string {
  const sessionsRoot = path.resolve(environment.sessionsDir)
  const rootArtifactsDirectory = path.resolve(
    sessionsRoot,
    environment.rootFsBasePath,
    'visual-artifacts'
  )

  if (!isPathInside(sessionsRoot, rootArtifactsDirectory)) {
    throw new Error('Resolved visual artifacts directory escapes SESSIONS_DIR')
  }

  return rootArtifactsDirectory
}

export function resolveArtifactRoot(artifactId: string): string {
  if (!isValidArtifactId(artifactId)) {
    throw new Error(`Malformed visual artifact id: ${artifactId}`)
  }

  const rootArtifactsDirectory = getVisualArtifactsRoot(readSessionEnvironment())
  const artifactDirectory = path.resolve(rootArtifactsDirectory, artifactId)

  if (!isPathInside(rootArtifactsDirectory, artifactDirectory)) {
    throw new Error('Resolved visual artifact directory escapes the visual artifacts root')
  }

  return artifactDirectory
}

export function isPathInside(parentDirectory: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentDirectory, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function isSafeRelativePath(candidatePath: string): boolean {
  if (
    candidatePath.length === 0 ||
    path.isAbsolute(candidatePath) ||
    candidatePath.includes('\\')
  ) {
    return false
  }

  return candidatePath
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}
