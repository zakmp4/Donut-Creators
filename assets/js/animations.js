/* Donut Creators Hub animation engine.
   Each animation draws itself onto a canvas at time t (seconds). The same code powers the live
   previews, the Configure dialog, and rendering the downloadable WebM/PNG files. */
(function(){
const NAVY = "#0a1c52", ICE = "#7fe3ff", RED = "#e8202a", GOLD = "#ffd23f", DOUGH = "#e0a267";
const FONT = '"Bricolage Grotesque", "Arial Black", Impact, sans-serif';

const clamp = (v,a=0,b=1) => Math.min(b, Math.max(a, v));
const num = (v,def,min,max) => { const n=parseFloat(v); return isFinite(n) ? clamp(n,min,max) : def; };
const seg = (t,a,b) => clamp((t-a)/(b-a));               // progress of t through [a,b]
const easeOutBack = x => { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); };
const easeOutCubic = x => 1 - Math.pow(1-x, 3);
const easeInCubic = x => x*x*x;
const easeInBack = x => { const c1=1.70158; return (c1+1)*x*x*x - c1*x*x; };
const easeInOut = x => x<.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2;
const easeOutBounce = x => { const n=7.5625, d=2.75;
  if (x<1/d) return n*x*x; if (x<2/d) return n*(x-=1.5/d)*x+.75;
  if (x<2.5/d) return n*(x-=2.25/d)*x+.9375; return n*(x-=2.625/d)*x+.984375; };

/* ---------- drawing helpers ---------- */
function rr(g,x,y,w,h,r){ g.beginPath(); if (g.roundRect) g.roundRect(x,y,w,h,r); else g.rect(x,y,w,h); }

// chunky box: hard shadow + navy outline
function block(g,x,y,w,h,r,fill,{lw=8,shadow=10,shadowColor=NAVY,stroke=NAVY}={}){
  g.save();
  if (shadow){ rr(g,x+shadow,y+shadow*1.15,w,h,r); g.fillStyle=shadowColor; g.fill(); }
  rr(g,x,y,w,h,r); g.fillStyle=fill; g.fill();
  if (lw){ g.lineWidth=lw; g.strokeStyle=stroke; g.stroke(); }
  g.restore();
}

// chunky text: hard shadow + outline + fill. outer = optional extra outline (e.g. white sticker edge)
function blockText(g,text,x,y,size,fill,{align="center",shadow=true,stroke=NAVY,outer=null,weight=800}={}){
  g.save();
  g.font = `${weight} ${size}px ${FONT}`; g.textAlign=align; g.textBaseline="middle"; g.lineJoin="round";
  const lw = Math.max(4, size*.14), off = size*.07, olw = lw + size*.16;
  if (shadow){
    g.lineWidth = outer ? olw : lw; g.strokeStyle=stroke; g.fillStyle=stroke;
    g.strokeText(text,x+off,y+off*1.2); g.fillText(text,x+off,y+off*1.2);
  }
  if (outer){ g.lineWidth=olw; g.strokeStyle=outer; g.strokeText(text,x,y); }
  g.lineWidth=lw; g.strokeStyle=stroke; g.strokeText(text,x,y);
  g.fillStyle=fill; g.fillText(text,x,y);
  g.restore();
}
function textWidth(g,text,size,weight=800){ g.save(); g.font=`${weight} ${size}px ${FONT}`; const w=g.measureText(text).width; g.restore(); return w; }
function fitSize(g,text,maxW,size){ const w=textWidth(g,text,size); return w>maxW ? size*maxW/w : size; }

// 4-point star sparkle
function sparkle(g,x,y,r,color){
  if (r<=0.5) return;
  g.save(); g.translate(x,y); g.beginPath();
  for (let i=0;i<8;i++){ const a=i*Math.PI/4 - Math.PI/2, d=i%2 ? r*.3 : r; g.lineTo(Math.cos(a)*d, Math.sin(a)*d); }
  g.closePath(); g.fillStyle=color; g.fill(); g.lineWidth=Math.max(2,r*.14); g.lineJoin="round"; g.strokeStyle=NAVY; g.stroke();
  g.restore();
}
// ring of sparkles flying outwards, p = 0..1
function burst(g,cx,cy,p,{n=10,dist=260,size=34,colors=[ICE,"#fff",GOLD],spin=0}={}){
  if (p<=0 || p>=1) return;
  const e=easeOutCubic(p);
  for (let i=0;i<n;i++){
    const a=i/n*Math.PI*2+spin, d=dist*(.6+.4*((i*37)%10)/10)*e;
    sparkle(g, cx+Math.cos(a)*d, cy+Math.sin(a)*d, size*(1-p)*(i%2?.65:1), colors[i%colors.length]);
  }
}
function cursor(g,x,y,s=1){
  g.save(); g.translate(x,y); g.scale(s,s); g.beginPath();
  [[0,0],[0,74],[19,57],[32,86],[46,80],[33,51],[56,51]].forEach(([px,py],i)=> i ? g.lineTo(px,py) : g.moveTo(px,py));
  g.closePath(); g.fillStyle="#fff"; g.fill(); g.lineWidth=6; g.lineJoin="round"; g.strokeStyle=NAVY; g.stroke();
  g.restore();
}
function bell(g,x,y,s,rot){
  g.save(); g.translate(x,y); g.rotate(rot); g.scale(s,s);
  g.lineWidth=7; g.lineJoin="round"; g.strokeStyle=NAVY;
  g.beginPath(); g.arc(0,48,11,0,Math.PI*2); g.fillStyle=GOLD; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-40,34); g.quadraticCurveTo(-34,26,-34,6); g.quadraticCurveTo(-34,-42,0,-42);
  g.quadraticCurveTo(34,-42,34,6); g.quadraticCurveTo(34,26,40,34); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0,-48,8,0,Math.PI*2); g.fill(); g.stroke();
  g.restore();
}
// arrow pointing to +x, tip at (0,0)
function arrowShape(g,len=380,shaft=80,head=210){
  g.beginPath();
  g.moveTo(0,0); g.lineTo(-head*.85,-head/2); g.lineTo(-head*.85,-shaft/2); g.lineTo(-len,-shaft/2);
  g.lineTo(-len,shaft/2); g.lineTo(-head*.85,shaft/2); g.lineTo(-head*.85,head/2); g.closePath();
}
function drawArrow(g,cx,cy,angle,offset,{color=RED}={}){
  g.save(); g.translate(cx,cy); g.rotate(angle); g.translate(190+offset,0); g.lineJoin="round";
  g.save(); g.translate(12,14); arrowShape(g); g.fillStyle=NAVY; g.fill(); g.lineWidth=14; g.strokeStyle=NAVY; g.stroke(); g.restore();
  arrowShape(g); g.lineWidth=30; g.strokeStyle="#fff"; g.stroke(); g.lineWidth=12; g.strokeStyle=NAVY; g.stroke();
  g.fillStyle=color; g.fill();
  g.restore();
}
// hand-drawn marker circle, p = how much is drawn (0..1)
function scribble(g,cx,cy,rx,ry,p,{color=RED,width=24}={}){
  if (p<=0) return;
  const a0=-2.4, total=Math.PI*2*1.12, steps=120, end=Math.max(1,Math.round(steps*p));
  const pt = i => { const a=a0+total*i/steps, grow=1+.045*(a-a0)/Math.PI, wob=1+.025*Math.sin(a*3+.7);
    return [cx+Math.cos(a)*rx*grow*wob, cy+Math.sin(a)*ry*grow*wob]; };
  const path = () => { g.beginPath(); for (let i=0;i<=end;i++){ const [x,y]=pt(i); i?g.lineTo(x,y):g.moveTo(x,y); } };
  g.save(); g.lineCap="round"; g.lineJoin="round";
  g.translate(6,8); path(); g.strokeStyle="rgba(10,28,82,.55)"; g.lineWidth=width; g.stroke(); g.translate(-6,-8);
  path(); g.strokeStyle=color; g.lineWidth=width; g.stroke();
  g.restore();
}

/* ---------- number formatting ---------- */
function shortNum(v){
  const a=Math.abs(v), f=(x,s)=>{ let t = x>=100 ? String(Math.round(x)) : x.toFixed(x>=10?1:2); if (t.includes(".")) t=t.replace(/\.?0+$/,""); return t+s; };
  if (a>=1e9) return f(v/1e9,"B"); if (a>=1e6) return f(v/1e6,"M"); if (a>=1e3) return f(v/1e3,"K");
  return String(Math.round(v));
}
const fullNum = v => Math.round(v).toLocaleString("en-US");

/* ---------- images ---------- */
const IMGS = {};
function loadImg(key, src){
  if (!IMGS[key]) IMGS[key] = new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; });
  return IMGS[key];
}
let donutImg = null;
async function ready(){
  const base = (window.DCH_ASSET_BASE || "assets/");
  const [img] = await Promise.all([
    loadImg("donut", base+"images/donutsmp_logo.webp"),
    document.fonts ? document.fonts.load(`800 100px "Bricolage Grotesque"`).catch(()=>{}) : null
  ]);
  donutImg = img;
}

/* ---------- animations ---------- */
const ANIMS = {
  subscribe: {
    title:"Subscribe pop", w:1100, h:380, dur:()=>4,
    draw(g,t){
      const cx=480, cy=180, bw=640, bh=170;
      const out = easeInBack(seg(t,3.45,3.9));
      const s = easeOutBack(seg(t,0,.45)) * (1-out);
      const clickP = seg(t,1.55,1.8), squish = clickP>0 && clickP<1 ? 1-.09*Math.sin(clickP*Math.PI) : 1;
      const subbed = t>=1.66;
      if (s>0){
        g.save(); g.translate(cx,cy); g.scale(s*squish,s*squish);
        block(g,-bw/2,-bh/2,bw,bh,30, subbed ? "#8f9bbd" : RED, {shadow:12});
        blockText(g, subbed ? "SUBSCRIBED" : "SUBSCRIBE", 0, 6, subbed ? 76 : 88, "#fff", {shadow:false});
        g.restore();
      }
      const bp = easeOutBack(seg(t,1.95,2.3)) * (1-out);
      if (bp>0){ const w=t-2.3; bell(g, cx+bw/2+120, cy, 1.25*bp, w>0 ? Math.sin(w*22)*.35*Math.exp(-w*2.2) : 0); }
      burst(g, cx+bw/2+120, cy, seg(t,2.2,2.9), {n:8, dist:130, size:22});
      if (t>.9 && t<3.3){
        const m=easeInOut(seg(t,.95,1.5)), x=1000+(cx+150-1000)*m, y=380+(cy+30-380)*m;
        const leave=easeInCubic(seg(t,2.6,3.2));
        cursor(g, x+leave*300, y+leave*200, clickP>0&&clickP<1 ? .88 : 1);
      }
    }
  },

  donut: {
    title:"Donut drop intro", w:800, h:800, dur:()=>3,
    draw(g,t){
      const cx=400, cy=410, size=460;
      const drop=seg(t,0,.85), y = -560*(1-easeOutBounce(drop));
      const out=easeInBack(seg(t,2.55,3));
      const bob = t>1.2 ? Math.sin((t-1.2)*4.5)*10*(1-seg(t,2.4,2.6)) : 0;
      const rot = (1-easeOutCubic(drop))*-Math.PI*3 + out*Math.PI*.6;
      // shockwave + sparkles on landing
      const sw=seg(t,.33,.95);
      if (sw>0 && sw<1){ g.save(); g.globalAlpha=1-sw; g.lineWidth=26*(1-sw)+4; g.strokeStyle=ICE;
        g.beginPath(); g.arc(cx,cy,size*.5+sw*230,0,Math.PI*2); g.stroke(); g.restore(); }
      burst(g,cx,cy,seg(t,.33,1.2),{n:12,dist:360,size:44});
      const s=1-out;
      if (s>0 && donutImg){
        g.save(); g.translate(cx,cy+y+bob); g.rotate(rot); g.scale(s,s);
        g.shadowColor="rgba(10,28,82,.55)"; g.shadowOffsetX=14; g.shadowOffsetY=18;
        g.drawImage(donutImg,-size/2,-size/2,size,size); g.restore();
      }
    }
  },

  live: {
    title:"LIVE badge", w:600, h:260, dur:()=>2, loop:true,
    draw(g,t){
      const cx=300, cy=125, pulse=1+.035*Math.sin(t*Math.PI*2/2);
      g.save(); g.translate(cx,cy); g.scale(pulse,pulse);
      block(g,-220,-72,440,144,72,RED,{shadow:10});
      const dx=-128, p=(t%1);
      g.save(); g.globalAlpha=(1-p)*.9; g.lineWidth=8; g.strokeStyle="#fff";
      g.beginPath(); g.arc(dx,0,26+p*34,0,Math.PI*2); g.stroke(); g.restore();
      g.beginPath(); g.arc(dx,0,26,0,Math.PI*2); g.fillStyle="#fff"; g.fill(); g.lineWidth=6; g.strokeStyle=NAVY; g.stroke();
      blockText(g,"LIVE",46,6,92,"#fff",{shadow:false});
      g.restore();
    }
  },

  arrow: {
    title:"Bouncing arrow", w:640, h:640, dur:()=>1.2, loop:true,
    draw(g,t){ drawArrow(g,300,300,Math.PI/4,-Math.abs(Math.sin(t*Math.PI/1.2))*60); }
  },

  circle: {
    title:"Circle highlight", w:900, h:640, dur:()=>1.8,
    draw(g,t){ scribble(g,450,320,360,230,easeInOut(seg(t,0,.65))); }
  },

  money: {
    title:"Money counter", w:1400, h:340, configurable:true,
    fields:[
      {key:"from",  label:"Start amount", type:"number", value:0},
      {key:"to",    label:"End amount",   type:"number", value:1000000},
      {key:"secs",  label:"Count time (seconds)", type:"number", value:3, min:1, max:20, step:.5},
      {key:"prefix",label:"Prefix", type:"text", value:"$", maxlength:3},
      {key:"style", label:"Number style", type:"select", value:"short", options:[["short","Short (1.2M)"],["full","Full (1,200,000)"]]},
      {key:"color", label:"Color", type:"color", value:"#35d05a"}
    ],
    dur:o=>num(o.secs,3,1,20)+1.4,
    draw(g,t,o){
      const secs=num(o.secs,3,1,20), from=num(o.from,0,-1e15,1e15), to=num(o.to,0,-1e15,1e15), fmt=o.style==="full"?fullNum:shortNum;
      const val = from+(to-from)*easeOutCubic(seg(t,0,secs));
      const text = (o.prefix||"")+fmt(val);
      // size from the widest value so the text doesn't jitter while counting
      const key=JSON.stringify(o);
      if (this._k!==key){ let maxW=0; for (let i=0;i<=40;i++){ maxW=Math.max(maxW,textWidth(g,(o.prefix||"")+fmt(from+(to-from)*i/40),200)); }
        this._size = Math.min(210, 200*1300/maxW); this._k=key; }
      const inS=easeOutBack(seg(t,0,.3)), popP=seg(t,secs,secs+.35), pop=1+.14*Math.sin(popP*Math.PI);
      g.save(); g.translate(700,170); g.scale(inS*pop,inS*pop);
      blockText(g,text,0,0,this._size,o.color||"#35d05a");
      g.restore();
      burst(g,700,170,seg(t,secs,secs+.9),{n:12,dist:520,size:40,colors:[o.color||"#35d05a","#fff",GOLD]});
    }
  },

  countdown: {
    title:"Countdown", w:800, h:800, configurable:true,
    fields:[
      {key:"from",  label:"Count down from", type:"number", value:5, min:1, max:60, step:1},
      {key:"end",   label:"End text", type:"text", value:"GO!", maxlength:12},
      {key:"color", label:"Color", type:"color", value:"#1f5bff"}
    ],
    dur:o=>Math.round(num(o.from,5,1,60))+1.2,
    draw(g,t,o){
      const n0=Math.round(num(o.from,5,1,60)), col=o.color||"#1f5bff", cx=400, cy=400;
      if (t<n0){
        const n=n0-Math.floor(t), local=t%1, s=easeOutBack(seg(local,0,.3));
        g.save(); g.translate(cx,cy);
        g.beginPath(); g.arc(12,14,280,0,Math.PI*2); g.fillStyle=NAVY; g.fill();
        g.beginPath(); g.arc(0,0,280,0,Math.PI*2); g.fillStyle="#fff"; g.fill(); g.lineWidth=12; g.strokeStyle=NAVY; g.stroke();
        g.lineCap="round"; g.lineWidth=34; g.strokeStyle="rgba(10,28,82,.12)";
        g.beginPath(); g.arc(0,0,226,0,Math.PI*2); g.stroke();
        g.strokeStyle=col; g.beginPath(); g.arc(0,0,226,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-local)); g.stroke();
        g.scale(s,s); blockText(g,String(n),0,14,String(n).length>1?250:300,col);
        g.restore();
      } else if (o.end){
        const s=easeOutBack(seg(t,n0,n0+.35)), size=fitSize(g,o.end,720,260);
        burst(g,cx,cy,seg(t,n0,n0+1),{n:12,dist:360,size:44,colors:[col,"#fff",GOLD]});
        g.save(); g.translate(cx,cy); g.rotate(-.06); g.scale(s,s); blockText(g,o.end,0,0,size,col,{outer:"#fff"}); g.restore();
      }
    }
  },

  lowerThird: {
    title:"Lower third", w:1600, h:340, configurable:true,
    fields:[
      {key:"name",  label:"Name", type:"text", value:"YourName", maxlength:28},
      {key:"sub",   label:"Subtitle", type:"text", value:"DonutSMP creator", maxlength:40},
      {key:"color", label:"Accent color", type:"color", value:"#7fe3ff"},
      {key:"hold",  label:"Time on screen (seconds)", type:"number", value:4, min:1, max:20, step:.5}
    ],
    dur:o=>num(o.hold,4,1,20)+1.3,
    draw(g,t,o){
      const hold=num(o.hold,4,1,20), D=hold+1.3, col=o.color||ICE, name=o.name||" ", sub=o.sub||"";
      const out=seg(t,D-.6,D-.05);
      const nameSize=fitSize(g,name,1250,104), subSize=fitSize(g,sub,1200,46);
      const w1=Math.max(420,textWidth(g,name,nameSize)+110), w2=sub?textWidth(g,sub,subSize,700)+80:0;
      const barP=easeOutCubic(seg(t,0,.25))*(1-easeInCubic(seg(out,.6,1)));
      const p1=easeOutCubic(seg(t,.12,.55))*(1-easeInCubic(seg(out,.2,.8)));
      const p2=easeOutCubic(seg(t,.35,.75))*(1-easeInCubic(seg(out,0,.6)));
      const x0=70, y1=70, h1=140, y2=y1+h1+18, h2=70;
      // accent bar
      if (barP>0){ const bh=(h1+18+h2)*barP; block(g,x0-46,y1,28,bh,8,col,{lw:6,shadow:8}); }
      if (p1>0){
        g.save(); g.beginPath(); g.rect(x0-10,0,(w1+40)*p1,y2-4); g.clip();
        block(g,x0,y1,w1,h1,14,NAVY,{lw:6,shadow:10,shadowColor:"rgba(2,8,31,.55)",stroke:"#02081f"});
        blockText(g,name,x0+50-(1-p1)*120,y1+h1/2+6,nameSize,"#fff",{align:"left",shadow:false,stroke:"#02081f"});
        g.restore();
      }
      if (p2>0 && sub){
        g.save(); g.beginPath(); g.rect(x0-10,y2-4,(w2+40)*p2,h2+30); g.clip();
        block(g,x0,y2,w2,h2,12,col,{lw:6,shadow:8});
        g.font=`700 ${subSize}px ${FONT}`; g.textBaseline="middle"; g.fillStyle=NAVY;
        g.fillText(sub,x0+40-(1-p2)*80,y2+h2/2+3);
        g.restore();
      }
    }
  },

  textSticker: {
    title:"Text sticker", w:1800, h:700, configurable:true, image:true,
    fields:[
      {key:"text",  label:"Text", type:"text", value:"RAIDED!", maxlength:24},
      {key:"color", label:"Color", type:"color", value:"#ffd23f"},
      {key:"tilt",  label:"Tilt (degrees)", type:"number", value:-6, min:-30, max:30, step:1}
    ],
    dur:()=>1,
    draw(g,t,o){
      const text=o.text||" ", size=fitSize(g,text,1500,260);
      g.save(); g.translate(900,350); g.rotate(num(o.tilt,0,-30,30)*Math.PI/180);
      blockText(g,text,0,0,size,o.color||GOLD,{outer:"#fff"});
      g.restore();
    }
  }
};

/* ---------- output ---------- */
function paint(g,A,t,o,bg){
  g.clearRect(0,0,A.w,A.h);
  if (bg && bg!=="transparent"){ g.fillStyle=bg; g.fillRect(0,0,A.w,A.h); }
  A.draw(g,t,o);
}
function defaults(key){ return Object.fromEntries((ANIMS[key].fields||[]).map(f=>[f.key,f.value])); }

// crop a canvas to its visible pixels (used for stickers)
function autocrop(c,pad=24){
  const g=c.getContext("2d"), {data}=g.getImageData(0,0,c.width,c.height);
  let x0=c.width,y0=c.height,x1=0,y1=0;
  for (let y=0;y<c.height;y++) for (let x=0;x<c.width;x++) if (data[(y*c.width+x)*4+3]>8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  if (x1<x0) return c;
  x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad); x1=Math.min(c.width-1,x1+pad); y1=Math.min(c.height-1,y1+pad);
  const out=document.createElement("canvas"); out.width=x1-x0+1; out.height=y1-y0+1;
  out.getContext("2d").drawImage(c,x0,y0,out.width,out.height,0,0,out.width,out.height);
  return out;
}

async function renderPNG(key,o){
  await ready();
  const A=ANIMS[key], c=document.createElement("canvas"); c.width=A.w; c.height=A.h;
  paint(c.getContext("2d"),A,A.dur(o)-.001,o);
  const out = A.image ? autocrop(c) : c;
  return new Promise(res=>out.toBlob(res,"image/png"));
}

// WebM keeps transparency; MP4 is more widely supported by editors, so it's preferred for solid backgrounds
function videoMime(preferMp4){
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  const webm=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"], mp4=["video/mp4;codecs=avc1","video/mp4"];
  return (preferMp4 ? [...mp4,...webm] : [...webm,...mp4]).find(m=>MediaRecorder.isTypeSupported(m)) || null;
}

// Plays the animation in real time and records it. bg: "transparent" or a CSS color (e.g. green screen)
async function record(key,o,{bg="transparent",onProgress,loops=1}={}){
  await ready();
  const mime=videoMime(bg!=="transparent"); if (!mime) throw new Error("This browser can't record video. Try Chrome or Edge.");
  const A0=ANIMS[key], one=A0.dur(o), webm=mime.startsWith("video/webm");
  // looping animations can be recorded several cycles long
  const A = loops>1 ? {...A0, draw:(g,t,oo)=>A0.draw.call(A0,g,t%one,oo)} : A0, dur=one*loops;
  const back = bg==="transparent" ? (webm ? null : "#00ff00") : bg;
  const c=document.createElement("canvas"); c.width=A.w; c.height=A.h; const g=c.getContext("2d");
  paint(g,A,0,o,back);
  const stream=c.captureStream(60), rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10e6}), chunks=[];
  rec.ondataavailable=e=>{ if (e.data.size) chunks.push(e.data); };
  const stopped=new Promise(r=>rec.onstop=r);
  rec.start();
  const t0=performance.now();
  let last=t0, stalled=false;
  await new Promise(done=>{
    const step=()=>{ const now=performance.now(), t=(now-t0)/1000;
      // browsers pause drawing in hidden tabs; a long gap means the video would come out broken
      if (now-last>300){ stalled=true; return done(); }
      last=now; paint(g,A,Math.min(t,dur),o,back);
      if (onProgress) onProgress(Math.min(1,t/dur));
      if (t<dur+.08) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  });
  rec.stop(); await stopped; stream.getTracks().forEach(tr=>tr.stop());
  if (stalled) throw new Error("Recording stopped because the tab was hidden. Keep this tab open and try again.");
  let blob=new Blob(chunks,{type:mime.split(";")[0]});
  // MediaRecorder leaves the duration out of WebM files; patch it so editors can seek
  if (webm && window.ysFixWebmDuration){ try{ blob=await window.ysFixWebmDuration(blob,dur*1000,{logger:false}); }catch{} }
  return { blob, ext: webm?"webm":"mp4", transparent: webm && !back };
}

window.DCH = { ANIMS, defaults, paint, ready, record, renderPNG, videoMime, autocrop,
  helpers:{ block, blockText, sparkle, burst, drawArrow, scribble, textWidth, fitSize, seg, easeOutCubic, NAVY, ICE, RED, GOLD, DOUGH } };
})();
