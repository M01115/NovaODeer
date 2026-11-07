// Records PNG frames of every Puff state x accessory by driving headless Edge/Chrome (see cdp.mjs).
//
//   node record.mjs [outDir] [states,comma,separated]
//
// Env: SIZE (px, default 420), FPS (default 20), BG (stage color, default #F6EFE4 app cream; "transparent" for alpha PNGs),
//      SETS (default brush,hat,glasses,none), BROWSER (path to msedge/chrome), PORT (default 9339).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser } from "./cdp.mjs";
import { STATES } from "./states.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const page = resolve(here, "..", "_render.html");
if (!existsSync(page)) { console.error("Run make_render_page.py first (missing _render.html)."); process.exit(1); }
const outDir = resolve(process.argv[2] || join(here, "..", "_frames"));
const onlyIds = process.argv[3];
const SIZE = +(process.env.SIZE || 420), FPS = +(process.env.FPS || 20);
const BG = process.env.BG || "#F6EFE4";   // app background (Explicai cream)
const SETS = (process.env.SETS || "brush,hat,glasses,none").split(",");
const IDS = STATES.filter(i => !onlyIds || onlyIds.split(",").includes(i));

mkdirSync(outDir, { recursive: true });
const b = await openBrowser({ page, workDir: outDir, size: SIZE, transparent: BG === "transparent" });
try {
  for (const x of IDS) for (const v of SETS) {
    const dir = join(outDir, `${x}__${v}`); mkdirSync(dir, { recursive: true });
    const info = await b.evaluate(`show(${JSON.stringify(x)},${JSON.stringify(v)},${SIZE},${JSON.stringify(BG)})`);
    await b.sleep(150);
    const n = Math.round(info.loop / 1000 * FPS);
    for (let k = 0; k < n; k++) {
      await b.evaluate(`frame(${(k * info.loop / n).toFixed(2)})`);
      await b.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(1))))");
      const shot = await b.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 } });
      writeFileSync(join(dir, String(k).padStart(4, "0") + ".png"), Buffer.from(shot.result.data, "base64"));
    }
    console.log(`${x} ${v}: ${n} frames`);
  }
} finally { await b.close(); }
process.exit(0);
