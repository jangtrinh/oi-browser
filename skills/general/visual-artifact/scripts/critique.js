"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.critiqueArtifact = critiqueArtifact;
const ids_js_1 = require("./ids.js");
async function critiqueArtifact(input) {
    const normalizedInput = normalizeCritiqueArtifactInput(input);
    return oi.internal.critiqueArtifact(normalizedInput);
}
function normalizeCritiqueArtifactInput(input) {
    validateArtifactId(input.artifactId);
    if (input.includeVision !== undefined && typeof input.includeVision !== 'boolean') {
        throw new Error('includeVision must be a boolean when provided');
    }
    for (const target of input.exportTargets ?? []) {
        if (target !== 'png' && target !== 'pdf') {
            throw new Error(`Unsupported export target: ${target}`);
        }
    }
    return {
        artifactId: input.artifactId,
        includeVision: input.includeVision ?? false,
        ...(input.exportTargets !== undefined && input.exportTargets.length > 0
            ? { exportTargets: input.exportTargets }
            : {})
    };
}
function validateArtifactId(artifactId) {
    if (!(0, ids_js_1.isValidArtifactId)(artifactId)) {
        throw new Error(`Malformed visual artifact id: ${artifactId}`);
    }
}
