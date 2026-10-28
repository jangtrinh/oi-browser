export const REDACTION_RULES = [
  {
    id: "api_key",
    regex: /\b(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,})\b/g,
    replacement: "[REDACTED_API_KEY]"
  },
  {
    id: "github_token",
    regex: /\b(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]"
  },
  {
    id: "aws_key",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacement: "[REDACTED_AWS_KEY]"
  },
  {
    id: "bearer_jwt",
    regex: /Bearer\s+[A-Za-z0-9._\-]{18,}/gi,
    replacement: "Bearer [REDACTED_TOKEN]"
  },
  {
    id: "private_key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]"
  },
  {
    id: "credit_card",
    regex: /\b(?:\d[ -]*?){13,16}\b/g,
    replacement: "[REDACTED_CARD]"
  }
];

export class GuardrailsSanitizer {
  constructor() {
    this.totalScans = 0;
    this.totalRedactions = 0;
    this.byRule = {
      api_key: 0,
      github_token: 0,
      aws_key: 0,
      bearer_jwt: 0,
      private_key: 0,
      credit_card: 0
    };
    this.recentEvents = [];
  }

  sanitizeText(rawText = "", sourceUrl = "internal") {
    this.totalScans++;
    let cleanText = String(rawText ?? "");
    let redactionCount = 0;
    const matchedRules = [];

    for (const rule of REDACTION_RULES) {
      const rx = new RegExp(rule.regex.source, rule.regex.flags);
      const matches = cleanText.match(rx);
      if (matches && matches.length > 0) {
        const count = matches.length;
        redactionCount += count;
        this.totalRedactions += count;
        this.byRule[rule.id] = (this.byRule[rule.id] || 0) + count;
        matchedRules.push(rule.id);
        cleanText = cleanText.replace(rx, rule.replacement);
      }
    }

    if (redactionCount > 0) {
      const event = {
        timestamp: new Date().toISOString(),
        sourceUrl: String(sourceUrl || "internal"),
        redactionCount,
        matchedRules: [...matchedRules]
      };
      this.recentEvents.unshift(event);
      if (this.recentEvents.length > 15) {
        this.recentEvents.length = 15;
      }
    }

    return {
      cleanText,
      redactionCount,
      matchedRules
    };
  }

  getStatus() {
    return {
      enabled: true,
      engine: "OpenJarvis Guardrails Secret & PII Filter",
      totalScans: this.totalScans,
      totalRedactions: this.totalRedactions,
      byRule: this.byRule,
      recentEvents: this.recentEvents
    };
  }
}
