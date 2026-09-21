/* Pointer label for the case-study pages.

   Anything carrying data-cursor="…" hides the arrow while the pointer is over
   it and shows that text in a small pill riding under the cursor instead. Mouse
   only: a finger never sees it, and without this file nothing changes.

   The pill takes its colours from the page: --bg and --ink build the plate, and
   a page can say it differently on :root with --pill-ink (label colour, e.g. a
   brand accent), --pill-bg, --pill-border, --pill-font and --pill-size. */
(function () {
  'use strict';

  var mq;
  try { mq = matchMedia('(hover:hover) and (pointer:fine)'); } catch (e) { return; }

  var root = document.documentElement;
  var css = document.createElement('style');
  css.textContent =
    '.cursor-pill{position:fixed;left:0;top:0;z-index:100;pointer-events:none;}' +
    '.cursor-pill span{display:flex;align-items:center;height:32px;padding:0 14px;border-radius:999px;' +
      'background:var(--pill-bg,color-mix(in srgb,var(--bg) 78%,transparent));' +
      'border:1px solid var(--pill-border,color-mix(in srgb,var(--ink) 14%,transparent));' +
      'box-shadow:0 6px 20px rgba(0,0,0,.08);' +
      '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
      'color:var(--pill-ink,var(--ink));font-family:var(--pill-font,var(--font));' +
      'font-size:var(--pill-size,13px);font-weight:500;letter-spacing:-0.01em;line-height:1;white-space:nowrap;' +
      'opacity:0;transform:translate(-50%,-50%) scale(.6);' +
      'transition:transform .22s cubic-bezier(.2,.7,.2,1),opacity .18s ease;}' +
    '.cursor-pill.on span{opacity:1;transform:translate(-50%,-50%) scale(1);}' +
    'html.cursor-pill-on [data-cursor]{cursor:none;}' +
    '@media (prefers-reduced-motion: reduce){.cursor-pill span{transform:translate(-50%,-50%);transition:opacity .18s ease;}}';
  document.head.appendChild(css);

  var pill = document.createElement('div');
  pill.className = 'cursor-pill';
  pill.setAttribute('aria-hidden', 'true');
  var label = document.createElement('span');
  pill.appendChild(label);
  document.body.appendChild(pill);

  var cur = null, x = 0, y = 0, known = false, raf = 0;

  function place() { raf = 0; pill.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }

  function show(el) {
    if (el === cur) return;
    if (el) {
      if (!cur) place();                  /* appear at the pointer, not where it last hid */
      label.textContent = el.getAttribute('data-cursor');
      pill.classList.add('on');
    } else pill.classList.remove('on');
    cur = el;
  }

  function under() {
    var t = known && document.elementFromPoint(x, y);
    return t && t.closest ? t.closest('[data-cursor]') : null;
  }

  function sync() { root.classList.toggle('cursor-pill-on', mq.matches); if (!mq.matches) show(null); }

  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' || !mq.matches) { show(null); return; }
    x = e.clientX; y = e.clientY; known = true;
    if (!raf) raf = requestAnimationFrame(place);
    show(e.target.closest ? e.target.closest('[data-cursor]') : null);
  }, { passive: true });

  /* the page can slide whatever is labelled out from under a still pointer */
  var sraf = 0;
  window.addEventListener('scroll', function () {
    if (!known || sraf) return;
    sraf = requestAnimationFrame(function () { sraf = 0; show(under()); });
  }, { passive: true });

  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) { known = false; show(null); } });
  window.addEventListener('blur', function () { show(null); });
  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync);
  sync();
})();
