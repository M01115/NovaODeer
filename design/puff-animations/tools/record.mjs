// Records PNG frames of every Puff state x accessory by driving a headless Chromium browser (Edge or Chrome)
// over the DevTools protocol. Needs Node 22+ (built-in fetch and WebSocket). No npm packages.
//
//   node record.mjs [outDir] [states,comma,separated]
//
// Env: SIZE (px, default 420), FPS (default 20), BG (stage color, default #FAFAF7; use "transparent" for alpha PNGs),
//      SETS (default brush,hat,glasses,none), BROWSER (path to msedge/chrome), PORT (default 9339).
import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = resolve(here, "..", "_render.html");
if (!existsSync(page)) { console.error("Run make_render_page.py first (missing _render.html)."); process.exit(1); }
const outDir = resolve(process.argv[2] || join(here, "..", "_frames"));
const onlyIds = process.argv[3];
const SIZE = +(process.env.SIZE || 420), FPS = +(process.env.FPS || 20), PORT = +(process.env.PORT || 9339);
const BG = process.env.BG || "#FAFAF7";
const SETS = (process.env.SETS || "brush,hat,glasses,none").split(",");
const IDS = ["neutral","happy","sad","angry","zoning","rolling","flapping","bouncing","thinking","nervous","awkward",
  "puffup","deflate","squint","surprised","proud","sleepy","explode"].filter(i => !onlyIds || onlyIds.split(",").includes(i));

const CANDIDATES = [process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"].filter(Boolean);
const BROWSER = CANDIDATES.find(p => existsSync(p));
if (!BROWSER) { console.error("No Edge/Chrome found. Set BROWSER=/path/to/browser."); process.exit(1); }

mkdirSync(outDir, { recursive: true });
const profile = join(outDir, "_profile");
const browser = spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${SIZE},${SIZE}`, "--hide-scrollbars", "--force-device-scale-factor=1",
  "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--disable-features=msEdgeSync,EdgeSyncDialog",
  "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
function stopBrowser() {
  // Edge's launcher hands off to other processes, so kill everything using this run's private profile.
  try {
    if (process.platform === "win32") {
      const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
      execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: "ignore" });
    } else {
      execSync(`pkill -f -- "${profile}"`, { stdio: "ignore" });
    }
  } catch {}
  try { browser.kill("SIGKILL"); } catch {}
}

// Connect to the blank tab we opened (Edge can also open hidden pages such as a sync dialog).
let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); wsUrl = l.find(t => t.type === "page" && t.url === "about:blank")?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl && i === 16) { // no blank tab after ~4s: open one ourselves
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json()).webSocketDebuggerUrl; } catch {}
  }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { console.error("Browser did not start."); stopBrowser(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener("message", m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.push(d.method); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};

try {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: SIZE, height: SIZE, deviceScaleFactor: 1, mobile: false });
  if (BG === "transparent") await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send("Page.navigate", { url: pathToFileURL(page).href });
  for (let i = 0; i < 100 && !events.includes("Page.loadEventFired"); i++) await sleep(100);
  await evaluate("document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode?i.decode().catch(()=>0):0))).then(()=>1)");

  for (const x of IDS) for (const v of SETS) {
    const dir = join(outDir, `${x}__${v}`); mkdirSync(dir, { recursive: true });
    const info = await evaluate(`show(${JSON.stringify(x)},${JSON.stringify(v)},${SIZE},${JSON.stringify(BG)})`);
    await sleep(150);
    const n = Math.round(info.loop / 1000 * FPS);
    for (let k = 0; k < n; k++) {
      await evaluate(`frame(${(k * info.loop / n).toFixed(2)})`);
      await evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(1))))");
      const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 } });
      writeFileSync(join(dir, String(k).padStart(4, "0") + ".png"), Buffer.from(shot.result.data, "base64"));
    }
    console.log(`${x} ${v}: ${n} frames`);
  }
} finally {
  ws.close(); stopBrowser();
  for (let i = 0; i < 10; i++) { // the browser can hold profile files for a moment after exiting
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); break; } catch {}
  }
  process.exit(0);
}
