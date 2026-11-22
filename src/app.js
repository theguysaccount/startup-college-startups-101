// Course progress, quizzes, builders and calculators. Everything stays in this browser (localStorage); nothing is
// sent anywhere. Each page includes a small JSON block that tells this script what it is.
import { render, fillDoc, missing, escapeHtml } from "./md.js";
import { runway, safeRound, pct, money } from "./calc.js";

const KEY = "sc101:v1";
const XP = { read: 50, perCorrect: 10, built: 100 };
export const LEVELS = [[0, "Getting started"], [300, "Validator"], [700, "Builder"], [1100, "Launcher"], [1500, "Operator"], [1800, "Course complete"]];

export function emptyState() { return { read: {}, quiz: {}, builders: {}, started: null }; }
function load() { try { return { ...emptyState(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return emptyState(); } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; } }

/** XP from the saved state: reading, best quiz score, completed builders. */
export function totalXp(s) {
  let xp = Object.keys(s.read || {}).length * XP.read;
  for (const q of Object.values(s.quiz || {})) xp += (q.best || 0) * XP.perCorrect;
  for (const b of Object.values(s.builders || {})) if (b.completed) xp += XP.built;
  return xp;
}
export function level(xp) { let name = LEVELS[0][1], next = null; for (const [min, n] of LEVELS) { if (xp >= min) name = n; else { next = min; break; } } return { name, next }; }

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pageData = () => { const el = document.getElementById("page-data"); return el ? JSON.parse(el.textContent) : {}; };
const today = () => new Date().toISOString().slice(0, 10);

function updateBadges(s) {
  const xp = totalXp(s);
  for (const el of $$("[data-xp]")) el.textContent = `${xp} XP · ${level(xp).name}`;
  for (const el of $$("[data-module-status]")) {
    const slug = el.dataset.moduleStatus, b = el.dataset.builder, n = el.dataset.n;
    const parts = [];
    if (s.read[slug]) parts.push("read");
    if (s.quiz[n]) parts.push(`quiz ${s.quiz[n].best}/5`);
    if (s.builders[b]?.completed) parts.push("document done");
    el.textContent = parts.length ? parts.join(" · ") : "";
    el.closest(".mod-card")?.classList.toggle("done", !!(s.read[slug] && s.builders[b]?.completed));
  }
}

function toast(msg) {
  let t = $("#toast");
  if (!t) { t = Object.assign(document.createElement("div"), { id: "toast", className: "toast", role: "status" }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- module page ----------
function modulePage(s, d) {
  const readBtn = $("#mark-read");
  const sync = () => { readBtn.textContent = s.read[d.slug] ? "Read ✓" : `Mark as read (+${XP.read} XP)`; readBtn.disabled = !!s.read[d.slug]; };
  readBtn?.addEventListener("click", () => { s.read[d.slug] = today(); s.started ||= today(); save(s); sync(); updateBadges(s); toast(`+${XP.read} XP`); });
  if (readBtn) sync();
  const form = $("#quiz");
  if (form) {
    const prev = s.quiz[d.n];
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let score = 0;
      const answers = [];
      $$(".q", form).forEach((q, i) => {
        const chosen = $("input:checked", q);
        const pick = chosen ? Number(chosen.value) : -1;
        answers.push(pick);
        const right = pick === d.quiz[i].answer;
        if (right) score++;
        q.classList.toggle("right", right);
        q.classList.toggle("wrong", !right);
        const why = $(".why", q);
        why.hidden = false;
        why.textContent = (right ? "Right. " : pick < 0 ? "Not answered. " : "Not quite. ") + d.quiz[i].why;
      });
      const best = Math.max(score, s.quiz[d.n]?.best || 0);
      const gained = (best - (s.quiz[d.n]?.best || 0)) * XP.perCorrect;
      s.quiz[d.n] = { best, last: score, at: today(), answers };
      s.started ||= today();
      save(s);
      $("#quiz-result").textContent = `${score} of ${d.quiz.length} right${gained ? ` (+${gained} XP)` : ""}. ${score < d.quiz.length ? "Read the explanations, then try again any time." : "All right."}`;
      updateBadges(s);
    });
    if (prev) $("#quiz-result").textContent = `Your best so far: ${prev.best} of ${d.quiz.length}.`;
  }
}

// ---------- builder page ----------
function builderPage(s, d) {
  const b = d.builder;
  const st = (s.builders[b.slug] ||= { answers: {} });
  const form = $("#builder");
  const preview = $("#doc-preview");
  const status = $("#builder-status");
  for (const f of b.fields) {
    const el = form.elements[f.id];
    if (!el) continue;
    const v = st.answers[f.id];
    if (v != null) el.value = Array.isArray(v) ? v.join("\n") : v;
  }
  const read = () => { for (const f of b.fields) { const el = form.elements[f.id]; if (el) st.answers[f.id] = f.type === "list" ? el.value.split("\n") : el.value; } };
  const refresh = () => {
    read();
    const doc = fillDoc(b, st.answers);
    preview.innerHTML = render(doc, { idPrefix: "doc-" }).html;
    const miss = missing(b, st.answers);
    $("#complete").disabled = miss.length > 0;
    status.textContent = st.completed ? `Completed ${st.completed}. Keep editing any time; it saves in this browser.` : miss.length ? `${miss.length} required ${miss.length === 1 ? "answer" : "answers"} to go: ${miss.map((f) => f.label).slice(0, 3).join("; ")}${miss.length > 3 ? "…" : ""}` : "Everything required is filled in. Mark it complete when you're happy.";
    return doc;
  };
  let t;
  form.addEventListener("input", () => { refresh(); clearTimeout(t); t = setTimeout(() => { s.started ||= today(); save(s); }, 300); });
  $("#complete").addEventListener("click", () => {
    refresh();
    if (missing(b, st.answers).length) return;
    const first = !st.completed;
    st.completed = st.completed || today();
    save(s);
    refresh();
    updateBadges(s);
    toast(first ? `Document complete: +${XP.built} XP` : "Saved");
  });
  $("#copy-doc").addEventListener("click", async () => { const doc = refresh(); try { await navigator.clipboard.writeText(doc); toast("Copied as text"); } catch { prompt("Copy your document:", doc); } });
  $("#download-doc").addEventListener("click", () => {
    const doc = refresh();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([doc], { type: "text/markdown;charset=utf-8" })), download: `${b.slug}.md` });
    document.body.append(a); a.click(); a.remove();
  });
  $("#print-doc").addEventListener("click", () => { refresh(); window.print(); });
  $("#clear-doc").addEventListener("click", () => {
    if (!confirm("Clear every answer in this document? This can't be undone.")) return;
    s.builders[b.slug] = { answers: {} };
    save(s);
    location.reload();
  });
  refresh();
}

// ---------- progress page ----------
function progressPage(s, d) {
  const xp = totalXp(s);
  const lv = level(xp);
  $("#xp-total").textContent = `${xp} XP`;
  $("#xp-level").textContent = lv.name + (lv.next ? ` · ${lv.next - xp} XP to the next level` : "");
  $("#xp-bar").style.width = `${Math.min(100, (100 * xp) / d.maxXp).toFixed(1)}%`;
  const rows = $("#progress-rows");
  rows.innerHTML = d.modules.map((m) => {
    const q = s.quiz[m.n], bl = s.builders[m.builder];
    return `<tr><td><a href="${m.url}">${m.n}. ${escapeHtml(m.title)}</a></td><td>${s.read[m.slug] ? "✓" : "–"}</td><td>${q ? `${q.best}/5` : "–"}</td><td>${bl?.completed ? `<a href="${m.builderUrl}">✓ ${escapeHtml(m.builderTitle)}</a>` : `<a href="${m.builderUrl}">start</a>`}</td></tr>`;
  }).join("");
  const docs = d.modules.filter((m) => s.builders[m.builder]?.completed);
  $("#all-docs").disabled = !docs.length;
  $("#all-docs").addEventListener("click", () => {
    const text = docs.map((m) => fillDoc(d.builders[m.builder], s.builders[m.builder].answers)).join("\n\n---\n\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" })), download: "startups-101-my-documents.md" });
    document.body.append(a); a.click(); a.remove();
  });
  const record = $("#record");
  record.innerHTML = `<h2>Course record</h2><p>${docs.length} of ${d.modules.length} documents completed, ${Object.keys(s.read).length} of ${d.modules.length} modules read, ${xp} XP${s.started ? `, started ${s.started}` : ""}.</p>` +
    (docs.length ? `<ul>${docs.map((m) => `<li>${escapeHtml(m.builderTitle)}: completed ${s.builders[m.builder].completed}</li>`).join("")}</ul>` : "") +
    `<p class="fine">Self-reported progress kept in one browser. It is not a credential, a certification or an application to any program.</p>`;
  $("#print-record").addEventListener("click", () => { document.body.classList.add("print-record"); window.print(); setTimeout(() => document.body.classList.remove("print-record"), 500); });
  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("Delete all your progress, quiz answers and documents from this browser? This can't be undone.")) return;
    try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
    location.reload();
  });
}

// ---------- calculators ----------
function runwayTool() {
  const form = $("#runway-form");
  const out = $("#runway-out");
  const go = () => {
    const v = Object.fromEntries([...new FormData(form)].map(([k, x]) => [k, Number(x) || 0]));
    const r = runway(v);
    out.innerHTML = `<p><strong>Net burn:</strong> ${money(r.burn)} a month.</p><p><strong>Runway:</strong> ${Number.isFinite(r.months) ? `${r.months.toFixed(1)} months` : "not burning cash at these numbers"}.</p>` +
      `<p><strong>To reach the milestone with a ${v.bufferMonths}-month buffer</strong> at this burn you would need about ${money(r.toRaise)} more than you have.</p>`;
  };
  form.addEventListener("input", go);
  go();
}

function safeTool() {
  const form = $("#safe-form");
  const out = $("#safe-out");
  const go = () => {
    const n = (name) => Number(form.elements[name].value) || 0;
    const safes = [1, 2, 3].map((i) => ({ amount: n(`amount${i}`), cap: n(`cap${i}`) })).filter((x) => x.amount > 0 && x.cap > 0);
    try {
      const r = safeRound({ safes, poolBefore: n("poolBefore") / 100, round: n("investment") > 0 ? { investment: n("investment"), postMoney: n("postMoney"), poolTarget: n("poolTarget") / 100 } : null });
      const row = (label, b, a) => `<tr><td>${label}</td><td>${pct(b)}</td><td>${r.after ? pct(a) : "–"}</td></tr>`;
      out.innerHTML = `<table><thead><tr><th></th><th>After the SAFEs</th><th>After the priced round</th></tr></thead><tbody>` +
        row("Founders", r.before.founders, r.after?.founders) + row("Option pool", r.before.pool, r.after?.pool) +
        r.before.safes.map((x, i) => row(`SAFE ${i + 1}`, x, r.after?.safes[i])).join("") +
        row("New investors", 0, r.after?.investors) + `</tbody></table>`;
    } catch (e) { out.innerHTML = `<p class="warn">${escapeHtml(e.message)}</p>`; }
  };
  form.addEventListener("input", go);
  go();
}

export function boot() {
  const s = load();
  const d = pageData();
  updateBadges(s);
  if (d.type === "module") modulePage(s, d);
  else if (d.type === "builder") builderPage(s, d);
  else if (d.type === "progress") progressPage(s, d);
  if ($("#runway-form")) runwayTool();
  if ($("#safe-form")) safeTool();
  window.__course = { state: () => load(), xp: () => totalXp(load()) };
}

if (typeof document !== "undefined") boot();
