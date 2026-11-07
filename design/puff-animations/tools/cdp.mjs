// Shared helper: start a headless Edge/Chrome, connect over the DevTools protocol, open a page, clean up after.
// Node 22+ (built-in fetch and WebSocket). No npm packages.
import { spawn, execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CANDIDATES = [process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"].filter(Boolean);

export async function openBrowser({ page, workDir, size = 420, port = +(process.env.PORT || 9339), transparent = false }) {
  const BROWSER = CANDIDATES.find(p => existsSync(p));
  if (!BROWSER) throw new Error("No Edge/Chrome found. Set BROWSER=/path/to/browser.");
  const profile = join(workDir, "_profile");
  const proc = spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${size},${size}`, "--hide-scrollbars", "--force-device-scale-factor=1",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync",
    "--disable-features=msEdgeSync,EdgeSyncDialog",
    "--allow-file-access-from-files",                 // lets the exporter read the local layer PNGs
    "about:blank"], { stdio: "ignore" });

  const stop = async () => {
    // Edge's launcher hands off to other processes, so kill everything using this run's private profile.
    try {
      if (process.platform === "win32") {
        const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
        execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: "ignore" });
      } else execSync(`pkill -f -- "${profile}"`, { stdio: "ignore" });
    } catch {}
    try { proc.kill("SIGKILL"); } catch {}
    for (let i = 0; i < 10; i++) { await sleep(400); try { rmSync(profile, { recursive: true, force: true }); break; } catch {} }
  };

  // Connect to the blank tab we opened (Edge can also open hidden pages such as a sync dialog).
  let wsUrl;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); wsUrl = l.find(t => t.type === "page" && t.url === "about:blank")?.webSocketDebuggerUrl; } catch {}
    if (!wsUrl && i === 16) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json()).webSocketDebuggerUrl; } catch {} }
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) { await stop(); throw new Error("Browser did not start."); }

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let id = 0; const pending = new Map(); const events = [];
  ws.addEventListener("message", m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.push(d.method); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  if (transparent) await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send("Page.navigate", { url: page.startsWith("http") || page.startsWith("file:") ? page : pathToFileURL(page).href });
  for (let i = 0; i < 100 && !events.includes("Page.loadEventFired"); i++) await sleep(100);
  await evaluate("document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode?i.decode().catch(()=>0):0))).then(()=>1)");

  const close = async () => { try { ws.close(); } catch {} await stop(); };
  return { send, evaluate, close, sleep };
}
