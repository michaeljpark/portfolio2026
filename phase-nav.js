/* Section indicator for the case-study pages.

   The markup lives in each page's sticky nav (.phase-nav), one link per
   <section class="phase-flat" id="..."> in the order they appear, so every
   page lists its own chapters and the links still jump without this script.
   This file adds the rest: the underline that follows the chapter you are
   reading, and a smooth scroll on click that does not light up every chapter
   it passes on the way.

   Desktop only. The CSS hides .phase-nav below each page's own breakpoint;
   while hidden, the bar is simply never placed. */
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
    if (!visible()) return;
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
    /* the first chapter to light up should not slide in from the left edge */
    var snap = active < 0;
    active = i;
    for (var k = 0; k < links.length; k++) {
      if (k === i) links[k].setAttribute('aria-current', 'true');
      else links[k].removeAttribute('aria-current');
    }
    placeBar(snap);
  }

  function atBottom() {
    var doc = document.documentElement;
    return window.innerHeight + window.pageYOffset >= doc.scrollHeight - ARRIVED;
  }

  function compute() {
    ticking = false;
    var barBottom = topbar ? topbar.getBoundingClientRect().bottom : 0;

    if (lockTarget >= 0) {
      var t = targets[lockTarget];
      var arrived = !t || Math.abs(t.getBoundingClientRect().top - barBottom) <= ARRIVED || atBottom();
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
    var barBottom = topbar ? topbar.getBoundingClientRect().bottom : 0;
    var arrived = !t || Math.abs(t.getBoundingClientRect().top - barBottom) <= ARRIVED || atBottom();
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

  function release() { if (lockTarget >= 0) { lockTarget = -1; schedule(); } }
  window.addEventListener('wheel', release, { passive: true });
  window.addEventListener('touchstart', release, { passive: true });
  window.addEventListener('keydown', release);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { fit(); placeBar(true); schedule(); });
  window.addEventListener('load', schedule);

  /* label widths change once the web font lands */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fit(); placeBar(true); });
  }

  fit();
  compute();
})();
