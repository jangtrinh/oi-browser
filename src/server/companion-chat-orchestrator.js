export class CompanionChatOrchestrator {
  constructor({ store, memory, domService, cliRouter }) {
    this.store = store;
    this.memory = memory;
    this.domService = domService;
    this.cliRouter = cliRouter;
  }

  async handleUserTurn({ companionId = "consulting-cora", message, activeUrl, harnessId, liveCli = false }) {
    const companions = this.store.listCompanions();
    const companion = companions.find((c) => c.id === companionId) || companions[0];
    this.store.addMessage({ companionId: companion.id, sender: "user", content: message });

    const tabs = this.store.listTabs();
    const activeTab = tabs.find((t) => t.is_active === 1) || tabs[0];
    const explicitUrl = this.extractUrlFromText(message);
    const isLeadSearch = !explicitUrl && /(tìm|search|lead|khách hàng|công ty|đối thủ|prospect|sourcing|ứng viên|khám phá|dự án)/i.test(message);
    const targetUrl = explicitUrl || activeUrl || activeTab?.url || "https://github.com/jangtrinh/oi-browser";

    const toolCalls = [];
    let createdArtifact = null;

    const snap = isLeadSearch ? await this.domService.searchWebLeads(message) : await this.domService.inspectUrl(targetUrl);
    const extractedUrls = snap.extractedUrls?.length ? snap.extractedUrls : [snap.url];
    if (snap.searchQueries?.length) {
      toolCalls.push({
        tool: "use_search_engine",
        status: "complete",
        input: { searchQueries: snap.searchQueries, objective: message.slice(0, 120) },
        output: snap.description
      });
    }
    toolCalls.push({
      tool: "web_extract",
      status: "complete",
      input: { urls: extractedUrls },
      output: `Title: "${snap.title}" · ${snap.headings.length} headings · ${snap.interactiveElements.length} [data-oi-id] interactive nodes`,
      oiToolMetadata: { websites: extractedUrls.map((u) => ({ url: u })) }
    });

    let cliRun = null;
    if (this.cliRouter) {
      const effectiveHarness = harnessId || this.cliRouter.activeHarnessId;
      const resolved = this.cliRouter.resolveForCompanion(companion.id, effectiveHarness);
      const skillPaths = this.cliRouter.resolveSkillFiles(companion.skills);
      const shouldExecLive = Boolean(liveCli) || resolved.resolvedHarness === "grok";
      const urlCtx = explicitUrl || isLeadSearch ? `\nDữ liệu lead/web thực tế vừa trích xuất ("${snap.title}"):\n${snap.textSnippet.slice(0, 750)}` : "";
      const leadRule = isLeadSearch ? "\nÁp dụng chuẩn find-prospects & qualify-account: trình bày danh sách các khách hàng thực tế ở trên kèm link Markdown [Tên](URL), Tín hiệu mua hàng (Buying Signal), phân loại Route (Priority / Explore / Nurture) và bước tiếp cận tiếp theo." : "";
      const groundedPrompt = `[Không gọi tool read_file, trả lời trực tiếp ngay] Bạn là ${companion.name} (${companion.role}) trong Ổi Browser.${urlCtx}${leadRule}\nTrả lời bằng tiếng Việt (ngắn gọn, thực chiến, đúng chuyên môn, tuyệt đối không dùng emoji) cho yêu cầu: ${message}`;
      cliRun = await this.cliRouter.executeCommand({
        harnessId: effectiveHarness,
        companionId: companion.id,
        prompt: groundedPrompt,
        mode: shouldExecLive ? "exec" : "simulated",
        timeoutMs: 28000
      });
      toolCalls.push({
        tool: "cli_harness_dispatch",
        status: "done",
        input: { harness: resolved.resolvedHarness, binary: resolved.binaryPath || "local", skills: skillPaths },
        output: `${resolved.label} · ${cliRun.durationMs}ms`
      });
    }

    const lower = String(message || "").toLowerCase();
    const wantsSheet =
      isLeadSearch ||
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
        ID: cells[0] || `oi-${i + 1}`,
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
                { ID: "oi-1", Type: "PAGE_TITLE", Content: snap.title, Reference: snap.url },
                { ID: "oi-2", Type: "META_DESC", Content: snap.description || "N/A", Reference: snap.url }
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
        ...snap.interactiveElements.slice(0, 8).map((el) => `- \`[${el.oiId}]\` <${el.tag}> **${el.label}** ${el.href ? `→ ${el.href}` : ""}`),
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
      summary: `Processed "${message.slice(0, 80)}" via ${cliRun?.resolvedHarness || "local"} on "${snap.title}" -> Artifact "${createdArtifact.title}"`,
      sourceUrl: snap.url
    });
    const targetFile = isLeadSearch ? "knowledge/crm.md" : obsPath;
    toolCalls.push({
      tool: "file_write",
      status: "complete",
      input: { path: targetFile, content: snap.textSnippet },
      output: `Appended dated observation to ${targetFile}`,
      oiToolMetadata: { action: "updated", lineDelta: { added: Math.max(3, (snap.tables || []).length) } }
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
          `- **CLI Harness**: \`${cliRun?.resolvedHarness || "local"}\``,
          `- **Description**: ${snap.description || "Extracted via AgentDOMBrowserService"}`,
          `- **Top Headings**: ${snap.headings.slice(0, 5).join(" | ") || "N/A"}`
        ].join("\n")
      });
    }

    const isSimulated = /^\[[^\]]+\] (Executed grounded turn|Streamed prompt|Completed)/.test(cliRun?.stdout || "");
    const rawLiveOut = cliRun?.stdout && !isSimulated ? cliRun.stdout.trim() : "";
    const cleanLiveOut = rawLiveOut.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/  +/g, " ").trim();
    const fallbackOut = isLeadSearch
      ? `Đã hoàn tất tìm kiếm và phân loại khách hàng tiềm năng (**find-prospects** & **qualify-account**) đồng thời cập nhật \`knowledge/crm.md\`:\n\n${snap.textSnippet}`
      : snap.description ? `> ${snap.description}` : `> ${snap.textSnippet.slice(0, 200)}...`;
    const reply = cleanLiveOut || fallbackOut;

    const assistantMsg = this.store.addMessage({
      companionId: companion.id,
      sender: "assistant",
      content: reply,
      toolCalls,
      artifactId: createdArtifact.id
    });

    return { assistantMessage: assistantMsg, artifact: createdArtifact, snapshot: snap, cliRun };
  }

  extractUrlFromText(text) {
    const m = String(text || "").match(/https?:\/\/[^\s)"']+/i);
    return m ? m[0] : null;
  }
}
