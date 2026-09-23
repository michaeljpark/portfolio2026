/* Swipeable screen sets for the case-study pages.

   Markup (static, so it still reads as a list of figures without this file):

     <div class="shots" style="--shot-ar:3320/1712">
       <div class="shots-track">
         <figure class="shot"><img class="shot-img" ...><figcaption>...</figcaption></figure>
         ...
       </div>
     </div>

   The track is a horizontal scroll-snap strip: on a phone that is a swipe, on a
   trackpad a two-finger slide. This file adds what a scroller cannot say for
   itself: dots that show where you are and jump when tapped, and small chevrons
   for mouse users. Accent comes from --brand on the .shots element. */
(function () {
  'use strict';

  var sets = Array.prototype.slice.call(document.querySelectorAll('.shots'));
  if (!sets.length) return;

  var EASE = 'cubic-bezier(.2,.7,.2,1)';
  var reduceMotion = false;
  try { reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '.shots{position:relative;margin-top:clamp(20px,2.4vw,32px);}' +
    '.shots-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;' +
      'scrollbar-width:none;-ms-overflow-style:none;}' +
    '.shots-track::-webkit-scrollbar{display:none;}' +
    '.shot{flex:0 0 100%;min-width:0;margin:0;scroll-snap-align:start;}' +
    '.shot-img{display:block;width:100%;height:auto;aspect-ratio:var(--shot-ar,auto);object-fit:contain;object-position:top center;}' +
    /* the gap under the screens is where the controls sit, so the caption starts below it */
    '.shot figcaption > :first-child{margin-top:clamp(58px,5.4vw,74px);}' +
    /* the slides off to the side never enter the viewport, so the page's
       scroll-reveal must not be the thing that decides they are visible */
    '.reveal-on .shots .phase-note,.reveal-on .shots .subsec-lead{opacity:1;transform:none;}' +
    /* the controls sit in the band right under the screens: always in view with
       what they move, never parked under the sticky bar, never over the picture */
    '.shots-ui{position:absolute;z-index:2;left:50%;top:var(--shots-ui-top,0px);transform:translate(-50%,-50%);' +
      'display:flex;align-items:center;gap:clamp(6px,0.8vw,10px);padding:0 8px;border-radius:999px;' +
      'background:var(--bg);border:1px solid var(--line);}' +
    '.shots-dots{display:flex;align-items:center;}' +
    /* the dot people see is 6px; the target a thumb has to hit is 18x30 */
    '.shots-dots button{-webkit-appearance:none;appearance:none;border:0;margin:0;padding:11px 6px;background:none;' +
      'display:block;cursor:pointer;line-height:0;-webkit-tap-highlight-color:transparent;}' +
    '.shots-dots button::before{content:"";display:block;width:6px;height:6px;border-radius:999px;background:var(--line);' +
      'transition:width .4s ' + EASE + ',background-color .3s ease;}' +
    '.shots-dots button[aria-current="true"]::before{width:22px;background:var(--brand,var(--ink));}' +
    '.shots-dots button:focus-visible,.shots-nav:focus-visible{outline:1px solid var(--ink);outline-offset:3px;}' +
    '.shots-nav{-webkit-appearance:none;appearance:none;border:0;padding:0;margin:0;background:none;width:26px;height:26px;' +
      'display:none;place-items:center;border-radius:999px;color:var(--muted);cursor:pointer;transition:color .2s,opacity .2s;}' +
    '.shots-nav:hover{color:var(--ink);}' +
    '.shots-nav:disabled{opacity:.25;cursor:default;}' +
    '.shots-nav svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;' +
      'transition:transform .2s ' + EASE + ';}' +
    '.shots-nav.prev:not(:disabled):active svg{transform:translateX(-2px);}' +
    '.shots-nav.next:not(:disabled):active svg{transform:translateX(2px);}' +
    /* chevrons are for a pointer; a finger has the swipe */
    '@media (hover:hover) and (pointer:fine){.shots-nav{display:grid;}}' +
    '@media (prefers-reduced-motion: reduce){.shots-dots button::before{transition:background-color .2s ease;}}';
  document.head.appendChild(css);

  sets.forEach(function (root, n) {
    var track = root.querySelector('.shots-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.shot'));
    if (!track || slides.length < 2) return;

    var label = (root.getAttribute('data-label') || 'Screen');
    var ui = document.createElement('div');
    ui.className = 'shots-ui';
    ui.innerHTML =
      '<button type="button" class="shots-nav prev" aria-label="Previous ' + label.toLowerCase() + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>' +
      '<div class="shots-dots" role="tablist"></div>' +
      '<button type="button" class="shots-nav next" aria-label="Next ' + label.toLowerCase() + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>';
    var prev = ui.querySelector('.prev');
    var next = ui.querySelector('.next');
    var dotWrap = ui.querySelector('.shots-dots');

    var dots = slides.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', label + ' ' + (i + 1) + ' of ' + slides.length);
      b.addEventListener('click', function () { goTo(i); });
      dotWrap.appendChild(b);
      /* the caption belongs to its screen for anyone reading with the tab order */
      s.id = s.id || 'shot-' + n + '-' + i;
      b.setAttribute('aria-controls', s.id);
      return b;
    });
    root.appendChild(ui);

    /* park the chip near the foot of the picture, whatever the picture's ratio */
    function placeUi() {
      var img = slides[0].querySelector('img');
      if (!img) return;
      var r = img.getBoundingClientRect(), rr = root.getBoundingClientRect();
      if (!r.height) return;
      root.style.setProperty('--shots-ui-top', Math.round(r.bottom - rr.top + 27) + 'px');
    }

    var index = -1;
    function mark(i) {
      if (i === index) return;
      index = i;
      dots.forEach(function (d, k) {
        if (k === i) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    }
    function current() {
      return Math.round(track.scrollLeft / Math.max(1, slides[0].getBoundingClientRect().width));
    }
    function goTo(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      var x = i * slides[0].getBoundingClientRect().width;
      if (track.scrollTo) track.scrollTo({ left: x, behavior: reduceMotion ? 'auto' : 'smooth' });
      else track.scrollLeft = x;
      mark(i);
    }
    prev.addEventListener('click', function () { goTo(current() - 1); });
    next.addEventListener('click', function () { goTo(current() + 1); });

    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; mark(current()); });
    }, { passive: true });

    /* arrow keys once a dot has focus */
    dotWrap.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var i = Math.max(0, Math.min(slides.length - 1, current() + (e.key === 'ArrowRight' ? 1 : -1)));
      goTo(i);
      dots[i].focus();
    });

    window.addEventListener('resize', function () { placeUi(); mark(current()); });
    window.addEventListener('load', placeUi);
    placeUi();
    mark(current());
  });
})();
