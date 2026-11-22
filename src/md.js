// A small, safe markdown renderer for the course text and the builders' documents: ## and ### headings,
// paragraphs, **bold**, *italic*, [links](https://…), - bullets, 1. numbered lists and > blockquotes.
// Everything is HTML-escaped first, so text typed into a builder can never inject markup.

export const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(s) {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (m, text, url) => `<a href="${url}" rel="noopener">${text}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, "$1<em>$2</em>");
  return t;
}

export const slugify = (s) => String(s).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Render markdown to HTML. Returns { html, headings: [{ level, text, id }] }. */
export function render(md, { idPrefix = "" } = {}) {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const headings = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      flushAll();
      const level = Math.max(2, m[1].length);
      const text = m[2].trim();
      const id = idPrefix + slugify(text);
      headings.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.+)$/))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return { html: out.join("\n"), headings };
}

/** Split "---\nkey: value\n---\nbody" front matter. Values stay strings except integers. */
export function frontMatter(text) {
  const m = String(text).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: String(text) };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["'](.*)["']$/, "$1");
    data[kv[1]] = /^-?\d+$/.test(v) ? Number(v) : v;
  }
  return { data, body: m[2] };
}

/** Fill a builder's document template with answers: lists become bullets, empty answers become a visible gap. */
export function fillDoc(builder, answers) {
  const byId = Object.fromEntries(builder.fields.map((f) => [f.id, f]));
  return builder.doc.replace(/\{\{(\w+)\}\}/g, (m, id) => {
    const f = byId[id];
    const v = answers?.[id];
    if (f?.type === "list") {
      const items = (Array.isArray(v) ? v : String(v ?? "").split("\n")).map((x) => String(x).trim()).filter(Boolean);
      return items.length ? items.map((x) => `- ${x}`).join("\n") : "- *(to fill in)*";
    }
    const s = String(v ?? "").trim();
    return s || "*(to fill in)*";
  });
}

/** Which required fields are still missing. */
export function missing(builder, answers) {
  return builder.fields.filter((f) => {
    if (!f.required) return false;
    const v = answers?.[f.id];
    if (f.type === "list") {
      const n = (Array.isArray(v) ? v : String(v ?? "").split("\n")).map((x) => String(x).trim()).filter(Boolean).length;
      return n < (f.min || 1);
    }
    return !String(v ?? "").trim();
  });
}
