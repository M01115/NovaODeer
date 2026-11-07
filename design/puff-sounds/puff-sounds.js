/* Puff sound kit: every sound is synthesized from code (no samples).
   Runs in the browser (sound board) and in Node (render.js writes WAVs).
   Palette: bubbles (pitch-rising sine blips), shell marimba, glass bell,
   sonar pings, rubbery pufferfish skin, and a soft underwater room.
   Key: D major pentatonic, so every sound sits in one family. */
(function (root) {
  'use strict';
  const SR = 44100;
  const TAU = Math.PI * 2;

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // D major pentatonic note names -> midi
  const N = { D4: 62, A4: 69, B4: 71, D5: 74, E5: 76, Fs5: 78, A5: 81, B5: 83, Cs6: 85, D6: 86, E6: 88, Fs6: 90, A6: 93, B6: 95, D7: 98, E7: 100, Fs7: 102, A7: 105 };
  const PENTA = [N.D5, N.E5, N.Fs5, N.A5, N.B5, N.D6, N.E6, N.Fs6, N.A6, N.B6, N.D7, N.E7, N.Fs7, N.A7];
  const hz = n => mtof(typeof n === 'string' ? N[n] : n);

  // ---------- core oscillator: per-sample freq + amp functions ----------
  function osc(out, t, dur, freq, amp, wave) {
    const i0 = Math.round(t * SR), n = Math.round(dur * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const k = i0 + i; if (k < 0) continue; if (k >= out.length) break;
      const tau = i / SR;
      ph += TAU * freq(tau) / SR;
      let s;
      if (wave === 'rubber') s = Math.sin(ph) + 0.45 * Math.sin(2 * ph) + 0.22 * Math.sin(3 * ph) + 0.1 * Math.sin(4 * ph);
      else if (wave === 'tri') s = (2 / Math.PI) * Math.asin(Math.sin(ph));
      else s = Math.sin(ph);
      const edge = Math.min(1, (dur - tau) / 0.004); // no end clicks
      out[k] += s * amp(tau) * edge;
    }
  }
  const envAD = (a, d) => tau => tau < a ? tau / a : Math.exp(-(tau - a) / d);

  // ---------- noise through a time-varying state-variable filter ----------
  function noise(out, t, dur, o) {
    const r = rng(o.seed || 7);
    const i0 = Math.round(t * SR), n = Math.round(dur * SR);
    let low = 0, band = 0;
    const q = o.q == null ? 0.7 : o.q;
    for (let i = 0; i < n; i++) {
      const k = i0 + i; if (k < 0) continue; if (k >= out.length) break;
      const tau = i / SR;
      const fc = Math.min(SR / 6.5, o.fc(tau));
      const f = 2 * Math.sin(Math.PI * fc / SR);
      const x = r() * 2 - 1;
      low += f * band; const high = x - low - q * band; band += f * high;
      const s = o.mode === 'low' ? low : o.mode === 'high' ? high : band;
      out[k] += s * o.amp(tau) * Math.min(1, (dur - tau) / 0.006);
    }
  }

  // ---------- instruments ----------
  // Bubble: a sine whose pitch shoots up as it decays. Rising = "bloop", falling = "blub".
  function bloop(out, t, f0, f1, len, amp) {
    const g = Math.log(f1 / f0);
    osc(out, t, len * 2.2, tau => f0 * Math.exp(g * Math.min(1, tau / (len * 0.8))), tau => amp * envAD(0.002, len / 2.6)(tau));
  }
  // Shell marimba: fundamental + the marimba's 4x and 10x overtones.
  function mallet(out, t, f, amp, decay) {
    decay = decay || 0.32;
    osc(out, t, decay * 6, tau => f * (1 + 0.012 * Math.exp(-tau / 0.01)), tau => amp * envAD(0.0015, decay)(tau));
    osc(out, t, decay * 2, () => f * 3.93, tau => amp * 0.18 * envAD(0.001, decay * 0.22)(tau));
    osc(out, t, decay, () => f * 9.9, tau => amp * 0.05 * envAD(0.001, decay * 0.07)(tau));
  }
  // Glass bell / sea-glass chime: inharmonic partials, long shimmering decay.
  function bell(out, t, f, amp, decay) {
    decay = decay || 1.1;
    [[1, 1, 1], [2.0, 0.22, 0.7], [2.76, 0.32, 0.55], [5.4, 0.13, 0.3], [8.93, 0.06, 0.18]].forEach(([r, a, d]) => {
      osc(out, t, decay * d * 6, () => f * r, tau => amp * a * envAD(0.002, decay * d)(tau));
    });
  }
  // Sonar ping: soft attack, slight downward drift, long tail.
  function ping(out, t, f, amp, decay, wobble) {
    osc(out, t, decay * 6, tau => f * (1 - 0.015 * Math.min(1, tau / 0.4)) * (1 + (wobble || 0) * Math.sin(TAU * 9 * tau)),
      tau => amp * envAD(0.006, decay)(tau));
    osc(out, t, decay * 3, () => f * 2.01, tau => amp * 0.08 * envAD(0.004, decay * 0.4)(tau));
  }
  // Low "thump" for landings.
  function thump(out, t, amp) {
    osc(out, t, 0.32, tau => 55 + 110 * Math.exp(-tau / 0.04), tau => amp * envAD(0.002, 0.07)(tau));
  }
  // Pufferfish skin: rubbery squeak/stretch with vibrato.
  function rubber(out, t, dur, freq, amp, vibHz, vibDepth) {
    let vp = 0;
    osc(out, t, dur, tau => { vp = Math.sin(TAU * (typeof vibHz === 'function' ? vibHz(tau) : vibHz || 7) * tau); return freq(tau) * (1 + (vibDepth || 0.02) * vp); },
      amp, 'rubber');
  }
  // Water whoosh: band-passed noise sweeping between two frequencies.
  function whoosh(out, t, dur, fa, fb, amp, seed) {
    noise(out, t, dur, { seed, q: 1.1, fc: tau => fa * Math.pow(fb / fa, tau / dur), amp: tau => amp * Math.sin(Math.PI * Math.min(1, tau / dur)) });
  }
  // A cloud of small bubbles between t0 and t1.
  function fizz(out, r, t0, t1, count, fLo, fHi, amp) {
    for (let i = 0; i < count; i++) {
      const u = r(), t = t0 + (t1 - t0) * Math.pow(u, 1.4);
      const f0 = fLo + (fHi - fLo) * r();
      bloop(out, t, f0, f0 * (1.6 + r() * 0.8), 0.025 + r() * 0.04, amp * (0.4 + 0.6 * r()) * (1 - 0.6 * u));
    }
  }

  // ---------- room: small Schroeder reverb, darkened so it feels underwater ----------
  function reverb(dry, wet, size) {
    if (!wet) return dry;
    size = size || 1;
    const out = new Float32Array(dry.length);
    const combs = [1116, 1188, 1277, 1356].map(d => ({ d: Math.round(d * size), b: new Float32Array(Math.round(d * size)), i: 0, lp: 0 }));
    const aps = [556, 441].map(d => ({ b: new Float32Array(d), i: 0 }));
    let tone = 0;
    for (let n = 0; n < dry.length; n++) {
      const x = dry[n] * 0.25;
      let s = 0;
      for (const c of combs) {
        const y = c.b[c.i]; c.lp = y * 0.55 + c.lp * 0.45; c.b[c.i] = x + c.lp * 0.8; c.i = (c.i + 1) % c.d; s += y;
      }
      for (const a of aps) { const bo = a.b[a.i]; const y = -s * 0.5 + bo; a.b[a.i] = s + bo * 0.5; a.i = (a.i + 1) % a.b.length; s = y; }
      tone += 0.32 * (s - tone); // lowpass ~2.5 kHz on the wet signal
      out[n] = dry[n] + tone * wet;
    }
    return out;
  }

  function finish(d, o) {
    let w = reverb(d, o.wet == null ? 0.18 : o.wet, o.room);
    if (o.loop) { // fold the tail back onto the start so the loop is seamless
      const L = Math.round(o.loop * SR), f = new Float32Array(L);
      for (let i = 0; i < w.length; i++) f[i % L] += w[i];
      w = f;
    }
    let peak = 0; for (let i = 0; i < w.length; i++) peak = Math.max(peak, Math.abs(w[i]));
    const g = peak ? (0.89 * (o.level || 1)) / peak : 0;
    // trim trailing silence (below -60 dB), then a short fade
    let end = w.length;
    if (!o.loop) { while (end > 1 && Math.abs(w[end - 1] * g) < 0.003) end--; end = Math.min(w.length, end + Math.round(0.02 * SR)); }
    const res = new Float32Array(end), fade = Math.round(0.015 * SR);
    for (let i = 0; i < end; i++) res[i] = Math.tanh(w[i] * g * 1.05) / Math.tanh(1.05) * (!o.loop && i > end - fade ? (end - i) / fade : 1);
    return res;
  }

  // ---------- the sounds ----------
  // each: id, group, name, when (trigger), notes (how to use), sec (render length), level, render(out, r)
  const SOUNDS = [
    // UI
    { id: 'tap', group: 'Taps and UI', name: 'Bubble tap', when: 'Any main button (Start sketching, Snap my sketch).', sec: 0.4, level: 0.55, wet: 0.08,
      render(o) { bloop(o, 0, 620, 1150, 0.05, 1); mallet(o, 0.004, hz('D7'), 0.12, 0.05); } },
    { id: 'tab', group: 'Taps and UI', name: 'Pebble click', when: 'Tab bar, chips, small toggles.', sec: 0.3, level: 0.42, wet: 0.06,
      render(o) { bloop(o, 0, 900, 1350, 0.03, 1); } },
    { id: 'back', group: 'Taps and UI', name: 'Blub back', when: 'Back, close, dismiss a sheet.', sec: 0.4, level: 0.45, wet: 0.08,
      render(o) { bloop(o, 0, 1100, 620, 0.055, 1); } },
    { id: 'gentle-no', group: 'Taps and UI', name: 'Soft blub (not that)', when: 'Something can\'t be done yet (e.g. feed still locked). Never a "wrong" buzzer.', sec: 0.8, level: 0.5, wet: 0.15,
      render(o) { bloop(o, 0, 520, 280, 0.11, 1); bloop(o, 0.13, 400, 230, 0.12, 0.8); } },

    // App open (matches rig: roll 0-1.1, land 1.1, hop 2.0, wordmark, shrink 3.3)
    { id: 'app-open', group: 'App open', name: 'Puff rolls in', when: 'Cold start, synced to the 4 s "App opens" animation.', sec: 4.6, level: 1, wet: 0.2,
      timeline: [[0, 'roll in (two spins)'], [1.1, 'land, squash'], [1.35, 'small bounce'], [2.0, 'happy hop'], [2.1, 'wordmark chime'], [3.3, 'shrink to home']],
      render(o, r) {
        noise(o, 0, 1.15, { seed: 3, q: 1.4, fc: tau => 380 + 500 * Math.sin(Math.PI * tau / 1.15), amp: tau => 0.18 * Math.min(1, tau / 0.3) });
        whoosh(o, 0.05, 0.5, 300, 1400, 0.5, 11); whoosh(o, 0.55, 0.55, 400, 1100, 0.4, 12);
        for (let t = 0; t < 1.08;) { const f = 380 + r() * 500; bloop(o, t, f, f * 1.7, 0.03 + r() * 0.03, 0.25 + r() * 0.2); t += 0.035 + r() * 0.05; }
        thump(o, 1.1, 0.9); bloop(o, 1.1, 420, 190, 0.12, 0.7);
        noise(o, 1.1, 0.25, { seed: 5, mode: 'high', fc: () => 3000, amp: envAD(0.002, 0.05) }); // tiny splash
        fizz(o, r, 1.12, 1.5, 10, 700, 1600, 0.25);
        bloop(o, 1.36, 360, 220, 0.07, 0.4);
        rubber(o, 2.0, 0.2, tau => 330 * Math.pow(2.2, tau / 0.2), tau => 0.22 * Math.sin(Math.PI * tau / 0.2), 0, 0);
        bloop(o, 2.02, 500, 1300, 0.07, 0.6);
        [N.D5, N.Fs5, N.A5, N.D6].forEach((m, i) => mallet(o, 2.12 + i * 0.075, mtof(m), 0.55, 0.3));
        bell(o, 2.36, hz('D6'), 0.28, 1.2); bell(o, 2.36, hz('A6'), 0.12, 1.0);
        whoosh(o, 3.3, 0.45, 1600, 500, 0.28, 13);
        bloop(o, 3.72, 700, 1400, 0.05, 0.45);
      } },

    // Sketch session
    { id: 'session-start', group: 'Sketch countdown', name: 'Ready, set, sketch', when: 'Timer starts.', sec: 1.4, level: 0.85, wet: 0.2,
      render(o) { [520, 700, 940].forEach((f, i) => bloop(o, i * 0.11, f, f * 1.8, 0.05, 0.7)); mallet(o, 0.34, hz('A5'), 0.5, 0.4); mallet(o, 0.34, hz('D6'), 0.6, 0.45); } },
    { id: 'one-minute', group: 'Sketch countdown', name: 'Sonar ping (1:00 left)', when: '1:00 left. Puff peeks closer.', sec: 2.2, level: 0.6, wet: 0.4, room: 1.3,
      render(o) { ping(o, 0, hz('D6'), 0.8, 0.45); ping(o, 0.42, hz('D6'), 0.22, 0.4); } },
    { id: 'thirty-sec', group: 'Sketch countdown', name: 'Nervous double ping (0:30)', when: '0:30 left. Puff sweats.', sec: 1.8, level: 0.62, wet: 0.35, room: 1.2,
      render(o) { ping(o, 0, hz('E6'), 0.7, 0.3, 0.006); ping(o, 0.17, hz('E6'), 0.7, 0.35, 0.008); } },
    { id: 'tick', group: 'Sketch countdown', name: 'Water-drop tick', when: 'Each second from 0:10 to 0:04.', sec: 0.35, level: 0.42, wet: 0.12,
      render(o) { bloop(o, 0, 900, 1650, 0.03, 1); mallet(o, 0.002, hz('A6'), 0.08, 0.03); } },
    { id: 'tick-high', group: 'Sketch countdown', name: 'Last-3 tick', when: '0:03, 0:02, 0:01.', sec: 0.35, level: 0.5, wet: 0.12,
      render(o) { bloop(o, 0, 1150, 2100, 0.03, 1); mallet(o, 0.002, hz('D7'), 0.12, 0.035); } },
    { id: 'time-up', group: 'Sketch countdown', name: 'Buoy bell (time\'s up)', when: '0:00. Friendly, not an alarm: you can keep drawing.', sec: 2.8, level: 0.8, wet: 0.3,
      render(o, r) { bell(o, 0, hz('A5'), 0.6, 1.0); bell(o, 0.24, hz('D6'), 0.7, 1.3); fizz(o, r, 0.05, 0.6, 8, 600, 1300, 0.18); } },
    { id: 'overtime-creak', group: 'Sketch countdown', name: 'Overtime creak', when: 'Every ~6 s in overtime. Raise playback rate each time (1.0 → 1.6) as Puff inflates.', sec: 0.5, level: 0.45, wet: 0.12,
      render(o) { rubber(o, 0, 0.36, tau => 210 + 60 * tau / 0.36, tau => 0.5 * Math.sin(Math.PI * tau / 0.36), 11, 0.03); } },
    { id: 'inflate', group: 'Sketch countdown', name: 'Final inflate', when: 'Start at +0:57 so it peaks into the pop.', sec: 2.8, level: 0.7, wet: 0.12,
      render(o) {
        rubber(o, 0, 2.7, tau => 190 * Math.pow(900 / 190, Math.pow(tau / 2.7, 1.6)), tau => 0.3 * Math.min(1, tau / 0.4) * (0.75 + 0.25 * Math.sin(TAU * (5 + 12 * tau / 2.7) * tau)), tau => 6 + 10 * tau / 2.7, 0.025);
        noise(o, 0, 2.7, { seed: 9, q: 0.9, fc: tau => 1200 + 3000 * tau / 2.7, amp: tau => 0.15 * tau / 2.7 });
      } },
    { id: 'pop', group: 'Sketch countdown', name: 'POP', when: '+1:00. Puff pops (comedy, not failure).', sec: 1.8, level: 1, wet: 0.22,
      render(o, r) {
        noise(o, 0, 0.06, { seed: 21, q: 0.4, fc: () => 3500, amp: envAD(0.0005, 0.012) });
        thump(o, 0, 0.8); bloop(o, 0.005, 300, 1800, 0.06, 0.6);
        fizz(o, r, 0.04, 1.2, 45, 500, 2200, 0.35);
      } },
    { id: 'reform', group: 'Sketch countdown', name: 'Sheepish reform', when: 'Right after the pop, as Puff pulls back together.', sec: 1.5, level: 0.7, wet: 0.2,
      render(o) {
        bloop(o, 0, 300, 520, 0.07, 0.6); bloop(o, 0.14, 340, 600, 0.07, 0.6); bloop(o, 0.3, 420, 820, 0.09, 0.7);
        rubber(o, 0.45, 0.22, tau => 420 - 120 * Math.sin(Math.PI * tau / 0.22), tau => 0.15 * Math.sin(Math.PI * tau / 0.22), 0, 0);
        mallet(o, 0.72, hz('A5'), 0.4, 0.25); mallet(o, 0.88, hz('Fs5'), 0.35, 0.35);
      } },
    { id: 'snap', group: 'Sketch countdown', name: 'Clam snap (photo)', when: 'Photo of the paper sketch taken.', sec: 0.9, level: 0.8, wet: 0.15,
      render(o, r) {
        [0, 0.055].forEach((t, i) => noise(o, t, 0.03, { seed: 30 + i, q: 0.5, fc: () => 2800 - i * 900, amp: envAD(0.0005, 0.006) }));
        bloop(o, 0.06, 380, 900, 0.06, 0.5); fizz(o, r, 0.08, 0.35, 6, 800, 1500, 0.2);
      } },

    // Puff looks at your sketch
    { id: 'scan', group: 'Puff\'s feedback', name: 'Sonar scan', when: 'Scan line sweeps your photo (first ~2 s).', sec: 2.4, level: 0.5, wet: 0.3,
      render(o) {
        osc(o, 0, 2.0, tau => 520 * Math.pow(3.2, tau / 2.0), tau => 0.18 * Math.sin(Math.PI * tau / 2.0));
        for (let i = 0; i < 6; i++) ping(o, 0.1 + i * 0.32, hz('A6'), 0.12, 0.08);
      } },
    { id: 'thinking-loop', group: 'Puff\'s feedback', name: 'Thinking bubbles (loop)', when: 'Loop while waiting for the AI. Seamless 2.4 s.', sec: 2.4, level: 0.45, wet: 0.25, loop: 2.4,
      render(o) { [[0.0, 420], [0.35, 560], [0.6, 480], [1.2, 520], [1.5, 640], [1.9, 470]].forEach(([t, f]) => bloop(o, t, f, f * 1.6, 0.06, 0.6)); } },
    { id: 'aha', group: 'Puff\'s feedback', name: 'Aha!', when: 'AI answer arrives; Puff jumps.', sec: 1.6, level: 0.85, wet: 0.25,
      render(o) { bloop(o, 0, 380, 1900, 0.12, 0.8); bell(o, 0.08, hz('A6'), 0.35, 0.8); [N.Fs6, N.A6, N.D7].forEach((m, i) => mallet(o, 0.12 + i * 0.06, mtof(m), 0.3, 0.2)); } },
    { id: 'type-blip', group: 'Puff\'s feedback', name: 'Word blip', when: 'Each word as Puff\'s note types out. Vary rate 0.9-1.2.', sec: 0.2, level: 0.3, wet: 0.05,
      render(o) { bloop(o, 0, 1150, 1500, 0.018, 1); } },
    { id: 'notice', group: 'Puff\'s feedback', name: 'Puff noticed something', when: 'Puff\'s note lands. The "correct!" moment, but about noticing, not grading.', sec: 1.0, level: 0.8, wet: 0.2,
      render(o) { mallet(o, 0, hz('D6'), 0.7, 0.25); bloop(o, 0, 900, 1500, 0.03, 0.25); mallet(o, 0.095, hz('A6'), 0.75, 0.4); bloop(o, 0.095, 1200, 2000, 0.03, 0.25); } },

    // Posting and streaks
    { id: 'post', group: 'Posting and streaks', name: 'Bubble to the surface', when: 'Sketch posted.', sec: 1.4, level: 0.8, wet: 0.2,
      render(o) {
        for (let i = 0; i < 8; i++) { const f = 400 * Math.pow(1.18, i); bloop(o, i * 0.06 * (1 - i * 0.05), f, f * 1.7, 0.035, 0.45); }
        whoosh(o, 0.0, 0.55, 400, 2200, 0.3, 41);
        bloop(o, 0.58, 1300, 2400, 0.025, 0.6); mallet(o, 0.6, hz('D6'), 0.45, 0.4);
      } },
    { id: 'streak', group: 'Posting and streaks', name: 'Streak extended', when: 'Synced to the 4 s "Streak extended" animation.', sec: 4.2, level: 1, wet: 0.25,
      timeline: [[0.3, 'Puff puffs up'], [0.9, 'streak pill pops'], [0.95, 'number rolls 6 → 7'], [1.5, 'confetti + fanfare'], [2.3, 'Puff cheers']],
      render(o, r) {
        rubber(o, 0.3, 0.55, tau => 240 * Math.pow(2.3, tau / 0.55), tau => 0.16 * Math.sin(Math.PI * Math.min(1, tau / 0.6)), 8, 0.02);
        noise(o, 0.9, 0.04, { seed: 51, q: 0.5, fc: () => 3000, amp: envAD(0.0005, 0.01) }); bloop(o, 0.9, 500, 1400, 0.06, 0.6);
        [N.A5, N.B5, N.Cs6, N.D6].forEach((m, i) => mallet(o, 0.98 + i * 0.09, mtof(m), 0.32 + i * 0.05, 0.12));
        fizz(o, r, 1.5, 2.4, 30, 600, 2000, 0.3);
        [N.D6, N.Fs6, N.A6, N.D7].forEach((m, i) => mallet(o, 1.5 + i * 0.08, mtof(m), 0.6, 0.3));
        [N.D6, N.Fs6, N.A6].forEach(m => mallet(o, 1.86, mtof(m), 0.35, 0.6)); bell(o, 1.86, hz('D7'), 0.3, 1.4);
        for (let i = 0; i < 9; i++) bell(o, 2.3 + i * 0.07 + r() * 0.03, mtof(PENTA[9 + Math.floor(r() * 5)]), 0.12 * (1 - i / 11), 0.5);
      } },
    { id: 'milestone', group: 'Posting and streaks', name: 'Streak milestone', when: '7, 30, 100 days. Swap in for "streak" on those days.', sec: 3.6, level: 1, wet: 0.3,
      render(o, r) {
        bloop(o, 0, 300, 1600, 0.14, 0.8);
        PENTA.slice(0, 11).forEach((m, i) => mallet(o, 0.1 + i * 0.05, mtof(m), 0.45, 0.22));
        [N.D5, N.A5, N.D6, N.Fs6, N.A6].forEach(m => mallet(o, 0.72, mtof(m), 0.35, 0.8));
        bell(o, 0.72, hz('D7'), 0.4, 1.8); bell(o, 0.72, hz('A6'), 0.2, 1.5);
        fizz(o, r, 0.7, 2.0, 50, 600, 2400, 0.3);
        for (let i = 0; i < 12; i++) bell(o, 1.1 + i * 0.09 + r() * 0.04, mtof(PENTA[8 + Math.floor(r() * 6)]), 0.1 * (1 - i / 14), 0.5);
      } },
    { id: 'streak-lost', group: 'Posting and streaks', name: 'Gentle deflate (streak reset)', when: 'First open after a missed day. Kind: a sigh, then a hopeful note.', sec: 2.0, level: 0.55, wet: 0.25,
      render(o) {
        rubber(o, 0, 0.8, tau => 480 * Math.pow(180 / 480, tau / 0.8), tau => 0.25 * Math.sin(Math.PI * Math.min(1, tau / 0.85)), 6, 0.02);
        noise(o, 0, 0.8, { seed: 61, q: 0.9, fc: tau => 2200 - 1500 * tau / 0.8, amp: tau => 0.08 * (1 - tau / 0.8) });
        mallet(o, 1.0, hz('D5'), 0.4, 0.4); bloop(o, 1.2, 500, 1000, 0.05, 0.3);
      } },
    { id: 'unlock-feed', group: 'Posting and streaks', name: 'Shell glissando (friends unlock)', when: 'Friends\' sketches unlock after you post.', sec: 2.2, level: 0.85, wet: 0.3,
      render(o, r) {
        PENTA.slice(0, 12).forEach((m, i) => mallet(o, i * 0.045, mtof(m), 0.3 + i * 0.02, 0.18));
        bell(o, 0.56, hz('Fs6'), 0.3, 1.2); bell(o, 0.56, hz('D6'), 0.25, 1.2);
        fizz(o, r, 0.5, 1.2, 14, 800, 2000, 0.2);
      } },
    { id: 'reaction', group: 'Posting and streaks', name: 'Pop-pop (reaction)', when: 'Someone reacts to your sketch / you react to theirs.', sec: 0.6, level: 0.6, wet: 0.12,
      render(o) { bloop(o, 0, 600, 1300, 0.04, 0.9); bloop(o, 0.075, 820, 1700, 0.04, 0.9); mallet(o, 0.08, hz('Fs6'), 0.15, 0.1); } },
    { id: 'notify', group: 'Posting and streaks', name: 'Today\'s prompt is here', when: 'Push notification sound (keep under 30 s for iOS; this is 1.8 s).', sec: 2.0, level: 0.8, wet: 0.3,
      render(o) { ping(o, 0, hz('A5'), 0.35, 0.3); [N.D6, N.Fs6, N.A6].forEach((m, i) => bell(o, 0.22 + i * 0.12, mtof(m), 0.4, 0.8)); } },
  ];

  function render(snd) {
    const out = new Float32Array(Math.ceil(snd.sec * SR) + SR); // headroom for reverb tail
    const r = rng(snd.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    snd.render(out, r);
    return finish(out, snd);
  }

  const api = { SR, SOUNDS, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PuffSounds = api;
})(this);
