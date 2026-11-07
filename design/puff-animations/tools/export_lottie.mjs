// Exports every Puff state as one Lottie JSON file with all accessories in it (for lottie-react-native / lottie-web).
// Accessory layers are named acc:hat / acc:glasses / acc:brush; lottie/withOutfit.ts hides the ones an outfit leaves out.
//
//   node export_lottie.mjs [outDir] [states,comma,separated]
//
// Env: FPS (keyframes per second, default 30; overtime uses 15).
// Writes <outDir>/puff-<state>.json (default outDir: ../lottie).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser } from "./cdp.mjs";
import { STATES, FILE_NAMES } from "./states.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const page = resolve(here, "..", "_render.html");
if (!existsSync(page)) { console.error("Run make_render_page.py first (missing _render.html)."); process.exit(1); }
const outDir = resolve(process.argv[2] || join(here, "..", "lottie"));
const only = process.argv[3]?.split(",");
const FPS = +(process.env.FPS || 30);
const SETS = ["all"];
const IDS = [...STATES, "overtime"].filter(i => !only || only.includes(i));

mkdirSync(outDir, { recursive: true });
const b = await openBrowser({ page, workDir: outDir, size: 600 });
try {
  for (const x of IDS) for (const v of SETS) {
    const opts = x === "overtime" ? { fps: 15, durationMs: 60000, perFrame: "overtimeFrame" } : { fps: FPS };
    const json = await b.evaluate(`exportLottie(${JSON.stringify(x)},${JSON.stringify(v)},${JSON.stringify(opts)})`);
    const file = join(outDir, `puff-${FILE_NAMES[x]}.json`);
    writeFileSync(file, json);
    const L = JSON.parse(json);
    console.log(`${x} ${v}: ${L.layers.length} layers, ${L.assets.length} images, ${L.op} frames @${L.fr}fps, ${(json.length / 1024) | 0} KB`);
  }
} finally { await b.close(); }
process.exit(0);
