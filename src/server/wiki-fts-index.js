import { DatabaseSync } from "node:sqlite";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from",
  "cua", "cho", "trong", "nhung", "cac", "la", "va"
]);

export class WikiFtsIndex {
  constructor({ db, memory } = {}) {
    this.db = db || new DatabaseSync(":memory:");
    this.memory = memory || null;
    this.initFtsTable();
    this.syncAllFromDisk();
  }

  initFtsTable() {
    this.db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(path, title, category, content, tokenize='unicode61 remove_diacritics 2');"
    );
  }

  syncAllFromDisk() {
    if (!this.memory || typeof this.memory.listFiles !== "function") return 0;
    this.db.exec("DELETE FROM wiki_fts;");
    const files = this.memory.listFiles() || [];
    let count = 0;
    for (const file of files) {
      const relPath = typeof file === "string" ? file : file?.path;
      if (!relPath) continue;
      const content = String(this.memory.readFile(relPath) || "");
      const match = content.match(/^#+\s+(.+)$/m);
      const title = match ? match[1].trim() : relPath;
      const parts = relPath.split("/");
      const category = parts.length > 1 ? parts[0] : "profile";
      this.indexDocument({ path: relPath, title, category, content });
      count++;
    }
    return count;
  }

  indexDocument({ path: relPath, title, category, content }) {
    if (!relPath) return null;
    const cleanPath = String(relPath);
    const docTitle = String(title || cleanPath);
    const docCategory = String(category || "wiki");
    const docBody = String(content ?? "");
    this.db.prepare("DELETE FROM wiki_fts WHERE path = ?").run(cleanPath);
    this.db
      .prepare(
        "INSERT INTO wiki_fts (path, title, category, content) VALUES (?, ?, ?, ?)"
      )
      .run(cleanPath, docTitle, docCategory, docBody);
    return { path: cleanPath, title: docTitle, category: docCategory };
  }

  search(rawQuery = "", limit = 5) {
    const maxLimit = Math.max(1, Number(limit) || 5);
    const rawTokens =
      String(rawQuery || "")
        .toLowerCase()
        .match(/[\p{L}\p{N}]{2,}/gu) || [];
    const tokens = rawTokens.filter((t) => !STOPWORDS.has(t));
    const effectiveTokens = tokens.length > 0 ? tokens : rawTokens;
    const ftsQuery = effectiveTokens
      .slice(0, 8)
      .map((t) => `"${t.replace(/"/g, "")}"*`)
      .join(" OR ");

    let results = [];
    if (ftsQuery) {
      try {
        results = this.db
          .prepare(
            "SELECT path, title, category, snippet(wiki_fts, 3, '[', ']', '...', 20) AS snippet, bm25(wiki_fts) AS score FROM wiki_fts WHERE wiki_fts MATCH ? ORDER BY score ASC LIMIT ?"
          )
          .all(ftsQuery, maxLimit);
      } catch {
        results = [];
      }
    }

    if (!results || results.length === 0) {
      results = this.db
        .prepare(
          "SELECT path, title, category, substr(content, 1, 160) AS snippet, 0.0 AS score FROM wiki_fts LIMIT ?"
        )
        .all(maxLimit);
    }

    return {
      query: rawQuery,
      engine: "SQLite FTS5 BM25 (unicode61 remove_diacritics 2)",
      totalIndexedDocs: this.getDocCount(),
      results: results || []
    };
  }

  getDocCount() {
    return this.db.prepare("SELECT COUNT(*) AS c FROM wiki_fts").get()?.c || 0;
  }
}
