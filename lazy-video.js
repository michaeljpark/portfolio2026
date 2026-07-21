/* Lazy video manager — poster (first frame) shows immediately;
   the mp4 is only fetched when the video nears the viewport.
   If the network fails, the poster stays visible.

   Usage:
   <video class="lazy-vid" data-src="./clip.mp4" poster="./posters/clip.jpg"
          loop muted playsinline preload="none"></video>
   Optional: data-src-mobile / data-poster-mobile (max-width:880px variants).
   Optional: data-hover — don't fetch/play on scroll; load and play only while
   the pointer is over the card (mouse devices only; touch keeps the default).
   Dynamically created videos: window.observeLazyVid(videoEl). */
(function () {
  var ASSET_VERSION = '20260719d';
  try {
    var scriptVersion = new URL(document.currentScript.src, window.location.href).searchParams.get('v');
    if (scriptVersion) ASSET_VERSION = scriptVersion;
  } catch (e) {}

  var isMobile = window.matchMedia('(max-width:880px)').matches;

  function versionedUrl(url) {
    if (!url || /^(data:|blob:|https?:|#)/i.test(url) || /[?&]v=/.test(url)) return url;
    var hashIndex = url.indexOf('#');
    var hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    var base = hashIndex === -1 ? url : url.slice(0, hashIndex);
    return base + (base.indexOf('?') === -1 ? '?' : '&') + 'v=' + ASSET_VERSION + hash;
  }

  function setPoster(v) {
    var poster = (isMobile && v.dataset.posterMobile) ? v.dataset.posterMobile : v.getAttribute('poster');
    if (poster) v.poster = versionedUrl(poster);
  }

  function mount(v) {
    if (v.dataset.mounted) return;
    v.dataset.mounted = '1';
    var src = (isMobile && v.dataset.srcMobile) ? v.dataset.srcMobile : v.dataset.src;
    setPoster(v);
    if (src) { v.src = versionedUrl(src); v.load(); }
  }

  function tryPlay(v) {
    v.muted = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.play().catch(function () {});
  }

  /* Hover-to-play: opt in with data-hover on the <video>. The clip is only
     fetched once the pointer enters the card; leaving restores the poster.
     Needs a real mouse — touch devices fall back to the viewport behaviour. */
  var canHover = false;
  try {
    canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  } catch (e) {}

  function unmount(v) {
    if (!v.dataset.mounted) return;
    delete v.dataset.mounted;
    try { v.pause(); } catch (e) {}
    v.removeAttribute('src');
    /* reset the element so the poster paints again instead of the last frame */
    v.load();
  }

  function bindHover(v) {
    var card = v.parentElement || v;
    card.addEventListener('mouseenter', function () { mount(v); tryPlay(v); });
    card.addEventListener('mouseleave', function () { unmount(v); });
  }

  var vio = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) { mount(v); tryPlay(v); }
      else if (!v.paused) { v.pause(); }
    });
  }, { rootMargin: '400px 0px', threshold: 0 });

  window.observeLazyVid = function (v) { vio.observe(v); };

  function init() {
    document.querySelectorAll('video.lazy-vid').forEach(function (v) {
      setPoster(v);
      if (v.dataset.hover !== undefined && canHover) bindHover(v);
      else vio.observe(v);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function playVisible() {
    document.querySelectorAll('video.lazy-vid').forEach(function (v) {
      if (v.dataset.mounted) tryPlay(v);
    });
  }
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(function (ev) {
    document.addEventListener(ev, function unlock() {
      playVisible();
      document.removeEventListener(ev, unlock);
    }, { once: true, passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) playVisible();
  });

  /* keep loops running even if a loop attribute is missing */
  document.addEventListener('ended', function (e) {
    var v = e.target;
    if (v && v.tagName === 'VIDEO') { v.currentTime = 0; v.play().catch(function () {}); }
  }, true);
})();
