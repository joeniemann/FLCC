(function(){
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero   = document.getElementById("hero");
  var markEl = document.getElementById("mark");
  var toolEl = document.getElementById("tool");
  var toolIn = toolEl.querySelector(".tool-in");
  var cv     = document.getElementById("sparks");
  var ctx    = cv.getContext("2d");
  var thread = document.getElementById("thread");
  var sstitch= document.getElementById("seamstitch");

  var revs  = [].slice.call(document.querySelectorAll(".rev"));
  var kerfs = [].slice.call(document.querySelectorAll(".kerf"));
  var fills = [].slice.call(document.querySelectorAll(".fill"));
  var tags  = [].slice.call(document.querySelectorAll(".tag"));
  var lens = [], total = 0;

  /* the mark's coordinate space, read from the artwork itself */
  var VB = (function(){
    var svg = document.querySelector(".mark-svg"), d = {x:0,y:0,w:400,h:400};
    if (svg && svg.viewBox && svg.viewBox.baseVal) {
      var v = svg.viewBox.baseVal;
      if (v.width && v.height) d = {x:v.x, y:v.y, w:v.width, h:v.height};
    }
    return d;
  })();

  /* DOM order is arcs-first so the letters paint on top of them.
     The CUT order is the reverse priority: letters first (2,3,4,5),
     then the two ring arcs (0,1) — inner features before the outline. */
  var ORDER = [2,3,4,5,0,1];

  function measure(){
    lens = kerfs.map(function(p){ return p.getTotalLength(); });
    total = lens.reduce(function(a,b){ return a+b; }, 0);
    revs.forEach(function(p,i){ p.style.strokeDasharray = lens[i]+" "+lens[i]; });
    kerfs.forEach(function(p,i){ p.style.strokeDasharray = lens[i]+" "+lens[i]; });
  }

  function setPass(prog){
    var d = prog*total, pt = null, active = -1, localD = 0;
    for(var k=0;k<ORDER.length;k++){
      var i = ORDER[k], L = lens[i], off;
      if(d >= L){ off = 0; d -= L; markDone(i,true); }
      else if(d > 0){ off = L - d; pt = kerfs[i].getPointAtLength(d); active = i; localD = d; d = 0; markDone(i,false); }
      else { off = L; markDone(i,false); }
      revs[i].style.strokeDashoffset  = off;
      kerfs[i].style.strokeDashoffset = off;
    }
    if(!pt && prog >= 1){
      var lastI = ORDER[ORDER.length-1];
      pt = kerfs[lastI].getPointAtLength(lens[lastI]);
    }
    tags.forEach(function(t){ t.classList.toggle("done", prog >= 1); });
    return {pt:pt, active:active, localD:localD};
  }
  function markDone(i,on){
    fills.forEach(function(f){ if(+f.dataset.c === i) f.classList.toggle("done", on); });
  }

  /* ---------- seam ----------
     SLANT is a percentage of hero WIDTH, so a fixed value would make the
     seam nearly vertical on a phone and steeply diagonal on an ultrawide.
     Solve it from the aspect ratio instead: the seam travels a constant
     fraction of the hero's HEIGHT, which is a constant visual angle. */
  var seam = 52, seamT = 52, SLANT = 5;
  var ANGLE = 0.14;                       /* horizontal travel ÷ hero height */
  function updateSlant(){
    var h = hero.getBoundingClientRect();
    if (!h.width || !h.height) return;
    SLANT = Math.max(1.6, Math.min(16, (ANGLE * h.height) / h.width * 100 / 2));
    hero.style.setProperty("--slant", SLANT.toFixed(3) + "%");
  }
  function paintSeam(){
    hero.style.setProperty("--seam", seam.toFixed(2)+"%");
    thread.setAttribute("x1",(seam+SLANT).toFixed(2)); thread.setAttribute("x2",(seam-SLANT).toFixed(2));
    sstitch.setAttribute("x1",(seam+SLANT).toFixed(2)); sstitch.setAttribute("x2",(seam-SLANT).toFixed(2));
    syncMarkClip();
  }
  function syncMarkClip(){
    var h = hero.getBoundingClientRect(), m = markEl.getBoundingClientRect();
    if(!h.height || !m.width) return;
    var xAt = function(yHero){ return (seam + SLANT - 2*SLANT*(yHero/h.height))/100 * h.width; };
    var top = (xAt(m.top - h.top) - (m.left - h.left)) / m.width * 100;
    var bot = (xAt(m.bottom - h.top) - (m.left - h.left)) / m.width * 100;
    hero.style.setProperty("--mkTop", top.toFixed(2)+"%");
    hero.style.setProperty("--mkBot", bot.toFixed(2)+"%");
  }
  function seamXAtHeroY(y){
    var h = hero.getBoundingClientRect();
    return (seam + SLANT - 2*SLANT*(y/h.height))/100 * h.width;
  }
  /* the mark sits above the hero's vertical centre, where the slanted seam
     has already drifted right — so the resting seam is solved for rather
     than hardcoded, keeping the mark bisected at any viewport */
  function restingSeam(){
    var h = hero.getBoundingClientRect(), m = markEl.getBoundingClientRect();
    if(!h.width || !m.width) return 52;
    var yc = (m.top - h.top) + m.height/2;
    var cx = (m.left - h.left) + m.width/2;
    return Math.max(20, Math.min(80, (cx/h.width)*100 - SLANT + 2*SLANT*(yc/h.height)));
  }

  hero.addEventListener("pointermove", function(e){
    var r = hero.getBoundingClientRect();
    seamT = Math.max(16, Math.min(84, ((e.clientX - r.left)/r.width)*100));
    if(reduce){ seam = seamT; paintSeam(); }
  });
  hero.addEventListener("pointerleave", function(){ seamT = restingSeam(); if(reduce){ seam = seamT; paintSeam(); } });

  /* ---------- canvas ---------- */
  var cw=0, ch=0, DPR = Math.min(devicePixelRatio || 1, 2), parts = [];
  function sizeCanvas(){
    var r = hero.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return false;
    if(r.width === cw && r.height === ch) return true;
    cw = r.width; ch = r.height;
    cv.width = cw*DPR; cv.height = ch*DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    syncMarkClip();
    return true;
  }
  function emit(x,y,n,spread){
    for(var i=0;i<n;i++){
      var a = Math.random()*Math.PI*2, s = 1.1 + Math.random()*(spread||6);
      parts.push({x:x,y:y,vx:Math.cos(a)*s*1.3,vy:Math.sin(a)*s-1.7,
                  life:1,decay:.010+Math.random()*.024,r:.5+Math.random()*1.6});
    }
    if(parts.length > 1400) parts.splice(0, parts.length-1400);
  }

  /* ---------- pass ---------- */
  var prog = 0, running = false, doneAt = 0, heat = 0, raf = null, last = 0;
  var SPEED = 0.105;               /* passes per second */

  function start(){
    if(reduce || document.visibilityState === "hidden"){
      measure(); setPass(1); heat = 0;
      hero.style.setProperty("--heat","0");
      return;
    }
    prog = 0; running = true; heat = 0; last = 0;
    hero.style.setProperty("--heat","0");
    sizeCanvas(); measure(); setPass(0);
    if(!raf) raf = requestAnimationFrame(loop);
  }

  function loop(now){
    raf = requestAnimationFrame(loop);
    if(!sizeCanvas()) return;
    var dt = last ? Math.min((now-last)/1000, .05) : 0; last = now;

    if(Math.abs(seamT - seam) > 0.04){ seam += (seamT - seam)*0.14; paintSeam(); }

    if(running){
      prog += SPEED*dt;
      if(prog >= 1){ prog = 1; running = false; doneAt = now; heat = 1; }
      var r = setPass(prog);
      if(r.pt){
        var m = markEl.getBoundingClientRect(), h = hero.getBoundingClientRect();
        /* map SVG user units -> mark box. Read from the live viewBox rather
           than hardcoding, so swapping the logo artwork cannot break the
           traveller's position. */
        var px = ((r.pt.x - VB.x)/VB.w)*m.width, py = ((r.pt.y - VB.y)/VB.h)*m.height;
        var hx = (m.left-h.left)+px,   hy = (m.top-h.top)+py;
        toolIn.style.left = px+"px"; toolIn.style.top = py+"px";
        /* fabrication is the LEFT half, so "hard" is left of the seam */
        var onHard = hx <= seamXAtHeroY(hy);
        toolEl.dataset.side = onHard ? "hard" : "soft";
        if(onHard){
          emit(hx, hy, 5, 6);
          toolIn.style.transform = "translate(-50%,-50%)";
        } else if(r.active >= 0){
          var ahead = kerfs[r.active].getPointAtLength(Math.min(lens[r.active], r.localD + 6));
          var ang = Math.atan2(ahead.y - r.pt.y, ahead.x - r.pt.x)*180/Math.PI;
          toolIn.style.transform = "translate(-50%,-50%) rotate("+ang.toFixed(1)+"deg)";
        }
      }
    } else {
      if(heat > 0) heat = Math.max(0, heat - dt*0.42);
      hero.style.setProperty("--heat", heat.toFixed(3));
      if(now - doneAt > 2800) start();
    }

    ctx.clearRect(0,0,cw,ch);
    ctx.globalCompositeOperation = "lighter";
    for(var i=parts.length-1;i>=0;i--){
      var p = parts[i];
      p.vy += 0.13; p.vx *= 0.988; p.vy *= 0.994;
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if(p.life <= 0 || p.y > ch+40){ parts.splice(i,1); continue; }
      /* hotter ramp: white core -> flare -> molten, with a wider halo */
      var l = p.life, col = l > .70 ? "255,255,255" : (l > .38 ? "255,179,92" : "255,90,31");
      var rg = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5.6);
      rg.addColorStop(0,"rgba("+col+","+l+")"); rg.addColorStop(1,"rgba("+col+",0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*5.6,0,6.283); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,"+l+")";
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*.72,0,6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    toolEl.style.opacity = running ? "1" : "0";
  }

  /* cursor tracking for .btn--heat lives in site.js — not duplicated here */
  document.addEventListener("click", function(e){
    if(reduce || !(e.target.closest && e.target.closest(".btn--heat"))) return;
    var r = cv.getBoundingClientRect();
    if(e.clientY < r.top || e.clientY > r.bottom) return;
    emit(e.clientX-r.left, e.clientY-r.top, 46, 7);
  });

  var rp=document.getElementById("replay"); if(rp) rp.addEventListener("click", start);
  addEventListener("resize", function(){ sizeCanvas(); updateSlant(); seam = seamT = restingSeam(); paintSeam(); });
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible" && !running && !reduce) start();
  });

  measure();
  updateSlant();
  seam = seamT = restingSeam();
  paintSeam();
  start();
  requestAnimationFrame(function(){ updateSlant(); seam = seamT = restingSeam(); paintSeam(); });
  setTimeout(function(){ updateSlant(); seam = seamT = restingSeam(); paintSeam(); }, 260);
})();
