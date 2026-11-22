import { test } from "node:test";
import assert from "node:assert/strict";
import { render, inline, frontMatter, fillDoc, missing, escapeHtml } from "../src/md.js";
import { runway, safeRound } from "../src/calc.js";
import { totalXp, level, emptyState, LEVELS } from "../src/app.js";

test("markdown: headings with ids, lists, quotes, inline styles, safe links", () => {
  const { html, headings } = render("## Why now\n\nText with **bold**, *italic* and [a link](https://example.com).\n\n- one\n- two\n\n1. first\n2. second\n\n> a quote\n> continues");
  assert.deepEqual(headings, [{ level: 2, text: "Why now", id: "why-now" }]);
  assert.match(html, /<h2 id="why-now">Why now<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>, <em>italic<\/em> and <a href="https:\/\/example\.com" rel="noopener">a link<\/a>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>a quote continues<\/p><\/blockquote>/);
});

test("markdown never passes HTML or unsafe links through", () => {
  assert.equal(inline("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.doesNotMatch(inline("[x](javascript:alert(1))"), /<a /);
  assert.equal(escapeHtml(`"<&>`), "&quot;&lt;&amp;&gt;");
});

test("front matter", () => {
  const { data, body } = frontMatter("---\nn: 3\ntitle: \"Validate\"\nminutes: 18\n---\n## Hi\n");
  assert.deepEqual(data, { n: 3, title: "Validate", minutes: 18 });
  assert.equal(body, "## Hi\n");
});

const B = { slug: "x", title: "X", intro: "", fields: [
  { id: "company", label: "Company", type: "text", required: true },
  { id: "risks", label: "Risks", type: "list", min: 2, required: true },
  { id: "notes", label: "Notes", type: "textarea" }], doc: "# {{company}}\n\n{{risks}}\n\n{{notes}}" };

test("builder documents fill in, show gaps, and list what's missing", () => {
  assert.equal(fillDoc(B, { company: "Acme", risks: ["a", " ", "b"], notes: "" }), "# Acme\n\n- a\n- b\n\n*(to fill in)*");
  assert.deepEqual(missing(B, { company: "Acme", risks: ["only one"] }).map((f) => f.id), ["risks"]);
  assert.deepEqual(missing(B, { company: "Acme", risks: "one\ntwo" }), []);
  assert.match(render(fillDoc(B, { company: "<b>x</b>" })).html, /&lt;b&gt;x&lt;\/b&gt;/, "typed text can't inject markup");
});

test("runway", () => {
  const r = runway({ cash: 150000, monthlyCosts: 18000, monthlyRevenue: 3000, monthsToMilestone: 18, bufferMonths: 6 });
  assert.equal(r.burn, 15000);
  assert.equal(r.months, 10);
  assert.equal(r.toRaise, 15000 * 24 - 150000);
  assert.equal(runway({ cash: 1, monthlyCosts: 1, monthlyRevenue: 5 }).months, Infinity);
});

test("post-money SAFE and priced round math", () => {
  const one = safeRound({ safes: [{ amount: 1_000_000, cap: 10_000_000 }] });
  assert.ok(Math.abs(one.before.safes[0] - 0.10) < 1e-12, "a $1M SAFE at a $10M post-money cap owns 10%");
  assert.ok(Math.abs(one.before.founders - 0.90) < 1e-12);
  const r = safeRound({ safes: [{ amount: 1_000_000, cap: 10_000_000 }], round: { investment: 2_000_000, postMoney: 12_000_000, poolTarget: 0.10 } });
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(close(r.after.investors, 1 / 6));
  assert.ok(close(r.after.safes[0], 0.10 * (5 / 6)));
  assert.ok(close(r.after.pool, 0.10));
  assert.ok(close(r.after.founders, 0.90 * (5 / 6) - 0.10));
  const sum = r.after.founders + r.after.pool + r.after.investors + r.after.safes.reduce((a, b) => a + b, 0);
  assert.ok(close(sum, 1), "ownership adds up to 100%");
  assert.throws(() => safeRound({ safes: [{ amount: 9, cap: 10 }], poolBefore: 0.2 }), /whole company/);
});

test("XP and levels", () => {
  const s = emptyState();
  assert.equal(totalXp(s), 0);
  s.read = { a: "2026-01-01", b: "2026-01-02" };
  s.quiz = { 1: { best: 4 }, 2: { best: 5 } };
  s.builders = { x: { completed: "2026-01-03" }, y: { answers: {} } };
  assert.equal(totalXp(s), 2 * 50 + 9 * 10 + 100);
  assert.equal(level(0).name, LEVELS[0][1]);
  assert.equal(level(LEVELS[1][0]).name, LEVELS[1][1]);
  assert.equal(level(5000).next, null);
});
