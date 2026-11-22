// End-to-end self-test in headless Chrome, against the local build or the live site:
//   node scripts/selftest.mjs                 serves dist/ the way Pages does
//   node scripts/selftest.mjs https://…/      tests the live site
// Walks the course as a learner: reads a module, takes its quiz, fills its builder to completion, checks XP and the
// progress page, runs both calculators, visits every module and template, checks phone layout, console errors,
// and that the pages contact nothing but this site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./lib/chrome.mjs";
import { createServer } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "selftest-out");
fs.mkdirSync(OUT, { recursive: true });
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); else console.log("  ok  " + msg); };

let base = process.argv[2], server, info;
if (!base) {
  info = JSON.parse(fs.readFileSync(path.join(ROOT, process.env.SC_OUT || "dist", "build-info.json"), "utf8"));
  const bp = new URL(info.siteUrl + "/").pathname;
  server = createServer(bp);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}${bp}`;
}
base = base.replace(/\/?$/, "/");
const origin = new URL(base).origin;
if (!info) info = await (await fetch(base + "build-info.json")).json();
console.log(`self-test against ${base} (${info.modules.length} modules)`);

const privacy = (page, label) => {
  const bad = page.requests.filter((r) => !(r.url.startsWith(origin + "/") || r.url.startsWith("data:") || r.url.startsWith("blob:")) || r.method !== "GET" || r.hasBody);
  check(!bad.length, `${label}: contacts only this site, sends nothing${bad.length ? " (saw " + bad.slice(0, 3).map((r) => r.method + " " + r.url).join(", ") + ")" : ""}`);
  page.requests.length = 0;
};
const noErrors = (page, label) => { check(!page.errors.length, `${label}: no console errors${page.errors.length ? ": " + page.errors.slice(0, 3).join(" | ") : ""}`); page.errors.length = 0; };
const overflow = (page) => page.eval("document.documentElement.scrollWidth - window.innerWidth");

const chrome = await launch();
try {
  const page = await chrome.newPage({ width: 1280, height: 900 });
  await page.goto(base, 400);
  await page.eval(`localStorage.clear()`);
  await page.goto(base, 300);
  const mods = await page.eval(`[...document.querySelectorAll(".mod-card > a")].map((a) => a.href)`);
  check(mods.length === info.modules.length, `home lists all ${info.modules.length} modules`);
  check((await page.eval(`document.querySelector("[data-xp]").textContent`)).startsWith("0 XP"), "a new learner starts at 0 XP");
  await page.screenshot(path.join(OUT, "desktop-home.png"));
  // Module 1 as a learner
  const first = info.modules[0];
  await page.goto(mods[0], 300);
  const lesson = await page.eval(`({ h2: document.querySelectorAll(".lesson h2").length, words: document.querySelector(".lesson").textContent.split(/\\s+/).length, q: document.querySelectorAll("#quiz .q").length })`);
  check(lesson.h2 >= 3 && lesson.words > 800 && lesson.q === 5, `module 1: ${lesson.h2} sections, ~${lesson.words} words, 5 questions`);
  await page.eval(`document.getElementById("mark-read").click()`);
  const answers = JSON.parse(await page.eval(`document.getElementById("page-data").textContent`)).quiz.map((q) => q.answer);
  await page.eval(`(() => { const a = ${JSON.stringify(answers)}; document.querySelectorAll("#quiz .q").forEach((q, i) => { q.querySelectorAll("input")[a[i]].checked = true; }); document.querySelector("#quiz button[type=submit]").click(); })()`);
  const quiz = await page.eval(`({ result: document.getElementById("quiz-result").textContent, why: [...document.querySelectorAll("#quiz .why")].every((w) => !w.hidden && w.textContent.length > 10) })`);
  check(/5 of 5 right/.test(quiz.result) && quiz.why, `quiz scores and explains: "${quiz.result}"`);
  check((await page.eval(`window.__course.xp()`)) === 100, "reading (+50) and a perfect quiz (+50) give 100 XP");
  await page.screenshot(path.join(OUT, "desktop-module.png"));
  // Its builder: fill every field, complete it
  await page.eval(`document.querySelector(".build-cta a.btn").click()`);
  await page.waitFor(`document.getElementById("builder")`);
  const fields = JSON.parse(await page.eval(`document.getElementById("page-data").textContent`)).builder.fields;
  check(await page.eval(`document.getElementById("complete").disabled`), "an empty document can't be marked complete");
  await page.eval(`(() => { const f = ${JSON.stringify(fields)}; const form = document.getElementById("builder");
    for (const x of f) { const el = form.elements[x.id]; el.value = x.type === "list" ? Array.from({ length: Math.max(3, x.min || 1) }, (_, i) => "Test line " + (i + 1)).join("\\n") : x.type === "number" ? "12" : "Test answer for " + x.label; }
    form.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  const doc = await page.eval(`document.getElementById("doc-preview").textContent`);
  check(!/to fill in/.test(doc) && /Test answer/.test(doc), "the document fills in as you type");
  await page.eval(`document.getElementById("complete").click()`);
  check((await page.eval(`window.__course.xp()`)) === 200, "completing the document gives +100 XP");
  await page.screenshot(path.join(OUT, "desktop-builder.png"));
  // Persistence and the progress page
  await page.goto(base + "progress/", 300);
  const prog = await page.eval(`({ xp: document.getElementById("xp-total").textContent, rows: document.querySelectorAll("#progress-rows tr").length, record: document.getElementById("record").textContent })`);
  check(prog.xp === "200 XP" && prog.rows === info.modules.length && /1 of \d+ documents completed/.test(prog.record) && /not a credential/.test(prog.record), "progress page shows XP, every module and a course record that isn't a credential");
  await page.screenshot(path.join(OUT, "desktop-progress.png"));
  // Every module and template renders
  for (const m of info.modules) {
    await page.goto(`${base}modules/${m.slug}/`, 80);
    const ok = await page.eval(`document.querySelectorAll(".lesson h2").length >= 3 && document.querySelectorAll("#quiz .q").length === 5 && !!document.querySelector(".build-cta a")`);
    if (!ok) problems.push(`module ${m.n} (${m.slug}) is incomplete`);
    await page.goto(`${base}templates/${m.builder}/`, 80);
    const ok2 = await page.eval(`document.querySelectorAll("#builder .field").length >= 6 && document.getElementById("doc-preview").textContent.length > 20`);
    if (!ok2) problems.push(`template ${m.builder} is incomplete`);
  }
  check(true, `all ${info.modules.length} modules and templates render`);
  // Calculators
  await page.goto(base + "tools/safe-calculator/", 200);
  const safe = await page.eval(`document.getElementById("safe-out").textContent`);
  check(/Founders/.test(safe) && /New investors/.test(safe) && /%/.test(safe), "SAFE calculator shows an ownership table");
  await page.goto(base + "tools/runway-calculator/", 200);
  check(/10\.0 months/.test(await page.eval(`document.getElementById("runway-out").textContent`)), "runway calculator: 150,000 at a 15,000 net burn is 10.0 months");
  for (const p of ["templates/", "about/"]) { await page.goto(base + p, 80); check(await page.eval(`document.querySelector("h1").textContent.length > 5`), `${p} renders`); }
  privacy(page, "course, templates, tools");
  noErrors(page, "course, templates, tools");
  // Reset
  await page.goto(base + "progress/", 200);
  await page.eval(`window.confirm = () => true; document.getElementById("reset-progress").click()`);
  await new Promise((r) => setTimeout(r, 600));
  check((await page.eval(`window.__course.xp()`)) === 0, "deleting progress resets to 0 XP");
  await page.close();

  const phone = await chrome.newPage({ width: 390, height: 844, mobile: true });
  for (const p of ["", `modules/${info.modules[0].slug}/`, `templates/${info.modules[0].builder}/`, "tools/safe-calculator/", "progress/"]) {
    await phone.goto(base + p, 200);
    check((await overflow(phone)) <= 1, `phone: /${p} has no sideways scroll`);
  }
  await phone.goto(base, 200);
  await phone.screenshot(path.join(OUT, "phone-home.png"));
  await phone.goto(`${base}templates/${info.modules[1]?.builder || info.modules[0].builder}/`, 200);
  await phone.screenshot(path.join(OUT, "phone-template.png"));
  privacy(phone, "phone");
  noErrors(phone, "phone");
  await phone.close();
} catch (e) {
  problems.push("self-test crashed: " + (e.stack || e.message));
} finally {
  await chrome.close();
  server?.close();
}
fs.writeFileSync(path.join(OUT, "report.txt"), problems.length ? problems.join("\n") + "\n" : "all checks passed\n");
if (problems.length) { console.error("\nFAILED:\n" + problems.map((p) => " - " + p).join("\n")); process.exit(1); }
console.log("\nself-test passed");
