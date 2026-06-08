/* ring.js — 두 개의 텍스트 링 (내측 Data Ownership 반시계 / 외측 Data Economy 시계).
   사용법: <div id="stage"></div> 가 있는 페이지에서 로드. 배경 검정 권장.
*/
(function injectStyles(){
  if(document.getElementById("ring-style")) return;
  var s=document.createElement("style"); s.id="ring-style";
  s.textContent=
    "#stage svg{width:100%;height:100%;display:block;}"+
    "#stage text{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-0.05em;fill:#ffffff;}"+
    "#stage .ring{transform-box:view-box;transform-origin:300px 300px;}"+
    "@keyframes cw{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}"+
    "@keyframes ccw{from{transform:rotate(0deg);}to{transform:rotate(-360deg);}}";
  document.head.appendChild(s);
})();

(function(){
  const NS="http://www.w3.org/2000/svg";
  const XLINK="http://www.w3.org/1999/xlink";
  const C=300;
  const SEP="  \u2022  ";
  const rings=[
    { id:"inner", text:"Data Ownership", r:120, font:32, spin:"ccw", dur:20 },  // inner, counter-clockwise
    { id:"outer", text:"Data Economy",   r:252, font:36, spin:"cw",  dur:28 }   // outer, clockwise
  ];

  const el=(n,a)=>{const e=document.createElementNS(NS,n); if(a)for(const k in a)e.setAttribute(k,a[k]); return e;};
  const circle=(cx,cy,r)=>`M ${cx-r} ${cy} a ${r} ${r} 0 1 1 ${2*r} 0 a ${r} ${r} 0 1 1 ${-2*r} 0`;

  function build(){
    const svg=el("svg",{viewBox:"0 0 600 600",xmlns:NS,preserveAspectRatio:"xMidYMid meet"});
    const defs=el("defs"); svg.appendChild(defs);
    document.getElementById("stage").appendChild(svg);   // attach first (so measuring works)

    rings.forEach(ring=>{
      const pathId="p_"+ring.id;
      defs.appendChild(el("path",{id:pathId, d:circle(C,C,ring.r), fill:"none"}));

      const pathLen=2*Math.PI*ring.r;
      const unit=ring.text+SEP;

      // measure one phrase to choose repeat count close to circumference
      const probe=el("text",{x:0,y:0,"font-size":ring.font}); // inherits letter-spacing from CSS
      probe.textContent=unit; svg.appendChild(probe);
      let w=probe.getComputedTextLength(); svg.removeChild(probe);
      if(!w || !isFinite(w)) w=unit.length*ring.font*0.5;
      const n=Math.max(1, Math.round(pathLen/w));

      const g=el("g",{class:"ring"});
      g.style.animation=ring.spin+" "+ring.dur+"s linear infinite";
      // textLength fills the circle exactly; lengthAdjust="spacing" -> glyph shapes stay intact
      const t=el("text",{ "font-size":ring.font, "textLength":pathLen, lengthAdjust:"spacing" });
      const tp=el("textPath",{ "dominant-baseline":"middle", startOffset:"0" });
      tp.setAttributeNS(XLINK,"xlink:href","#"+pathId);
      tp.setAttribute("href","#"+pathId);
      tp.textContent=unit.repeat(n);
      t.appendChild(tp); g.appendChild(t); svg.appendChild(g);
    });
  }

  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(build);
  else window.addEventListener("load",build);
})();
