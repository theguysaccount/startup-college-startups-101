// Draw the Open Graph share cards (1200×630) with headless Chrome: the course, the templates and the tools.
// The PNGs are committed in src/og/ and copied into every build.   node scripts/og.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./lib/chrome.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "og");
fs.mkdirSync(OUT, { recursive: true });
const card = (title, line, foot) => `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#13294b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
<div style="position:absolute;inset:36px;background:#f6f7fb;border-radius:24px;padding:66px 76px">
<div style="display:flex;align-items:center;gap:16px;font-size:30px;color:#13202f"><span style="background:#13294b;color:#ff7a45;font:900 24px 'Arial Black',Arial,sans-serif;padding:12px 10px;border-radius:10px">101</span>Startup College <b>Startups 101</b></div>
<div style="font-weight:850;font-size:64px;line-height:1.06;color:#13202f;margin-top:52px;letter-spacing:-1px">${title}</div>
<div style="font-size:32px;line-height:1.3;color:#556275;margin-top:20px">${line}</div>
<div style="position:absolute;left:76px;bottom:56px;font-weight:700;font-size:26px;color:#ff7a45">${foot}</div>
</div></body></html>`;
const chrome = await launch();
try {
  const page = await chrome.newPage({ width: 1200, height: 630 });
  for (const [name, a, b, c] of [
    ["home.png", "Learn to build a startup by building one", "Nine free modules. Each ends with a document you keep.", "Free · no sign-up · your work stays in your browser"],
    ["templates.png", "Free founder templates you fill in online", "Pitch memo, MVP plan, launch post, raise plan and more.", "Startups 101 · free"],
    ["tools.png", "SAFE, dilution and runway calculators", "Estimates for learning, with the math explained.", "Startups 101 · free"],
  ]) {
    await page.goto("data:text/html;charset=utf-8," + encodeURIComponent(card(a, b, c)), 300);
    await page.screenshot(path.join(OUT, name));
    console.log("drew og/" + name);
  }
} finally { await chrome.close(); }
