/* Explainer animation (LAND-04 stand-in until the captioned video arrives).
   Tells one story in four phases on a single 2D canvas:
     1  Ingest   — a raw 3 m satellite tile arrives and is sampled onto the grid
     2  Detect   — a scan labels every cell water / dry; the day's layer lifts and lands on the stack
     3  Stack    — eight daily layers compress into one; each cell keeps its share of water days
     4  Output   — the unified persistence layer, classed at 70 / 80 / 90 %, ready to query
   Data: EXPLAINER_GRID, a 48×48 cell grid cut from the real Ramsey County 2025 masks; each cell
   carries the probability that a daily observation reads "water". Daily frames are derived from it
   with spatially coherent, deterministic noise, so shorelines flicker and lake centres do not.
   No dependencies. Time-driven (not frame-driven) so play/pause/seek are exact and cheap. */
(function () {
  const host = document.getElementById("explainer");
  const G = window.EXPLAINER_GRID;
  if (!host || !G || host.dataset.videoSrc) return;

  // ---------- Palette (dark cartographic) ----------
  const C = {
    base: "#0a0d12", plane: "#111721", lattice: "rgba(140,170,200,0.16)", latticeStrong: "rgba(140,170,200,0.32)",
    scan: "#f5b54a", scanGlow: "rgba(245,181,74,0.35)", label: "#c9d4e2", muted: "#6f7f92",
    daily: "#3ad6f2", dailyDim: "rgba(58,214,242,0.55)", dry: "rgba(28,38,52,0.9)",
    p70: "#2f7fb3", p80: "#3cb4dd", p90: "#7deaf9", glow: "rgba(143,243,255,0.25)"
  };
  const N = G.n, DAYS = 8;
  const score = Array.from({ length: N * N }, (_, i) => parseInt(G.score.substr(i * 2, 2), 10) / 99);

  // ---------- Deterministic noise ----------
  const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // Coherent per-day field: 6-cell blocks with bilinear blend, plus a little per-cell jitter.
  function dayNoise(x, y, d) {
    const b = 6, gx = x / b, gy = y / b, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const v = (i, j) => hash(i, j, d * 7 + 3);
    const top = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx, bot = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx;
    return (top * (1 - fy) + bot * fy) * 0.8 + hash(x, y, d) * 0.2;
  }
  // Each day's "clearness" shifts the threshold a little so some days read wetter overall.
  const dayBias = Array.from({ length: DAYS }, (_, d) => (hash(d, 11, 5) - 0.5) * 0.16);
  const dayWater = (i, d) => dayNoise(i % N, Math.floor(i / N), d) < score[i] + dayBias[d];
  const counts = new Uint8Array(N * N);
  for (let d = 0; d < DAYS; d++) for (let i = 0; i < N * N; i++) if (dayWater(i, d)) counts[i]++;
  const classOf = i => { const f = counts[i] / DAYS; return f >= 0.9 ? 3 : f >= 0.8 ? 2 : f >= 0.7 ? 1 : 0; };
  const dates = ["Mar 18", "Mar 27", "Apr 04", "Apr 15", "Apr 29", "May 12", "May 30", "Jun 21"];

  // ---------- Offscreen layers (N×N px, one px per cell) ----------
  const off = (draw) => { const c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d"); const img = x.createImageData(N, N); draw(img.data); x.putImageData(img, 0, 0); return c; };
  const rgba = (data, i, r, g, b, a) => { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a; };
  // Raw tile: a false-colour composite. Dry land varies by a slow field, water is dark and slightly blue.
  const rawLayer = off(data => {
    for (let i = 0; i < N * N; i++) {
      const x = i % N, y = Math.floor(i / N), s = score[i];
      const field = dayNoise(x, y, 99), tex = hash(x, y, 77);
      if (s > 0.55) { const k = 0.7 + tex * 0.3; rgba(data, i, 22 * k, 40 * k, 58 * k, 255); }
      else { const veg = 0.55 + field * 0.45, k = 0.75 + tex * 0.35; rgba(data, i, (120 - 40 * veg) * k, (110 + 10 * veg) * k, (70 + 20 * s) * k, 255); }
    }
  });
  const dayLayers = Array.from({ length: DAYS }, (_, d) => off(data => {
    for (let i = 0; i < N * N; i++) dayWater(i, d) ? rgba(data, i, 58, 214, 242, 235) : rgba(data, i, 20, 28, 40, 110);
  }));
  const hex = h => [1, 3, 5].map(k => parseInt(h.substr(k, 2), 16));
  const P = [null, hex(C.p70), hex(C.p80), hex(C.p90)];
  const finalLayer = off(data => {
    for (let i = 0; i < N * N; i++) { const c = classOf(i); c ? rgba(data, i, ...P[c], 245) : rgba(data, i, 20, 28, 40, 140); }
  });
  const stats = [0, 0, 0, 0]; for (let i = 0; i < N * N; i++) stats[classOf(i)]++;

  // ---------- DOM ----------
  host.innerHTML = `
    <canvas class="ex-canvas" aria-hidden="true"></canvas>
    <div class="ex-hud">
      <div class="ex-phase"><span class="ex-eyebrow" id="ex-eyebrow">Step 1 of 4</span><strong id="ex-title"></strong><span id="ex-desc"></span></div>
      <div class="ex-readout" id="ex-readout"></div>
    </div>
    <div class="ex-controls">
      <button class="ex-play" type="button" aria-label="Pause" aria-pressed="false"></button>
      <ol class="ex-steps" aria-label="Animation steps">
        ${["Ingest", "Detect", "Stack", "Output"].map((s, i) => `<li><button type="button" data-step="${i}" aria-current="${i === 0}"><span class="ex-bar"><i></i></span><span class="ex-step-label">${s}</span></button></li>`).join("")}
      </ol>
    </div>
    <p class="sr-only">Animation: daily 3-metre satellite images of Ramsey County are each scanned for standing water, the daily layers are stacked, and every cell keeps the share of days it was under water, giving the 70, 80 and 90 percent persistence layers.</p>`;
  const canvas = host.querySelector(".ex-canvas"), ctx = canvas.getContext("2d");
  const $ = s => host.querySelector(s);
  const el = { eyebrow: $("#ex-eyebrow"), title: $("#ex-title"), desc: $("#ex-desc"), readout: $("#ex-readout"), play: $(".ex-play"), steps: [...host.querySelectorAll("[data-step]")] };

  // ---------- Timeline (seconds) ----------
  const T_INGEST = 3.0;
  const dayDur = Array.from({ length: DAYS }, (_, k) => 1.55 - (1.55 - 0.42) * (k / (DAYS - 1)));   // days arrive faster and faster
  const dayStart = []; let acc = T_INGEST; dayDur.forEach(d => { dayStart.push(acc); acc += d; });
  const T_STACK = acc, T_OUT = T_STACK + 2.2, T_END = T_OUT + 3.6, T_LOOP = T_END + 0.6;
  const PHASES = [
    { at: 0, title: "Daily satellite image", desc: "A 3 m PlanetScope tile is sampled onto the analysis grid." },
    { at: T_INGEST, title: "Water detected each day", desc: "Every cell is labelled water or dry. Each clear day adds a layer." },
    { at: T_STACK, title: "Days stacked", desc: "Layers compress into one. Each cell keeps its share of water days." },
    { at: T_OUT, title: "Persistence layer", desc: "Classed at 70, 80 and 90 % of the window — the file you download." }
  ];
  const phaseAt = t => PHASES.reduce((p, ph, i) => t >= ph.at ? i : p, 0);

  // ---------- Easing ----------
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const spring = x => 1 - Math.exp(-6.2 * x) * Math.cos(11 * x);            // light overshoot, settles by x≈1
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- Projection ----------
  // World: tile spans [0,N]×[0,N] on a ground plane, z up in cell units. cam=0 top-down, cam=1 isometric.
  let W = 0, H = 0, dpr = 1, s = 1, sTop = 1, sIso = 1, cx = 0, cy = 0, camK = 0;
  const cos30 = Math.cos(Math.PI / 6), sin30 = 0.5;
  function basis(cam) {
    // Columns of the affine map for x and y axes; z shortens as the view tilts.
    return { ax: lerp(1, cos30, cam) * s, ay: lerp(0, sin30, cam) * s, bx: lerp(0, -cos30, cam) * s, by: lerp(1, sin30, cam) * s, z: lerp(0, 0.62, cam) * s };
  }
  let B = basis(0);
  const proj = (x, y, z = 0) => [cx + x * B.ax + y * B.bx, cy + x * B.ay + y * B.by - z * B.z];
  function setCam(cam) {
    camK = cam; s = lerp(sTop, sIso, cam); B = basis(cam);
    // Top-down: the tile sits right of the HUD text. Isometric: centred, plane lowered so the stack grows into the space above.
    const mx = N / 2, my = N / 2, tx = lerp(W * 0.6, W * 0.5, cam), ty = lerp(H * 0.46, H * 0.5, cam);
    cx = tx - (mx * B.ax + my * B.bx); cy = ty - (mx * B.ay + my * B.by) + lerp(0, 7.5, cam) * B.z;
  }
  function drawLayer(img, z, alpha, clipX) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (clipX != null) { ctx.beginPath(); poly([[0, 0], [clipX, 0], [clipX, N], [0, N]], z); ctx.clip(); }
    const [ox, oy] = proj(0, 0, z);
    ctx.setTransform(B.ax * dpr, B.ay * dpr, B.bx * dpr, B.by * dpr, ox * dpr, oy * dpr);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, N, N);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.restore();
  }
  function poly(pts, z) { pts.forEach(([x, y], i) => { const [u, v] = proj(x, y, z); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.closePath(); }
  function outline(z, color, width = 1) { ctx.beginPath(); poly([[0, 0], [N, 0], [N, N], [0, N]], z); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  function lattice(z, alpha, step = 6) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = C.lattice; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = 0; k <= N; k += step) { let [a, b] = proj(k, 0, z), [c, d] = proj(k, N, z); ctx.moveTo(a, b); ctx.lineTo(c, d); [a, b] = proj(0, k, z); [c, d] = proj(N, k, z); ctx.moveTo(a, b); ctx.lineTo(c, d); }
    ctx.stroke(); ctx.restore();
  }
  function ticks(z, alpha) {
    // Coordinate ticks along the two front edges, labelled in metres from the tile origin.
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = C.muted; ctx.font = `${10}px Consolas, "SFMono-Regular", Menlo, monospace`; ctx.textAlign = "center";
    for (let k = 0; k <= N; k += 12) {
      const [u, v] = proj(k, N + 1.6, z); ctx.fillText(`${k * G.cell_m} m`, u, v + 10);
      if (camK > 0.5) { const [u2, v2] = proj(N + 1.4, k, z); ctx.textAlign = "left"; ctx.fillText(`${k * G.cell_m} m`, u2 + 4, v2 + 3); ctx.textAlign = "center"; }
    }
    ctx.restore();
  }
  function scanline(x, z, alpha) {
    const [a, b] = proj(x, 0, z), [c, d] = proj(x, N, z);
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = C.scanGlow; ctx.shadowBlur = 14; ctx.strokeStyle = C.scan; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.restore();
  }
  function planeShadow(z, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); poly([[0.6, 0.6], [N + 0.6, 0.6], [N + 0.6, N + 0.6], [0.6, N + 0.6]], z - 0.4); ctx.fill(); ctx.restore();
  }

  // ---------- Frame ----------
  const Z_GAP = 3.4;
  function frame(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.base; ctx.fillRect(0, 0, W, H);
    // Ambient vignette toward the plane
    const g = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(40,62,92,0.28)"); g.addColorStop(1, "rgba(10,13,18,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Camera: top-down during ingest, tilts to isometric as the first day is detected.
    setCam(easeInOut(seg(t, T_INGEST - 0.9, T_INGEST + 0.6)));
    const fadeOut = 1 - easeInOut(seg(t, T_END, T_LOOP));
    ctx.globalAlpha = fadeOut;

    // Ground: lattice + ticks
    const groundIn = easeOutCubic(seg(t, 0.35, 1.4));
    lattice(0, 0.55 * groundIn); outline(0, C.latticeStrong);
    ticks(0, 0.9 * groundIn);

    // Phase 1: raw tile appears, scan sweeps to show sampling onto the grid
    const rawIn = easeOutCubic(seg(t, 0.0, 0.9));
    const rawOut = 1 - easeInOut(seg(t, dayStart[0] + 0.25, dayStart[0] + 0.75));
    const rawAlpha = rawIn * rawOut;
    if (rawAlpha > 0.005) {
      drawLayer(rawLayer, 0, rawAlpha);
      const sx = easeInOut(seg(t, 0.9, 2.3)) * N;
      if (sx > 0 && sx < N) scanline(sx, 0.05, rawAlpha);
      lattice(0.02, 0.35 * seg(t, 1.0, 2.4) * rawAlpha, 1);   // fine 1-cell lattice = sensor sampling
    }

    // Phase 2–3: daily layers
    const stackK = easeInOut(seg(t, T_STACK, T_STACK + 1.6));      // 0 = stacked apart, 1 = compressed
    const finalK = easeOutCubic(seg(t, T_STACK + 0.9, T_OUT + 0.3));
    let dayShown = -1;
    for (let d = 0; d < DAYS; d++) {
      const t0 = dayStart[d], dur = dayDur[d];
      if (t < t0) break;
      dayShown = d;
      const u = (t - t0) / dur;
      const arriveZ = Z_GAP * d + 9;                                // arrives above the stack…
      const restZ = Z_GAP * d;                                      // …and settles onto it
      const scan = seg(u, 0.08, 0.62), settle = spring(seg(u, 0.55, 1.0));
      let z = lerp(arriveZ, restZ, settle);
      z = lerp(z, 0, stackK);                                       // compression pulls every layer to the plane
      const appear = easeOutCubic(seg(u, 0, 0.18));
      let alpha = appear;
      if (stackK > 0) alpha *= lerp(1, d === DAYS - 1 ? 1 : 0.18, stackK) * (1 - finalK * 0.85);
      if (alpha < 0.01) continue;
      if (u < 0.62) {                                               // raw tile with scan reveal of detections
        drawLayer(rawLayer, z, alpha * 0.9);
        drawLayer(dayLayers[d], z, alpha, scan * N);
        if (scan > 0 && scan < 1) scanline(scan * N, z + 0.05, alpha);
      } else {
        planeShadow(z, 0.5 * alpha * (1 - stackK));
        drawLayer(dayLayers[d], z, alpha);
        outline(z, `rgba(58,214,242,${0.35 * alpha})`);
      }
    }

    // Phase 3→4: the unified layer materialises on the plane
    if (finalK > 0) {
      const pulse = 0.5 + 0.5 * Math.sin((t - T_OUT) * 2.2);
      ctx.save(); ctx.shadowColor = C.glow; ctx.shadowBlur = 18 + 10 * pulse * seg(t, T_OUT, T_OUT + 0.6);
      drawLayer(finalLayer, 0, finalK); ctx.restore();
      outline(0, `rgba(143,243,255,${0.55 * finalK})`, 1.2);
      lattice(0.01, 0.35 * finalK);
      ticks(0, 0.9);
    }
    ctx.globalAlpha = 1;

    // HUD
    const ph = phaseAt(t);
    if (ph !== hudPhase) {
      hudPhase = ph; el.eyebrow.textContent = `Step ${ph + 1} of 4`; el.title.textContent = PHASES[ph].title; el.desc.textContent = PHASES[ph].desc;
      el.steps.forEach((b, i) => b.setAttribute("aria-current", i === ph));
      host.dataset.phase = ph;
      host.dispatchEvent(new CustomEvent("explainer:phase", { detail: { phase: ph } }));
    }
    el.steps.forEach((b, i) => { const a = PHASES[i].at, z = i < 3 ? PHASES[i + 1].at : T_END; b.querySelector("i").style.transform = `scaleX(${seg(t, a, z)})`; });
    if (ph === 0) readout(`PlanetScope · 3 m · ${G.origin}`, `${G.lat.toFixed(2)}° N ${Math.abs(G.lon).toFixed(2)}° W`);
    else if (ph === 1) readout(`Day ${String(dayShown + 1).padStart(2, "0")} of ${DAYS}`, `${dates[Math.max(0, dayShown)]} ${G.year} · clear-sky observation`);
    else if (ph === 2) readout(`${DAYS} layers → 1`, `each cell: water days ÷ clear days`);
    else readout(`≥90% ${fmt(stats[3])} · ≥80% ${fmt(stats[2])} · ≥70% ${fmt(stats[1])}`, `${G.cell_m} m cells · ${DAYS} clear days · ${G.year}`);
  }
  const fmt = n => `${(n * G.cell_m * G.cell_m / 1e4).toFixed(1)} ha`;
  let lastReadout = "";
  function readout(a, b) { const k = a + "|" + b; if (k === lastReadout) return; lastReadout = k; el.readout.innerHTML = `<strong></strong><span></span>`; el.readout.firstChild.textContent = a; el.readout.lastChild.textContent = b; }
  let hudPhase = -1;

  // ---------- Sizing ----------
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    // Isometric: fit the footprint (width N·2·cos30) plus the stack's height budget. Top-down: fill most of the height.
    sIso = Math.min(W * 0.7 / (N * 2 * cos30), (H * 0.74) / (N + 16));
    sTop = Math.min(H * 0.56 / N, W * 0.4 / N);
    if (!playing) frame(current);
  }
  new ResizeObserver(resize).observe(host);

  // ---------- Clock & controls ----------
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let playing = !reduced, current = reduced ? T_OUT + 1.0 : 0, last = performance.now();
  function tick(now) {
    if (playing) {
      current += Math.min(0.05, (now - last) / 1000);
      if (current >= T_LOOP) current = 0;
      frame(current);
    }
    last = now; requestAnimationFrame(tick);
  }
  function setPlaying(p) { playing = p; el.play.setAttribute("aria-pressed", !p); el.play.setAttribute("aria-label", p ? "Pause" : "Play"); host.classList.toggle("is-paused", !p); if (!p) frame(current); }
  el.play.onclick = () => setPlaying(!playing);
  el.steps.forEach(b => b.onclick = () => { current = PHASES[+b.dataset.step].at; last = performance.now(); frame(current); if (!playing && !reduced) setPlaying(true); });
  // Don't burn cycles off-screen.
  new IntersectionObserver(([e]) => { host.classList.toggle("is-offscreen", !e.isIntersecting); if (!e.isIntersecting && playing) { wasPlaying = true; playing = false; } else if (e.isIntersecting && wasPlaying) { wasPlaying = false; playing = true; last = performance.now(); } }, { threshold: 0.1 }).observe(host);
  let wasPlaying = false;

  // Debug/preview: ?t=seconds freezes the animation at a timestamp.
  const dbg = new URLSearchParams(location.search).get("t");
  if (dbg !== null) { current = Math.min(T_LOOP - 0.01, Math.max(0, parseFloat(dbg))); setPlaying(false); }

  resize(); setPlaying(playing); requestAnimationFrame(tick);
})();
