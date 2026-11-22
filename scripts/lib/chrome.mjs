// Drive headless Chrome over the DevTools protocol with no dependencies (Node 22+ has WebSocket).
// Records console errors, exceptions and every network request each page makes, so tests can prove
// that nothing leaves the device.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("Chrome not found; set CHROME=/path/to/chrome");
  return found;
}

export async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sc-chrome-"));
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"];
  if (process.env.CI || process.getuid?.() === 0) args.unshift("--no-sandbox");
  const proc = spawn(chromePath(), args, { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("Chrome did not start: " + buf.slice(-400))), 30000);
    proc.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
    proc.on("exit", () => reject(new Error("Chrome exited: " + buf.slice(-400))));
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r, { once: true }); ws.addEventListener("error", j, { once: true }); });
  let seq = 0;
  const waiting = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(typeof e.data === "string" ? e.data : e.data.toString());
    if (m.id && waiting.has(m.id)) {
      const { resolve, reject } = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
    } else for (const l of listeners) l(m);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  async function newPage({ width = 1280, height = 900, mobile = false, scheme = process.env.SS_SCHEME || "light" } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const errors = [], requests = [];
    on((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "exception");
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(`${m.params.entry.text} ${m.params.entry.url || ""}`.trim());
      if (m.method === "Network.requestWillBeSent") requests.push({ url: m.params.request.url, method: m.params.request.method, hasBody: !!m.params.request.hasPostData || !!m.params.request.postData, type: m.params.type });
    });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    await send("Log.enable", {}, sessionId);
    await send("Network.enable", {}, sessionId);
    await send("DOM.enable", {}, sessionId);
    const page = {
      sessionId, errors, requests,
      send: (method, params) => send(method, params, sessionId),
      async viewport(w, h, isMobile = false) {
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: isMobile }, sessionId);
        if (isMobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
      },
      async goto(url, settleMs = 300) {
        const loaded = new Promise((resolve) => { const off = on((m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { off(); resolve(); } }); });
        await send("Page.navigate", { url }, sessionId);
        await Promise.race([loaded, new Promise((r) => setTimeout(r, 25000))]);
        if (settleMs) await new Promise((r) => setTimeout(r, settleMs));
      },
      async eval(expression) {
        const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
        return r.result.value;
      },
      async waitFor(expression, timeout = 20000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
          if (await page.eval(`!!(${expression})`)) return true;
          await new Promise((r) => setTimeout(r, 120));
        }
        throw new Error("timed out waiting for " + expression);
      },
      /** Put files into an <input type=file> as if chosen by a person, and fire its change event. */
      async setFiles(selector, files) {
        const { root } = await send("DOM.getDocument", { depth: 1 }, sessionId);
        const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector }, sessionId);
        if (!nodeId) throw new Error("no element " + selector);
        await send("DOM.setFileInputFiles", { nodeId, files }, sessionId);
      },
      async screenshot(file, fullPage = false) {
        const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage }, sessionId);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(data, "base64"));
      },
      async close() { await send("Target.closeTarget", { targetId }); },
    };
    await page.viewport(width, height, mobile);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] }, sessionId);
    return page;
  }

  async function close() {
    try { ws.close(); } catch { /* ignore */ }
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  return { send, newPage, close };
}
