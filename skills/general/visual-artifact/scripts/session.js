"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSessionEnvironment = readSessionEnvironment;
exports.getRootSessionId = getRootSessionId;
exports.getVisualArtifactsRoot = getVisualArtifactsRoot;
exports.resolveArtifactRoot = resolveArtifactRoot;
exports.isPathInside = isPathInside;
const node_path_1 = __importDefault(require("node:path"));
const ids_js_1 = require("./ids.js");
function readSessionEnvironment() {
    const sessionId = process.env.SESSION_ID;
    const sessionsDir = process.env.SESSIONS_DIR;
    if (!sessionId) {
        throw new Error('SESSION_ID is required to create a visual artifact');
    }
    if (!sessionsDir) {
        throw new Error('SESSIONS_DIR is required to create a visual artifact');
    }
    const rootFsBasePath = getRootSessionId(sessionId);
    if (!rootFsBasePath) {
        throw new Error('SESSION_ID does not contain a root session id');
    }
    if (!isSafeRelativePath(rootFsBasePath)) {
        throw new Error('SESSION_ID root session path is malformed');
    }
    return {
        sessionId,
        sessionsDir,
        rootFsBasePath
    };
}
function getRootSessionId(sessionId) {
    const [rootFsBasePath] = sessionId.split('/agents/');
    if (!rootFsBasePath) {
        throw new Error('SESSION_ID does not contain a root session id');
    }
    if (!isSafeRelativePath(rootFsBasePath)) {
        throw new Error('SESSION_ID root session path is malformed');
    }
    return rootFsBasePath;
}
function getVisualArtifactsRoot(environment) {
    const sessionsRoot = node_path_1.default.resolve(environment.sessionsDir);
    const rootArtifactsDirectory = node_path_1.default.resolve(sessionsRoot, environment.rootFsBasePath, 'visual-artifacts');
    if (!isPathInside(sessionsRoot, rootArtifactsDirectory)) {
        throw new Error('Resolved visual artifacts directory escapes SESSIONS_DIR');
    }
    return rootArtifactsDirectory;
}
function resolveArtifactRoot(artifactId) {
    if (!(0, ids_js_1.isValidArtifactId)(artifactId)) {
        throw new Error(`Malformed visual artifact id: ${artifactId}`);
    }
    const rootArtifactsDirectory = getVisualArtifactsRoot(readSessionEnvironment());
    const artifactDirectory = node_path_1.default.resolve(rootArtifactsDirectory, artifactId);
    if (!isPathInside(rootArtifactsDirectory, artifactDirectory)) {
        throw new Error('Resolved visual artifact directory escapes the visual artifacts root');
    }
    return artifactDirectory;
}
function isPathInside(parentDirectory, candidatePath) {
    const relativePath = node_path_1.default.relative(parentDirectory, candidatePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !node_path_1.default.isAbsolute(relativePath));
}
function isSafeRelativePath(candidatePath) {
    if (candidatePath.length === 0 ||
        node_path_1.default.isAbsolute(candidatePath) ||
        candidatePath.includes('\\')) {
        return false;
    }
    return candidatePath
        .split('/')
        .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
