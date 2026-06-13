(() => {
  // ---------- config ----------
  const PALETTE = [
    '#b9e6c2', // green
    '#f9d6a4', // peach
    '#d6c6f2', // lilac
    '#f6b9b9', // rose
    '#aeddf2', // sky
    '#f6e7aa', // butter
    '#f8c9dd', // pink
    '#b9e9e1'  // mint
  ];

  // 2026.6 기준 최신 프런티어 모델 + 소속 연구기관
  const MODELS = [
    { model: 'Claude Fable 5',  org: 'Anthropic' },
    { model: 'Claude Opus 4.8', org: 'Anthropic' },
    { model: 'GPT-5.5',         org: 'OpenAI' },
    { model: 'Gemini 3.1 Pro',  org: 'Google DeepMind' },
    { model: 'Grok 4.3',        org: 'xAI' },
    { model: 'Llama 4',         org: 'Meta AI' },
    { model: 'Qwen 3.7 Max',    org: 'Alibaba Cloud' },
    { model: 'Kimi K2.6',       org: 'Moonshot AI' }
  ];

  const TEXT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum';

  // timings (ms)
  const T = {
    riseStagger : 15,
    riseDur     : 650,
    holdTokens  : 1200,
    rowsDur     : 1150,   // 색상별 줄 정렬
    holdRows    : 0,      // 정렬 꼬리와 타이핑이 겹치므로 정지 없음
    charStep    : 36,     // 타이핑 속도
    rowStagger  : 230,    // 줄별 타이핑 시작 간격
    eraseDur    : 350,    // lorem 텍스트 지우기
    collapseDur : 900,    // 박스 우→좌 수축
    mergeDur    : 1000,
    typeStep    : 95,
    typeStartLag: 300,
    zoomDur     : 1550,
    holdLogo    : 2400,
    afterReset  : 350
  };

  const ZOOM_ORIGIN_Y = 0.46;
  const SCENE_SCALE   = 0.26;   // logoScene 시작 scale = 1 / world zoom scale
  const CARD_W        = 0.64;
  const CARD_H        = 0.34;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const frame     = document.getElementById('frame');
  const world     = document.getElementById('world');
  const logoScene = document.getElementById('logoScene');
  const logoCard  = document.getElementById('logoCard');
  const tokensEl  = document.getElementById('tokens');
  const letters   = [...document.querySelectorAll('#logoSvg .letter')];
  const starWrap  = document.getElementById('starWrap');
  const caret     = document.getElementById('caret');

  if (!frame) return;   // 골격이 없는 페이지에선 아무것도 하지 않음

  // ===== 전체 타이밍 스케일 (1.0 = 원래 ~26.5s, 0.57 ≈ 15s) =====
  const SPEED = 0.566;
  const SP = v => v * SPEED;

  // ===== 뷰포트/탭 가시성 게이트 =====
  // 카드가 화면 밖이거나 탭이 백그라운드면 sleep 경계에서 멈췄다가
  // 다시 보일 때 이어서 진행한다. (full-screen standalone에선 항상 보여 무영향)
  let _visible = true, _wake = null;
  const _refresh = () => {
    const vis = _visible;
    if (vis && _wake){ const w = _wake; _wake = null; w(); }
  };
  const whenVisible = () => _visible ? Promise.resolve() : new Promise(r => { _wake = r; });
  const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED)).then(whenVisible);
  const rand    = (a,b) => a + Math.random()*(b-a);
  const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

  // ---------- tokenizer ----------
  function tokenize(text){
    const out = [];
    text.split(' ').forEach((word, wi) => {
      const lead = wi === 0 ? '' : ' ';
      const m = word.match(/^(.*?)([.,]*)$/);
      let core = m[1], punct = m[2];
      if (core.length > 5 && Math.random() < 0.5){
        const cut = 2 + Math.floor(Math.random() * (core.length - 4));
        out.push(lead + core.slice(0, cut));
        out.push(core.slice(cut));
      } else {
        out.push(lead + core);
      }
      if (punct) out.push(punct);
    });
    return out;
  }

  function paintColors(spans){
    let prev = -1;
    spans.forEach(s => {
      let i;
      do { i = Math.floor(Math.random() * PALETTE.length); } while (i === prev);
      prev = i;
      s.dataset.c = i;
      s.style.backgroundColor = PALETTE[i];
    });
  }

  function buildTokens(){
    tokensEl.innerHTML = '';
    const spans = tokenize(TEXT).map(t => {
      const s = document.createElement('span');
      s.className = 'token';
      s.textContent = t;
      tokensEl.appendChild(s);
      return s;
    });
    paintColors(spans);
    return spans;
  }

  let spans = buildTokens();
  let rowsWrap = null;
  let rows = [];   // { tokensBox, modelEl, orgEl, colorIdx, modelData }

  // ---------- typing helper ----------
  async function typeText(host, text){
    const txt = document.createElement('span');
    const tc  = document.createElement('span');
    tc.className = 'tcaret';
    host.appendChild(txt);
    host.appendChild(tc);
    for (const ch of text){
      txt.textContent += ch;
      await sleep(T.charStep + rand(-8, 14));
    }
    await sleep(220);
    tc.remove();
  }

  // ---------- phase 1 : rise ----------
  async function riseTokens(){
    let maxEnd = 0;
    spans.forEach((s, i) => {
      const d = i * T.riseStagger + rand(0, 60);
      s.style.opacity = '1';
      s.animate(
        [
          { opacity: 0, transform: 'translateY(26px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: SP(T.riseDur), delay: SP(d), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
      );
      maxEnd = Math.max(maxEnd, d + T.riseDur);
    });
    await sleep(maxEnd);
  }

  // ---------- phase 2 : 색상별 줄 정렬 (FLIP, translate+scale) ----------
  // 토큰을 하나도 버리지 않고(텍스트 유지) 폰트를 자동 축소해 전부 줄에 담는다.
  async function gatherIntoRows(){
    const before = new Map(spans.map(s => [s, s.getBoundingClientRect()]));
    const assigned = shuffle(MODELS);

    rowsWrap = document.createElement('div');
    rowsWrap.id = 'rowsWrap';
    rows = PALETTE.map((color, ci) => {
      const row = document.createElement('div');
      row.className = 'row';
      const tb = document.createElement('div');
      tb.className = 'rowTokens';
      const me = document.createElement('span');
      me.className = 'rowModel';
      const oe = document.createElement('span');
      oe.className = 'rowOrg';
      oe.style.background = color;
      row.append(tb, me, oe);
      rowsWrap.appendChild(row);
      return { rowEl: row, tokensBox: tb, modelEl: me, orgEl: oe, colorIdx: ci, modelData: assigned[ci] };
    });
    world.appendChild(rowsWrap);

    // 토큰들을 자기 색 줄로 이동 (원래 순서 유지, 텍스트 전부 유지)
    spans.forEach(s => rows[+s.dataset.c].tokensBox.appendChild(s));

    // 줄 시작은 공백 없이 깔끔하게
    rows.forEach(r => {
      const f = r.tokensBox.firstChild;
      if (f && /^ /.test(f.textContent)) f.textContent = f.textContent.replace(/^ +/, '');
    });

    // 폰트 자동 맞춤 — 토큰이 우측 모델명 자리를 침범하지 않고(가로),
    // 8줄이 프레임 안에 다 들어오도록(세로) 한다. → 절대 안 겹침.
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-style:italic;letter-spacing:-0.05em;';
    rowsWrap.appendChild(probe);
    let longestModel = 0;
    MODELS.forEach(m => { probe.textContent = m.model; longestModel = Math.max(longestModel, probe.offsetWidth); });
    probe.remove();

    const fs0    = parseFloat(getComputedStyle(rowsWrap).fontSize);
    const gapPx  = fs0 * 1.6;                                   // 토큰↔모델 여백
    const availW = rowsWrap.clientWidth - longestModel - gapPx; // 토큰이 쓸 수 있는 최대 가로
    let widest = 0;
    rows.forEach(r => { widest = Math.max(widest, r.tokensBox.scrollWidth); });
    const scaleW = widest > availW ? availW / widest : 1;

    // 세로 맞춤: 갭을 뺀 '줄 자체' 높이의 합이 4:3 영역의 88%에 들어가도록.
    // (offsetHeight 합은 flex gap을 제외하므로 갭과 무관하게 줄 높이만 잰다.)
    const targetH = frame.getBoundingClientRect().height * 0.88;
    let rowsOnlyH = 0;
    rows.forEach(r => { rowsOnlyH += r.rowEl.offsetHeight; });
    const scaleH = rowsOnlyH > targetH ? targetH / rowsOnlyH : 1;

    const k = Math.min(scaleW, scaleH);
    // 작은 임베드(모바일 썸네일)에선 6px까지 줄여 토큰이 모델명을 절대 침범하지 않게.
    // 큰 화면/standalone에선 k≈1이라 사실상 영향 없음. (이전의 13px 하한은
    // 작은 카드에서 필요한 축소를 막아 텍스트가 겹치는 원인이었다.)
    if (k < 1) rowsWrap.style.fontSize = Math.max(6, fs0 * k * 0.985) + 'px';

    // 가로 폭에 맞춰 폰트가 줄면 8줄이 가운데 뭉치고 상하에 빈 공간이 남는다.
    // → 남는 세로 공간을 균등한 갭으로 분배해 8줄이 4:3 영역을 고르게 채우게.
    let rowsH = 0;
    rows.forEach(r => { rowsH += r.rowEl.offsetHeight; });   // 폰트 적용 후 실제 줄 높이
    const n = rows.length;
    const rowH = rowsH / n;                                  // 평균 줄 높이
    const slack = targetH - rowsH;
    const idealGap = (n > 1 && slack > 0) ? slack / (n - 1) : 0;
    // 갭 상한 = 줄 높이 × 계수. 작은 카드(모바일)는 폰트가 많이 줄어 줄 높이가
    // 작은데 slack은 커서 갭이 과하게 벌어진다 → 텍스트 대비 비율로 제한.
    // 모바일(≤880px)은 더 촘촘하게(0.15), 데스크톱은 0.8. 상한에 걸리면 중앙 정렬로 모임.
    const gapFactor = window.matchMedia('(max-width:880px)').matches ? 0.15 : 0.8;
    rowsWrap.style.gap = Math.min(idealGap, rowH * gapFactor) + 'px';

    // FLIP : 읽기 전부 → 쓰기 전부 (레이아웃 스래싱 제거)
    // 갑자기 튀던 진짜 원인 — 배율을 '박스 높이' 비율로 잡았던 것.
    // 박스 높이엔 line-height(단락 1.62 vs 줄 1.2) 차이가 섞여 있어
    // 글자 크기가 같아도 비율이 ~1.35로 잡혀, 첫 프레임에 글자가 확 커졌다.
    // → 실제 폰트 크기 비율로 균일 배율을 잡고, 글자 '중심' 기준으로 정렬한다.
    const paraFont = parseFloat(getComputedStyle(tokensEl).fontSize);
    const rowFont  = parseFloat(getComputedStyle(rowsWrap).fontSize);
    const scale    = paraFont / rowFont;          // 진짜 글자 크기 비율

    const items = [];
    rows.forEach((r, ri) => [...r.tokensBox.children].forEach(s => items.push({ s, ri })));
    const after = items.map(it => it.s.getBoundingClientRect());

    items.forEach((it, i) => {
      const s = it.s;
      const b = before.get(s);
      const a = after[i];
      const dx = (b.left + b.width / 2)  - (a.left + a.width / 2);
      const dy = (b.top  + b.height / 2) - (a.top  + a.height / 2);
      s.style.transformOrigin = '50% 50%';
      s.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transform: 'none' }
        ],
        {
          duration: SP(T.rowsDur),
          delay: SP(it.ri * 60),             // 위 줄부터 아래로 부드러운 캐스케이드
          easing: 'cubic-bezier(.33,0,.15,1)',
          fill: 'backwards'
        }
      );
    });

    const totalDelay = (rows.length - 1) * 60;
    // 정렬 마무리와 모델명 타이핑이 자연스럽게 겹침
    await sleep((T.rowsDur + totalDelay) * 0.72);
  }

  // ---------- phase 3 : 모델명 타이핑 (한 줄에 한 모델) ----------
  async function typeModels(){
    await Promise.all(rows.map((r, i) =>
      (async () => {
        await sleep(i * T.rowStagger);
        await typeText(r.modelEl, r.modelData.model);
      })()
    ));
  }

  // ---------- phase 4 : lorem 철자 단위로 하나씩 지우기 + 박스 우→좌 수축 ----------
  async function eraseLeft(){
    // 각 토큰의 글자를 단어 span 하나로 감싼다 (박스 배경은 토큰에 그대로 유지)
    rows.forEach(r => {
      [...r.tokensBox.children].forEach(tok => {
        const w = document.createElement('span');
        w.textContent = tok.textContent;
        w.style.display = 'inline-block';
        w.style.transition = `opacity ${SP(220)}ms ease, transform ${SP(300)}ms cubic-bezier(.5,0,1,1)`;
        tok.textContent = '';
        tok.appendChild(w);
        tok._word = w;
      });
    });
    // 줄마다 우→좌로 한 단어씩, 아래로 뚝 떨어지며 사라짐 (줄들은 동시에)
    await Promise.all(rows.map(r => (async () => {
      const words = [...r.tokensBox.children].map(t => t._word).reverse();
      for (const w of words){
        w.style.opacity = '0';
        w.style.transform = `translateY(${26 + rand(0, 8)}px)`;   // 아래로 빠짐
        await sleep(55);
      }
    })()));
    await sleep(160);

    rows.forEach((r, i) => {
      const w = r.tokensBox.getBoundingClientRect().width;
      r.tokensBox.classList.add('clip');   // 수축 단계에서만 클리핑 켜기
      r.tokensBox.style.maxWidth = 'none';
      r.tokensBox.style.width = w + 'px';
    });
    void rowsWrap.offsetHeight;
    rows.forEach((r, i) => {
      r.tokensBox.style.transition = `width ${SP(T.collapseDur)}ms cubic-bezier(.7,0,.25,1) ${SP(i * 55)}ms, margin ${SP(T.collapseDur)}ms cubic-bezier(.7,0,.25,1) ${SP(i * 55)}ms`;
      r.tokensBox.style.width = '0px';
      // 모델이 좌측 끝까지 붙도록
      r.modelEl.style.transition = `margin-left ${SP(T.collapseDur)}ms cubic-bezier(.7,0,.25,1) ${SP(i * 55)}ms`;
      r.modelEl.style.marginLeft = '0px';
    });
    await sleep(T.collapseDur + rows.length * 55 + 120);
  }

  // ---------- phase 5 : 연구기관 타이핑 + 박스 (모델 ── 연구소 와이어) ----------
  async function typeOrgs(){
    // 모델과 연구소 사이에 점선 와이어 삽입 (org 우정렬 대신 와이어가 공간을 채움)
    rows.forEach(r => {
      r.orgEl.style.marginLeft = '0';
      const wire = makeWire(PALETTE[r.colorIdx]);
      r.rowEl.insertBefore(wire, r.orgEl);   // [model][wire][org]
      r.wireEl = wire;
    });
    await Promise.all(rows.map((r, i) =>
      (async () => {
        await sleep(i * T.rowStagger);
        runWire(r.wireEl, 1500);
        r.orgEl.style.display = 'inline-block';
        await typeText(r.orgEl, r.modelData.org);
      })()
    ));
  }

  // 점선 와이어 + 좌→우로 흐르는 컬러 원형 노드들
  function makeWire(color){
    const wire = document.createElement('span');
    wire.className = 'wire';
    for (let k = 0; k < 3; k++){
      const node = document.createElement('span');
      node.className = 'node';
      node.style.background = color;
      wire.appendChild(node);
    }
    return wire;
  }
  function runWire(wire, dur = 1500){
    dur = SP(dur);
    requestAnimationFrame(() => wire.classList.add('on'));
    [...wire.children].forEach((node, k) => {
      node.animate(
        [
          { left: '0%',   opacity: 0 },
          { left: '6%',   opacity: 1 },
          { left: '94%',  opacity: 1 },
          { left: '100%', opacity: 0 }
        ],
        { duration: dur, delay: k * (dur / 3), iterations: Infinity, easing: 'linear' }
      );
    });
  }

  // 토큰수 — 멈추지 않고 계속 올라감
  function startTicker(r){
    r.tokenCount = 600 + Math.floor(Math.random() * 3200);
    r.rate = 2200 + Math.random() * 6000;   // tokens/sec
    r.ticking = true;
    let last = performance.now();
    const tick = now => {
      if (!r.ticking) return;
      r.tokenCount += r.rate * (now - last) / 1000;
      last = now;
      r.numEl.textContent = Math.floor(r.tokenCount).toLocaleString() + ' tokens';
      r._raf = requestAnimationFrame(tick);
    };
    r._raf = requestAnimationFrame(tick);
  }
  function stopTicker(r){
    r.ticking = false;
    if (r._raf) cancelAnimationFrame(r._raf);
  }

  // ---------- phase 5.5 : 영수증 — 연구소 좌측 이동 + 점선 + 토큰수 상승 ----------
  async function receiptTransfer(){
    // 모델명 페이드아웃 → 좌측은 연구소만 남김
    rows.forEach(r => {
      r.modelEl.style.transition = `opacity ${SP(400)}ms ease`;
      r.modelEl.style.opacity = 0;
    });
    await sleep(380);
    rows.forEach(r => { r.modelEl.style.display = 'none'; });

    // 재구성 : [연구소(좌)] ──•──→ [토큰수(우, 컬러 박스)]
    const beforeOrg = rows.map(r => r.orgEl.getBoundingClientRect());
    rows.forEach(r => {
      if (r.wireEl) r.wireEl.remove();             // 모델→연구소 와이어 제거
      const wire = makeWire(PALETTE[r.colorIdx]);  // 연구소→토큰 와이어 (노드 흐름)
      const num  = document.createElement('span'); num.className = 'rcptNum';
      num.textContent = '0 tokens';
      num.style.background = PALETTE[r.colorIdx];   // 줄 색상 박스
      r.orgEl.style.marginLeft = '0';
      r.rowEl.insertBefore(r.orgEl, r.rowEl.firstChild);  // 연구소를 맨 좌측으로
      r.rowEl.append(wire, num);
      r.wireEl = wire; r.numEl = num;
    });

    // FLIP : 연구소가 우 → 좌로 이동
    rows.forEach((r, i) => {
      const a = r.orgEl.getBoundingClientRect();
      const b = beforeOrg[i];
      r.orgEl.animate(
        [ { transform: `translateX(${b.left - a.left}px)` }, { transform: 'none' } ],
        { duration: SP(720), delay: SP(i * 55), easing: 'cubic-bezier(.5,0,.18,1)', fill: 'backwards' }
      );
    });

    // 점선 와이어 + 좌→우 노드 흐름 + 토큰수 계속 상승 (데이터 전송)
    rows.forEach((r, i) => {
      setTimeout(() => {
        runWire(r.wireEl, 1400);
        r.numEl.classList.add('on');
        startTicker(r);
      }, SP(i * 55 + 360));
    });

    // 숫자가 한동안 계속 차오르는 걸 보여줌 (멈추지 않음)
    await sleep(rows.length * 55 + 360 + 1700);
  }

  // ---------- phase 6 : 영수증 줄들이 각자 수평 중앙으로 모이며 사라짐 ----------
  async function mergeToBox(chosenIdx){
    rows.forEach(stopTicker);   // 토큰 카운터 정지

    rows.forEach(r => {
      const rc    = r.rowEl.getBoundingClientRect();
      const cxRow = rc.left + rc.width / 2;          // 그 줄의 수평 중앙
      const ease  = 'cubic-bezier(.7,0,.25,1)';
      const dur   = SP(600);

      if (r.wireEl){
        [...r.wireEl.children].forEach(n => n.getAnimations().forEach(a => a.cancel())); // 노드 정지
        r.wireEl.style.transformOrigin = 'center';
        r.wireEl.animate(
          [ { transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(0)', opacity: 0 } ],
          { duration: dur, easing: ease, fill: 'forwards' }
        );
      }
      // 좌측 연구소 → 중앙으로 (수평 이동만)
      const o = r.orgEl.getBoundingClientRect();
      r.orgEl.style.transformOrigin = 'center';
      r.orgEl.animate(
        [ { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${cxRow - (o.left + o.width / 2)}px)`, opacity: 0 } ],
        { duration: dur, easing: ease, fill: 'forwards' }
      );
      // 우측 토큰 박스 → 중앙으로 (수평 이동만)
      if (r.numEl){
        const n = r.numEl.getBoundingClientRect();
        r.numEl.style.transformOrigin = 'center';
        r.numEl.animate(
          [ { transform: 'translateX(0)', opacity: 1 },
            { transform: `translateX(${cxRow - (n.left + n.width / 2)}px)`, opacity: 0 } ],
          { duration: dur, easing: ease, fill: 'forwards' }
        );
      }
    });
    await sleep(660);
  }

  // ---------- logo ----------
  function resetLogo(){
    letters.forEach(l => l.classList.remove('on'));
    starWrap.classList.remove('on');
    caret.classList.remove('blink');
    caret.style.opacity = 0;
  }

  async function typeLogo(){
    caret.style.opacity = '';
    caret.classList.add('blink');
    const first = letters[0].getBBox();
    caret.setAttribute('x', first.x - 2);
    await sleep(T.typeStartLag);

    for (const l of letters){
      l.classList.add('on');
      const b = l.getBBox();
      caret.setAttribute('x', b.x + b.width + 9);
      await sleep(T.typeStep);
    }
    await sleep(120);
    starWrap.classList.add('on');   // 별 등장 → 무한 회전
    await sleep(450);
    caret.classList.remove('blink');
    caret.style.opacity = 0;
  }

  // 타이핑 지우기 (백스페이스처럼 뒤에서부터)
  async function untypeLogo(){
    caret.style.opacity = '';
    caret.classList.add('blink');
    const last = letters[letters.length - 1].getBBox();
    caret.setAttribute('x', last.x + last.width + 9);
    await sleep(380);

    for (let i = letters.length - 1; i >= 0; i--){
      const b = letters[i].getBBox();
      letters[i].classList.remove('on');
      caret.setAttribute('x', b.x - 4);
      await sleep(T.typeStep);
    }
    await sleep(150);
    starWrap.classList.remove('on');
    await sleep(320);
    caret.classList.remove('blink');
    caret.style.opacity = 0;
  }

  // ---------- reset ----------
  function resetAll(){
    if (rowsWrap){ rows.forEach(stopTicker); rowsWrap.remove(); rowsWrap = null; rows = []; }
    spans = buildTokens();           // 새 분할 + 새 랜덤 컬러
  }

  // ---------- main loop ----------
  async function loop(){
    if (reduced){
      spans.forEach(s => s.style.opacity = '1');
      letters.forEach(l => l.classList.add('on'));
      starWrap.classList.add('on');
      logoScene.classList.add('shown');
      return;
    }

    while (true){
      await whenVisible();   // 카드가 화면에 들어와야 새 사이클 시작
      // 1. 토큰이 아래에서 위로
      await riseTokens();
      await sleep(T.holdTokens);

      // 2. 색상별로, 세로 갭을 두고 줄 정렬 (텍스트 전부 유지)
      await gatherIntoRows();

      // 3. 우측에 최신 AI 모델명 타이핑 — 정렬 마무리와 자연스럽게 겹쳐 시작
      await typeModels();
      await sleep(700);

      // 4. lorem 텍스트 지우기 + 박스 우→좌 수축, 모델이 좌측으로
      await eraseLeft();
      await sleep(350);

      // 5. 거기에 소속 연구기관 타이핑 + 컬러 박스
      await typeOrgs();
      await sleep(650);

      // 5.5 영수증 — 연구소가 좌측으로 이동, 점선 리더, 우측 토큰수 상승 (데이터 전송)
      await receiptTransfer();

      // 6. 한 색의 박스로 뭉치기 → 로고 카드로 전환
      const chosenIdx = Math.floor(Math.random() * PALETTE.length);
      logoCard.style.background = PALETTE[chosenIdx];
      resetLogo();
      await mergeToBox(chosenIdx);

      // 7. 뭉친 박스 안에서 tokentrust 타이핑 + 별 무한 회전
      logoScene.classList.add('shown');
      await sleep(150);
      await typeLogo();
      await sleep(400);

      // 8. 로고 영역 사이즈까지만 줌인
      world.classList.add('zoomed');
      logoScene.classList.add('active');
      await sleep(T.zoomDur);
      await sleep(T.holdLogo);

      // 9. 타이핑 지우기 → 박스가 중앙으로 줄어들며 사라짐 → 처음처럼
      await untypeLogo();
      logoScene.classList.add('shrinkOut');
      await sleep(1000);

      resetAll();
      logoScene.classList.remove('shown', 'active', 'shrinkOut');
      world.style.transition = 'none';
      world.classList.remove('zoomed');
      void world.offsetHeight;
      world.style.transition = '';
      await sleep(T.afterReset);
    }
  }

  // 가시성 추적: 카드가 뷰포트 안 && 탭이 포그라운드일 때만 진행
  let _inView = true;
  const _apply = () => { _visible = _inView && !document.hidden; if (_visible) _refresh(); };
  if ('IntersectionObserver' in window){
    new IntersectionObserver(es => { _inView = es[0].isIntersecting; _apply(); }, { threshold: 0 })
      .observe(frame);
  }
  document.addEventListener('visibilitychange', _apply);

  loop();
})();
