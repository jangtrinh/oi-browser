"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportArtifact = exportArtifact;
const ids_js_1 = require("./ids.js");
const SUPPORTED_TARGETS = new Set(['png', 'pdf']);
async function exportArtifact(input) {
    validateExportArtifactInput(input);
    return oi.internal.exportArtifact(input);
}
function validateExportArtifactInput(input) {
    validateArtifactId(input.artifactId);
    if (input.targets.length === 0) {
        throw new Error('At least one export target is required');
    }
    for (const target of input.targets) {
        if (!SUPPORTED_TARGETS.has(target)) {
            throw new Error(`Unsupported export target: ${target}`);
        }
    }
}
function validateArtifactId(artifactId) {
    if (!(0, ids_js_1.isValidArtifactId)(artifactId)) {
        throw new Error(`Malformed visual artifact id: ${artifactId}`);
    }
}
