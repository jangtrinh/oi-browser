const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) BerryBrowser/1.0.0 Chrome/130.0.0.0 Safari/537.36";

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export class AgentDOMBrowserService {
  constructor() {
    this.cache = new Map();
  }

  normalizeUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return "berry://newtab";
    if (trimmed.startsWith("berry://") || trimmed.startsWith("oi://")) {
      return trimmed.replace(/^oi:\/\//, "berry://");
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  async inspectUrl(rawUrl) {
    const url = this.normalizeUrl(rawUrl);
    if (url.startsWith("berry://")) {
      return {
        url,
        title: `Berry Internal Surface (${url})`,
        description: "Internal workspace surface managed by Ổi Browser.",
        headings: [url],
        interactiveElements: [
          { strwId: "strw-1", tag: "button", label: "Open Companion Chat", href: null },
          { strwId: "strw-2", tag: "button", label: "Run Scheduled Routine", href: null }
        ],
        tables: [],
        textSnippet: `Active internal workspace surface: ${url}`
      };
    }

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(8000)
      });
      const html = await res.text();
      return this.parseHtmlDom(url, html);
    } catch (err) {
      return {
        url,
        title: new URL(url).hostname,
        description: `Offline or unreachable (${err.message})`,
        headings: [new URL(url).hostname],
        interactiveElements: [],
        tables: [],
        textSnippet: `Could not reach ${url}: ${err.message}`
      };
    }
  }

  parseHtmlDom(url, html) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 140) : new URL(url).hostname;
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
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
    let em;
    let idx = 1;
    while ((em = elRegex.exec(html)) && interactiveElements.length < 25) {
      const tag = em[1].toLowerCase();
      const attrs = em[2] || "";
      const label = stripTags(em[3]).slice(0, 80);
      if (!label || label.length < 2) continue;
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      let href = hrefMatch ? hrefMatch[1] : null;
      if (href && !href.startsWith("javascript:")) {
        try {
          href = new URL(href, url).href;
        } catch {}
      }
      interactiveElements.push({
        strwId: `strw-${idx++}`,
        tag,
        label,
        href
      });
    }

    const tables = this.extractStructuredRows(url, html, headings, interactiveElements);
    const textSnippet = stripTags(html).slice(0, 1200);
    const snapshot = { url, title, description, headings, interactiveElements, tables, textSnippet, html };
    this.cache.set(url, snapshot);
    return snapshot;
  }

  extractStructuredRows(url, html, headings, interactiveElements) {
    const rows = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr;
    while ((tr = trRegex.exec(html)) && rows.length < 15) {
      const cells = [];
      const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let td;
      while ((td = tdRegex.exec(tr[1]))) {
        const text = stripTags(td[1]);
        if (text) cells.push(text.slice(0, 90));
      }
      if (cells.length >= 2) rows.push(cells);
    }
    if (rows.length > 0) return rows;

    return interactiveElements.slice(0, 12).map((el) => [
      el.strwId,
      el.tag.toUpperCase(),
      el.label,
      el.href || url
    ]);
  }

  async renderProxiedHtml(rawUrl) {
    const snap = await this.inspectUrl(rawUrl);
    if (!snap.html) {
      return `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;"><h2>${snap.title}</h2><p>${snap.description}</p></body></html>`;
    }
    let idx = 1;
    const annotated = snap.html
      .replace(/<head([^>]*)>/i, `<head$1><base href="${snap.url}">`)
      .replace(/<(a|button|input)\b/gi, (m) => `${m} data-oi-id="strw-${idx++}"`);
    return annotated;
  }
}
