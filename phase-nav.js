/* Section indicator for the case-study pages.

   The markup lives in each page's sticky nav (.phase-nav), one link per
   <section class="phase-flat" id="..."> in the order they appear, so every
   page lists its own chapters and the links still jump without this script.
   This file adds the rest: the underline that follows the chapter you are
   reading, and a smooth scroll on click that does not light up every chapter
   it passes on the way.

   Wherever the chapters do not fit in the bar (phones, narrow windows: each
   page's CSS hides .phase-nav below its own breakpoint), the current chapter
   is shown instead in a pill just under the bar, with chevrons that step to
   the previous and next chapter. The pill is built here, styles included. */
(function () {
  'use strict';

  var nav = document.querySelector('.phase-nav');
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var targets = links.map(function (a) {
    return document.getElementById(decodeURIComponent(a.hash.slice(1)));
  });
  var bar = nav.querySelector('.phase-nav-bar');
  var topbar = document.querySelector('nav.top');
  var root = document.documentElement;

  var reduceMotion = false;
  try { reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var active = -1;
  var ticking = false;

  /* While a clicked scroll is in flight the click decides what is current, so the
     underline does not flick through every chapter on the way. The lock lifts when
     the chapter arrives (or the page runs out), when the reader takes over with the
     wheel, touch or keys, or after a safety timeout. It does not wait for a
     'scrollend' event, which Safari does not send. */
  var lockTarget = -1;
  var lockUntil = 0;

  /* Anything that grows above the chapter after the scroll has started (a video
     poster, a late font, an image a browser ignores the reserved size of) moves
     the target, and a smooth scroll does not retarget itself. So once the page
     stops moving, check the chapter actually arrived, and follow it if not. */
  var settleTimer = null;
  var retries = 0;

  /* "The page has stopped" has to survive a long flight past heavy media: the
     browser can go ~200ms between scroll events while it decodes, and reading
     that pause as a stop would restart the scroll mid-way. So the wait is at
     least 450ms and at least three times the longest pause seen on this flight. */
  var lastScrollAt = 0;
  var longestSilence = 0;

  /* close enough to count as landed. A smooth scroll aims at where the chapter
     was when it set off, so a pixel or two of drift on the way is normal, and
     correcting it would be a visible twitch half a second after the page settles */
  var ARRIVED = 8;

  function visible() { return nav.offsetParent !== null; }

  /* Each page's CSS breakpoint is set with room to spare for the widest system
     font, but a font this file cannot predict may still come out wider. If the
     chapters would overlap the name or the links, or the grid can no longer
     keep them on the centre line, hide them rather than show them off-centre.
     Removing and re-adding the class happens inside one task, so it never paints. */
  function fit() {
    nav.classList.remove('is-cramped');
    if (visible()) {
      var inner = nav.parentNode;
      var ir = inner.getBoundingClientRect();
      var nr = nav.getBoundingClientRect();
      var mark = inner.querySelector('.nav-mark');
      var side = inner.querySelector('.nav-links');
      var mr = mark ? mark.getBoundingClientRect() : { right: ir.left };
      var sr = side ? side.getBoundingClientRect() : { left: ir.right };
      var drift = Math.abs((nr.left + nr.width / 2) - (ir.left + ir.width / 2));
      if (inner.scrollWidth > inner.clientWidth + 1 ||
          nr.left < mr.right + 24 || nr.right > sr.left - 24 || drift > 2) {
        nav.classList.add('is-cramped');
      }
    }
    setPillMode();
  }

  function placeBar(snap) {
    if (!bar || !visible()) return;
    if (active < 0) { bar.style.opacity = '0'; return; }
    var a = links[active];
    if (snap) bar.style.transition = 'none';
    bar.style.width = a.offsetWidth + 'px';
    bar.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    bar.style.opacity = '1';
    if (snap) { void bar.offsetWidth; bar.style.transition = ''; }
  }

  function setActive(i) {
    if (i === active) return;
    var prev = active;
    /* the first chapter to light up should not slide in from the left edge */
    var snap = active < 0;
    active = i;
    for (var k = 0; k < links.length; k++) {
      if (k === i) links[k].setAttribute('aria-current', 'true');
      else links[k].removeAttribute('aria-current');
    }
    placeBar(snap);
    updatePill(prev);
  }

  function atBottom() {
    var doc = document.documentElement;
    return window.innerHeight + window.pageYOffset >= doc.scrollHeight - ARRIVED;
  }

  /* where a chapter's top comes to rest: scrollIntoView honours scroll-margin-top,
     which is the bar's height on desktop and more under the pill */
  function landed(t) {
    var m = parseFloat(getComputedStyle(t).scrollMarginTop) || 0;
    return Math.abs(t.getBoundingClientRect().top - m) <= ARRIVED;
  }

  function compute() {
    ticking = false;
    var barBottom = topbar ? topbar.getBoundingClientRect().bottom : 0;

    if (lockTarget >= 0) {
      var t = targets[lockTarget];
      var arrived = !t || landed(t) || atBottom();
      if (!arrived && Date.now() < lockUntil) return;
      lockTarget = -1;
    }

    /* a chapter counts as current once its top passes a line a third of the
       way down the visible area, below the sticky bar */
    var line = barBottom + window.innerHeight * 0.3;
    var i = -1;
    for (var k = 0; k < targets.length; k++) {
      if (targets[k] && targets[k].getBoundingClientRect().top <= line) i = k;
    }

    /* the last chapter is often too short to ever reach that line, so the
       bottom of the page settles it */
    if (i >= 0 && atBottom()) i = targets.length - 1;
    setActive(i);
  }

  function schedule() {
    if (!ticking) { ticking = true; requestAnimationFrame(compute); }
  }

  function go(t) {
    t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function chase() {
    if (lockTarget < 0) return;
    var t = targets[lockTarget];
    var arrived = !t || landed(t) || atBottom();
    if (arrived || retries >= 3) { lockTarget = -1; schedule(); return; }
    retries++;
    lockUntil = Date.now() + 3000;
    lastScrollAt = 0;
    go(t);
    armSettle();
  }

  function armSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(chase, Math.max(450, longestSilence * 3));
  }

  function onScroll() {
    schedule();
    if (lockTarget < 0) return;
    var now = performance.now();
    if (lastScrollAt) longestSilence = Math.max(longestSilence, now - lastScrollAt);
    lastScrollAt = now;
    armSettle();
  }

  links.forEach(function (a, k) {
    a.addEventListener('click', function (e) {
      var t = targets[k];
      if (!t) return;
      e.preventDefault();
      setActive(k);
      lockTarget = k;
      lockUntil = Date.now() + 3000;
      retries = 0;
      lastScrollAt = 0;
      longestSilence = 0;
      go(t);
      armSettle();
      try { history.replaceState(null, '', a.hash); } catch (err) {}
    });
  });

  /* ---------------------------------------------------------------------------
     The pill. Its label is one span per chapter name: on a change the new name
     slides in from the side it is coming from while the old one leaves the other
     way, and the label box morphs to the new name's width. The pill is centred,
     so it grows and shrinks evenly on both sides. */
  var pill = null, pillLabel = null, pillPrev = null, pillNext = null, pillText = null;
  var pillMode = false;
  var PILL_GAP = 8;      /* between the bar and the pill */
  var PILL_H = 34;
  var PILL_CLEAR = 16;   /* between the pill and a chapter heading it has scrolled to */
  var LABEL_PAD = 12;    /* breathing room either side of the name, inside the chevrons */
  var SLIDE = 14;
  var EASE = 'cubic-bezier(.2,.7,.2,1)';

  function buildPill() {
    var css = document.createElement('style');
    css.textContent =
      '.phase-pill{position:fixed;left:50%;top:var(--pp-top,56px);z-index:49;display:none;align-items:center;' +
        'height:' + PILL_H + 'px;padding:0 1px;border-radius:999px;box-sizing:border-box;' +
        'background:color-mix(in srgb,var(--bg) 86%,transparent);border:1px solid var(--line);color:var(--ink);' +
        '-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);' +
        'box-shadow:0 6px 22px rgba(0,0,0,.07);font-size:13px;font-weight:500;letter-spacing:-0.01em;white-space:nowrap;' +
        'opacity:0;transform:translate(-50%,-8px) scale(.96);pointer-events:none;' +
        'transition:opacity .3s ease,transform .45s ' + EASE + ';}' +
      'html.phase-pill-on .phase-pill{display:flex;}' +
      'html.phase-pill-on .phase-flat{scroll-margin-top:var(--pp-clear,56px);}' +
      '.phase-pill.is-shown{opacity:1;transform:translate(-50%,0) scale(1);pointer-events:auto;}' +
      '.phase-pill button{-webkit-appearance:none;appearance:none;border:0;margin:0;padding:0;background:none;' +
        'width:32px;height:32px;display:grid;place-items:center;border-radius:999px;color:var(--muted);cursor:pointer;' +
        'transition:color .2s,opacity .2s;-webkit-tap-highlight-color:transparent;}' +
      '.phase-pill button:hover{color:var(--ink);}' +
      '.phase-pill button:disabled{opacity:.3;cursor:default;}' +
      '.phase-pill button:focus-visible{outline:1px solid var(--ink);outline-offset:-4px;}' +
      '.phase-pill svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;' +
        'transition:transform .2s ' + EASE + ';}' +
      '.phase-pill .pp-prev:not(:disabled):active svg{transform:translateX(-2px);}' +
      '.phase-pill .pp-next:not(:disabled):active svg{transform:translateX(2px);}' +
      '.pp-label{position:relative;display:block;height:' + (PILL_H - 2) + 'px;overflow:hidden;transition:width .45s ' + EASE + ';}' +
      '.pp-text{position:absolute;left:50%;top:0;line-height:' + (PILL_H - 2) + 'px;transform:translateX(-50%);' +
        'transition:transform .45s ' + EASE + ',opacity .3s ease;}' +
      'html.touch-ui .phase-pill{-webkit-backdrop-filter:none;backdrop-filter:none;background:color-mix(in srgb,var(--bg) 94%,transparent);}' +
      '@media (prefers-reduced-motion: reduce){.phase-pill,.pp-label,.pp-text,.phase-pill svg{transition:opacity .2s ease;}' +
        '.phase-pill,.phase-pill.is-shown{transform:translate(-50%,0);}}';
    document.head.appendChild(css);

    pill = document.createElement('div');
    pill.className = 'phase-pill';
    pill.setAttribute('role', 'navigation');
    pill.setAttribute('aria-label', 'Sections');
    pill.innerHTML =
      '<button type="button" class="pp-prev"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>' +
      '<span class="pp-label"></span>' +
      '<button type="button" class="pp-next"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>';
    pillPrev = pill.querySelector('.pp-prev');
    pillNext = pill.querySelector('.pp-next');
    pillLabel = pill.querySelector('.pp-label');
    pill.inert = true;
    document.body.appendChild(pill);

    /* stepping reuses the chapter links, so it gets the same locked, smooth scroll */
    pillPrev.addEventListener('click', function () { step(-1); });
    pillNext.addEventListener('click', function () { step(1); });
  }

  function step(d) {
    var k = active + d;
    if (active < 0 || k < 0 || k >= links.length) return;
    links[k].click();
  }

  function newText(name) {
    var s = document.createElement('span');
    s.className = 'pp-text';
    s.textContent = name;
    pillLabel.appendChild(s);
    return s;
  }

  function sizeLabel(w, snap) {
    if (snap) pillLabel.style.transition = 'none';
    pillLabel.style.width = w + 'px';
    if (snap) { void pillLabel.offsetWidth; pillLabel.style.transition = ''; }
  }

  function updatePill(prev) {
    if (!pill) return;
    var show = pillMode && active >= 0;
    pill.classList.toggle('is-shown', show);
    pill.inert = !show;
    if (!pillMode || active < 0) return;   /* the label is rebuilt when the pill comes back */

    var last = links.length - 1;
    pillPrev.disabled = active === 0;
    pillNext.disabled = active === last;
    pillPrev.setAttribute('aria-label', active > 0 ? 'Previous section: ' + links[active - 1].textContent : 'Previous section');
    pillNext.setAttribute('aria-label', active < last ? 'Next section: ' + links[active + 1].textContent : 'Next section');

    var name = links[active].textContent;
    if (pillText && pillText.textContent === name && prev === active) return;

    var span = newText(name);
    var w = Math.ceil(span.offsetWidth) + LABEL_PAD * 2;
    var still = reduceMotion || !pillText || prev < 0 || !show;

    if (still) {
      /* first appearance, or nothing on screen to animate from */
      Array.prototype.slice.call(pillLabel.children).forEach(function (c) { if (c !== span) pillLabel.removeChild(c); });
      sizeLabel(w, true);
    } else {
      var d = active > prev ? 1 : -1;
      span.style.transition = 'none';
      span.style.opacity = '0';
      span.style.transform = 'translateX(calc(-50% + ' + (d * SLIDE) + 'px))';
      void span.offsetWidth;
      span.style.transition = 'transform .45s ' + EASE + ', opacity .3s ease .1s';
      span.style.opacity = '1';
      span.style.transform = 'translateX(-50%)';

      var old = pillText;
      old.style.transition = 'transform .45s ' + EASE + ', opacity .15s ease';
      old.style.opacity = '0';
      old.style.transform = 'translateX(calc(-50% + ' + (-d * SLIDE) + 'px))';
      setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 500);

      sizeLabel(w, false);
    }
    pillText = span;
  }

  /* re-measure without animating: after a resize, a mode switch or the web font */
  function snapPill() {
    if (!pill || !pillMode || !pillText) return;
    sizeLabel(Math.ceil(pillText.offsetWidth) + LABEL_PAD * 2, true);
  }

  function setPillMode() {
    if (!pill) return;
    var on = !visible();
    if (on !== pillMode) {
      pillMode = on;
      root.classList.toggle('phase-pill-on', on);
      pillLabel.textContent = '';
      pillText = null;
    }
    if (on && topbar) {
      /* the pill hangs just under the bar; a chapter scrolled to lands with its
         heading clear of the pill, never less than flush with the bar */
      var h = topbar.offsetHeight;
      var pad = targets[0] ? parseFloat(getComputedStyle(targets[0]).paddingTop) || 0 : 0;
      root.style.setProperty('--pp-top', (h + PILL_GAP) + 'px');
      root.style.setProperty('--pp-clear', Math.max(h, Math.round(h + PILL_GAP + PILL_H + PILL_CLEAR - pad)) + 'px');
    }
    updatePill(active);
    snapPill();
  }

  /* a tap or key on the pill itself is not the reader taking over the scroll */
  function release(e) {
    if (pill && e && e.target && pill.contains(e.target)) return;
    if (lockTarget >= 0) { lockTarget = -1; schedule(); }
  }
  window.addEventListener('wheel', release, { passive: true });
  window.addEventListener('touchstart', release, { passive: true });
  window.addEventListener('keydown', release);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { fit(); placeBar(true); schedule(); });
  window.addEventListener('load', schedule);

  /* label widths change once the web font lands */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fit(); placeBar(true); snapPill(); });
  }

  buildPill();
  fit();
  compute();
})();
