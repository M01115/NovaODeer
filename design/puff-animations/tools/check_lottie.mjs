// Visual check: plays exported Lottie files in lottie-web (the same player family lottie-react-native uses)
// next to the original rig at the same moments, and saves a side-by-side PNG per sample.
//
//   node check_lottie.mjs <lottieDir> <outDir> state:accessory:seconds[,state:accessory:seconds...]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openBrowser } from "./cdp.mjs";
import { FILE_NAMES, SET_NAMES } from "./states.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [lottieDir, outDir, list] = [resolve(process.argv[2]), resolve(process.argv[3]), process.argv[4]];
mkdirSync(outDir, { recursive: true });
const S = 360;
const b = await openBrowser({ page: resolve(here, "..", "_render.html"), workDir: outDir, size: S * 2 });
try {
  await b.evaluate(`new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);})`);
  for (const item of list.split(",")) {
    const [x, v, sec] = item.split(":");
    const file = pathToFileURL(join(lottieDir, SET_NAMES[v], `puff-${FILE_NAMES[x]}-${SET_NAMES[v]}.json`)).href;
    await b.evaluate(`(async()=>{
      const info=show(${JSON.stringify(x)},${JSON.stringify(v)},${S},"#FAFAF7");
      frame(${+sec * 1000});
      let box=document.getElementById("lt"); if(box){window._la&&window._la.destroy();box.remove();}
      box=document.createElement("div"); box.id="lt"; box.style.cssText="position:fixed;left:${S}px;top:0;width:${S}px;height:${S}px;background:#FAFAF7";
      document.body.appendChild(box);
      const data=await (await fetch(${JSON.stringify(file)})).json();
      window._la=lottie.loadAnimation({container:box,renderer:"svg",loop:false,autoplay:false,animationData:data});
      await new Promise(r=>window._la.addEventListener("DOMLoaded",r));
      window._la.goToAndStop(${+sec}*data.fr,true);
      await new Promise(r=>setTimeout(r,250));
    })()`);
    const shot = await b.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: S * 2, height: S, scale: 1 } });
    writeFileSync(join(outDir, `${x}_${v}_${sec}.png`), Buffer.from(shot.result.data, "base64"));
    console.log("checked", item);
  }
} finally { await b.close(); }
process.exit(0);
