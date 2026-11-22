// Check the live site: every sitemap page answers 200, every internal file exists, and every outbound link in the
// lessons still resolves. Outbound links that are gone (404, 410) fail the check; sites that refuse scripts
// (403, 429, timeouts) only warn, since a browser may still reach them.
//   node scripts/linkcheck.mjs https://owner.github.io/startup-college-startups-101 [--internal-only]
const base = (process.argv[2] || process.env.SITE_URL || "").replace(/\/$/, "");
if (!base) throw new Error("usage: linkcheck.mjs <base url> [--internal-only]");
const internalOnly = process.argv.includes("--internal-only");
const origin = new URL(base).origin;
const UA = "startups-101-linkcheck (+https://github.com/theguysaccount/startup-college-startups-101)";
const problems = [], warnings = [];
const seen = new Map();
const warn = (m) => { warnings.push(m); console.log(process.env.GITHUB_ACTIONS ? `::warning::${m}` : `warning: ${m}`); };

async function get(url, text = false) {
  if (seen.has(url) && !text) return seen.get(url);
  let res, body = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25000), headers: { "user-agent": UA } });
      if (text) body = await res.text(); else await res.arrayBuffer();
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) { res = { status: 0, statusText: e.message }; }
    await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
  }
  const out = { status: res.status, body };
  seen.set(url, out);
  return out;
}

const sm = await get(base + "/sitemap.xml", true);
if (sm.status !== 200) { console.error("sitemap missing:", sm.status); process.exit(1); }
const pages = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const internal = new Set([base + "/robots.txt", base + "/favicon.svg", base + "/build-info.json"]);
const outbound = new Set();
for (const p of pages) {
  const r = await get(p, true);
  if (r.status !== 200) { problems.push(`${r.status} ${p}`); continue; }
  for (const m of r.body.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    let u = m[1].replace(/&amp;/g, "&");
    if (u.startsWith("/")) u = origin + u;
    if (u.startsWith(base + "/")) internal.add(u.split("?")[0]);
    else if (/^https:\/\//.test(u) && !u.startsWith(origin)) outbound.add(u);
  }
}
const list = [...internal];
for (let i = 0; i < list.length; i += 8) await Promise.all(list.slice(i, i + 8).map(async (u) => { const r = await get(u); if (r.status !== 200) problems.push(`${r.status} ${u}`); }));
if (!internalOnly) {
  for (const u of outbound) {
    const r = await get(u);
    if (r.status === 404 || r.status === 410) problems.push(`outbound link gone (${r.status}): ${u}`);
    else if (r.status < 200 || r.status >= 400) warn(`outbound link answered ${r.status || "no response"}: ${u}`);
    await new Promise((x) => setTimeout(x, 700));
  }
}
console.log(`checked ${pages.length} pages, ${list.length} files${internalOnly ? "" : ` and ${outbound.size} outbound links (${warnings.length} warnings)`}`);
if (problems.length) { console.error("broken:\n" + problems.map((p) => " - " + p).join("\n")); process.exit(1); }
console.log("all good");
