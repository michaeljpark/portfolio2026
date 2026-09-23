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
    '.shot figcaption > :first-child{margin-top:clamp(16px,1.8vw,24px);}' +
    /* the slides off to the side never enter the viewport, so the page's
       scroll-reveal must not be the thing that decides they are visible */
    '.reveal-on .shots .phase-note,.reveal-on .shots .subsec-lead{opacity:1;transform:none;}' +
    '.shots-ui{display:flex;align-items:center;justify-content:center;gap:clamp(10px,1.2vw,16px);margin-bottom:clamp(12px,1.4vw,18px);}' +
    '.shots-dots{display:flex;align-items:center;}' +
    /* the dot people see is 6px; the target a thumb has to hit is 18x30 */
    '.shots-dots button{-webkit-appearance:none;appearance:none;border:0;margin:0;padding:12px 6px;background:none;' +
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
    /* the picture is split in thirds: the outer two step back and forward, the
       middle one is left alone, and over a live third the arrow becomes a round
       brand-coloured button pointing the way it will go */
    '.shots-edge{position:absolute;top:0;height:var(--shots-img-h,0px);width:33.333%;' +
      'display:none;border:0;padding:0;margin:0;background:none;z-index:2;-webkit-tap-highlight-color:transparent;}' +
    '.shots-edge.prev{left:0;}' +
    '.shots-edge.next{right:0;}' +
    '.shots-edge:not(:disabled){cursor:none;}' +
    '.shots-edge:disabled{cursor:default;}' +
    '.shots-edge:focus-visible{outline:1px solid var(--ink);outline-offset:-3px;}' +
    '.shots-cursor{position:fixed;left:0;top:0;z-index:100;pointer-events:none;}' +
    '.shots-cursor span{display:grid;place-items:center;width:46px;height:46px;border-radius:999px;' +
      'background:var(--brand,var(--ink));color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.14);' +
      'opacity:0;transform:translate(-50%,-50%) scale(.6);' +
      'transition:transform .22s ' + EASE + ',opacity .18s ease;}' +
    '.shots-cursor.on span{opacity:1;transform:translate(-50%,-50%) scale(1);}' +
    '.shots-cursor svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;' +
      'transition:transform .22s ' + EASE + ';}' +
    '.shots-cursor.back svg{transform:scaleX(-1);}' +
    /* chevrons and edge zones are for a pointer; a finger has the swipe */
    '@media (hover:hover) and (pointer:fine){.shots-nav{display:grid;}.shots-edge{display:block;}}' +
    '@media (prefers-reduced-motion: reduce){.shots-cursor span{transform:translate(-50%,-50%);transition:opacity .18s ease;}' +
      '.shots-cursor.on span{transform:translate(-50%,-50%);}}' +
    '@media (prefers-reduced-motion: reduce){.shots-dots button::before{transition:background-color .2s ease;}}';
  document.head.appendChild(css);

  /* one button follows the pointer for all the sets on the page */
  var mouse = false;
  try { mouse = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
  var cursor = null, cursorOn = null, cx = 0, cy = 0, craf = 0;

  function buildCursor() {
    cursor = document.createElement('div');
    cursor.className = 'shots-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span><svg viewBox="0 0 24 24">' +
      '<path d="M10.029 4.285A2 2 0 0 0 7 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>' +
      '<path d="M3 4v16"/></svg></span>';
    document.body.appendChild(cursor);
  }

  function placeCursor() { craf = 0; cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)'; }

  function showCursor(edge) {
    if (edge === cursorOn) return;
    if (edge) {
      if (!cursorOn) placeCursor();          /* appear under the pointer, not where it last hid */
      cursor.classList.toggle('back', edge.classList.contains('prev'));
      cursor.classList.add('on');
    } else cursor.classList.remove('on');
    cursorOn = edge;
  }

  if (mouse) {
    buildCursor();
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') { showCursor(null); return; }
      cx = e.clientX; cy = e.clientY;
      if (!craf) craf = requestAnimationFrame(placeCursor);
      var edge = e.target.closest ? e.target.closest('.shots-edge') : null;
      showCursor(edge && !edge.disabled ? edge : null);
    }, { passive: true });
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) showCursor(null); });
    window.addEventListener('blur', function () { showCursor(null); });
    /* the zone under a still pointer can change or switch off as the set moves */
    window.addEventListener('scroll', function () { if (cursorOn) showCursor(null); }, { passive: true });
  }

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
    /* above the screens, not under the caption: the set is tall enough that
       controls at the bottom would be off the screen while you look at it */
    root.insertBefore(ui, track);

    /* click zones down the left and right of the picture itself */
    var edges = ['prev', 'next'].map(function (dir) {
      var e = document.createElement('button');
      e.type = 'button';
      e.className = 'shots-edge ' + dir;
      e.setAttribute('aria-label', (dir === 'prev' ? 'Previous ' : 'Next ') + label.toLowerCase());
      e.addEventListener('click', function () { goTo(current() + (dir === 'prev' ? -1 : 1)); });
      root.appendChild(e);
      return e;
    });

    /* the zones cover the picture, not the caption under it */
    function sizeEdges() {
      var img = slides[0].querySelector('img');
      if (!img) return;
      var r = img.getBoundingClientRect(), rr = root.getBoundingClientRect();
      if (!r.height) return;
      root.style.setProperty('--shots-img-h', Math.round(r.height) + 'px');
      edges.forEach(function (e) { e.style.top = Math.round(r.top - rr.top) + 'px'; });
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
      if (edges) {
        edges[0].disabled = prev.disabled;
        edges[1].disabled = next.disabled;
        if (cursorOn && cursorOn.disabled) showCursor(null);
      }
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

    window.addEventListener('resize', function () { sizeEdges(); mark(current()); });
    window.addEventListener('load', sizeEdges);
    sizeEdges();
    mark(current());
  });
})();
