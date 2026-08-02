/* Adaptive media governor
   ------------------------------------------------------------------
   One clip is fetched at a time. The video nearest the middle of the
   viewport is the one that loads and plays; everything else pauses,
   and anything that scrolls far enough away hands its buffer back so
   memory stays flat no matter how long the page is.

   How hard it pushes depends on who is visiting: the concurrency
   budget, how early posters and clips are fetched, and whether video
   autoplays at all are all read off the connection (effectiveType,
   saveData) and the device (deviceMemory, hardwareConcurrency).

   Markup (both forms are accepted; a plain src/poster is adopted at
   startup so existing pages need no edits):
   <video class="lazy-vid" data-src="./clip.mp4" data-poster="./posters/clip.jpg"
          loop muted playsinline preload="none"></video>
   <video class="snap-vid" src="./clip.mp4" data-poster="./posters/clip.jpg" ...>

   Optional: data-src-mobile / data-poster-mobile (max-width:880px).
   Optional: data-hover — pointer-driven instead of scroll-driven; the
             clip is fetched on mouseenter and released on mouseleave
             (mouse devices only, touch keeps the scroll behaviour).
   Dynamically created videos: window.observeLazyVid(videoEl).
   Current profile, for debugging: window.mediaProfile(). */
(function () {
  'use strict';

  var ASSET_VERSION = '20260723';
  try {
    var sv = new URL(document.currentScript.src, window.location.href).searchParams.get('v');
    if (sv) ASSET_VERSION = sv;
  } catch (e) {}

  var root = document.documentElement;
  var isMobile = false, canHover = false, reduceMotion = false;
  try { isMobile = matchMedia('(max-width:880px)').matches; } catch (e) {}
  try { canHover = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
  try { reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------------- visitor profile ---------------- */

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  var P = {};

  function readProfile() {
    var et = (conn && conn.effectiveType) || '4g';
    var save = !!(conn && conn.saveData);
    var mem = navigator.deviceMemory || 4;
    var cores = navigator.hardwareConcurrency || 4;

    /* tier 0 keeps every clip as a still until it is asked for */
    var tier;
    if (save || et === 'slow-2g' || et === '2g' || reduceMotion) tier = 0;
    else if (et === '3g' || mem <= 2 || cores <= 2) tier = 1;
    else if (mem <= 4 || cores <= 4) tier = 2;
    else tier = 3;

    P = {
      tier: tier,
      effectiveType: et,
      saveData: save,
      memory: mem,
      cores: cores,
      /* how many clips may hold a buffer and run at once */
      budget: [0, 1, 2, 3][tier],
      /* px outside the viewport at which a poster is fetched */
      posterMargin: [120, 300, 600, 900][tier],
      /* viewport heights outside the viewport at which a clip is released */
      releaseAt: [0.35, 0.6, 1.2, 2][tier]
    };

    root.classList.toggle('low-power', tier <= 1);
    root.classList.toggle('no-autovid', tier === 0);
    return P;
  }
  readProfile();

  /* Safari and Firefox expose no Network Information API, so the hints above
     quietly read as "fast" there. Timing the bytes that have already arrived
     works everywhere, so the observed throughput is allowed to pull the tier
     down (never up) once there is enough evidence to judge. */
  var floorTier = P.tier;
  var pendingUp = -1;

  /* Aggregate of the most recent sizeable transfers rather than the best one
     ever seen, so the estimate can fall again when the link degrades. */
  function observedKbps() {
    if (!window.performance || !performance.getEntriesByType) return 0;
    var e = performance.getEntriesByType('resource');
    var spans = [], bytes = 0, n = 0;
    for (var i = e.length - 1; i >= 0 && n < 12; i--) {
      var r = e[i];
      var s = r.transferSize || r.encodedBodySize || 0;
      if (s <= 20000 || !(r.responseEnd > r.responseStart)) continue;
      spans.push([r.responseStart, r.responseEnd]);
      bytes += s;
      n++;
    }
    if (n < 2) return 0;

    /* Downloads overlap and are separated by idle time, so charge the bytes
       against the union of the intervals that were actually transferring. */
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var busy = 0, from = spans[0][0], to = spans[0][1];
    for (var k = 1; k < spans.length; k++) {
      if (spans[k][0] > to) { busy += to - from; from = spans[k][0]; to = spans[k][1]; }
      else if (spans[k][1] > to) to = spans[k][1];
    }
    busy += to - from;
    return busy > 0 ? bytes * 8 / busy : 0;           /* bits per ms is kbit/s */
  }

  function applyTier(t, kbps) {
    P.tier = t;
    P.budget = [0, 1, 2, 3][t];
    P.posterMargin = [120, 300, 600, 900][t];
    P.releaseAt = [0.35, 0.6, 1.2, 2][t];
    P.measuredKbps = Math.round(kbps);
    root.classList.toggle('low-power', t <= 1);
    root.classList.toggle('no-autovid', t === 0);
    if (document.body) { trimImageCandidates(); markTapTargets(); }
    schedule();
  }

  /* Badge the clips that are waiting on a tap: everything when autoplay is
     off, nothing otherwise. */
  function markTapTargets() {
    if (!vids) return;                               /* called before setup */
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      var host = v.parentElement;
      if (!host || v._hover) continue;
      var wants = P.tier === 0 && !v._mounted;
      if (wants === !!v._tapMarked) continue;
      v._tapMarked = wants;
      host.classList.toggle('gov-tap', wants);
    }
  }

  /* Nothing has been measured yet, so open one notch below the top: the
     first clip comes from the trimmed set for everyone, and the full-size
     files are only used once the link has shown it can carry them. */
  applyTier(Math.min(floorTier, 2), 0);

  /* Drop a tier the moment things look slow; only climb back after two
     readings agree, so a single fast burst cannot undo it. */
  function refineTier() {
    var kbps = observedKbps();
    if (!kbps) return;
    var capped = kbps < 700 ? 0 : kbps < 2500 ? 1 : kbps < 8000 ? 2 : 3;
    var next = Math.min(floorTier, capped);
    if (next === P.tier) { pendingUp = -1; return; }
    if (next > P.tier && pendingUp !== next) { pendingUp = next; return; }
    pendingUp = -1;
    applyTier(next, kbps);
  }

  window.mediaProfile = function () { return P; };

  /* Trim the effects that cost the most on weak GPUs. The sticky bars
     lose their blur, so they go fully opaque to stay readable. */
  (function () {
    var css =
      'html.low-power *,html.low-power *::before,html.low-power *::after{' +
        'backdrop-filter:none!important;-webkit-backdrop-filter:none!important;' +
        'will-change:auto!important}' +
      'html.low-power nav.top,html.low-power .phase-toggle{background:var(--bg)!important}' +
      /* Nothing plays by itself at this point, so say so rather than
         leaving what looks like a broken still. */
      '.gov-tap{position:relative}' +
      '.gov-tap>video{cursor:pointer}' +
      '.gov-tap::after{content:"";position:absolute;left:50%;top:50%;width:56px;height:56px;' +
        'margin:-28px 0 0 -28px;border-radius:50%;pointer-events:none;z-index:2;' +
        'background:rgba(0,0,0,.55) no-repeat center/18px 20px;' +
        'background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 18\'%3E%3Cpath d=\'M2 1l12 8-12 8z\' fill=\'white\'/%3E%3C/svg%3E");' +
        'box-shadow:0 2px 12px rgba(0,0,0,.3)}';
    var s = document.createElement('style');
    s.setAttribute('data-media-governor', '');
    s.textContent = css;
    (document.head || root).appendChild(s);
  })();

  /* ---------------- element plumbing ---------------- */

  var vids = [];

  function versionedUrl(url) {
    if (!url || /^(data:|blob:|https?:|#)/i.test(url) || /[?&]v=/.test(url)) return url;
    var h = url.indexOf('#');
    var hash = h === -1 ? '' : url.slice(h);
    var base = h === -1 ? url : url.slice(0, h);
    return base + (base.indexOf('?') === -1 ? '?' : '&') + 'v=' + ASSET_VERSION + hash;
  }

  /* A trimmed copy of every asset lives under light/: clips at up to 1280px
     wide with no audio track, stills as 1440px WebP. Reach for it when the
     connection is the bottleneck, or when the box on screen is too small to
     show the extra pixels anyway. Missing copies fall back to the original. */
  function isAbsolute(u) { return /^(data:|blob:|https?:|\/\/)/i.test(u); }

  function variantUrl(url, dir) {
    if (!url || isAbsolute(url) || url.indexOf('light/') !== -1 || url.indexOf('mid/') !== -1) return null;
    var tail = '', cut = url.search(/[?#]/);
    if (cut !== -1) { tail = url.slice(cut); url = url.slice(0, cut); }
    var lead = url.slice(0, 2) === './' ? './' : '';
    var path = lead ? url.slice(2) : url;
    var ext = (path.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    if (ext === 'mp4') return lead + dir + '/' + path + tail;
    if (dir === 'light' && (ext === 'png' || ext === 'jpg' || ext === 'jpeg'))
      return lead + 'light/' + path.replace(/\.[a-z0-9]+$/i, '.webp') + tail;
    return null;
  }
  function lightAsset(url) { return variantUrl(url, 'light'); }

  /* Width the element actually occupies, falling back to its container
     while the media is still empty and has no intrinsic size. */
  function boxWidth(el) {
    var w = 0;
    try {
      w = el.getBoundingClientRect().width || el.offsetWidth || 0;
      if (!w && el.parentElement) w = el.parentElement.getBoundingClientRect().width || 0;
    } catch (e) {}
    return w;
  }

  /* Three rungs to choose from: light/ at 1280px, mid/ at 1920px, and the
     untouched original. Pixels beyond what the box can show are wasted, so
     the pick is driven by the width the clip really occupies; density is
     counted only up to 1.5x, past which extra video detail stops being
     visible but keeps costing the whole file. */
  function rungFor(v) {
    if (v.dataset && v.dataset.light === 'off') return null;
    if (P.tier <= 1 || v._forceLight) return 'light';
    var need = boxWidth(v) * Math.min(window.devicePixelRatio || 1, 1.5);
    if (!need) return 'mid';
    if (need <= 1450) return 'light';
    if (need <= 2600 || P.tier <= 2) return 'mid';
    return null;                                     /* original */
  }

  function posterFor(v) {
    var base = (isMobile && v.dataset.posterMobile) ? v.dataset.posterMobile : v.dataset.poster;
    if (!base || v._noLight) return base;
    /* Stills are cheap and get replaced the moment the clip runs. */
    return lightAsset(base) || base;
  }

  function srcFor(v) {
    var base = (isMobile && v.dataset.srcMobile) ? v.dataset.srcMobile : v.dataset.src;
    if (!base || v._noLight) return base;
    var rung = rungFor(v);
    return (rung && variantUrl(base, rung)) || base;
  }

  function showPoster(v) {
    if (v._posterSet) return;
    v._posterSet = 1;
    var p = posterFor(v);
    if (p) v.setAttribute('poster', versionedUrl(p));
  }

  /* Clips stay out of the way until the page itself has finished
     loading, so text, stylesheets and stills get the pipe first. */
  var opened = false;

  function mount(v) {
    showPoster(v);
    if (!opened || v._mounted) return;
    var s = srcFor(v);
    if (!s) return;
    v._mounted = 1;
    v._loadedSrc = s;
    v._mountedAt = (window.performance && performance.now) ? performance.now() : Date.now();
    /* Point at the file before asking for it, or the element would start
       fetching whatever source it was holding first. */
    v.setAttribute('src', versionedUrl(s));
    v.preload = 'auto';
    try { v.load(); } catch (e) {}
  }

  /* Hand the buffer back and repaint the poster. */
  function unmount(v) {
    if (!v._mounted) return;
    v._mounted = 0;
    v._forced = 0;
    v._loadedSrc = '';
    try { v.pause(); } catch (e) {}
    v.removeAttribute('src');
    v.preload = 'none';
    try { v.load(); } catch (e) {}
  }

  function play(v) {
    v.muted = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    var pr = v.play();
    if (pr && pr.catch) pr.catch(function () {});
  }

  function pause(v) { if (!v.paused) { try { v.pause(); } catch (e) {} } }

  /* ---------------- the governor pass ---------------- */

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(runPass);
  }

  function runPass() {
    queued = false;
    if (document.hidden) { for (var h = 0; h < vids.length; h++) pause(vids[h]); return; }

    var vh = window.innerHeight || 1;
    var live = [];

    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      var r = v.getBoundingClientRect();
      if (!r.width && !r.height) continue;          /* not laid out */

      /* px between the element and the nearest viewport edge */
      var gap = r.top > vh ? r.top - vh : (r.bottom < 0 ? -r.bottom : 0);

      /* every card earns its still, hover-driven ones included */
      if (gap <= P.posterMargin) showPoster(v);

      if (v._hover) continue;                       /* pointer drives the rest */

      if (gap > P.releaseAt * vh) { unmount(v); continue; }

      if (r.bottom > 0 && r.top < vh) {
        live.push({
          v: v,
          d: Math.abs((r.top + r.height / 2) - vh / 2),
          big: r.height > vh * 0.55
        });
      } else {
        pause(v);                                   /* just offscreen: keep the buffer */
      }
    }

    live.sort(function (a, b) { return a.d - b.d; });

    /* A clip filling most of the screen is the one being read, so it
       gets the page to itself; a grid of small cards may share. */
    var budget = P.budget;
    if (live.length && live[0].big) budget = Math.min(budget, 1);

    for (var j = 0; j < live.length; j++) {
      var e = live[j];
      if (j < budget || e.v._forced) { mount(e.v); play(e.v); }
      else pause(e.v);
    }

    markTapTargets();
  }

  /* ---------------- wiring ---------------- */

  function adopt(v) {
    /* Fold a plain src/poster into the deferred attributes so nothing
       is fetched before the governor asks for it. */
    v.preload = 'none';
    var s = v.getAttribute('src');
    if (s && !v.dataset.src) {
      v.dataset.src = s;
      v.removeAttribute('src');
      /* Dropping the attribute alone leaves the element still holding the
         file the markup named, so reset the selection before it is asked
         to buffer anything. */
      try { v.load(); } catch (e) {}
    }
    var p = v.getAttribute('poster');
    if (p && !v.dataset.poster) { v.dataset.poster = p; v.removeAttribute('poster'); }
    if (!v.hasAttribute('playsinline')) v.setAttribute('playsinline', '');
  }

  function bindHover(v) {
    v._hover = 1;
    var card = v.parentElement || v;
    card.addEventListener('mouseenter', function () { mount(v); play(v); });
    card.addEventListener('mouseleave', function () { unmount(v); });
  }

  /* Coarse trigger so a clip that shifts into view without a scroll
     (layout change, accordion, resize) still gets picked up. */
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(schedule, { rootMargin: '600px 0px', threshold: [0, 0.25, 0.6] });
  }

  /* If the trimmed copy is not on the server, take the original instead. */
  function onError(e) {
    var v = e.target;
    if (!v || v.tagName !== 'VIDEO' || !v._governed || v._noLight) return;
    if (!v.getAttribute('src')) return;              /* released, not broken */
    if (!v._loadedSrc || !/(^|\/)(light|mid)\//.test(v._loadedSrc)) return;
    /* Only a genuinely unusable source means the trimmed copy is missing;
       an abort just means the governor moved on while it was loading. */
    if (!v.error || v.error.code !== 4) return;
    v._noLight = 1;
    v._mounted = 0;
    mount(v);
    play(v);
  }

  function register(v) {
    if (v._governed) return;
    v._governed = 1;
    adopt(v);
    vids.push(v);
    v.addEventListener('error', onError);
    if (v.dataset.hover !== undefined && canHover) bindHover(v);
    else if (io) io.observe(v);
    schedule();
  }
  window.observeLazyVid = register;

  function init() {
    initImages();

    var list = document.querySelectorAll('video.lazy-vid, video.snap-vid');
    for (var i = 0; i < list.length; i++) register(list[i]);

    /* Anything already on screen gets its poster now rather than a frame late. */
    var vh = window.innerHeight || 1;
    for (var j = 0; j < vids.length; j++) {
      var r = vids[j].getBoundingClientRect();
      if (r.bottom > -200 && r.top < vh + 200) showPoster(vids[j]);
    }
    runPass();

    if (document.readyState === 'complete') openGate();
    else {
      window.addEventListener('load', openGate, { once: true });
      setTimeout(openGate, 3000);                    /* never stall on a slow asset */
    }
  }

  function openGate() {
    if (opened) return;
    opened = true;
    refineTier();
    schedule();
    setInterval(watchdog, 2500);
  }

  /* A clip that is mounted but still not playable is a sign the connection
     is worse than it advertised: swap it for the trimmed copy and go on. */
  function watchdog() {
    if (document.hidden) return;
    refineTier();
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (!v._mounted || v._noLight || v._forceLight) continue;
      if (!v._loadedSrc || v._loadedSrc.indexOf('light/') !== -1) continue;  /* already the smallest */
      if (v.readyState >= 3 || now - (v._mountedAt || 0) < 5000) continue;
      v._forceLight = 1;
      unmount(v);
      mount(v);
      play(v);
    }
  }

  /* Stills carry a srcset, so the browser already picks between the trimmed
     copy and the original by screen density, with no risk of fetching both.
     All that is left is the case density gets wrong: on a link measured slow,
     drop the full-size candidate for pictures that are still far enough away
     not to have started, so bandwidth wins over pixel count. */
  function trimImageCandidates() {
    if (P.tier > 1) return;
    var imgs = document.querySelectorAll('img[srcset]');
    var vh = window.innerHeight || 1;
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im._trimmed || (im.complete && im.naturalWidth)) continue;
      if (im.getBoundingClientRect().top < vh * 1.5) continue;   /* likely already started */
      var first = im.getAttribute('srcset').split(',')[0].trim();
      if (first.indexOf('light/') === -1) continue;
      im._trimmed = 1;
      im.setAttribute('srcset', first);
    }
  }

  function initImages() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].getAttribute('decoding')) imgs[i].setAttribute('decoding', 'async');
    }
  }

  /* Tap a still to start it when autoplay is off (tier 0) or when the
     concurrency budget is already spoken for. */
  document.addEventListener('click', function (ev) {
    var v = ev.target && ev.target.closest && ev.target.closest('video');
    if (!v || !v._governed || v._hover) return;
    if (v._mounted && !v.paused) return;
    v._forced = 1;
    openGate();                                      /* an explicit tap outranks the gate */
    mount(v);
    play(v);
  }, true);

  if (conn && conn.addEventListener) {
    conn.addEventListener('change', function () {
      readProfile();
      floorTier = P.tier;
      pendingUp = -1;
      refineTier();
      schedule();
    });
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () {
    try { isMobile = matchMedia('(max-width:880px)').matches; } catch (e) {}
    schedule();
  }, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { for (var i = 0; i < vids.length; i++) pause(vids[i]); }
    else schedule();
  });

  /* Autoplay stays blocked until the first gesture on some browsers. */
  ['touchend', 'pointerdown', 'click'].forEach(function (name) {
    document.addEventListener(name, function once() {
      document.removeEventListener(name, once);
      schedule();
    }, { once: true, passive: true });
  });

  /* Keep looping even where the loop attribute is missing. */
  document.addEventListener('ended', function (e) {
    var v = e.target;
    if (v && v.tagName === 'VIDEO' && v._mounted) { v.currentTime = 0; play(v); }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
