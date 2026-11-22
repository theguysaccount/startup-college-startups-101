// The course content follows its own rules: complete front matter, a "Do the work" section, five sound quiz
// questions, builders whose fields all appear in their documents, safe links, and no promises of money or success.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCourse } from "../scripts/build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const course = loadCourse();
const PROMISES = /\b(guarantee[ds]?|millionaire|billionaire|get rich|get funded|you will raise|passive income|10x your|financial freedom|quit your job)\b/i;

test("there are modules, numbered 1..n without gaps", () => {
  assert.ok(course.modules.length >= 1);
  course.modules.forEach((m, i) => assert.equal(m.n, i + 1, `module ${m.file} numbering`));
});

for (const m of course.modules) {
  test(`module ${m.n}: ${m.title}`, () => {
    for (const k of ["slug", "title", "summary", "minutes", "outcome"]) assert.ok(m[k], `${m.file}: front matter "${k}"`);
    assert.ok(m.summary.length >= 80 && m.summary.length <= 200, `${m.file}: summary length ${m.summary.length}`);
    assert.ok(m.words >= 1000 && m.words <= 2600, `${m.file}: ${m.words} words`);
    const h2 = m.headings.filter((h) => h.level === 2);
    assert.ok(h2.length >= 4, `${m.file}: ${h2.length} sections`);
    assert.match(h2[h2.length - 1].text, /do the work/i, `${m.file}: last section is "Do the work"`);
    assert.doesNotMatch(m.body, PROMISES, `${m.file}: promises an outcome`);
    for (const link of m.body.matchAll(/\]\(([^)]+)\)/g)) assert.match(link[1], /^https:\/\//, `${m.file}: link ${link[1]}`);
    assert.equal(m.quiz.length, 5, `${m.file}: five questions`);
    for (const q of m.quiz) {
      assert.equal(q.options.length, 4, q.q);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, q.q);
      assert.ok(q.why && q.why.length > 20, q.q);
      assert.equal(new Set(q.options).size, 4, `${q.q}: repeated option`);
    }
    assert.ok(new Set(m.quiz.map((q) => q.answer)).size >= 2, `${m.file}: the right answer is always in the same place`);
    const b = m.builder;
    assert.equal(b.slug, m.builder.slug);
    assert.equal(b.fields[0].id, "company", `${b.slug}: starts with company`);
    assert.ok(b.fields.length >= 6 && b.fields.length <= 12, `${b.slug}: ${b.fields.length} fields`);
    const ids = new Set();
    for (const f of b.fields) {
      assert.ok(!ids.has(f.id), `${b.slug}: duplicate field ${f.id}`);
      ids.add(f.id);
      assert.ok(["text", "textarea", "list", "number"].includes(f.type), `${b.slug}.${f.id}: type ${f.type}`);
      assert.ok(b.doc.includes(`{{${f.id}}}`), `${b.slug}: {{${f.id}}} missing from the document`);
    }
    for (const ph of b.doc.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(ids.has(ph[1]), `${b.slug}: {{${ph[1]}}} has no field`);
    assert.doesNotMatch(JSON.stringify(b), PROMISES, `${b.slug}: promises an outcome`);
  });
}

test("builder slugs are unique and module slugs are unique", () => {
  assert.equal(new Set(course.modules.map((m) => m.slug)).size, course.modules.length);
  assert.equal(new Set(course.modules.map((m) => m.builder.slug)).size, course.modules.length);
});

test("the built site has every page, valid structured data and safe headers", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "sc-build-"));
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { env: { ...process.env, SC_OUT: out, SITE_URL: "https://theguysaccount.github.io/startup-college-startups-101" }, stdio: "pipe" });
    const sitemap = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
    assert.equal((sitemap.match(/<loc>/g) || []).length, 1 + course.modules.length * 2 + 1 + 2 + 1, "home, modules, templates, template list, two tools, about");
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const missing = [];
    for (const f of walk(out).filter((x) => x.endsWith(".html"))) {
      const s = fs.readFileSync(f, "utf8");
      const rel = path.relative(out, f);
      assert.match(s, /<title>[^<]{10,}<\/title>/, rel);
      assert.match(s, /<meta name="description" content="[^"]{40,}">/, rel);
      assert.match(s, /connect-src 'self';/, `${rel}: CSP`);
      for (const j of s.matchAll(/<script type="application\/(?:ld\+)?json"[^>]*>([^<]+)<\/script>/g)) JSON.parse(j[1]);
      for (const a of s.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
        const p = a[1];
        let file = path.join(out, p.replace(/^\/startup-college-startups-101\//, ""));
        if (p.endsWith("/")) file = path.join(file, "index.html");
        if (!p.startsWith("/startup-college-startups-101/") || !fs.existsSync(file)) missing.push(`${rel}: ${p}`);
      }
    }
    assert.deepEqual(missing.slice(0, 10), []);
    assert.doesNotMatch(fs.readFileSync(path.join(out, "progress", "index.html"), "utf8"), /data-slot="apply"/, "the program link is off unless its key is set");
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
