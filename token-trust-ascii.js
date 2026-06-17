/* TokenTrust — ASCII lockup, embedded build of token_trust_ascii.html.
   Mounts into <canvas id="tt-ascii">. The internal buffer is a fixed 4:3
   resolution, so it fills the 4:3 card with CSS (width/height:100%) — no
   letterboxing. Authoring controls (record / PNG) are removed. For perf the
   render loop pauses when the card is off-screen or the tab is hidden, and is
   throttled to ~30fps. */
(() => {
  "use strict";

  const stage = document.getElementById("tt-ascii");
  if (!stage) return;                 // only runs on the page that has the card
  const ctx = stage.getContext("2d");

  // ---- 8-spike sparkle path, straight from the SVG mask ----
  const STAR_PATH = "M232.841 10.5296L182.681 131.282L304.054 81.1211L315.82 107.134L193.829 157.288L315.82 207.449L304.054 232.841L182.681 182.68L232.841 304.054L207.452 315.82L157.292 193.824L107.131 315.82L81.7422 304.054L131.284 182.68L10.5297 232.841L0 207.449L120.754 157.288L0 107.134L10.5297 81.743L131.284 131.282L81.7422 10.5296L107.131 0L157.292 120.752L207.452 0L232.841 10.5296Z";
  const STAR_VIEW = 315.82;
  const STAR_CENTER = STAR_VIEW / 2;
  const starPath = new Path2D(STAR_PATH);

  // glyph ramp: empty -> small dot -> small circle -> hollow -> dotted -> filled
  const RAMP = [" ", "·", "∘", "○", "◉", "●"];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ROT_SPEED = reduceMotion ? 0.06 : 0.22; // rad/s, infinite spin

  // layout switching cadence
  const HOLD = 5.0;   // seconds each layout is held
  const TRANS = 1.5;  // seconds to morph between layouts
  const PERIOD = HOLD + TRANS;

  const WORD = "TokenTrust";
  let BF = 320;       // base font px the wordmark buffer is rendered at (set per-resize)

  // resolution-independent noise frequencies (base, per CSS pixel)
  const GF = 0.013, AF = 0.017;

  // ---------- canvases ----------
  const scene = document.createElement("canvas");        // glyphs, white on black
  const sctx = scene.getContext("2d");

  const bloom = document.createElement("canvas");        // bloom scratch
  const blctx = bloom.getContext("2d");

  const SB = 360;                                         // rotating star buffer
  const shape = document.createElement("canvas");
  shape.width = SB; shape.height = SB;
  const shctx = shape.getContext("2d", { willReadFrequently: true });

  const textBuf = document.createElement("canvas");      // wordmark, rendered once
  const tctx = textBuf.getContext("2d", { willReadFrequently: true });

  // ---------- value noise (fbm) ----------
  function hash(x, y) { let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  const smooth = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y) { let val = 0, amp = 0.5, f = 1; for (let i = 0; i < 3; i++) { val += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; } return val; }

  // ---------- state ----------
  // Fixed internal 4:3 resolution → consistent output regardless of card size,
  // CSS just scales the canvas to fit. (Lighter than the 1600×1200 authoring
  // build; still well above the card's device-pixel size, so it stays crisp.)
  const H = 960, W = 1280, U = Math.min(W, H);   // 4:3
  let cell = 16, monoMain = "";
  let cols = 0, rows = 0;
  let textCellPx = 8, monoText = "";       // wordmark grid: constant size, both layouts
  let gf = GF, af = AF;                     // grain freq

  let fontReady = false;
  let tBufData = null, tw = 0, th = 0, wpx = 0;
  let prefixX = [];   // per-character x boundaries within the text buffer

  // full centered layout anchors for each mode; positions interpolate directly
  // and the wordmark is typed/untyped so the mark never collides
  let LV = null, LH = null;
  let layoutReady = false;

  // Render the wordmark into a tight buffer (Instrument Sans, -5% tracking).
  function renderTextBuffer() {
    if (!fontReady) return;
    BF = Math.round(Math.min(U * 0.46, 720));

    tctx.font = `500 ${BF}px "Instrument Sans", sans-serif`;
    tctx.letterSpacing = `${(-0.05 * BF).toFixed(2)}px`;
    wpx = tctx.measureText(WORD).width || BF * 5;

    tw = Math.ceil(wpx) + Math.round(BF * 0.1);
    th = Math.ceil(BF * 1.25);

    // per-character x boundaries in buffer space (for character-by-character typing)
    const leftEdge = tw / 2 - wpx / 2;
    prefixX = [];
    for (let k = 0; k <= WORD.length; k++) {
      prefixX.push(leftEdge + tctx.measureText(WORD.slice(0, k)).width);
    }

    textBuf.width = tw; textBuf.height = th;   // resizing resets context state

    tctx.fillStyle = "#fff";
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.font = `500 ${BF}px "Instrument Sans", sans-serif`;
    tctx.letterSpacing = `${(-0.05 * BF).toFixed(2)}px`;
    tctx.filter = `blur(${Math.max(0.6, BF * 0.004).toFixed(2)}px)`;
    tctx.fillText(WORD, tw / 2, th / 2);
    tctx.filter = "none";
    tBufData = tctx.getImageData(0, 0, tw, th).data;

    computeLayouts();
  }

  function computeLayouts() {
    if (!W) return;

    // vertical: mark on top, wordmark below, group centered
    const mV = U * 0.56;
    const tSV = wpx ? (mV * 0.92) / wpx : 0.5;
    const capV = BF * 0.72 * tSV;
    const gapV = U * 0.05;
    const groupHV = mV + gapV + capV;
    const topV = (H - groupHV) / 2;
    LV = {
      mcx: W / 2, mcy: topV + mV / 2, mSize: mV,
      tcx: W / 2, tcy: topV + mV + gapV + capV / 2, tscale: tSV,
    };

    // horizontal: mark on left, wordmark on right, group centered + width-fit
    let mH = U * 0.40;
    let tSH = (mH * 0.80) / BF;
    let textWH = wpx * tSH;
    const gapH = U * 0.05;
    let groupWH = mH + gapH + textWH;
    const maxW = W * 0.92;
    if (groupWH > maxW) {
      const k = maxW / groupWH;
      mH *= k; tSH *= k; textWH *= k; groupWH *= k;
    }
    const leftH = (W - groupWH) / 2;
    LH = {
      mcx: leftH + mH / 2, mcy: H / 2, mSize: mH,
      tcx: leftH + mH + gapH + textWH / 2, tcy: H / 2, tscale: tSH,
    };

    layoutReady = true;
  }

  // straight eased interpolation between the two layouts
  function geomAt(m) {
    return {
      mcx: lerp(LV.mcx, LH.mcx, m),
      mcy: lerp(LV.mcy, LH.mcy, m),
      mSize: lerp(LV.mSize, LH.mSize, m),
      tcx: lerp(LV.tcx, LH.tcx, m),
      tcy: lerp(LV.tcy, LH.tcy, m),
      tscale: lerp(LV.tscale, LH.tscale, m),
    };
  }

  // one-time setup at the fixed internal resolution
  function setup() {
    cell = Math.max(9, Math.min(16, Math.round(U / 90)));
    cols = Math.ceil(W / cell) + 1;
    rows = Math.ceil(H / cell) + 1;
    textCellPx = Math.max(3, Math.round(cell * 0.5));
    gf = GF; af = AF;

    for (const c of [stage, scene, bloom]) { c.width = W; c.height = H; }

    monoMain = `${Math.round(cell * 0.94)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    monoText = `${Math.max(3, Math.round(textCellPx * 1.02))}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";

    computeLayouts();
  }

  setup();

  if (document.fonts) {
    document.fonts.load('500 80px "Instrument Sans"')
      .then(() => { fontReady = true; renderTextBuffer(); })
      .catch(() => { fontReady = true; renderTextBuffer(); });
  } else {
    fontReady = true; renderTextBuffer();
  }

  // Returns position blend m and reveal (wordmark opacity 0..1). The transition
  // is a soft dissolve: the wordmark eases out (glyphs decay down the ramp),
  // the mark glides to its new layout while the word is hidden, then the word
  // eases back in at the new position. No typewriter — a natural crossfade.
  function modeBlend(time) {
    const c = time % (2 * PERIOD);
    const e1 = 0.34, e2 = 0.66;   // fade out | relocate mark | fade in
    function phase(p, from, to) {
      if (p < e1) return { m: from, reveal: 1 - smooth(p / e1) };
      if (p < e2) return { m: lerp(from, to, smooth((p - e1) / (e2 - e1))), reveal: 0 };
      return { m: to, reveal: smooth((p - e2) / (1 - e2)) };
    }
    if (c < HOLD) return { m: 0, reveal: 1 };
    if (c < HOLD + TRANS) return phase((c - HOLD) / TRANS, 0, 1);
    if (c < 2 * HOLD + TRANS) return { m: 1, reveal: 1 };
    return phase((c - (2 * HOLD + TRANS)) / TRANS, 1, 0);
  }

  // ---------- loop (viewport-gated, ~30fps) ----------
  let angle = 0, last = performance.now(), lastDraw = 0;
  let rafId = null, inView = true;
  const FRAME_MS = 1000 / 30;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (now - lastDraw < FRAME_MS) return;     // throttle to ~30fps
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; lastDraw = now;
    angle += dt * ROT_SPEED;
    const t = now / 1000;

    // placement + typing reveal for the current point in the cycle
    const ready = layoutReady && tBufData;
    const ph = ready ? modeBlend(t) : { m: 0, reveal: 1 };
    const g = ready ? geomAt(ph.m)
                    : { mcx: W / 2, mcy: H / 2, mSize: U * 0.56, tcx: W / 2, tcy: H / 2, tscale: 0.5 };
    const mcx = g.mcx, mcy = g.mcy, mSize = g.mSize;
    const tcx = g.tcx, tcy = g.tcy, tscale = g.tscale;
    const reveal = ph.reveal;               // fraction of the word typed (L→R)
    const skipBand = reveal >= 0.999;       // carve out the band only when fully typed

    // rotating star into the small shape buffer
    shctx.clearRect(0, 0, SB, SB);
    shctx.save();
    shctx.filter = "blur(1.6px)";
    shctx.translate(SB / 2, SB / 2);
    shctx.rotate(angle);
    const ss = (SB * 0.86) / STAR_VIEW;
    shctx.scale(ss, ss);
    shctx.translate(-STAR_CENTER, -STAR_CENTER);
    shctx.fillStyle = "#fff";
    shctx.fill(starPath);
    shctx.restore();
    const sd = shctx.getImageData(0, 0, SB, SB).data;

    // text band (screen-space rect of the wordmark at current placement)
    let bx0 = 1, bx1 = -1, by0 = 1, by1 = -1;
    if (tBufData) {
      const bw = wpx * tscale * 1.04;
      const bh = BF * 0.95 * tscale;
      bx0 = tcx - bw / 2; bx1 = tcx + bw / 2;
      by0 = tcy - bh / 2; by1 = tcy + bh / 2;
    }

    // ===== coarse pass: mark + ambient field (skips the text band) =====
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, W, H);
    sctx.font = monoMain;

    const half = mSize / 2;
    for (let gy = 0; gy < rows; gy++) {
      const py = gy * cell + cell / 2;
      const ry = (py - mcy) / half;
      for (let gx = 0; gx < cols; gx++) {
        const px = gx * cell + cell / 2;
        if (skipBand && px >= bx0 && px <= bx1 && py >= by0 && py <= by1) continue;

        const rx = (px - mcx) / half;
        let body = 0;
        const sx = (rx * 0.5 + 0.5) * SB, sy = (ry * 0.5 + 0.5) * SB;
        if (sx >= 0 && sx < SB && sy >= 0 && sy < SB)
          body = sd[((sy | 0) * SB + (sx | 0)) * 4] / 255;

        const grain = fbm(px * gf + t * 0.28, py * gf - t * 0.16);
        const amb = fbm(px * af - t * 0.11, py * af + t * 0.13);
        let v = body * (0.40 + 0.85 * grain);
        v = Math.max(v, (amb - 0.62) * 0.55);
        if (v <= 0.06) continue;
        if (v > 1) v = 1;

        let gi = (v * RAMP.length) | 0;
        if (gi >= RAMP.length) gi = RAMP.length - 1;
        const ch = RAMP[gi];
        if (ch === " ") continue;
        sctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.20 + v * 0.95).toFixed(3)})`;
        sctx.fillText(ch, px, py);
      }
    }

    // ===== wordmark pass: dissolve in/out by `reveal` (opacity) =====
    if (tBufData && LV && LH) {
      const c2 = textCellPx;
      sctx.font = monoText;

      for (let py = by0 + c2 / 2; py < by1; py += c2) {
        if (py < 0 || py >= H) continue;
        const ly = ((py - tcy) / tscale + th / 2) | 0;
        const rowOK = ly >= 0 && ly < th;
        for (let px = bx0 + c2 / 2; px < bx1; px += c2) {
          if (px < 0 || px >= W) continue;
          const grain = fbm(px * gf + t * 0.28, py * gf - t * 0.16);

          let cover = 0, lx = -1;
          if (rowOK) {
            lx = ((px - tcx) / tscale + tw / 2) | 0;
            if (lx >= 0 && lx < tw) cover = tBufData[(ly * tw + lx) * 4] / 255;
          }
          const letterV = cover * (0.42 + 0.82 * grain);

          let v;
          if (skipBand) {
            // at rest: crisp letters + ambient so the band has no seam
            const amb = fbm(px * af - t * 0.11, py * af + t * 0.13);
            v = Math.max(letterV, (amb - 0.62) * 0.55);
          } else {
            // transition: fade the whole word by `reveal` — glyphs decay down
            // the ramp (●→◉→○→·) for a soft dissolve instead of typing.
            if (cover <= 0.04) continue;
            v = letterV * reveal;
          }
          if (v <= 0.06) continue;
          if (v > 1) v = 1;
          let gi = (v * RAMP.length) | 0; if (gi >= RAMP.length) gi = RAMP.length - 1;
          const ch = RAMP[gi]; if (ch === " ") continue;
          sctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.20 + v * 0.95).toFixed(3)})`;
          sctx.fillText(ch, px, py);
        }
      }
    }

    // ===== composite + bloom on a #1a1a1a base =====
    // Lay a #1a1a1a backdrop, then add the glyph scene (and its bloom)
    // additively — black areas contribute nothing, so the background stays
    // an even #1a1a1a while the glyphs glow on top.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(scene, 0, 0);

    blctx.clearRect(0, 0, W, H);
    blctx.filter = `blur(${(U * 0.006).toFixed(1)}px)`;
    blctx.drawImage(scene, 0, 0);
    blctx.filter = "none";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bloom, 0, 0);

    blctx.clearRect(0, 0, W, H);
    blctx.filter = `blur(${(U * 0.02).toFixed(1)}px)`;
    blctx.drawImage(scene, 0, 0);
    blctx.filter = "none";
    ctx.globalAlpha = 0.40;
    ctx.drawImage(bloom, 0, 0);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // baked-in vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, U * 0.30, W / 2, H / 2, U * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function start() { if (rafId == null) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
  function stop()  { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }
  function apply() { if (inView && !document.hidden) start(); else stop(); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(es => { inView = es[0].isIntersecting; apply(); }, { threshold: 0 }).observe(stage);
  }
  document.addEventListener("visibilitychange", apply);
  start();
})();
