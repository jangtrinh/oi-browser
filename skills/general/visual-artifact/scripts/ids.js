"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidArtifactId = isValidArtifactId;
const ARTIFACT_ID_PATTERN = /^[a-z]+-[a-z]+-[a-z]+$/;
function isValidArtifactId(artifactId) {
    return ARTIFACT_ID_PATTERN.test(artifactId);
}
