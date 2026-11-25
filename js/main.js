/* Selected work strip: card + 16:9 detail panel that pushes the row.
   Project content lives in js/projects.js. */

const $ = id => document.getElementById(id);
const stage = $('stage'), strip = $('strip'), track = $('track'), panel = $('panel'), inner = $('panelInner');
const mq = matchMedia('(max-width: 760px)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const pad2 = n => String(n).padStart(2, '0');
const DUR = 700;
let cur = -1, cw = 0, offset = 0, busy = false;

/* cards */
/* each pill starts with a capital, unless its first word is already cased on purpose (iOS) */
const capTag = t => /^[a-z]+[A-Z]/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1);
$('count').textContent = `(${pad2(PROJECTS.length)})`;
PROJECTS.forEach((p, i) => {
  const b = document.createElement('button');
  b.className = 'work' + (p.video ? ' has-video' : '');
  b.setAttribute('aria-controls', 'panel');
  b.setAttribute('aria-expanded', 'false');
  b.innerHTML = `
    <div class="frame">
      ${p.art ? p.art : p.poster ? `<img src="${p.poster}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      ${p.video ? `<video muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1" data-src="${p.video}"></video>` : ''}
      <span class="tags">${p.category.split(/,\s*/).map(t => `<span class="tag">${capTag(t)}</span>`).join('')}</span>
    </div>
    <div class="meta small">
      <b>${p.title}</b><span class="yr mid">${p.year}</span>
      <span class="pitch mid">${p.pitch}</span>
    </div>`;
  /* The first click opens the card. Once it is open, clicking its video (or
     poster) again goes to the case study, the same as View case study, in a
     new tab when the project asks for one. */
  b.addEventListener('click', e => {
    if (cur !== i) { openCard(i); return; }
    if (busy || !e.target.closest('.frame')) return;
    if (p.newTab) window.open(p.href, '_blank', 'noopener');
    else location.href = p.href;
  });
  track.appendChild(b);
});
const works = [...track.querySelectorAll('.work')];

const padPx = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
const gapPx = () => parseFloat(getComputedStyle(track).columnGap) || 12;
const wait = ms => new Promise(r => setTimeout(r, reduce.matches ? 0 : ms));

function maxOffset() {
  const last = works[works.length - 1];
  return Math.max(0, last.offsetLeft + last.offsetWidth + padPx() - strip.clientWidth);
}
function setOffset(x, animate = true) {
  offset = x;
  if (!animate) track.style.transition = 'none';
  track.style.transform = `translateX(${-x}px)`;
  if (!animate) { track.offsetHeight; track.style.transition = ''; }
  updateChev();
}
/* Steps and dots under the strip. The long dot is the open project. With the
   panel closed it is the card last aimed at (a clicked dot, or the project
   just closed) while that card is fully in view, else the first card in full
   view. Clicking a dot works like the chevrons: open, it switches project;
   closed, it moves the strip to that card. */
let aim = -1;
const dots = PROJECTS.map((p, j) => {
  const d = document.createElement('button');
  d.type = 'button';
  d.setAttribute('aria-label', p.title);
  d.addEventListener('click', () => goTo(j));
  return $('wDots').appendChild(d);
});
function goTo(j) {
  if (cur > -1) { if (j !== cur) openCard(j); return; }
  if (mq.matches) return;
  aim = j;
  setOffset(Math.min(maxOffset(), Math.max(0, works[j].offsetLeft - padPx())));
}
function updateChev() {
  const open = cur > -1;
  $('prev').disabled = !open && offset <= 1;
  $('next').disabled = !open && offset >= maxOffset() - 1;
  const inView = j => { const l = works[j].offsetLeft - offset; return l >= -1 && l + works[j].offsetWidth <= strip.clientWidth + 1; };
  const first = Math.min(PROJECTS.length - 1, Math.max(0, Math.ceil((offset - padPx() - 1) / (cw + gapPx()))));
  const at = open ? cur : aim > -1 && inView(aim) ? aim : first;
  dots.forEach((d, j) => {
    d.classList.toggle('on', j === at);
    if (j === at) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
  });
}
function placePanel() {
  if (mq.matches) {
    if (cur > -1) works[cur].after(panel);
  } else if (panel.parentElement !== stage) {
    strip.after(panel);
  }
}
function layout() {
  placePanel();
  if (mq.matches) { offset = 0; push(-1); return; }
  const W = stage.clientWidth, pad = padPx(), gap = gapPx();
  const h = Math.round(Math.max(220, Math.min(460, (W - pad * 2 - gap) / (4 / 3 + 16 / 9))));
  stage.style.setProperty('--h', h + 'px');
  cw = Math.round(h * 4 / 3);
  if (cur > -1) setOffset(works[cur].offsetLeft - pad, false);
  else setOffset(Math.min(offset, maxOffset()), false);
  push(cur);
}
function push(i) {
  const on = i > -1 && !mq.matches;
  works.forEach((w, j) => {
    w.classList.toggle('is-pushed', on && j > i);
    w.classList.toggle('is-pulled', on && j < i);
  });
}
function fill(i) {
  const p = PROJECTS[i], n = PROJECTS.length;
  $('pIdx').textContent = `${pad2(i + 1)} / ${pad2(n)}`;
  $('pTitle').textContent = p.title;
  $('pProblem').textContent = p.problem;
  $('pKpi').innerHTML = p.kpi.map(k => `<div><dt class="small mid">${k.l}</dt><dd>${k.v}</dd></div>`).join('');
  $('pTldr').textContent = p.tldr;
  ['pCta', 'pCtaM'].forEach(id => {
    const a = $(id);
    a.href = p.href;
    if (p.newTab) {
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('aria-label', 'View case study (opens in a new tab)');
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
      a.removeAttribute('aria-label');
    }
  });
  $('mTitle').textContent = p.title;
  $('mYear').textContent = p.year;
  $('mPitch').textContent = p.pitch;
}
/* Card video. Nothing is fetched until the first hover or open. A mouse
   hover previews the clip; leaving pauses it and fades back to the poster,
   and the next hover resumes from the same frame. While the card is open the
   clip keeps playing (or starts, if it was paused). Off screen or in a
   hidden tab it pauses, and picks up again when it is back. */
const hoverMQ = matchMedia('(hover: hover) and (pointer: fine)');
const saveData = !!(navigator.connection && navigator.connection.saveData);
const clips = [];

function clipWants(c) {
  if (document.hidden || !c.inView) return false;
  return c.active || (c.hover && hoverMQ.matches && !saveData && !reduce.matches);
}
function syncClip(c) {
  const v = c.v;
  if (clipWants(c)) {
    if (!v.getAttribute('src')) { v.preload = 'auto'; v.src = v.dataset.src; }
    /* A pause() before this resolves rejects it with AbortError, which is expected. */
    if (v.paused) v.play().catch(() => {});
  } else {
    c.w.classList.remove('is-playing');
    if (!v.paused) v.pause();
  }
}
works.forEach(w => {
  const v = w.querySelector('video');
  if (!v) return;
  const c = { w, v, hover: false, active: false, inView: true };
  w._clip = c;
  clips.push(c);
  w.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { c.hover = true; syncClip(c); } });
  w.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { c.hover = false; syncClip(c); } });
  /* Show the video only once frames are actually moving, so a slow first load keeps the poster. */
  v.addEventListener('playing', () => { if (clipWants(c)) w.classList.add('is-playing'); else v.pause(); });
});
if (clips.length) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      const c = e.target._clip;
      c.inView = e.isIntersecting;
      syncClip(c);
    }));
    clips.forEach(c => io.observe(c.w));
  }
  document.addEventListener('visibilitychange', () => clips.forEach(syncClip));
}

function mark() {
  works.forEach((w, j) => {
    const on = j === cur;
    w.classList.toggle('is-active', on);
    w.setAttribute('aria-expanded', String(on));
    if (w._clip) { w._clip.active = on; syncClip(w._clip); }
  });
}
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

async function openMobile(i) {
  if (cur > -1) {
    panel.classList.remove('is-open');
    await wait(480);
  }
  cur = i;
  mark();
  fill(i);
  works[i].after(panel);
  panel.setAttribute('aria-hidden', 'false');
  const y = works[i].getBoundingClientRect().top + scrollY - 8;
  window.scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' });
  await frames();
  panel.classList.add('is-open');
  await wait(560);
}

/* Named openCard, not open: a top-level open() would replace window.open. */
async function openCard(i) {
  if (busy) return;
  busy = true;
  if (mq.matches) { await openMobile(i); busy = false; return; }
  const wasOpen = cur > -1;
  const target = works[i].offsetLeft - padPx();
  cur = i;
  mark();
  updateChev();
  if (!wasOpen) {
    fill(i);
    panel.setAttribute('aria-hidden', 'false');
    if (Math.abs(target - offset) > 1) { setOffset(target); await wait(DUR - 120); }
    push(i);
    panel.classList.add('is-open');
    await wait(DUR);
  } else {
    inner.classList.add('is-swapping');
    push(i);
    setOffset(target);
    await wait(220);
    fill(i);
    await wait(DUR - 340);
    inner.classList.remove('is-swapping');
    await wait(120);
  }
  busy = false;
}
async function close() {
  if (cur < 0 || busy) return;
  busy = true;
  const last = works[cur];
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  push(-1);
  aim = cur;
  cur = -1;
  await wait(mq.matches ? 520 : DUR);
  mark();
  if (!mq.matches && offset > maxOffset()) setOffset(maxOffset());
  updateChev();
  last.focus({ preventScroll: true });
  busy = false;
}
function step(dir) {
  if (cur > -1) return openCard((cur + dir + PROJECTS.length) % PROJECTS.length);
  if (mq.matches) return;
  aim = -1;
  setOffset(Math.min(maxOffset(), Math.max(0, offset + dir * (cw + gapPx()))));
}

$('mPrev').addEventListener('click', () => step(-1));
$('mNext').addEventListener('click', () => step(1));
$('pClose').addEventListener('click', close);
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
document.addEventListener('keydown', e => {
  if (cur < 0) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
strip.addEventListener('scroll', () => {
  const s = strip.scrollLeft;
  if (!s) return;
  strip.scrollLeft = 0;
  if (cur < 0) setOffset(Math.min(maxOffset(), Math.max(0, offset + s)), false);
});
/* Two-finger horizontal swipe on a trackpad (also a tilt wheel or shift+wheel):
   one gesture is one step, exactly like the chevrons, so an open panel moves to
   the next project and a closed strip moves by one card. A trackpad keeps firing
   momentum events after the fingers lift, so after a step the gesture stays
   locked until the events go quiet. Momentum only ever decays in the same
   direction, so a reversal, or deltas that start climbing again out of the
   tail, is a new swipe and is let through. Vertical scrolling is left to the page. */
let wAcc = 0, wLock = false, wAt = 0, wDir = 0, wLow = 0, wPrev = 0, wRise = 0, wQuiet = 0;
stage.addEventListener('wheel', e => {
  if (mq.matches) return;
  let dx = e.deltaX;
  if (!dx && e.shiftKey) dx = e.deltaY;
  else if (Math.abs(dx) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  const px = dx * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? strip.clientWidth : 1);
  const a = Math.abs(px), dir = Math.sign(px), now = performance.now();
  clearTimeout(wQuiet);
  wQuiet = setTimeout(() => { wLock = false; wAcc = 0; }, 180);
  if (wLock) {
    const since = now - wAt;
    wRise = a > wPrev ? wRise + 1 : 0;
    wPrev = a;
    wLow = Math.min(wLow, a);
    const reversed = dir !== wDir && a >= 4 && since > 150;
    const fresh = since > 300 && wRise >= 3 && a >= Math.max(8, wLow * 2);
    if (!reversed && !fresh) return;
    wLock = false; wAcc = 0;
  }
  if (wAcc && dir !== Math.sign(wAcc)) wAcc = 0;
  wAcc += px;
  if (Math.abs(wAcc) >= 50) {
    step(wAcc > 0 ? 1 : -1);
    wLock = true; wAt = now; wDir = Math.sign(wAcc); wLow = wPrev = a; wRise = 0; wAcc = 0;
  }
}, { passive: false });

let sx = null;
strip.addEventListener('touchstart', e => { sx = mq.matches ? null : e.touches[0].clientX; }, { passive: true });
strip.addEventListener('touchend', e => {
  if (sx === null) return;
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  sx = null;
});
window.addEventListener('resize', layout);
mq.addEventListener('change', layout);
layout();
