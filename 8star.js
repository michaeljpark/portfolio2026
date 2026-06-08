/* 8star.js — 4개의 흰색 직사각형 띠가 8방향 별을 이루고,
   각 띠 안에서 텍스트 마키가 흐르며, 전체가 시계방향으로 천천히 회전.
   사용법: <div id="stage"></div> 가 있는 페이지에서 이 스크립트를 불러오면 됩니다. */
(function(){
  const SVG = "http://www.w3.org/2000/svg";
  const C   = 500;     // center
  const VB  = 1000;    // square viewBox
  const F   = 130;     // font-size
  const H   = Math.round(F * 0.56);  // bar half-height -> snug to text
  const LX  = 472;     // bar half-length
  const REPEATS = 16;
  const SPEED   = 58;  // user-units / second
  const SPIN    = 60;  // seconds per full clockwise rotation
  const MOUNT   = "#stage";

  // ---- inject required styles ----
  function injectStyles(){
    if (document.getElementById("star8-style")) return;
    const s = document.createElement("style");
    s.id = "star8-style";
    s.textContent = `
      ${MOUNT} svg{width:100%;height:100%;display:block;overflow:visible;}
      #star8-spin{
        transform-box:view-box;
        transform-origin:${C}px ${C}px;
        animation:star8-spin ${SPIN}s linear infinite;
      }
      @keyframes star8-spin{ from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
      text.star8-marquee{
        font-family:"Helvetica Neue", Helvetica, Arial, sans-serif;
        font-weight:400;
        letter-spacing:-0.05em;   /* Figma -5% */
        fill:#0a0c12;
      }
    `;
    document.head.appendChild(s);
  }

  function barPath(){
    return `M ${C-LX} ${C-H} L ${C+LX} ${C-H} L ${C+LX} ${C+H} L ${C-LX} ${C+H} Z`;
  }

  // bottom -> top. last entry renders on TOP.
  const bars = [
    { text:"AI-generated Noise Protection", angle:135, dir: 1, flip:true },
    { text:"AI Copyright Ensuring",         angle:45,  dir:-1 },
    { text:"Interplatform AI Token",        angle:90,  dir: 1 },
    { text:"Data Compensation",             angle:0,   dir:-1 }   // TOP layer
  ];

  function el(name, attrs){
    const e = document.createElementNS(SVG, name);
    if(attrs) for(const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function build(){
    injectStyles();

    const host = document.querySelector(MOUNT);
    if(!host){ console.warn("8star: mount element", MOUNT, "not found"); return; }

    const svg = el("svg", {
      viewBox:`0 0 ${VB} ${VB}`,
      xmlns:SVG,
      preserveAspectRatio:"xMidYMid meet"
    });
    const defs = el("defs");
    svg.appendChild(defs);

    const spin = el("g", { id:"star8-spin" });
    svg.appendChild(spin);

    const animated = [];

    bars.forEach((bar, i)=>{
      const clipId = "star8-clip"+i;

      const clip = el("clipPath", { id:clipId, clipPathUnits:"userSpaceOnUse" });
      clip.appendChild(el("path", { d:barPath() }));
      defs.appendChild(clip);

      const g = el("g", { transform:`rotate(${bar.angle} ${C} ${C})` });

      // white bar, no border
      g.appendChild(el("path", { d:barPath(), fill:"#ffffff" }));

      const gClip = el("g", { "clip-path":`url(#${clipId})` });

      // optional 180 flip so tilted bars read right-side up
      const gOrient = el("g");
      if (bar.flip) gOrient.setAttribute("transform", `rotate(180 ${C} ${C})`);

      const gMove = el("g"); // animated marquee

      const phrase = bar.text + "    \u2022    ";
      const t = el("text", {
        class:"star8-marquee",
        x:C, y:C,
        "text-anchor":"start",
        "font-size":F
      });
      t.textContent = phrase.repeat(REPEATS);

      gMove.appendChild(t);
      gOrient.appendChild(gMove);
      gClip.appendChild(gOrient);
      g.appendChild(gClip);
      spin.appendChild(g);

      animated.push({ textNode:t, moveNode:gMove, dir:bar.dir });
    });

    host.appendChild(svg);

    animated.forEach(a=>{
      const total = a.textNode.getComputedTextLength();
      const unit  = total / REPEATS;     // one phrase = seamless loop period

      // center horizontally, then vertically using real glyph bbox
      a.textNode.setAttribute("x", C - total/2);
      const bb = a.textNode.getBBox();
      const dy = C - (bb.y + bb.height/2);
      a.textNode.setAttribute("y", C + dy);

      const from = "translateX(0px)";
      const to   = `translateX(${-unit}px)`;
      const frames = a.dir === 1 ? [{transform:from},{transform:to}]
                                 : [{transform:to},{transform:from}];
      a.moveNode.animate(frames, {
        duration: (unit / SPEED) * 1000,
        iterations: Infinity,
        easing:"linear"
      });
    });
  }

  function start(){
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    else build();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
