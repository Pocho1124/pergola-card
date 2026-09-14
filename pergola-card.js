/* pergola-card.js — Pergola bioclimatica 3D per Home Assistant */
(function(){
const YAW=32*Math.PI/180, PIT=24*Math.PI/180;
const cY=Math.cos(YAW), sY=Math.sin(YAW), cP=Math.cos(PIT), sP=Math.sin(PIT);
const CX=200, CY0=236, S=82;
function P(x,y,z){const x1=x*cY+z*sY, z1=-x*sY+z*cY, y2=y*cP-z1*sP, d=y*sP+z1*cP;
  return {x:CX+x1*S, y:CY0-y2*S, d};}
const key=p=>p.x.toFixed(1)+","+p.y.toFixed(1);
// ---------- vettori ----------
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const m=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/m,a[1]/m,a[2]/m];};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function prng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const LIGHT=norm([0.38,0.86,0.34]);
const HALF =norm([LIGHT[0],LIGHT[1]+0.6,LIGHT[2]+0.7]);
// ---------- dimensioni ----------
const W=3.0, D=2.2, H=1.6, T=0.042, PITCH=0.185;
function rad(p){return p/100*90*Math.PI/180;}
function hex2rgb(h){h=(h||'').replace('#','');return [parseInt(h.substr(0,2),16)||0,parseInt(h.substr(2,2),16)||0,parseInt(h.substr(4,2),16)||0];}
class PergolaCard extends HTMLElement {
  setConfig(config){
    const d={title:'Pergola',tilt_entity:null,tilt_max:100,led_entity:null,glass_entity:null,day_night:null,mount:'free',louvers:'horizontal',slats:14,fixed_every:0,led_type:'strip',led_rgb:false,led_color:'#ffdca6',led_temp:'warm',glass:false,speaker:false,speaker_entity:null,frame_color:'#34383e',louver_color:'#d6d0c4',speaker_color:'#1a1c20',controls:false};
    this._cfg=Object.assign(d,config||{}); this._built=false;
  }
  static getStubConfig(){return {tilt_entity:'',led_entity:'',glass_entity:'',speaker_entity:'',mount:'free',louvers:'horizontal',slats:14,fixed_every:4,glass:false,speaker:false,frame_color:'#34383e',louver_color:'#d6d0c4',speaker_color:'#1a1c20',controls:true};}
  getCardSize(){return this._cfg&&this._cfg.controls?6:4;}
  set hass(h){this._hass=h; if(!this._built)this._build(); this._sync();}
  _pct(id,max){const st=this._hass&&this._hass.states[id]; if(!st)return null; const dom=id.split('.')[0], a=st.attributes||{};
    if(dom==='cover'){const t=a.current_tilt_position,p=a.current_position; let r=(id===this._cfg.tilt_entity&&t!=null)?t:(p!=null?p:(st.state==='open'?100:st.state==='closed'?0:null)); return r==null?null:Math.max(0,Math.min(100,r));}
    const v=parseFloat(st.state); return isNaN(v)?null:Math.max(0,Math.min(100,v/max*100));}
  _sync(){
    const c=this._cfg,h=this._hass;
    const tilt=c.tilt_entity?this._pct(c.tilt_entity,c.tilt_max):50; this._tiltTarget=(tilt==null?50:tilt);
    const ls=c.led_entity&&h.states[c.led_entity]; this._ledOn=!!(ls&&ls.state==='on');
    let col=c.led_color; if(!c.led_rgb) col=(c.led_temp==='cool')?'#eaf1ff':'#ffdca6';
    else if(ls&&ls.attributes&&ls.attributes.rgb_color){const r=ls.attributes.rgb_color; col='rgb('+r[0]+','+r[1]+','+r[2]+')';}
    this._ledColor=col;
    const gs=c.glass_entity&&h.states[c.glass_entity]; this._glassTarget = gs? (this._pct(c.glass_entity,100)||0):0;
    let night=false;
    if(c.day_night && c.day_night!=='auto'){const dn=h.states[c.day_night]; if(dn){ if(dn.state==='below_horizon'||dn.state==='off')night=true; else if(!isNaN(parseFloat(dn.state)))night=parseFloat(dn.state)<50; }}
    else { const hr=new Date().getHours(); night=(hr<7||hr>=20); }
    this._night=night;
    this._speaker=!!c.speaker;
    const sp=c.speaker_entity&&h.states[c.speaker_entity];
    this._spkOn = c.speaker_entity ? !!(sp && !['off','unavailable','unknown','standby'].includes(sp.state)) : !!c.speaker;
    this._spkPlaying = !!(sp && sp.state==='playing');
    if(this._titleEl) this._titleEl.textContent=c.title;
    this._animate();
  }
  _animate(){
    const n=this._cfg.slats;
    if(!this._cur||this._cur.length!==n) this._cur=new Array(n).fill((this._tiltTarget||0)/100*90*Math.PI/180);
    if(this._glassCur==null) this._glassCur=this._glassTarget||0;
    if(this._tiltShown==null) this._tiltShown=this._tiltTarget||0;
    if(this._raf) cancelAnimationFrame(this._raf);
    const step=()=>{
      let moving=false; const tt=(this._tiltTarget||0)/100*90*Math.PI/180;
      for(let i=0;i<this._cur.length;i++){this._cur[i]+=(tt-this._cur[i])*0.2; if(Math.abs(tt-this._cur[i])>0.002)moving=true; else this._cur[i]=tt;}
      this._tiltShown+=((this._tiltTarget||0)-this._tiltShown)*0.2; if(Math.abs((this._tiltTarget||0)-this._tiltShown)>0.3)moving=true;
      this._glassCur+=((this._glassTarget||0)-this._glassCur)*0.2; if(Math.abs((this._glassTarget||0)-this._glassCur)>0.3)moving=true; else this._glassCur=this._glassTarget||0;
      this._render(); this._raf=moving?requestAnimationFrame(step):null;
    };
    this._raf=requestAnimationFrame(step);
  }
  _build(){
    const c=this._cfg; this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML='<style>ha-card{padding:14px;border-radius:16px}.head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}.t{font-size:1.15rem;font-weight:700;letter-spacing:.2px;color:var(--primary-text-color)}.s{font-size:.78rem;color:var(--secondary-text-color);text-transform:capitalize}svg{width:100%;height:auto;display:block;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.12)}.ctl{margin-top:12px}.lbl{font-size:.72rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--secondary-text-color);margin:12px 2px 6px}.row{display:flex;align-items:center;gap:10px}.row input[type=range]{flex:1;height:6px;border-radius:6px;accent-color:var(--primary-color)}.btns{display:flex;gap:10px;margin-top:8px}button.b{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--divider-color,#d4d9e0);background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:14px;padding:12px 10px;font-weight:600;font-size:.95rem;cursor:pointer;transition:transform .12s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}button.b:active{transform:scale(.97)}button.b .i{font-size:1.1rem;line-height:1}button.b.on{box-shadow:0 2px 10px rgba(0,0,0,.10)}#l.on{background:rgba(255,196,84,.20);border-color:rgba(255,196,84,.65)}#s.on{background:rgba(80,150,255,.18);border-color:rgba(80,150,255,.6)}</style>'
      +'<ha-card><div class="head"><span class="t"></span><span class="s"></span></div><svg viewBox="0 0 400 300" role="img" aria-label="Pergola"></svg><div class="ctl"></div></ha-card>';
    this._svg=this.shadowRoot.querySelector('svg');
    this._titleEl=this.shadowRoot.querySelector('.t');
    this._subEl=this.shadowRoot.querySelector('.s');
    if(c.controls) this._buildControls();
    if(!c.day_night || c.day_night==='auto') this._clock=setInterval(()=>{ if(this._hass) this._sync(); },60000);
    this._built=true;
  }
  _buildControls(){
    const c=this._cfg, ctl=this.shadowRoot.querySelector('.ctl'); let html='';
    html+='<div class="lbl">Inclinazione</div><div class="row"><input id="t" type="range" min="0" max="100"></div>';
    const btns=[];
    if(c.led_entity) btns.push('<button class="b" id="l"><span class="i">💡</span>Luci</button>');
    if(c.speaker_entity) btns.push('<button class="b" id="s"><span class="i">🔊</span>Casse</button>');
    if(btns.length) html+='<div class="btns">'+btns.join('')+'</div>';
    if(c.glass_entity) html+='<div class="lbl">Vetrate</div><div class="row"><input id="g" type="range" min="0" max="100"></div>';
    ctl.innerHTML=html;
    const t=ctl.querySelector('#t'); if(t) t.addEventListener('change',()=>this._setTilt(+t.value));
    const l=ctl.querySelector('#l'); if(l) l.addEventListener('click',()=>this._hass.callService('homeassistant','toggle',{entity_id:c.led_entity}));
    const s=ctl.querySelector('#s'); if(s) s.addEventListener('click',()=>{const id=c.speaker_entity,dom=id.split('.')[0];
      if(dom==='media_player') this._hass.callService('media_player','media_play_pause',{entity_id:id});
      else this._hass.callService('homeassistant','toggle',{entity_id:id});});
    const g=ctl.querySelector('#g'); if(g) g.addEventListener('change',()=>this._hass.callService('cover','set_cover_position',{entity_id:c.glass_entity,position:+g.value}));
    this._ctlT=t; this._ctlG=g;
  }
  _setTilt(v){const c=this._cfg, id=c.tilt_entity, dom=id.split('.')[0];
    if(dom==='cover'){const st=this._hass.states[id], sf=(st&&st.attributes&&st.attributes.supported_features)||0;
      if(sf&128) this._hass.callService('cover','set_cover_tilt_position',{entity_id:id,tilt_position:v});
      else if(sf&4) this._hass.callService('cover','set_cover_position',{entity_id:id,position:v});
      else this._hass.callService('cover', v>50?'open_cover':'close_cover', {entity_id:id});}
    else if(dom==='number'||dom==='input_number') this._hass.callService(dom,'set_value',{entity_id:id,value:v/100*c.tilt_max});}
  _render(){
    const c=this._cfg, svg=this._svg; if(!svg) return;
    const wall=c.mount==='wall', vertical=c.louvers==='vertical', slatsN=c.slats, fixedEvery=c.fixed_every, ledType=c.led_type, glass=c.glass;
    const night=this._night, ledOn=this._ledOn, ledColor=this._ledColor;
    const frameColor=c.frame_color, louverColor=c.louver_color, speakerColor=c.speaker_color, speaker=this._speaker, spkOn=this._spkOn, spkPlaying=this._spkPlaying;
    const cur=this._cur, glassCur=this._glassCur, tilt=this._tiltShown;
    const count=()=>slatsN, isFixed=i=>fixedEvery>0&&((i+1)%fixedEvery===0);
function metal(n){
  const diff=Math.max(0,dot(n,LIGHT)), spec=Math.pow(Math.max(0,dot(n,HALF)),30);
  const amb=night?0.34:0.52, kd=night?0.34:0.44, ks=night?0.12:0.22;
  let base=hex2rgb(louverColor); if(night)base=base.map(v=>Math.round(v*0.62)); const t=amb+kd*diff;
  const c=base.map(v=>v*t+255*ks*spec);
  return `rgb(${c.map(v=>Math.min(255,Math.round(v))).join(",")})`;
}
function faceObj(v3){const n=norm(cross(sub3(v3[1],v3[0]),sub3(v3[2],v3[0])));
  const pj=v3.map(p=>P(p[0],p[1],p[2])); const depth=pj.reduce((s,p)=>s+p.d,0)/pj.length;
  return {pj,n,depth};}
function pushMetal(list,v3){const f=faceObj(v3); const col=metal(f.n);
  list.push({depth:f.depth, s:`<polygon points="${f.pj.map(key).join(" ")}" fill="${col}" stroke="${col}" stroke-width="0.6" stroke-linejoin="round"/>`});}

// ---------- una lama (perno centrale, orientamento selezionabile) ----------
function louver(list, shList, i, A){
  const n=count(), pitch=(vertical?W:D)/n, chord=pitch*1.02, c0=(vertical?-W/2:-D/2)+pitch*(i+0.5);
  const ca=Math.cos(A), sa=Math.sin(A);
  const half=(vertical?D/2:W/2)-0.09;   // estremità dentro il telaio
  function C(sLong,sy,sAc){
    const ry=sy*T/2, rac=sAc*chord/2;
    const y=H+ry*ca-rac*sa, ac=c0+ry*sa+rac*ca;
    if(vertical) return [ac, y, sLong*half];
    return [sLong*half, y, ac];
  }
  const v={a:C(-1,1,-1),b:C(1,1,-1),c:C(1,1,1),d:C(-1,1,1),
           e:C(-1,-1,-1),f:C(1,-1,-1),g:C(1,-1,1),h:C(-1,-1,1)};
  // solo facce lunghe (top, bottom, fronte, retro) -> niente "pettine" di teste
  [[v.a,v.b,v.c,v.d],[v.h,v.g,v.f,v.e],[v.d,v.c,v.g,v.h],[v.b,v.a,v.e,v.f]].forEach(fv=>pushMetal(list,fv));
  const hi=[C(-0.97,1,-0.55),C(0.97,1,-0.55),C(0.97,1,-0.15),C(-0.97,1,-0.15)];
  const hf=faceObj(hi);
  list.push({depth:hf.depth+0.001, s:`<polygon points="${hf.pj.map(key).join(" ")}" fill="rgba(255,255,255,${night?0.05:0.14})"/>`});
  if(!night){const top=[v.a,v.b,v.c,v.d].map(P0=>{const s=P0[1]/LIGHT[1];
    return P(P0[0]-s*LIGHT[0],0,P0[2]-s*LIGHT[2]);});
    shList.push(`<polygon points="${top.map(key).join(" ")}" fill="rgba(0,0,0,0.26)"/>`);}
}

// ---------- prisma telaio ----------
function box(list,x0,x1,y0,y1,z0,z1,color){
  const V=(x,y,z)=>[x,y,z];
  const c={A:V(x0,y1,z0),B:V(x1,y1,z0),C:V(x1,y1,z1),D:V(x0,y1,z1),E:V(x0,y0,z0),F:V(x1,y0,z0),G:V(x1,y0,z1),H:V(x0,y0,z1)};
  [[c.A,c.B,c.C,c.D],[c.H,c.G,c.F,c.E],[c.D,c.C,c.G,c.H],[c.B,c.A,c.E,c.F],[c.A,c.D,c.H,c.E],[c.C,c.B,c.F,c.G]].forEach(fv=>{
    const f=faceObj(fv), sh=0.55+0.45*Math.max(0,dot(f.n,LIGHT)), rgb=color.map(v=>Math.round(v*sh));
    list.push({depth:f.depth, s:`<polygon points="${f.pj.map(key).join(" ")}" fill="rgb(${rgb.join(",")})" stroke="#111" stroke-width="0.3"/>`});});
}
function build(){
  const Q=(p3,fill,ex="")=>`<polygon points="${p3.map(q=>{const p=P(q[0],q[1],q[2]);return p.x.toFixed(1)+","+p.y.toFixed(1);}).join(" ")}" fill="${fill}" ${ex}/>`;
  const seg=(a,b,st,sw)=>{const pa=P(a[0],a[1],a[2]),pb=P(b[0],b[1],b[2]);return `<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;};
  const common=`
    <radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffdf2"/><stop offset="0.3" stop-color="#fff0bf"/><stop offset="1" stop-color="#fff0bf" stop-opacity="0"/></radialGradient>
    <radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe0a0" stop-opacity="1"/><stop offset="0.55" stop-color="#ffcf85" stop-opacity="0.65"/><stop offset="1" stop-color="#ffcf85" stop-opacity="0"/></radialGradient>
    <radialGradient id="ledpool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${ledColor}" stop-opacity="1"/><stop offset="0.55" stop-color="${ledColor}" stop-opacity="0.62"/><stop offset="1" stop-color="${ledColor}" stop-opacity="0"/></radialGradient>
    <linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c8" stop-opacity="0.8"/><stop offset="0.6" stop-color="#ffd487" stop-opacity="0.26"/><stop offset="1" stop-color="#ffd487" stop-opacity="0"/></linearGradient>
    <filter id="softsh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="blurC" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="blurB" x="-60%" y="-30%" width="220%" height="170%"><feGaussianBlur stdDeviation="5"/></filter>
    <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night?'#c7cacd':'#f3f4f5'}"/><stop offset="1" stop-color="${night?'#a9adb1':'#dfe2e4'}"/></linearGradient>
    <filter id="glow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const ZW=-1.35, ZF=9, ZB=-5, GX=11;
  const brk=night?'#3a2b28':'#8a5545', fugR=night?'#20161433':'#c9a98a66';
  const defs=`<defs>${common}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night?'#0b1636':'#4f93e2'}"/><stop offset="1" stop-color="${night?'#25355e':'#d4e6f7'}"/></linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night?'#2c4230':'#bcd6c4'}"/><stop offset="0.22" stop-color="${night?'#2b4524':'#83ad54'}"/><stop offset="1" stop-color="${night?'#1a301b':'#46702b'}"/></linearGradient></defs>`;
  const brickWall=(zc,top)=>{
    let s=Q([[-GX,0,zc],[GX,0,zc],[GX,top,zc],[-GX,top,zc]], brk); let r=0;
    for(let yy=0.16; yy<top; yy+=0.19, r++){
      s+=seg([-GX,yy,zc+0.004],[GX,yy,zc+0.004],fugR,1);
      const off=(r%2)?0.21:0;
      for(let xx=-GX+off; xx<GX; xx+=0.42){const a=P(xx,yy,zc+0.004),b=P(xx,yy+0.19,zc+0.004);
        s+=`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${fugR}" stroke-width="1"/>`;}
    } return s;
  };
  const doorWindow=(zc)=>{
    const dz=zc+0.012, tel=night?'#1c2230':'#2b2f36', g0=night?'#22304a':'#9fc0d8', g1=night?'#33465f':'#c8dced';
    const X0=-0.62,X1=0.62,Y0=0.03,Y1=1.5, mx=(X0+X1)/2;
    let s=Q([[X0,Y0,dz],[X1,Y0,dz],[X1,Y1,dz],[X0,Y1,dz]], tel);
    s+=`<defs><linearGradient id="pfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g1}"/><stop offset="0.5" stop-color="${g0}"/><stop offset="1" stop-color="${g1}"/></linearGradient></defs>`;
    s+=Q([[X0+0.05,Y0+0.05,dz+0.002],[mx-0.03,Y0+0.05,dz+0.002],[mx-0.03,Y1-0.05,dz+0.002],[X0+0.05,Y1-0.05,dz+0.002]],'url(#pfg)');
    s+=Q([[mx+0.03,Y0+0.05,dz+0.002],[X1-0.05,Y0+0.05,dz+0.002],[X1-0.05,Y1-0.05,dz+0.002],[mx+0.03,Y1-0.05,dz+0.002]],'url(#pfg)');
    s+=seg([mx,Y0,dz+0.003],[mx,Y1,dz+0.003],tel,4);
    s+=seg([mx-0.09,0.75,dz+0.004],[mx-0.09,1.0,dz+0.004],night?'#9aab':'#3a4048',3)+seg([mx+0.09,0.75,dz+0.004],[mx+0.09,1.0,dz+0.004],night?'#9aab':'#3a4048',3);
    return s;
  };
  // cielo
  let bg=`<rect x="0" y="0" width="400" height="300" fill="url(#sky)"/>`;
  if(!night){
    const cloud=(cx,cy,s)=>`<g opacity="0.92" filter="url(#blurC)"><ellipse cx="${cx}" cy="${cy}" rx="${30*s}" ry="${12*s}" fill="#fff"/><ellipse cx="${cx-20*s}" cy="${cy+5*s}" rx="${18*s}" ry="${9*s}" fill="#fff"/><ellipse cx="${cx+22*s}" cy="${cy+4*s}" rx="${20*s}" ry="${10*s}" fill="#fff"/></g>`;
    bg+=cloud(88,44,1)+cloud(215,30,0.7)+`<circle cx="330" cy="40" r="38" fill="url(#sun)"/><circle cx="330" cy="40" r="12" fill="#fff7d6"/>`;
  }
  // prato
  bg+=Q([[-GX,0,ZF],[GX,0,ZF],[GX,0,ZB],[-GX,0,ZB]],'url(#grass)');
  // chiazze tonali
  const rp=prng(33); let patch="";
  for(let i=0;i<44;i++){const px=(rp()*2-1)*(GX-1), pz=ZB+0.6+rp()*(ZF-ZB-1.2);
    const e=P(px,0,pz), rr=0.5+rp()*1.3, col=rp()<0.5?(night?'#2b4622':'#6f9a45'):(night?'#1b311a':'#3f6a2c');
    patch+=`<ellipse cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" rx="${(rr*S).toFixed(0)}" ry="${(rr*S*0.38).toFixed(0)}" fill="${col}" opacity="0.4"/>`;}
  bg+=`<g filter="url(#blurC)">${patch}</g>`;
  // muro di mattoni: alto e vicino se addossata, recinzione lontana se libera
  const muroZ = wall? ZW : -3.2, muroTop = wall? 5 : 2.6;
  bg+=brickWall(muroZ, muroTop)+doorWindow(muroZ);
  if(wall){const so=P(0,H*0.95,ZW+0.006); bg+=`<ellipse cx="${so.x.toFixed(1)}" cy="${so.y.toFixed(1)}" rx="150" ry="60" fill="#00000030" filter="url(#blurC)"/>`;}
  // erba davanti al muro
  const rg=prng(7), pal=night?['#294122','#22381d','#2f4b27','#31502a']:['#5f8a3f','#4f7a35','#6f9a4a','#77a352','#548538'];
  const fcol=night?['#b9c7d8','#c8b76a']:['#ffffff','#ffe58a','#f2c0d4'];
  const gz0=muroZ+0.2, items=[];
  for(let i=0;i<260;i++){
    const gx=(rg()*2-1)*(GX-0.6), gz=gz0+rg()*(4.6-gz0), hh=0.04+rg()*0.11, w=0.025+rg()*0.03, c=pal[(rg()*pal.length)|0];
    const b=P(gx,0,gz), t0=P(gx,hh,gz), tl=P(gx-w,hh*0.78,gz), tr=P(gx+w,hh*0.78,gz);
    const sw=Math.max(0.5, 2.0-(gz-ZB)/(ZF-ZB)*1.6);
    let s=`<path d="M${b.x.toFixed(1)} ${b.y.toFixed(1)} L${tl.x.toFixed(1)} ${tl.y.toFixed(1)} M${b.x.toFixed(1)} ${b.y.toFixed(1)} L${t0.x.toFixed(1)} ${t0.y.toFixed(1)} M${b.x.toFixed(1)} ${b.y.toFixed(1)} L${tr.x.toFixed(1)} ${tr.y.toFixed(1)}" stroke="${c}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round" fill="none"/>`;
    if(gz>1 && rg()<0.06){const f=P(gx,hh+0.02,gz); s+=`<circle cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" r="${Math.max(1,sw).toFixed(1)}" fill="${fcol[(rg()*fcol.length)|0]}"/>`;}
    items.push({z:gz, s});
  }
  items.sort((a,b)=>a.z-b.z);
  bg+=items.map(o=>o.s).join("");
  // pedana bianca su cui poggia la pergola
  bg+=Q([[-2.2,0.01,2.4],[2.2,0.01,2.4],[2.2,0.01,-1.3],[-2.2,0.01,-1.3]],'url(#deck)');
  svg.innerHTML=defs+bg+`<g id="shadows"></g><g id="glight"></g><g id="scene"></g><g id="beam"></g><g id="speaker"></g>`;
  draw();
}

function draw(){
  const list=[]; let col=hex2rgb(frameColor); if(night)col=col.map(v=>Math.round(v*0.6));
  // montanti
  box(list,-W/2-0.06,-W/2+0.06,0,H, D/2-0.06,D/2+0.06,col);
  box(list, W/2-0.06, W/2+0.06,0,H, D/2-0.06,D/2+0.06,col);
  if(!wall){box(list,-W/2-0.06,-W/2+0.06,0,H,-D/2-0.06,-D/2+0.06,col);
            box(list, W/2-0.06, W/2+0.06,0,H,-D/2-0.06,-D/2+0.06,col);}
  // travi perimetrali
  box(list,-W/2-0.07,W/2+0.07,H-0.12,H+0.12,-D/2-0.07,-D/2+0.07,col);
  box(list,-W/2-0.07,W/2+0.07,H-0.12,H+0.12, D/2-0.07, D/2+0.07,col);
  box(list,-W/2-0.07,-W/2+0.08,H-0.12,H+0.12,-D/2,D/2,col);
  box(list, W/2-0.08, W/2+0.07,H-0.12,H+0.12,-D/2,D/2,col);
  // lame
  const shList=[]; const n=count();
  for(let i=0;i<n;i++) louver(list,shList,i,isFixed(i)?0:cur[i]);
  // vetrate (porte-finestre) nel painter: 4 lati se libera, 3 se addossata
  if(glass){
    const vetro=night?'#61748a':'#bcd8ea', tel=night?'#20242c':'#2b2f36';
    const addWall=(x0,z0,x1,z1)=>{
      const open=glassCur/100, y0=0.02,y1=H-0.02;
      const L=Math.hypot(x1-x0,z1-z0), N=Math.max(2,Math.round(L/0.8)), w=1/N;
      const c0=P(x0,y0,z0),c1=P(x1,y0,z1),c2=P(x1,y1,z1),c3=P(x0,y1,z0);
      const depth=(c0.d+c1.d+c2.d+c3.d)/4;
      const anta=(tA,tB,fixed)=>{
        const p0=P(x0+(x1-x0)*tA,y0,z0+(z1-z0)*tA), p1=P(x0+(x1-x0)*tB,y0,z0+(z1-z0)*tB),
              p2=P(x0+(x1-x0)*tB,y1,z0+(z1-z0)*tB), p3=P(x0+(x1-x0)*tA,y1,z0+(z1-z0)*tA);
        let a=`<polygon points="${[p0,p1,p2,p3].map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}" fill="${vetro}" opacity="0.28" stroke="${tel}" stroke-width="${fixed?2.8:1.8}" stroke-linejoin="round"/>`;
        const mA=tA+(tB-tA)*0.22, mB=tA+(tB-tA)*0.5;
        const r1=P(x0+(x1-x0)*mA,y0+(y1-y0)*0.15,z0+(z1-z0)*mA), r2=P(x0+(x1-x0)*mB,y1*0.9,z0+(z1-z0)*mB);
        a+=`<line x1="${r1.x.toFixed(1)}" y1="${r1.y.toFixed(1)}" x2="${r2.x.toFixed(1)}" y2="${r2.y.toFixed(1)}" stroke="#fff" stroke-width="2" opacity="0.14"/>`;
        return a;
      };
      let s="";
      for(let i=0;i<N;i++){
        const tA = (i<N-1) ? i*w + ((N-1)*w - i*w)*open : (N-1)*w;   // mobili scorrono verso l'anta fissa (a x1)
        s+=anta(tA, tA+w, i===N-1);
      }
      list.push({depth,s});
    };
    addWall(-W/2,D/2, W/2,D/2);
    addWall(-W/2,-D/2, -W/2,D/2);
    addWall(W/2,-D/2, W/2,D/2);
    if(!wall) addWall(-W/2,-D/2, W/2,-D/2);
  }
  list.sort((a,b)=>a.depth-b.depth);
  svg.querySelector("#scene").innerHTML=list.map(f=>f.s).join("");
  // ombre di contatto sotto i montanti (ancorano la pergola al terreno)
  const feet = wall ? [[-W/2,D/2],[W/2,D/2]] : [[-W/2,D/2],[W/2,D/2],[-W/2,-D/2],[W/2,-D/2]];
  feet.forEach(f=>{const c=P(f[0],0.01,f[1]); shList.push(`<ellipse cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" rx="13" ry="5" fill="#00000038"/>`);});
  // ombre proiettate dei montanti (dal piede verso la direzione della luce)
  const sMul=1/LIGHT[1], tpx=H*LIGHT[0]*sMul, tpz=H*LIGHT[2]*sMul;
  feet.forEach(f=>{const tx=f[0]-tpx, tz=f[1]-tpz;
    const p1=P(f[0]-0.06,0.006,f[1]), p2=P(f[0]+0.06,0.006,f[1]), p3=P(tx+0.05,0.006,tz), p4=P(tx-0.05,0.006,tz);
    shList.push(`<polygon points="${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}" fill="#0000002b"/>`);});
  const shg=svg.querySelector("#shadows"); shg.setAttribute("filter","url(#softsh)"); shg.innerHTML=shList.join("");

  // luci: strip o faretti sulle lame fisse + riflesso a terra del colore scelto
  let gl="", strip="";
  if(ledOn){
    const tf=tilt/100, pitch=(vertical?W:D)/n;
    const idx=[]; for(let i=0;i<n;i++) if(isFixed(i)) idx.push(i);
    const targets = idx.length ? idx : [Math.floor(n/2)];
    const po=(night?1.0:0.72)*(0.65+0.35*tf);
    const ell=(cx,cz,rx,rz)=>{let p=[];for(let k=0;k<24;k++){const an=k/24*6.2832;p.push(P(cx+Math.cos(an)*rx,0.02,cz+Math.sin(an)*rz));}return p.map(q=>q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ');};
    targets.forEach(i=>{
      const c0=(vertical?-W/2:-D/2)+pitch*(i+0.5);
      if(ledType==='spot'){
        const span=(vertical?D:W)-0.5, M=Math.max(3,Math.round(span/0.55));
        for(let m=0;m<M;m++){
          const t=(m+0.5)/M, u=-(vertical?D:W)/2+0.25+t*span;
          const fx=vertical?c0:u, fz=vertical?u:c0, fp=P(fx,H-0.05,fz);
          strip+=`<circle cx="${fp.x.toFixed(1)}" cy="${fp.y.toFixed(1)}" r="3.4" fill="${ledColor}" filter="url(#glow)"/><circle cx="${fp.x.toFixed(1)}" cy="${fp.y.toFixed(1)}" r="1.5" fill="#ffffff"/>`;
          gl+=`<polygon points="${ell(fx,fz+0.12,0.55,0.55)}" fill="url(#ledpool)" opacity="${(po*0.85).toFixed(2)}"/>`;
          gl+=`<polygon points="${ell(fx,fz+0.12,0.28,0.28)}" fill="url(#ledpool)" opacity="${po.toFixed(2)}"/>`;
        }
      } else {
        let a,b,cx,cz,rxW,rzW;
        if(vertical){ a=P(c0,H-0.06,-D/2+0.14); b=P(c0,H-0.06,D/2-0.14); cx=c0; cz=0.15; rxW=0.9; rzW=D/2*1.35; }
        else { a=P(-W/2+0.14,H-0.06,c0); b=P(W/2-0.14,H-0.06,c0); cx=0; cz=c0+0.15; rxW=W/2*1.35; rzW=0.9; }
        strip+=`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ledColor}" stroke-width="3.4" stroke-linecap="round" filter="url(#glow)"/>`;
        strip+=`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>`;
        gl+=`<polygon points="${ell(cx,cz,rxW,rzW)}" fill="url(#ledpool)" opacity="${(po*0.85).toFixed(2)}"/>`;
        gl+=`<polygon points="${ell(cx,cz,rxW*0.55,rzW*0.55)}" fill="url(#ledpool)" opacity="${po.toFixed(2)}"/>`;
      }
    });
  }
  const glg=svg.querySelector("#glight"); glg.setAttribute("filter","url(#blurB)"); glg.style.mixBlendMode=""; glg.innerHTML=gl;
  svg.querySelector("#beam").innerHTML=strip;
  let spk="";
  if(speaker){
    const grid=(px)=>{
      const z=D/2+0.062, y0=0.55, y1=1.15, x0=px-0.05, x1=px+0.05;
      let s=`<polygon points="${[P(x0,y0,z),P(x1,y0,z),P(x1,y1,z),P(x0,y1,z)].map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}" fill="${speakerColor}" stroke="#0c0d10" stroke-width="1"/>`;
      for(let yy=y0+0.05; yy<y1; yy+=0.055){const a=P(x0+0.006,yy,z+0.001), b=P(x1-0.006,yy,z+0.001);
        s+=`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#3a3f47" stroke-width="1"/>`;}
      const on=spkOn, lp=P(px,y0+0.02,z+0.002);
      s+=`<circle cx="${lp.x.toFixed(1)}" cy="${lp.y.toFixed(1)}" r="${on?2.6:1.8}" fill="${on?'#38e08a':'#454b54'}"${on?' filter="url(#glow)"':''}/>`;
      if(spkPlaying){const cc=P(px,(y0+y1)/2,z+0.002);
        for(let w=1;w<=3;w++) s+=`<path d="M ${(cc.x+8*w).toFixed(1)} ${(cc.y-9*w).toFixed(1)} A ${11*w} ${11*w} 0 0 1 ${(cc.x+8*w).toFixed(1)} ${(cc.y+9*w).toFixed(1)}" fill="none" stroke="#8fd0ff" stroke-width="2.4" opacity="${(0.6-w*0.13).toFixed(2)}"/>`;}
      return s;
    };
    spk=grid(-W/2)+grid(W/2);
  }
  svg.querySelector("#speaker").innerHTML=spk;
}
    build();
    if(this._subEl) this._subEl.textContent=(this._tiltTarget>=92?'aperta':this._tiltTarget<=5?'chiusa':'parziale');
    if(this._ctlT && this.shadowRoot.activeElement!==this._ctlT) this._ctlT.value=Math.round(this._tiltTarget||0);
    if(this._ctlG && this.shadowRoot.activeElement!==this._ctlG) this._ctlG.value=Math.round(this._glassTarget||0);
    const lb=this.shadowRoot.querySelector('#l'); if(lb) lb.classList.toggle('on',this._ledOn);
    const sb=this.shadowRoot.querySelector('#s'); if(sb) sb.classList.toggle('on',this._spkOn);
  }
}
customElements.define('pergola-card', PergolaCard);
const PERGOLA_CARD_VERSION='1.3.2';
try{console.info('%c PERGOLA-CARD %c v'+PERGOLA_CARD_VERSION+' ','color:#fff;background:#34383e;padding:2px 6px;border-radius:4px 0 0 4px','color:#34383e;background:#ffdca6;padding:2px 6px;border-radius:0 4px 4px 0');}catch(e){}
window.customCards=window.customCards||[];
window.customCards.push({type:'pergola-card',name:'Pergola Card',version:PERGOLA_CARD_VERSION,description:'Pergola bioclimatica con vista 3D animata: inclinazione delle lame, luci LED (strip o faretti, calde/fredde/RGB), vetrate scorrevoli e ambiente giorno/notte. Comandi direttamente dalla card.'});
})();
