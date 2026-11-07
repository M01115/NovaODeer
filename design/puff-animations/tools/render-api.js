// Loaded into the recording page (see make_render_page.py). Shows one Puff state on a square stage and
// retimes every animation so they all loop in the same length, then lets the recorder step to exact times.
window.LOOP = {neutral:3, happy:1.8, sad:4, angry:1, zoning:5, rolling:4, flapping:3.6, bouncing:1.8, thinking:4,
  nervous:2.4, awkward:4, puffup:3, deflate:3, squint:3.6, surprised:2.4, proud:2.4, sleepy:4, explode:5, overtime:60, drawing:4};

window.show = function (id, v, size, bg) {
  document.querySelector(".wrap").style.display = "none";
  // the page paints its own paper color; clear it so a transparent stage records with real alpha
  document.documentElement.style.background = document.body.style.background = bg === "transparent" ? "transparent" : bg;
  let st = document.getElementById("st");
  if (!st) { st = document.createElement("div"); st.id = "st"; document.body.appendChild(st); }
  st.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;background:${bg}`;
  applyOutfit(st, v);              // brush | hat | glasses | none | all, or a mix like hat+glasses
  const c = X.find(o => o.id === id);
  st.innerHTML = puff(c, "r");
  const L = LOOP[id] * 1000;
  const anims = document.getAnimations().filter(a => a.effect && st.contains(a.effect.target));
  anims.forEach(a => {
    a.pause();
    const t = a.effect.getTiming(), alt = String(t.direction).includes("alternate");
    const period = (alt ? 2 : 1) * t.duration, n = Math.max(1, Math.round(L / period)), np = L / n;
    a.effect.updateTiming({duration: alt ? np / 2 : np, delay: (t.delay || 0) * np / period, iterations: Infinity});
  });
  window._anims = anims;
  return {loop: L, count: anims.length};
};
window.frame = function (ms) { window._anims.forEach(a => { a.currentTime = ms; }); };
