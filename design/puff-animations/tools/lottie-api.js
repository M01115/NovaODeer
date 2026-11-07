// Loaded into the render page next to render-api.js. Converts the live Puff rig into a Lottie (bodymovin) JSON:
// plays the CSS animation frame by frame, reads every part's exact transform and opacity, and writes them as
// Lottie layers. Parts that never move inside are flattened into one image; the eye masks become track mattes.
(function () {
  const ASSET_SCALE = 0.5;                  // image assets at half the rig's units (same as the PSD layer PNGs)
  const EPS = 1e-4;

  const imgCache = new Map();
  async function toDataURL(href) {
    if (imgCache.has(href)) return imgCache.get(href);
    const p = fetch(href).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }));
    imgCache.set(href, p); return p;
  }
  let fontCSS = null;                       // Puff Hand embedded so rasterized text (Zzz, !, POP!) keeps the app font
  async function getFontCSS() {
    if (fontCSS !== null) return fontCSS;
    fontCSS = "";
    try { fontCSS = `@font-face{font-family:"Puff Hand";src:url(${await toDataURL("assets/PuffHand-Regular.woff2")}) format('woff2')}`; }
    catch (e) { console.warn("Puff Hand not embedded", e); }
    return fontCSS;
  }
  // Accessory layers are named acc:<item>:... so the app can hide what the outfit doesn't include.
  const ACC = { beret: "hat", glasses: "glasses", brush: "brush" };
  const accOf = el => { const a = el.closest(".beret,.glasses,.brush"); return a ? ACC[[...a.classList].find(c => ACC[c])] : null; };
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // Rasterize an element's content (without its own transform) in its local coordinates.
  async function rasterize(el) {
    const bb = el.getBBox();
    const pad = 14;                                   // room for strokes, which getBBox ignores
    const x = bb.x - pad, y = bb.y - pad, w = bb.width + pad * 2, h = bb.height + pad * 2;
    const W = Math.max(1, Math.ceil(w * ASSET_SCALE)), H = Math.max(1, Math.ceil(h * ASSET_SCALE));
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (el.tagName === "image") {                     // keep the original PNG pixels; bake any CSS filter (orange flush)
      const im = await loadImg(await toDataURL(el.getAttribute("href")));
      const f = getComputedStyle(el).filter;
      if (f && f !== "none") ctx.filter = f;
      const ix = +el.getAttribute("x"), iy = +el.getAttribute("y"), iw = +el.getAttribute("width"), ih = +el.getAttribute("height");
      ctx.drawImage(im, (ix - x) * ASSET_SCALE, (iy - y) * ASSET_SCALE, iw * ASSET_SCALE, ih * ASSET_SCALE);
    } else {
      const clone = el.cloneNode(true);
      clone.removeAttribute("transform"); clone.removeAttribute("class"); clone.removeAttribute("style");
      clone.querySelectorAll("[class]").forEach(n => n.removeAttribute("class"));
      // bring along any eye masks this piece uses, or lids/pupils would spill outside the eyes
      const maskIds = [clone, ...clone.querySelectorAll("[mask]")].map(n => (n.getAttribute && n.getAttribute("mask") || "").match(/#([^)]+)/)?.[1]).filter(Boolean);
      let defs = "";
      for (const mid of maskIds) {
        const m = document.getElementById(mid).cloneNode(true);
        for (const im of m.querySelectorAll("image")) im.setAttribute("href", await toDataURL(im.getAttribute("href")));
        defs += new XMLSerializer().serializeToString(m);
      }
      for (const im of clone.querySelectorAll("image")) im.setAttribute("href", await toDataURL(im.getAttribute("href")));
      const hasText = !!clone.querySelector("text") || clone.tagName === "text";
      const style = hasText ? `<style>${await getFontCSS()}</style>` : "";
      // keep what the piece inherits from its parent groups (ink color, stroke width, font), or bare strokes vanish
      const cs = getComputedStyle(el.parentNode);
      const inherit = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "font-family", "font-size", "font-weight"]
        .map(k => `${k}:${cs.getPropertyValue(k)}`).join(";");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${W}" height="${H}">${style}<defs>${defs}</defs><g style="${inherit.replace(/"/g, "'")}">${new XMLSerializer().serializeToString(clone)}</g></svg>`;
      const im = await loadImg("data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg))));
      ctx.drawImage(im, 0, 0, W, H);
    }
    return { p: canvas.toDataURL("image/png"), w: W, h: H, x, y, uw: w, uh: h };
  }

  const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
  const inv = m => { const d = m[0]*m[3]-m[1]*m[2]; return [m[3]/d, -m[1]/d, -m[2]/d, m[0]/d, (m[2]*m[5]-m[3]*m[4])/d, (m[1]*m[4]-m[0]*m[5])/d]; };
  const arr = M => [M.a, M.b, M.c, M.d, M.e, M.f];
  // matrix -> Lottie position / rotation / scale (rotation x scale, no skew; the rig never shears)
  function decompose(m) {
    const sx = Math.hypot(m[0], m[1]), r = Math.atan2(m[1], m[0]), sy = (m[0]*m[3] - m[1]*m[2]) / sx;
    return { p: [m[4], m[5]], r: r * 180 / Math.PI, s: [sx * 100, sy * 100] };
  }

  const prop = (vals, dims, round) => {           // vals: per-frame arrays; returns Lottie animatable property
    const same = vals.every(v => v.every((x, i) => Math.abs(x - vals[0][i]) < EPS));
    const fix = v => v.map(x => +x.toFixed(round));
    if (same) return { a: 0, k: dims === 1 ? fix(vals[0])[0] : fix(vals[0]) };
    const lin = { i: { x: Array(dims).fill(1), y: Array(dims).fill(1) }, o: { x: Array(dims).fill(0), y: Array(dims).fill(0) } };
    const k = []; let last = null;
    vals.forEach((v, t) => {                      // drop frames that repeat the previous and next value (holds)
      const f = fix(v), next = vals[t + 1] ? fix(vals[t + 1]) : null;
      if (last && next && f.every((x, i) => x === last[i]) && next.every((x, i) => x === f[i])) return;
      k.push({ t, s: f, ...lin }); last = f;
    });
    return { a: 1, k };
  };

  window.exportLottie = async function (id, v, opts = {}) {
    const fps = opts.fps || 30;
    const info = show(id, v, 600, "transparent");
    const st = document.getElementById("st"), svg = st.querySelector("svg");
    const L = opts.durationMs || info.loop, N = Math.round(L / 1000 * fps);
    const vb = svg.viewBox.baseVal;

    // Collect visible elements (skip defs/masks and hidden accessories)
    const nodes = [];
    (function walk(el, parent) {
      for (const c of el.children) {
        if (["defs", "mask", "title", "desc"].includes(c.tagName)) continue;
        if (getComputedStyle(c).display === "none") continue;
        const n = { el: c, parent, kids: [], mats: [], ops: [] }; nodes.push(n); if (parent) parent.kids.push(n);
        if (c.tagName === "g") walk(c, n);
      }
    })(svg, null);

    const probe = document.createElementNS("http://www.w3.org/2000/svg", "g"); svg.appendChild(probe);
    for (let k = 0; k <= N; k++) {
      const t = (k % N) * L / N;                  // frame N repeats frame 0 so the loop closes
      frame(t); if (opts.perFrame) window[opts.perFrame](svg, t, L);
      const base = arr(probe.getCTM());
      for (const n of nodes) {
        const ctm = arr(n.el.getCTM());
        n.ctm = ctm;
        const parentCTM = n.parent ? n.parent.ctm : base;
        n.mats.push(mul(inv(parentCTM), ctm));
        n.ops.push(parseFloat(getComputedStyle(n.el).opacity));
      }
    }
    probe.remove();

    const changes = (list, eq) => list.some(x => !eq(x, list[0]));
    for (const n of nodes) {
      n.dyn = changes(n.mats, (a, b) => a.every((x, i) => Math.abs(x - b[i]) < EPS)) || changes(n.ops, (a, b) => Math.abs(a - b) < EPS);
    }
    (function mark(list) { for (const n of list) { mark(n.kids); n.dynBelow = n.kids.some(c => c.dyn || c.dynBelow); } })(nodes.filter(n => !n.parent));

    const assets = [], layers = []; let ind = 1, aid = 0;
    const seen = new Map();                        // identical images are stored once and shared by layers
    const addAsset = r => { const key = r.w + "x" + r.h + r.p; if (seen.has(key)) return seen.get(key);
      const id = "img_" + (aid++); assets.push({ id, w: r.w, h: r.h, u: "", p: r.p, e: 1 }); seen.set(key, id); return id; };
    const tf = (mats, ops) => {
      const d = mats.map(decompose);
      let prev = d[0].r; d.forEach(x => { while (x.r - prev > 180) x.r -= 360; while (x.r - prev < -180) x.r += 360; prev = x.r; });
      return { o: prop(ops.map(o => [o * 100]), 1, 1), r: prop(d.map(x => [x.r]), 1, 3), p: prop(d.map(x => [...x.p, 0]), 3, 2),
               a: { a: 0, k: [0, 0, 0] }, s: prop(d.map(x => [...x.s, 100]), 3, 3) };
    };
    const base = (nm, extra) => ({ ddd: 0, ind: ind++, nm, ao: 0, ip: 0, op: N, st: 0, bm: 0, sr: 1, ...extra });
    const rootLayer = base("root", { ty: 3, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [-vb.x, -vb.y, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } } });
    const nulls = [rootLayer], paint = [];

    async function imageLayer(n, parentInd, cumOps, nm, matte) {
      const r = await rasterize(n.el);
      const id = addAsset(r);
      // image pixels -> element-local units: translate to bbox corner, scale by 1/ASSET_SCALE
      const fix = [r.uw / r.w, 0, 0, r.uh / r.h, r.x, r.y];
      const mats = n.mats.map(m => mul(m, fix));
      const L2 = base(nm, { ty: 2, refId: id, parent: parentInd, ks: tf(mats, cumOps) });
      if (matte) { matte.layer.ip = 0; paint.push({ layer: L2, matte }); } else paint.push({ layer: L2 });
    }

    async function build(n, parentInd, cumOps, maskInfo) {
      const ops = n.ops.map((o, i) => o * cumOps[i]);
      const acc = accOf(n.el);
      const name = (acc ? `acc:${acc}:` : "") + (n.el.getAttribute("class") || n.el.tagName).split(" ")[0];
      const maskId = (n.el.getAttribute("mask") || "").match(/#([^)]+)/)?.[1];
      if (!n.dynBelow) {                                     // leaf: flatten into one image layer
        let matte = null;
        if (maskInfo) {
          const mImg = document.getElementById(maskInfo.id).querySelector("image");
          const fakeNode = { el: mImg, mats: maskInfo.mats, ops: maskInfo.mats.map(() => 1) };
          const r = await rasterize(mImg); const id = addAsset(r);
          const fix = [r.uw / r.w, 0, 0, r.uh / r.h, r.x, r.y];
          matte = { layer: base("matte", { ty: 2, refId: id, parent: maskInfo.parentInd, td: 1, ks: tf(fakeNode.mats.map(m => mul(m, fix)), fakeNode.ops) }) };
        }
        return imageLayer(n, parentInd, ops, name, matte);
      }
      // group with moving parts inside: a null layer carries its transform; opacity is passed down
      const nl = base(name, { ty: 3, parent: parentInd, ks: tf(n.mats, n.mats.map(() => 1)) });
      nulls.push(nl);
      let mi = maskInfo;
      if (maskId) mi = { id: maskId, parentInd: nl.ind, mats: n.mats.map(() => [1, 0, 0, 1, 0, 0]) };
      for (const c of n.kids) await build(c, nl.ind, ops, mi);
    }
    for (const n of nodes.filter(n => !n.parent)) await build(n, rootLayer.ind, n.ops.map(() => 1), null);

    // Lottie draws the first layer on top; SVG paints later elements on top. Mattes sit right above their layer.
    const ordered = [];
    for (const p of paint.reverse()) { if (p.matte) { p.layer.tt = 1; ordered.push(p.matte.layer); } ordered.push(p.layer); }
    return JSON.stringify({ v: "5.7.4", fr: fps, ip: 0, op: N, w: vb.width, h: vb.height, nm: `puff-${id}-${v}`, ddd: 0,
      assets, layers: [...ordered, ...nulls], markers: [] });
  };

  // overtime: 60s, inflation f = t/60s drives the same variables the app page sets live
  window.overtimeFrame = function (svg, t, L) {
    const f = Math.min(1, t / L);
    svg.style.setProperty("--inf", (1 + 0.3 * f).toFixed(3)); svg.style.setProperty("--tr", (3 + 30 * f).toFixed(1));
    svg.style.setProperty("--fl", (0.7 * f).toFixed(2)); svg.style.setProperty("--pp", (1 - 0.4 * f).toFixed(2));
    svg.style.setProperty("--fx", (-90 * f).toFixed(1));
  };
})();
