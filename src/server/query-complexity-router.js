/**
 * Query Complexity & Cascade Fallback Router
 * OpenJarvis-inspired adaptive query complexity classification and fallback cascade.
 */

export const COMPLEXITY_PROFILES = {
  code: {
    regex: /(code|fix|debug|typescript|javascript|python|rust|sql|regex|script|ast|function|api|git|build|test)/i,
    complexityScore: 0.85,
    preferredChain: ["codex", "claude", "agy", "grok", "local"],
    label: "Code & Engineering"
  },
  reasoning: {
    regex: /(architecture|design|strategy|analyze|phân tích|chiến lược|kiến trúc|compare|so sánh|audit|review|security|legal|financial)/i,
    complexityScore: 0.90,
    preferredChain: ["claude", "agy", "codex", "grok", "local"],
    label: "Deep Reasoning & Strategy"
  },
  data: {
    regex: /(table|bảng|sheet|csv|matrix|extract|lead|khách hàng|tuyển dụng|ứng viên|pipeline|crm|scrape|dom)/i,
    complexityScore: 0.75,
    preferredChain: ["agy", "codex", "claude", "grok", "local"],
    label: "Structured Data & Agentic Extraction"
  },
  speed: {
    regex: /(nhanh|tóm tắt|summary|tldr|quick|email|outreach|copy|social|post|tin nhắn|headline)/i,
    complexityScore: 0.35,
    preferredChain: ["grok", "claude", "agy", "codex", "local"],
    label: "Fast Outreach & Synthesis"
  },
  general: {
    complexityScore: 0.50,
    preferredChain: ["claude", "agy", "grok", "codex", "local"],
    label: "General Workspace"
  }
};

export function classifyQueryComplexity(prompt = "") {
  const text = String(prompt || "");
  for (const [category, profile] of Object.entries(COMPLEXITY_PROFILES)) {
    if (profile.regex && profile.regex.test(text)) {
      return {
        category,
        complexityScore: profile.complexityScore,
        preferredChain: [...profile.preferredChain],
        label: profile.label
      };
    }
  }
  const fallback = COMPLEXITY_PROFILES.general;
  return {
    category: "general",
    complexityScore: fallback.complexityScore,
    preferredChain: [...fallback.preferredChain],
    label: fallback.label
  };
}

export function resolveCascadePlan({
  companionId = "consulting-cora",
  requestedHarnessId = "auto",
  activeHarnessId = "auto",
  prompt = "",
  harnesses = [],
  companionAffinities = {}
} = {}) {
  const classification = classifyQueryComplexity(prompt);
  const pick = requestedHarnessId || activeHarnessId || "auto";

  let candidateIds;
  if (pick === "auto") {
    const affinityHarness = companionAffinities[companionId] || "claude";
    candidateIds = [affinityHarness, ...classification.preferredChain, "local"];
  } else {
    candidateIds = [pick, ...classification.preferredChain, "local"];
  }

  const dedupedIds = [];
  for (const id of candidateIds) {
    if (!dedupedIds.includes(id)) dedupedIds.push(id);
  }

  const localHarness = harnesses.find((h) => h.id === "local") || {
    id: "local",
    label: "Local Deterministic",
    binary: null,
    badge: "LOCAL",
    installed: true
  };

  const installedChain = [];
  for (const id of dedupedIds) {
    const found = harnesses.find((h) => h.id === id) || (id === "local" ? localHarness : null);
    if (found && found.installed && !installedChain.some((h) => h.id === found.id)) {
      installedChain.push(found);
    }
  }

  if (!installedChain.some((h) => h.id === "local")) {
    installedChain.push(localHarness);
  }

  return {
    primaryHarness: installedChain[0] || localHarness,
    cascadeChain: installedChain.map((h) => h.id),
    classification,
    routingPolicy: pick === "auto" ? "openjarvis-adaptive-auto" : "explicit-override-with-fallback"
  };
}
