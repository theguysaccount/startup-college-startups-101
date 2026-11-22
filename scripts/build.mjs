// Build the course site into dist/ (or $SC_OUT) from content/: home, nine modules, nine document builders (they
// double as free templates), the progress page, two calculators, about, sitemap, robots.txt and the IndexNow key.
//   node scripts/build.mjs
// Environment (optional; GitHub Actions passes repository variables):
//   SITE_URL        public base URL, no trailing slash (default: the github.io project URL). The one setting that
//                   moves the site to a custom domain.
//   SC_APPLY_URL    an application page for a founder program; shown on the progress page only when set
//   SC_SUPPORT_URL  a donation / sponsor link in the footer (off when empty)
//   SC_GOATCOUNTER  https://<code>.goatcounter.com/count for cookieless page counts (off when empty)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { render, frontMatter, escapeHtml as esc } from "../src/md.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_SITE_URL = "https://theguysaccount.github.io/startup-college-startups-101";
const SITE_URL = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
const BASE = new URL(SITE_URL + "/").pathname;
const OUT = path.resolve(ROOT, process.env.SC_OUT || "dist");
const APPLY_URL = (process.env.SC_APPLY_URL || "").trim();
const SUPPORT_URL = (process.env.SC_SUPPORT_URL || "").trim();
const GOATCOUNTER = (process.env.SC_GOATCOUNTER || "").trim();
const REPO_URL = "https://github.com/theguysaccount/startup-college-startups-101";
const NAME = "Startups 101";
const BRAND = "Startup College";
const DAY = process.env.SC_TODAY || new Date().toISOString().slice(0, 10);
const abs = (p) => SITE_URL + "/" + String(p).replace(/^\//, "");
const rel = (p) => BASE + String(p).replace(/^\//, "");
const write = (p, c) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };
const sha = (s, n = 16) => crypto.createHash("sha256").update(s).digest("hex").slice(0, n);

export function loadCourse(dir = path.join(ROOT, "content")) {
  const modules = fs.readdirSync(path.join(dir, "modules")).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const { data, body } = frontMatter(fs.readFileSync(path.join(dir, "modules", f), "utf8"));
    const nn = String(data.n).padStart(2, "0");
    const quiz = JSON.parse(fs.readFileSync(path.join(dir, "quizzes", `${nn}.json`), "utf8"));
    const builder = JSON.parse(fs.readFileSync(path.join(dir, "builders", `${data.builder}.json`), "utf8"));
    const { html, headings } = render(body);
    const words = body.split(/\s+/).filter(Boolean).length;
    return { ...data, file: f, body, html, headings, quiz, builder, words };
  });
  return { modules: modules.sort((a, b) => a.n - b.n) };
}

const modPath = (m) => `modules/${m.slug}/`;
const builderPath = (b) => `templates/${b.slug}/`;

function shell({ title, description, pathname, body, jsonld = [], noindex = false, pageData = null, bodyClass = "", v, og = "og/home.png" }) {
  const gcOrigin = GOATCOUNTER ? new URL(GOATCOUNTER).origin : "";
  const csp = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:${gcOrigin ? " " + gcOrigin : ""}; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'self'`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(abs(pathname))}">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}: ${NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(abs(pathname))}">
<meta property="og:image" content="${esc(abs(og))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#13294b">
<link rel="icon" href="${rel("favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${rel(`assets/site.css?v=${v}`)}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
${pageData ? `<script type="application/json" id="page-data">${JSON.stringify(pageData).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body class="${bodyClass}"${GOATCOUNTER ? ` data-gc="${esc(GOATCOUNTER)}"` : ""}>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${rel("")}"><span class="brand-mark" aria-hidden="true">101</span><span>${BRAND} <strong>${NAME}</strong></span></a>
  <nav aria-label="Main"><a href="${rel("")}#modules">Modules</a><a href="${rel("templates/")}">Templates</a><a href="${rel("tools/safe-calculator/")}">Tools</a><a href="${rel("progress/")}" class="xp-link"><span data-xp>0 XP</span></a></nav>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <p><strong>${NAME}</strong> is a free course: nine modules, each ending in a document you keep. It promises no income, funding or outcome; most startups fail, and many good companies never raise money. Lessons on equity, SAFEs and hiring explain how things commonly work and are not legal, tax or investment advice.</p>
  <p>Your progress and documents stay in this browser. <a href="${rel("about/")}">About, privacy and corrections</a> · <a href="${REPO_URL}" rel="noopener">Source</a> · Text CC BY 4.0${SUPPORT_URL ? ` · <a href="${esc(SUPPORT_URL)}" rel="noopener" data-slot="support">Support this free course</a>` : ""}</p>
</footer>
<script type="module" src="${rel(`assets/app.js?v=${v}`)}"></script>
</body>
</html>
`;
}

function homePage(course, v) {
  const mods = course.modules;
  const total = mods.reduce((a, m) => a + Number(m.minutes || 0), 0);
  const body = `
<section class="hero">
  <p class="eyebrow">A free course from ${BRAND}</p>
  <h1>Learn to build a startup by building one.</h1>
  <p class="lede">Nine short modules, from choosing a problem to hiring your first teammate. Each one ends with a real document you fill in as you go: a pitch memo, a customer discovery plan, an MVP and launch plan, a raise plan, a first-hire plan. No sign-up; your work stays in your browser.</p>
  <p><a class="btn" href="${rel(modPath(mods[0]))}">Start Module 1</a> <a class="btn ghost" href="${rel("templates/")}">Just the templates</a></p>
</section>
<section id="modules" aria-labelledby="mods-h">
  <h2 id="mods-h">The modules</h2>
  <p class="sub">About ${Math.round(total / 60 * 10) / 10} hours of reading in all, plus the time you spend doing the work. Earn XP as you read, check yourself and finish each document.</p>
  <ol class="mods">${mods.map((m) => `<li class="mod-card"><a href="${rel(modPath(m))}"><span class="mod-n">${m.n}</span><span class="mod-t">${esc(m.title)}</span></a>
    <p>${esc(m.outcome)}</p><p class="mod-meta">${m.minutes} min · builds: <a href="${rel(builderPath(m.builder))}">${esc(m.builder.title)}</a> <span class="status" data-module-status="${esc(m.slug)}" data-builder="${esc(m.builder.slug)}" data-n="${m.n}"></span></p></li>`).join("")}</ol>
</section>
<section class="how">
  <h2>How it works</h2>
  <ol class="three">
    <li><strong>Read a short module.</strong> Plain-English lessons with small worked examples. Mark it read for ${50} XP.</li>
    <li><strong>Check yourself.</strong> Five questions with explanations. Each right answer is worth 10 XP; retake any time.</li>
    <li><strong>Do the work.</strong> Fill in the module's document. It updates as you type; copy it, download it or print it. Finishing it is worth 100 XP.</li>
  </ol>
  <h2>What this course isn't</h2>
  <p>It isn't a promise of income, investment or success, and it isn't a credential. It doesn't connect you to investors. The parts about equity, SAFEs and hiring explain how things commonly work; have a lawyer look at real documents, and check the rules where you live.</p>
</section>`;
  const jsonld = [{ "@context": "https://schema.org", "@type": "Course", name: `${NAME}: learn to build a startup by building one`, description: "A free nine-module course for first-time founders. Each module ends with a document you fill in: a pitch memo, a discovery plan, an MVP and launch plan, a raise plan and more.",
    provider: { "@type": "Organization", name: BRAND, url: abs("") }, isAccessibleForFree: true, inLanguage: "en", url: abs(""),
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: `PT${Math.round(total / 60)}H` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", category: "Free" },
    syllabusSections: mods.map((m) => ({ "@type": "Syllabus", name: m.title, description: m.summary, url: abs(modPath(m)) })) }];
  return shell({ title: `${NAME}: a free startup course where you build as you learn | ${BRAND}`, description: "Nine free modules for first-time founders, from choosing a problem to hiring your first teammate. Each ends with a document you keep: pitch memo, MVP plan, launch post, raise plan.", pathname: "", body, jsonld, v, bodyClass: "page-home" });
}

function modulePage(course, m, v) {
  const i = course.modules.indexOf(m), prev = course.modules[i - 1], next = course.modules[i + 1];
  const toc = m.headings.filter((h) => h.level === 2);
  const quizHtml = m.quiz.map((q, qi) => `<fieldset class="q"><legend>${qi + 1}. ${esc(q.q)}</legend>${q.options.map((o, oi) => `<label><input type="radio" name="q${qi}" value="${oi}"> ${esc(o)}</label>`).join("")}<p class="why" hidden></p></fieldset>`).join("");
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${rel("")}">${NAME}</a> › <span>Module ${m.n}</span></nav>
<article class="module">
  <header class="mod-head">
    <p class="eyebrow">Module ${m.n} of ${course.modules.length} · ${m.minutes} minutes</p>
    <h1>${esc(m.title)}</h1>
    <p class="lede">${esc(m.outcome)}</p>
    <p class="mod-meta"><span class="status" data-module-status="${esc(m.slug)}" data-builder="${esc(m.builder.slug)}" data-n="${m.n}"></span></p>
  </header>
  <nav class="toc" aria-label="In this module"><strong>In this module</strong><ol>${toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}<li><a href="#check">Check yourself</a></li></ol></nav>
  <div class="lesson">
${m.html}
  </div>
  <p class="read-row"><button type="button" class="btn ghost" id="mark-read">Mark as read (+50 XP)</button></p>
  <section class="build-cta" aria-labelledby="do-h">
    <h2 id="do-h">Your document for this module</h2>
    <p><strong>${esc(m.builder.title)}.</strong> ${esc(m.builder.intro)}</p>
    <p><a class="btn" href="${rel(builderPath(m.builder))}">Open the ${esc(m.builder.title.toLowerCase())} builder (+100 XP)</a></p>
  </section>
  <section id="check" aria-labelledby="check-h">
    <h2 id="check-h">Check yourself</h2>
    <form id="quiz" class="quiz">${quizHtml}<p><button type="submit" class="btn">Check my answers</button></p><p id="quiz-result" class="quiz-result" role="status"></p></form>
  </section>
  <nav class="pager" aria-label="Modules">${prev ? `<a href="${rel(modPath(prev))}" rel="prev">← ${prev.n}. ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="${rel(modPath(next))}" rel="next">${next.n}. ${esc(next.title)} →</a>` : `<a href="${rel("progress/")}">Your progress →</a>`}</nav>
</article>`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "LearningResource", name: m.title, description: m.summary, url: abs(modPath(m)), learningResourceType: "Lesson", educationalLevel: "Beginner", timeRequired: `PT${m.minutes}M`, isAccessibleForFree: true, inLanguage: "en",
      isPartOf: { "@type": "Course", name: NAME, url: abs("") }, teaches: m.outcome },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: NAME, item: abs("") }, { "@type": "ListItem", position: 2, name: m.title, item: abs(modPath(m)) }] },
  ];
  return shell({ title: `${m.title}: Module ${m.n} | ${NAME}`, description: m.summary, pathname: modPath(m), body, jsonld, v, bodyClass: "page-module",
    pageData: { type: "module", n: m.n, slug: m.slug, quiz: m.quiz.map(({ answer, why }) => ({ answer, why })) } });
}

function builderPage(course, m, v) {
  const b = m.builder;
  const field = (f) => {
    const id = `f-${f.id}`;
    const req = f.required ? ' <span class="req">required</span>' : "";
    const help = f.help ? `<span class="help">${esc(f.help)}</span>` : "";
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
    let input;
    if (f.type === "textarea") input = `<textarea id="${id}" name="${f.id}" rows="4"${ph}></textarea>`;
    else if (f.type === "list") input = `<textarea id="${id}" name="${f.id}" rows="${Math.max(3, f.min || 3)}"${ph || ' placeholder="One per line"'}></textarea><span class="help">One per line${f.min ? `; at least ${f.min}` : ""}.</span>`;
    else input = `<input id="${id}" name="${f.id}" type="${f.type === "number" ? "number" : "text"}"${ph}>`;
    return `<div class="field"><label for="${id}">${esc(f.label)}${req}</label>${help}${input}</div>`;
  };
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${rel("")}">${NAME}</a> › <a href="${rel("templates/")}">Templates</a> › <span>${esc(b.title)}</span></nav>
<article class="builder-page">
  <header>
    <p class="eyebrow">Free template · from Module ${m.n}: <a href="${rel(modPath(m))}">${esc(m.title)}</a></p>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.intro)}</p>
    <p class="fine">Fill it in here: it saves in this browser as you type, and nothing is sent anywhere. Copy, download or print the result.</p>
  </header>
  <div class="builder-grid">
    <form id="builder" class="builder" autocomplete="off">${b.fields.map(field).join("")}</form>
    <aside class="doc-col">
      <div class="doc-tools">
        <button type="button" class="btn" id="complete" disabled>Mark complete (+100 XP)</button>
        <button type="button" class="btn ghost small" id="copy-doc">Copy</button>
        <button type="button" class="btn ghost small" id="download-doc">Download .md</button>
        <button type="button" class="btn ghost small" id="print-doc">Print or save PDF</button>
      </div>
      <p id="builder-status" class="builder-status" role="status"></p>
      <div class="doc" id="doc-preview" aria-live="polite"></div>
      <p><button type="button" class="linkish" id="clear-doc">Clear this document</button></p>
    </aside>
  </div>
</article>`;
  const jsonld = [{ "@context": "https://schema.org", "@type": "HowTo", name: `How to write a ${b.title.toLowerCase()}`, description: b.intro, step: b.fields.map((f, i) => ({ "@type": "HowToStep", position: i + 1, name: f.label, text: f.help || f.label })) }];
  return shell({ title: `${b.title} template: fill in free online | ${NAME}`, description: `${b.intro} A free ${b.title.toLowerCase()} template you fill in online; it saves in your browser and downloads as text.`.slice(0, 300), pathname: builderPath(b), body, jsonld, v, bodyClass: "page-builder", og: "og/templates.png",
    pageData: { type: "builder", builder: b } });
}

function templatesPage(course, v) {
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${rel("")}">${NAME}</a> › <span>Templates</span></nav>
<h1>Free startup templates you fill in online</h1>
<p class="lede">Each template walks you through one founder document with a hint at every step. It saves in your browser as you type; copy, download or print it when you're done. Each one comes from a module that explains the thinking behind it.</p>
<ul class="tpl-list">${course.modules.map((m) => `<li><a href="${rel(builderPath(m.builder))}"><strong>${esc(m.builder.title)}</strong></a><span>${esc(m.builder.intro)}</span><span class="fine">From Module ${m.n}: <a href="${rel(modPath(m))}">${esc(m.title)}</a></span></li>`).join("")}</ul>
<h2>Calculators</h2>
<ul class="tpl-list"><li><a href="${rel("tools/safe-calculator/")}"><strong>SAFE and dilution calculator</strong></a><span>Estimate ownership after post-money SAFEs and a priced round.</span></li><li><a href="${rel("tools/runway-calculator/")}"><strong>Runway calculator</strong></a><span>Months of cash left, and roughly how much a milestone needs.</span></li></ul>`;
  return shell({ title: `Free startup templates: pitch memo, MVP plan, raise plan and more | ${NAME}`, description: "Fill-in-online templates for first-time founders: pitch memo, customer discovery plan, MVP and launch plan, growth experiments, monthly update, raise plan, first-hire plan.", pathname: "templates/", body, v, og: "og/templates.png" });
}

function progressPage(course, v) {
  const maxXp = course.modules.length * (50 + 50 + 100);
  const body = `
<h1>Your progress</h1>
<p class="lede">Kept in this browser only. Clearing your browser data, or using another device, starts you from zero.</p>
<section class="xp-card"><p class="xp-big" id="xp-total">0 XP</p><p id="xp-level"></p><div class="xp-track"><div class="xp-fill" id="xp-bar"></div></div><p class="fine">Up to ${maxXp} XP: 50 for reading each module, 10 per right answer, 100 for each finished document.</p></section>
<table class="progress"><thead><tr><th>Module</th><th>Read</th><th>Quiz</th><th>Document</th></tr></thead><tbody id="progress-rows"></tbody></table>
<p class="actions"><button type="button" class="btn" id="all-docs">Download all my documents</button> <button type="button" class="btn ghost" id="print-record">Print my course record</button></p>
<section class="record" id="record"></section>
${APPLY_URL ? `<section class="apply"><h2>Want to keep going with others?</h2><p>${BRAND} runs a founder program. Applying is separate from this course and finishing the course doesn't change your chances.</p><p><a class="btn" href="${esc(APPLY_URL)}" rel="noopener" data-slot="apply">Read about the program</a></p></section>` : ""}
<p><button type="button" class="linkish danger" id="reset-progress">Delete my progress from this browser</button></p>`;
  const builders = Object.fromEntries(course.modules.map((m) => [m.builder.slug, m.builder]));
  return shell({ title: `Your progress | ${NAME}`, description: "Your XP, module progress and finished documents in Startups 101, kept in this browser only.", pathname: "progress/", body, v, noindex: true,
    pageData: { type: "progress", maxXp, builders, modules: course.modules.map((m) => ({ n: m.n, slug: m.slug, title: m.title, url: rel(modPath(m)), builder: m.builder.slug, builderTitle: m.builder.title, builderUrl: rel(builderPath(m.builder)) })) } });
}

function toolPages(course, v) {
  const raise = course.modules.find((m) => /raise/.test(m.slug));
  const disclaimer = `<p class="fine">For learning only, not investment, legal or tax advice. Real numbers depend on your documents and where you are; have a lawyer or accountant check anything you sign.</p>`;
  const safe = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${rel("")}">${NAME}</a> › <a href="${rel("templates/")}">Tools</a> › <span>SAFE calculator</span></nav>
<h1>SAFE and dilution calculator</h1>
<p class="lede">Estimate who owns what after one to three post-money SAFEs, and then after a priced round with an option pool. Change any number and the table updates.</p>
<div class="tool-grid">
<form id="safe-form" class="tool">
  <fieldset><legend>SAFEs (post-money valuation cap)</legend>
  ${[1, 2, 3].map((i) => `<div class="pair"><label>SAFE ${i} amount <input name="amount${i}" type="number" min="0" step="1000" value="${i === 1 ? 500000 : i === 2 ? 250000 : 0}"></label><label>Post-money cap <input name="cap${i}" type="number" min="0" step="100000" value="${i === 1 ? 8000000 : i === 2 ? 10000000 : 0}"></label></div>`).join("")}
  </fieldset>
  <fieldset><legend>Before the SAFEs</legend><label>Existing option pool, % <input name="poolBefore" type="number" min="0" max="50" step="0.5" value="0"></label></fieldset>
  <fieldset><legend>Priced round (leave the amount at 0 to skip)</legend>
  <div class="pair"><label>New money in <input name="investment" type="number" min="0" step="100000" value="2000000"></label><label>Post-money valuation <input name="postMoney" type="number" min="0" step="100000" value="12000000"></label></div>
  <label>Option pool after the round, % of the company <input name="poolTarget" type="number" min="0" max="40" step="0.5" value="10"></label></fieldset>
</form>
<div class="tool-out" id="safe-out" aria-live="polite"></div>
</div>
<h2>How this estimate works</h2>
<ul>
<li>A <strong>post-money SAFE</strong> owns its amount divided by its post-money cap, measured just before the priced round. A $500,000 SAFE with an $8,000,000 post-money cap owns 6.25%.</li>
<li>Founders and any existing option pool share what's left.</li>
<li>In the <strong>priced round</strong>, new investors own the new money divided by the post-money valuation, and everyone else shrinks by the same proportion.</li>
<li>If investors ask for a bigger <strong>option pool</strong> after the round, the top-up here comes out of the founders' share, which is how post-money SAFEs commonly treat it.</li>
<li>Left out: discounts, caps above the round price, pro rata rights, convertible notes and interest. The YC post-money SAFE (a US practice) is at <a href="https://www.ycombinator.com/documents" rel="noopener">ycombinator.com/documents</a>.</li>
</ul>
${disclaimer}
${raise ? `<p>The thinking behind it: <a href="${rel(modPath(raise))}">Module ${raise.n}: ${esc(raise.title)}</a>.</p>` : ""}`;
  const run = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${rel("")}">${NAME}</a> › <a href="${rel("templates/")}">Tools</a> › <span>Runway calculator</span></nav>
<h1>Startup runway calculator</h1>
<p class="lede">How many months your cash lasts at today's burn, and roughly how much a milestone needs with a safety buffer.</p>
<div class="tool-grid">
<form id="runway-form" class="tool">
  <label>Cash in the bank <input name="cash" type="number" min="0" step="1000" value="150000"></label>
  <label>Monthly costs <input name="monthlyCosts" type="number" min="0" step="500" value="18000"></label>
  <label>Monthly revenue <input name="monthlyRevenue" type="number" min="0" step="500" value="3000"></label>
  <label>Months to your next milestone <input name="monthsToMilestone" type="number" min="1" max="60" value="18"></label>
  <label>Buffer, months <input name="bufferMonths" type="number" min="0" max="24" value="6"></label>
</form>
<div class="tool-out" id="runway-out" aria-live="polite"></div>
</div>
<p>Net burn is costs minus revenue. Runway is cash divided by net burn. Costs usually rise when you hire, so re-run this whenever your plans change.</p>
${disclaimer}`;
  return [
    ["tools/safe-calculator/", shell({ title: `SAFE calculator: estimate dilution from post-money SAFEs and a priced round | ${NAME}`, description: "Free post-money SAFE and dilution calculator: see founder, SAFE, option pool and new investor ownership after SAFEs and a priced round. For learning, not advice.", pathname: "tools/safe-calculator/", body: safe, v, bodyClass: "page-tool", og: "og/tools.png" })],
    ["tools/runway-calculator/", shell({ title: `Startup runway calculator: months of cash and what a milestone needs | ${NAME}`, description: "Free runway calculator for founders: net burn, months of runway, and roughly how much you'd need to reach a milestone with a buffer.", pathname: "tools/runway-calculator/", body: run, v, bodyClass: "page-tool", og: "og/tools.png" })],
  ];
}

function aboutPage(v) {
  const body = `
<article class="prose">
<h1>About ${NAME}</h1>
<p>${NAME} is a free course from ${BRAND} for people building a company for the first time, especially those without a startup network nearby. It is written to be useful on its own: read a module, check your understanding, and leave with a document you can use the same week.</p>
<h2>Principles</h2>
<ul>
<li><strong>Do the work.</strong> Every module ends in a document you fill in, because founders learn by producing things, not by reading about them.</li>
<li><strong>No promises.</strong> The course doesn't promise income, investment or success, and finishing it isn't a credential. Most startups fail; many good companies never raise money.</li>
<li><strong>Not legal advice.</strong> Equity, SAFEs, vesting and hiring rules differ by country. The course explains how things commonly work; get a lawyer to check real documents.</li>
</ul>
<h2>Privacy</h2>
<p>No accounts, cookies or ads. Your XP, quiz answers and documents are saved only in your browser's local storage; the site has no server to send them to. Delete them any time from the progress page.</p>
<h2>Reuse and corrections</h2>
<p>The course text is CC BY 4.0: reuse it with a link back. Found an error or an outdated link? <a href="${REPO_URL}/issues" rel="noopener">Open an issue</a>.</p>
</article>`;
  return shell({ title: `About, privacy and corrections | ${NAME}`, description: "Who makes Startups 101, its principles (no promises, not legal advice), how your progress stays in your browser, and how to report errors.", pathname: "about/", body, v });
}

function copyAssets(v) {
  for (const f of ["app.js", "md.js", "calc.js"]) write(`assets/${f}`, fs.readFileSync(path.join(ROOT, "src", f), "utf8").replace(/(from\s+)(["'])(\.\/[^"']+\.js)\2/g, (m, a, q, p) => `${a}${q}${p}?v=${v}${q}`));
  write("assets/site.css", fs.readFileSync(path.join(ROOT, "src", "site.css")));
  write("favicon.svg", fs.readFileSync(path.join(ROOT, "src", "favicon.svg")));
  const og = path.join(ROOT, "src", "og");
  if (fs.existsSync(og)) for (const f of fs.readdirSync(og)) write(`og/${f}`, fs.readFileSync(path.join(og, f)));
}

export function build() {
  const course = loadCourse();
  const h = crypto.createHash("sha256");
  for (const f of fs.readdirSync(path.join(ROOT, "src")).sort()) { const p = path.join(ROOT, "src", f); if (fs.statSync(p).isFile()) h.update(f).update(fs.readFileSync(p)); }
  for (const m of course.modules) h.update(m.body).update(JSON.stringify(m.quiz)).update(JSON.stringify(m.builder));
  const v = h.update(SITE_URL + APPLY_URL + SUPPORT_URL).digest("hex").slice(0, 10);
  fs.rmSync(OUT, { recursive: true, force: true });
  copyAssets(v);
  const pages = new Map();
  const add = (p, html, index = true) => { write(p + "index.html", html); if (index) pages.set(abs(p), sha(html)); };
  add("", homePage(course, v));
  for (const m of course.modules) { add(modPath(m), modulePage(course, m, v)); add(builderPath(m.builder), builderPage(course, m, v)); }
  add("templates/", templatesPage(course, v));
  for (const [p, html] of toolPages(course, v)) add(p, html);
  add("about/", aboutPage(v));
  add("progress/", progressPage(course, v), false);
  write("404.html", shell({ title: `Not found | ${NAME}`, description: "This page isn't here. Start the free Startups 101 course or open a template.", pathname: "404.html", body: `<section class="prose"><h1>That page isn't here</h1><p><a class="btn" href="${rel("")}">Go to the course</a></p></section>`, v, noindex: true }));
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages.keys()].map((u) => `<url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: ${BASE}progress/\n\nSitemap: ${abs("sitemap.xml")}\n`);
  const key = fs.readFileSync(path.join(ROOT, "src", "indexnow-key.txt"), "utf8").trim();
  write(`${key}.txt`, key + "\n");
  write("manifest.json", JSON.stringify({ generated: DAY, v, pages: Object.fromEntries(pages) }) + "\n");
  write("build-info.json", JSON.stringify({ generated: DAY, v, siteUrl: SITE_URL, modules: course.modules.map((m) => ({ n: m.n, slug: m.slug, builder: m.builder.slug, words: m.words })) }) + "\n");
  return { course, pages: pages.size, v };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = build();
  console.log(`built ${r.pages} pages (${r.course.modules.length} modules, ${r.course.modules.reduce((a, m) => a + m.words, 0)} words) into ${path.relative(ROOT, OUT)}/ (v ${r.v})`);
}
