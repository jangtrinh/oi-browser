const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) OiBrowser/1.0.0 Chrome/130.0.0.0 Safari/537.36";

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x2F;/g, "/").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

export class AgentDOMBrowserService {
  constructor() { this.cache = new Map(); }

  normalizeUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return "berry://newtab";
    if (trimmed.startsWith("berry://") || trimmed.startsWith("oi://")) return trimmed.replace(/^oi:\/\//, "berry://");
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  async searchWebLeads(rawPrompt = "") {
    const words = String(rawPrompt).split(/[\s,();:!?/]+/);
    const stop = new Set(["tim", "kiem", "khach", "hang", "cong", "ty", "cho", "va", "lap", "bang", "danh", "sach", "top", "cac", "cua", "voi", "kem", "website", "web", "url", "route", "priority", "explore", "nurture", "pass", "crm.md", "crm", "luu", "vao", "phan", "loai", "tren", "mang", "thuc", "te", "tiem", "nang", "link", "profile", "ho", "so", "ung", "vien", "nguoi", "du", "an"]);
    const filtered = words.filter((w) => /^[A-Za-z][A-Za-z0-9.+-]{1,}$/.test(w) && !stop.has(w.toLowerCase())).slice(0, 5);
    const kw = filtered.length > 0 ? filtered.join(" ") : "AI agent browser automation";
    const leads = [];
    try {
      const [ghRes, hnRes] = await Promise.allSettled([
        fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(kw + " stars:>200")}&sort=stars&order=desc&per_page=4`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) }),
        fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent("Show HN " + kw)}&tags=show_hn&hitsPerPage=4`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) })
      ]);
      if (ghRes.status === "fulfilled" && ghRes.value.ok) {
        const gh = await ghRes.value.json();
        for (const item of (gh.items || []).slice(0, 4)) {
          const desc = String(item.description || "Active engineering project").replace(/\s+/g, " ").slice(0, 90);
          leads.push({ name: item.full_name, url: item.homepage && item.homepage.startsWith("http") ? item.homepage : item.html_url, signal: `GitHub ${item.stargazers_count.toLocaleString()} stars · ${desc}`, route: item.stargazers_count > 2000 ? "Priority" : "Explore" });
        }
      }
      if (hnRes.status === "fulfilled" && hnRes.value.ok) {
        const hn = await hnRes.value.json();
        for (const hit of (hn.hits || []).filter((h) => h.url).slice(0, 3)) {
          leads.push({ name: hit.title.replace(/^Show HN:\s*/i, "").slice(0, 55), url: hit.url, signal: `Show HN Launch (${hit.points || 1} pts, ${hit.num_comments || 0} comments) · ${new URL(hit.url).hostname}`, route: (hit.points || 0) > 50 ? "Priority" : "Explore" });
        }
      }
    } catch {}
    const rows = leads.slice(0, 6).map((l, i) => [l.route || (i < 3 ? "Priority" : "Explore"), l.name, l.signal, l.url]);
    const interactiveElements = leads.slice(0, 6).map((l, i) => ({ oiId: `oi-${i + 1}`, tag: "a", label: `${l.name} (${l.signal.slice(0, 45)})`, href: l.url }));
    const summaryText = leads.slice(0, 5).map((l, i) => `${i + 1}. [${l.name}](${l.url}) — Signal: ${l.signal} — Route: ${l.route}`).join("\n");
    return {
      url: leads[0]?.url || `https://github.com/search?q=${encodeURIComponent(kw)}`,
      title: `Ecosystem & Signal Discovery: ${kw}`,
      description: summaryText.slice(0, 260) || `Live ecosystem search for ${kw}`,
      searchQueries: [kw, `Show HN ${kw}`, `github ${kw}`],
      extractedUrls: leads.slice(0, 5).map((l) => l.url),
      headings: leads.map((l) => `[${l.route}] ${l.name} → ${l.url}`),
      interactiveElements,
      tables: rows,
      textSnippet: summaryText || `Live search for ${kw}`
    };
  }

  async inspectUrl(rawUrl) {
    const url = this.normalizeUrl(rawUrl);
    if (url.startsWith("berry://")) {
      return {
        url, title: `Ổi Browser Internal Surface (${url})`, description: "Internal workspace surface managed by Ổi Browser.",
        headings: [url], interactiveElements: [{ oiId: "oi-1", tag: "button", label: "Open Companion Chat", href: null }, { oiId: "oi-2", tag: "button", label: "Run Scheduled Routine", href: null }],
        tables: [], textSnippet: `Active internal workspace surface: ${url}`
      };
    }
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(8000) });
      return this.parseHtmlDom(url, await res.text());
    } catch (err) {
      return { url, title: new URL(url).hostname, description: `Offline or unreachable (${err.message})`, headings: [new URL(url).hostname], interactiveElements: [], tables: [], textSnippet: `Could not reach ${url}: ${err.message}` };
    }
  }

  parseHtmlDom(url, html) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 140) : new URL(url).hostname;
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? stripTags(descMatch[1]).slice(0, 260) : "";
    const headings = [];
    const hRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let hm;
    while ((hm = hRegex.exec(html)) && headings.length < 15) {
      const text = stripTags(hm[2]);
      if (text.length > 2) headings.push(`H${hm[1]}: ${text.slice(0, 110)}`);
    }
    const interactiveElements = [];
    const elRegex = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let em, idx = 1;
    while ((em = elRegex.exec(html)) && interactiveElements.length < 25) {
      const tag = em[1].toLowerCase(), attrs = em[2] || "", label = stripTags(em[3]).slice(0, 80);
      if (!label || label.length < 2) continue;
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      let href = hrefMatch ? hrefMatch[1] : null;
      if (href && !href.startsWith("javascript:")) { try { href = new URL(href, url).href; } catch {} }
      interactiveElements.push({ oiId: `oi-${idx++}`, tag, label, href });
    }
    const tables = this.extractStructuredRows(url, html, headings, interactiveElements);
    const snapshot = { url, title, description, headings, interactiveElements, tables, textSnippet: stripTags(html).slice(0, 1200), html };
    this.cache.set(url, snapshot);
    return snapshot;
  }

  extractStructuredRows(url, html, headings, interactiveElements) {
    const rows = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr;
    while ((tr = trRegex.exec(html)) && rows.length < 15) {
      const cells = [], tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let td;
      while ((td = tdRegex.exec(tr[1]))) {
        const text = stripTags(td[1]);
        if (text) cells.push(text.slice(0, 90));
      }
      if (cells.length >= 2) rows.push(cells);
    }
    return rows.length > 0 ? rows : interactiveElements.slice(0, 12).map((el) => [el.oiId, el.tag.toUpperCase(), el.label, el.href || url]);
  }

  async renderProxiedHtml(rawUrl) {
    const snap = await this.inspectUrl(rawUrl);
    if (!snap.html) return `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;"><h2>${snap.title}</h2><p>${snap.description}</p><a href="${snap.url}" data-oi-id="oi-1">${snap.url}</a></body></html>`;
    let idx = 1;
    return snap.html.replace(/<head([^>]*)>/i, `<head$1><base href="${snap.url}">`).replace(/<(a|button|input)\b/gi, (m) => `${m} data-oi-id="oi-${idx++}"`);
  }
}
