export class CompanionChatOrchestrator {
  constructor({ store, memory, domService }) {
    this.store = store;
    this.memory = memory;
    this.domService = domService;
  }

  async handleUserTurn({ companionId = "consulting-cora", message, activeUrl }) {
    const companions = this.store.listCompanions();
    const companion = companions.find((c) => c.id === companionId) || companions[0];
    this.store.addMessage({ companionId: companion.id, sender: "user", content: message });

    const tabs = this.store.listTabs();
    const activeTab = tabs.find((t) => t.is_active === 1) || tabs[0];
    const targetUrl = this.extractUrlFromText(message) || activeUrl || activeTab?.url || "https://oibrowser.vn";

    const toolCalls = [];
    let createdArtifact = null;

    const snap = await this.domService.inspectUrl(targetUrl);
    toolCalls.push({
      tool: "browser_inspect_dom",
      status: "done",
      input: { url: snap.url },
      output: `Title: "${snap.title}" · ${snap.headings.length} headings · ${snap.interactiveElements.length} [data-oi-id] interactive nodes`
    });

    const lower = String(message || "").toLowerCase();
    const wantsSheet =
      lower.includes("sheet") ||
      lower.includes("table") ||
      lower.includes("bảng") ||
      lower.includes("matrix") ||
      lower.includes("csv") ||
      lower.includes("extract") ||
      companion.id === "research-rosa" ||
      companion.id === "developer-dana";

    if (wantsSheet) {
      const rows = (snap.tables || []).slice(0, 12).map((cells, i) => ({
        ID: cells[0] || `strw-${i + 1}`,
        Type: cells[1] || "ELEMENT",
        Content: cells[2] || cells[0] || "Item",
        Reference: cells[3] || snap.url
      }));
      createdArtifact = this.store.createArtifact({
        title: `${companion.name}: Extracted Data — ${snap.title.slice(0, 42)}`,
        kind: "spreadsheet",
        companionId: companion.id,
        sourceUrl: snap.url,
        columns: ["ID", "Type", "Content", "Reference"],
        rows:
          rows.length > 0
            ? rows
            : [
                { ID: "strw-1", Type: "PAGE_TITLE", Content: snap.title, Reference: snap.url },
                { ID: "strw-2", Type: "META_DESC", Content: snap.description || "N/A", Reference: snap.url }
              ]
      });
      toolCalls.push({
        tool: "create_visual_artifact",
        status: "done",
        input: { kind: "spreadsheet", title: createdArtifact.title },
        output: `Created Spreadsheet Artifact (${createdArtifact.rows.length} rows)`
      });
    } else {
      const mdDoc = [
        `# ${companion.name} (${companion.role}) — Deliverable`,
        "",
        `- **Inspected Target**: [${snap.title}](${snap.url})`,
        `- **Summary**: ${snap.description || snap.textSnippet.slice(0, 220)}`,
        "",
        "## Observed DOM Structure (`data-oi-id`)",
        ...(snap.headings.slice(0, 6).map((h) => `- ${h}`) || ["- Root document inspected"]),
        "",
        "## Interactive Elements & Actionable Signals",
        ...snap.interactiveElements.slice(0, 8).map((el) => `- \`[${el.strwId}]\` <${el.tag}> **${el.label}** ${el.href ? `→ ${el.href}` : ""}`),
        "",
        "## Recommended Next Actions",
        `1. **${companion.skills[0] || "verify"}**: Execute grounded workflow on ${snap.title}.`,
        `2. **${companion.skills[1] || "compile"}**: Sync key entities into \`entities/companies/\` in Karpathy-Wiki Memory.`
      ].join("\n");

      createdArtifact = this.store.createArtifact({
        title: `${companion.name} Brief: ${snap.title.slice(0, 45)}`,
        kind: "document",
        companionId: companion.id,
        sourceUrl: snap.url,
        contentMarkdown: mdDoc
      });
      toolCalls.push({
        tool: "create_visual_artifact",
        status: "done",
        input: { kind: "document", title: createdArtifact.title },
        output: `Created Document Artifact #${createdArtifact.id}`
      });
    }

    const obsPath = this.memory.appendObservation({
      companionId: companion.id,
      summary: `Processed "${message.slice(0, 80)}" on "${snap.title}" (${snap.interactiveElements.length} DOM nodes) -> Artifact "${createdArtifact.title}"`,
      sourceUrl: snap.url
    });
    toolCalls.push({
      tool: "karpathy_wiki_memory_write",
      status: "done",
      input: { path: obsPath },
      output: `Appended dated observation to ${obsPath}`
    });

    if (snap.url.startsWith("http")) {
      const host = new URL(snap.url).hostname.replace(/^www\./, "");
      const entityPath = this.memory.upsertEntity({
        type: "companies",
        slug: host.replace(/\./g, "-"),
        title: snap.title || host,
        markdownBody: [
          `- **URL**: ${snap.url}`,
          `- **Inspected By**: ${companion.name} (\`${companion.id}\`)`,
          `- **Description**: ${snap.description || "Extracted via AgentDOMBrowserService"}`,
          `- **Top Headings**: ${snap.headings.slice(0, 5).join(" | ") || "N/A"}`
        ].join("\n")
      });
      toolCalls.push({
        tool: "karpathy_wiki_entity_upsert",
        status: "done",
        input: { path: entityPath },
        output: `Updated entity knowledge page ${entityPath}`
      });
    }

    const reply = [
      `**${companion.avatar} ${companion.name}** inspected **[${snap.title}](${snap.url})** (\`${snap.interactiveElements.length}\` interactive \`[data-oi-id]\` elements, \`${snap.headings.length}\` headings).`,
      "",
      snap.description ? `> ${snap.description}` : `> ${snap.textSnippet.slice(0, 200)}...`,
      "",
      `### Completed Actions`,
      `- **DOM Snapshot**: Captured top headings (${snap.headings.slice(0, 3).join("; ") || "root"})`,
      `- **Visual Artifact**: Created **${createdArtifact.title}** (\`${createdArtifact.kind}\`)`,
      `- **Karpathy-Wiki Memory**: Logged observation in \`${obsPath}\``
    ].join("\n");

    const assistantMsg = this.store.addMessage({
      companionId: companion.id,
      sender: "assistant",
      content: reply,
      toolCalls,
      artifactId: createdArtifact.id
    });

    return { assistantMessage: assistantMsg, artifact: createdArtifact, snapshot: snap };
  }

  extractUrlFromText(text) {
    const m = String(text || "").match(/https?:\/\/[^\s)"']+/i);
    return m ? m[0] : null;
  }
}
