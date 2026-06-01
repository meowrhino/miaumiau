// Poporing avatar generator (RICH) — port determinista del "Poporing Maker v8".
// Mirror EXACTO de src/poporing.ts. Determinista on seed.
// Identidad miau: orejas de gato dominantes. Los 4 traits básicos (ojos/boca/
// mejillas/cabeza) se derivan PRIMERO del seed para que cat-editor.js (que usa
// seedToTraits/traitsToSeed sobre esos 4) siga funcionando; los extras (forma,
// gorro, alas, item, fx, aura…) salen después del mismo seed.
;(function () {
  const W = 32, H = 32

  function seedRng(seed) {
    let s = seed | 0
    const next = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 0xFFFFFFFF }
    const int = n => Math.floor(next() * n)
    return { next, int }
  }
  const chance = (r, p) => r.next() < p

  const h2r = h => { const c = h.replace('#', ''); return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)] }
  const r2h = (r,g,b) => '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')
  const lt = (h,a) => { const [r,g,b]=h2r(h); return r2h(r+(255-r)*a, g+(255-g)*a, b+(255-b)*a) }
  const dk = (h,a) => { const [r,g,b]=h2r(h); return r2h(r*(1-a), g*(1-a), b*(1-a)) }
  const mkOL = h => { const [r,g,b]=h2r(h); return r2h(r*.95+10, g*.75+10, b*.8+15) }
  const px = (g,x,y,c) => { if (x>=0 && y>=0 && x<W && y<H) g[y][x] = c }

  function pal(c) {
    return {
      outline: mkOL(c), s1: dk(c,.32), s2: dk(c,.16), s3: c, s4: lt(c,.26), s5: lt(c,.5), shine: lt(c,.78), pat: dk(c,.18),
      eye:'#1a1a22', eyeW:'#fff', heart:'#d84050', mouth:'#1a1a22', mouthIn:'#6a2838', tongue:'#d07088',
      cheek:'#e89098', freckle:dk(c,.35), tear:'#80c0f0',
      leaf:'#7ac06a', leafD:'#3d7a3a', spike:dk(c,.45), spikeW:lt(c,.2), antenna:'#808080', antennaT:'#f0e060', droplet:lt(c,.5), dropletW:'#fff',
      bow:'#e05080', bowD:'#a03060', crown:'#f0c830', crownD:'#b08810', gem:'#4080d0',
      witch:'#4a2070', witchD:'#2a1050', witchB:'#f0c830', witchStar:'#f0e060',
      santa:'#d03030', santaD:'#a02020', santaW:'#fff', party:'#40a0e0', partyB:'#f06080', partyC:'#f0c830', partyR:'#fff',
      petal:'#ffe860', petalC:'#e08030', halo:'#f0e060', haloD:'#c0b030', mush:'#d03030', mushD:'#fff', mushS:'#e8d8c0', hpB:'#333', hpC:'#e05080',
      wingW:'#e8e8f0', wingD:'#b0b0c0', wingDk:'#303048', wingDkL:'#484860', earA:dk(c,.25), earB:dk(c,.45),
      blade:'#c0c0d0', hilt:'#705830', shieldA:'#a0783c', shieldB:'#c09850', staffW:'#805020', staffT:'#60d0f0', potionG:'#50b850', potionB:'#e0d0a0', heartI:'#e05060', starI:'#f0d030', forkA:'#a0a0a0', forkB:'#808080',
      effA:'#f0e060', effB:'#e05060', effC:'#80c0f0', effD:'#fff',
      auraHoly:'#f8e870', auraDark:'#5030a0', auraFire:'#f05020', auraFireB:'#f0a040', auraIce:'#90d8f0',
      fxFire:'#f05020', fxFireB:'#f0a040', fxIce:'#90d8f0', fxIceB:'#c0e8ff', fxElec:'#f0e060',
      shadow:'rgba(0,0,0,.2)', metalA:lt(c,.55),
    }
  }

  const EYE = { classic:[[0,0,'eye'],[1,0,'eyeW'],[0,1,'eye'],[1,1,'eye']], round:[[0,0,'eye'],[1,0,'eye'],[0,1,'eye'],[1,1,'eyeW']], dot:[[0,0,'eye']], sleepy:[[0,0,'eye'],[1,0,'eye'],[2,0,'eye']], star:[[1,0,'eye'],[0,1,'eye'],[1,1,'eye'],[2,1,'eye'],[1,2,'eye']], heart:[[0,0,'heart'],[2,0,'heart'],[0,1,'heart'],[1,1,'heart'],[2,1,'heart'],[1,2,'heart']], sparkle:[[0,0,'eyeW'],[1,0,'eye'],[0,1,'eye'],[1,1,'eyeW']], dead:[[0,0,'eye'],[2,0,'eye'],[1,1,'eye'],[0,2,'eye'],[2,2,'eye']] }
  const EYE_A = { angry:{l:[[1,0,'eye'],[0,1,'eye'],[1,1,'eye'],[0,2,'eye']], r:[[0,0,'eye'],[0,1,'eye'],[1,1,'eye'],[1,2,'eye']]}, wink:{l:EYE.classic, r:[[0,0,'eye'],[1,0,'eye']]} }
  const MO = { smile:[[-1,0,'mouth'],[0,1,'mouth'],[1,1,'mouth'],[2,0,'mouth']], open:[[0,0,'mouth'],[1,0,'mouth'],[0,1,'mouthIn'],[1,1,'tongue'],[0,2,'mouth'],[1,2,'mouth']], smirk:[[-1,1,'mouth'],[0,0,'mouth'],[1,0,'mouth'],[2,-1,'mouth']], frown:[[-1,1,'mouth'],[0,0,'mouth'],[1,0,'mouth'],[2,1,'mouth']], tongue:[[-1,0,'mouth'],[0,1,'mouth'],[1,1,'mouth'],[2,0,'mouth'],[0,2,'tongue'],[1,2,'tongue']], o:[[0,0,'mouth'],[1,0,'mouth'],[0,1,'mouth'],[1,1,'mouth']], cat:[[-1,0,'mouth'],[0,1,'mouth'],[1,0,'mouth'],[2,1,'mouth'],[3,0,'mouth']], teeth:[[0,0,'mouth'],[1,0,'mouth'],[0,1,'eyeW'],[1,1,'eyeW'],[0,2,'mouth'],[1,2,'mouth']] }

  // KEYS — order matters (cat-editor maps these indices). Basic 4 first.
  const EYE_KEYS = ['classic','round','dot','sleepy','star','heart','sparkle','dead','angry','wink']
  const MO_KEYS  = ['smile','open','smirk','frown','tongue','o','cat','teeth']
  const CHEEK    = ['none','blush','freckles']
  const HEADTOP  = ['none','leaf','droplet','spike','antenna']
  const SHAPE    = ['round','tall','wide','tiny']
  const HEADWEAR = ['bow','crown','witch','santa','party','mushroom','flower','halo','headphones']
  const EARS     = ['cat','bunny','bear']
  const WINGS    = ['angel','demon']
  const ITEM     = ['sword','shield','staff','potion','heart','star','fork']
  const PATTERN  = ['stripes','spots','bicolor']
  const FX       = ['fire','ice','electric']

  // Mascot body sizes (kept for branded zone mascots).
  const SIZES = { tiny:{rx:5,ry:5,cy:23}, small:{rx:6,ry:6,cy:22}, normal:{rx:8,ry:7,cy:22}, big:{rx:10,ry:9,cy:21} }
  function baseBP(shape) {
    switch (shape) {
      case 'tall': return { cx:16, cy:16, rx:10, ry:13, nT:2, nB:2.5 }
      case 'wide': return { cx:16, cy:19, rx:14, ry:9, nT:2, nB:3.5 }
      case 'round': return { cx:16, cy:17, rx:12, ry:11, nT:2, nB:3 }
      default: return { cx:16, cy:22, rx:8, ry:7, nT:2, nB:2.8 }
    }
  }

  // Basic 4 derived FIRST (same order as seedToTraits) → cat-editor stays valid.
  function pickTraits(seed) {
    const r = seedRng(seed)
    const eyes    = EYE_KEYS[r.int(EYE_KEYS.length)]
    const mouth   = MO_KEYS[r.int(MO_KEYS.length)]
    const cheeks  = CHEEK[r.int(CHEEK.length)]
    const headTop0 = HEADTOP[r.int(HEADTOP.length)]
    const shape    = chance(r,.4) ? 'tiny' : SHAPE[r.int(SHAPE.length)]
    const ears     = chance(r,.5) ? 'cat' : EARS[r.int(EARS.length)]
    const headwear = chance(r,.5) ? 'none' : HEADWEAR[r.int(HEADWEAR.length)]
    const wings    = chance(r,.72) ? 'none' : WINGS[r.int(WINGS.length)]
    const item     = chance(r,.68) ? 'none' : ITEM[r.int(ITEM.length)]
    const pattern  = chance(r,.58) ? 'none' : PATTERN[r.int(PATTERN.length)]
    const texture  = chance(r,.72) ? 'normal' : (chance(r,.5) ? 'metallic' : 'ghost')
    const fx       = chance(r,.75) ? 'none' : FX[r.int(FX.length)]
    const aura     = chance(r,.72) ? 'none' : ['holy','dark','fire','ice'][r.int(4)]
    const effect   = chance(r,.68) ? 'none' : ['sparkles','hearts','music','zzz'][r.int(4)]
    const headTop  = headwear !== 'none' ? 'none' : headTop0
    return { eyes, mouth, cheeks, headTop, shape, ears, headwear, wings, item, pattern, texture, fx, aura, effect }
  }

  function paintCheeks(g,i,t){ const sp=Math.round(i.rx*.5),cy=i.eL.y+3; if(t.cheeks==='blush'){px(g,i.cx-sp,cy,'cheek');px(g,i.cx-sp+1,cy,'cheek');px(g,i.cx+sp-1,cy,'cheek');px(g,i.cx+sp,cy,'cheek');}else if(t.cheeks==='freckles'){px(g,i.cx-sp,cy,'freckle');px(g,i.cx-sp+1,cy+1,'freckle');px(g,i.cx+sp,cy,'freckle');px(g,i.cx+sp-1,cy+1,'freckle');} }
  function paintEyes(g,i,t){ const s=EYE[t.eyes],a=EYE_A[t.eyes]; const p=(an,ps)=>{for(const[dx,dy,c]of ps)px(g,an.x+dx,an.y+dy,c);}; if(a){p(i.eL,a.l);p(i.eR,a.r);}else if(s){p(i.eL,s);p(i.eR,s);} }
  function paintMouth(g,i,t){ const d=MO[t.mouth]; if(!d)return; for(const[dx,dy,c]of d)px(g,i.mo.x+dx,i.mo.y+dy,c); }
  function paintHeadTop(g,i,t){ const tp=i.bT,cx=i.cx; if(t.headTop==='leaf'){px(g,cx+1,tp-4,'leafD');px(g,cx,tp-3,'leaf');px(g,cx+1,tp-3,'leafD');px(g,cx-1,tp-2,'leaf');px(g,cx,tp-2,'leaf');px(g,cx,tp-1,'leafD');}else if(t.headTop==='droplet'){px(g,cx-2,tp-2,'droplet');px(g,cx,tp-3,'dropletW');px(g,cx+2,tp-2,'droplet');}else if(t.headTop==='spike'){px(g,cx,tp-4,'spike');px(g,cx,tp-3,'spikeW');px(g,cx-1,tp-2,'spike');px(g,cx,tp-2,'spikeW');px(g,cx+1,tp-2,'spike');px(g,cx,tp-1,'spike');}else if(t.headTop==='antenna'){px(g,cx,tp-4,'antennaT');px(g,cx+1,tp-4,'antennaT');px(g,cx,tp-3,'antenna');px(g,cx,tp-2,'antenna');px(g,cx,tp-1,'antenna');} }
  function paintHeadwear(g,i,t){ const tp=i.bT,cx=i.cx,rx=i.rx,hw=t.headwear; if(hw==='none')return; if(hw==='bow'){const bx=cx+rx-2;px(g,bx-1,tp,'bow');px(g,bx,tp,'bowD');px(g,bx+1,tp,'bow');px(g,bx-1,tp+1,'bow');px(g,bx+1,tp+1,'bow');}else if(hw==='crown'){for(let d=-4;d<=4;d++)px(g,cx+d,tp,d%2?'crown':'crownD');for(let d=-3;d<=3;d++)px(g,cx+d,tp-1,d%2?'crown':'crownD');px(g,cx-3,tp-2,'crown');px(g,cx,tp-2,'gem');px(g,cx+3,tp-2,'crown');}else if(hw==='witch'){for(let d=-5;d<=5;d++)px(g,cx+d,tp,'witchD');for(let d=-4;d<=4;d++)px(g,cx+d,tp-1,'witch');for(let d=-4;d<=4;d++)px(g,cx+d,tp-2,'witchB');for(let d=-3;d<=3;d++)px(g,cx+d,tp-3,'witch');for(let d=-2;d<=2;d++)px(g,cx+d,tp-4,'witch');for(let d=-1;d<=1;d++)px(g,cx+d,tp-5,'witch');px(g,cx,tp-6,'witch');px(g,cx+2,tp-4,'witchStar');}else if(hw==='santa'){for(let d=-5;d<=5;d++)px(g,cx+d,tp,'santaW');for(let d=-4;d<=4;d++)px(g,cx+d,tp-1,'santa');for(let d=-3;d<=3;d++)px(g,cx+d,tp-2,'santa');for(let d=-2;d<=2;d++)px(g,cx+d,tp-3,'santaD');for(let d=-1;d<=1;d++)px(g,cx+d,tp-4,'santaD');px(g,cx,tp-5,'santaD');px(g,cx+4,tp-4,'santaW');px(g,cx+5,tp-5,'santaW');}else if(hw==='party'){for(let d=-4;d<=4;d++)px(g,cx+d,tp,'partyR');for(let d=-3;d<=3;d++)px(g,cx+d,tp-1,d%2?'party':'partyB');for(let d=-2;d<=2;d++)px(g,cx+d,tp-2,d%2?'partyC':'party');for(let d=-1;d<=1;d++)px(g,cx+d,tp-3,'partyB');px(g,cx,tp-4,'partyR');}else if(hw==='mushroom'){for(let d=-4;d<=4;d++)px(g,cx+d,tp-1,'mush');for(let d=-3;d<=3;d++)px(g,cx+d,tp-2,'mush');for(let d=-2;d<=2;d++)px(g,cx+d,tp-3,'mush');px(g,cx-2,tp-2,'mushD');px(g,cx+1,tp-2,'mushD');px(g,cx-1,tp,'mushS');px(g,cx,tp,'mushS');px(g,cx+1,tp,'mushS');}else if(hw==='flower'){const fx=cx-rx+1;px(g,fx,tp,'petal');px(g,fx+1,tp,'petal');px(g,fx-1,tp+1,'petal');px(g,fx,tp+1,'petalC');px(g,fx+1,tp+1,'petalC');px(g,fx+2,tp+1,'petal');px(g,fx,tp+2,'petal');px(g,fx+1,tp+2,'petal');}else if(hw==='halo'){for(let d=-4;d<=4;d++){px(g,cx+d,tp-3,'halo');px(g,cx+d,tp-1,'halo');}px(g,cx-5,tp-2,'haloD');px(g,cx+5,tp-2,'haloD');}else if(hw==='headphones'){for(let d=-rx;d<=rx;d++)px(g,cx+d,tp-1,'hpB');for(let d=-rx+1;d<=rx-1;d++)px(g,cx+d,tp-2,'hpB');for(let d2=0;d2<2;d2++){px(g,i.bL-1,i.eL.y+d2,'hpC');px(g,i.bL-2,i.eL.y+d2,'hpC');px(g,i.bR+1,i.eR.y+d2,'hpC');px(g,i.bR+2,i.eR.y+d2,'hpC');}} }
  function paintEars(g,i,t){ if(t.ears==='none')return; const tp=i.bT,lx=i.bL,rx2=i.bR; if(t.ears==='cat'){px(g,lx,tp-2,'earA');px(g,lx+1,tp-2,'earB');px(g,lx,tp-1,'earA');px(g,lx+1,tp-1,'earA');px(g,rx2,tp-2,'earB');px(g,rx2-1,tp-2,'earA');px(g,rx2,tp-1,'earA');px(g,rx2-1,tp-1,'earA');}else if(t.ears==='bunny'){px(g,lx+1,tp-5,'earA');px(g,lx+1,tp-4,'earA');px(g,lx+1,tp-3,'earA');px(g,lx+1,tp-2,'earB');px(g,lx+1,tp-1,'earB');px(g,rx2-1,tp-5,'earA');px(g,rx2-1,tp-4,'earA');px(g,rx2-1,tp-3,'earA');px(g,rx2-1,tp-2,'earB');px(g,rx2-1,tp-1,'earB');}else if(t.ears==='bear'){px(g,lx-1,tp,'earA');px(g,lx,tp,'earA');px(g,lx-1,tp-1,'earA');px(g,lx,tp-1,'earB');px(g,rx2+1,tp,'earA');px(g,rx2,tp,'earA');px(g,rx2+1,tp-1,'earA');px(g,rx2,tp-1,'earB');} }
  function paintWings(g,i,t){ if(t.wings==='none')return; const cy=i.cy-2,lx=i.bL,rx2=i.bR; if(t.wings==='angel'){px(g,lx-1,cy,'wingW');px(g,lx-2,cy,'wingW');px(g,lx-3,cy-1,'wingW');px(g,lx-1,cy-1,'wingD');px(g,lx-2,cy-1,'wingW');px(g,lx-1,cy+1,'wingD');px(g,rx2+1,cy,'wingW');px(g,rx2+2,cy,'wingW');px(g,rx2+3,cy-1,'wingW');px(g,rx2+1,cy-1,'wingD');px(g,rx2+2,cy-1,'wingW');px(g,rx2+1,cy+1,'wingD');}else if(t.wings==='demon'){px(g,lx-1,cy,'wingDk');px(g,lx-2,cy,'wingDkL');px(g,lx-3,cy-1,'wingDk');px(g,lx-4,cy-2,'wingDk');px(g,lx-1,cy+1,'wingDk');px(g,lx-2,cy-1,'wingDk');px(g,rx2+1,cy,'wingDk');px(g,rx2+2,cy,'wingDkL');px(g,rx2+3,cy-1,'wingDk');px(g,rx2+4,cy-2,'wingDk');px(g,rx2+1,cy+1,'wingDk');px(g,rx2+2,cy-1,'wingDk');} }
  function paintItem(g,i,t){ const h=t.item; if(h==='none')return; const hx=i.bR+2,hy=i.cy; if(h==='sword'){px(g,hx,hy-3,'blade');px(g,hx,hy-2,'blade');px(g,hx,hy-1,'blade');px(g,hx-1,hy,'hilt');px(g,hx,hy,'hilt');px(g,hx+1,hy,'hilt');px(g,hx,hy+1,'hilt');}else if(h==='shield'){px(g,hx,hy-1,'shieldA');px(g,hx+1,hy-1,'shieldA');px(g,hx,hy,'shieldB');px(g,hx+1,hy,'shieldA');px(g,hx,hy+1,'shieldA');px(g,hx+1,hy+1,'shieldA');}else if(h==='staff'){px(g,hx,hy-3,'staffT');px(g,hx,hy-2,'staffW');px(g,hx,hy-1,'staffW');px(g,hx,hy,'staffW');px(g,hx,hy+1,'staffW');}else if(h==='potion'){px(g,hx,hy-1,'potionB');px(g,hx+1,hy-1,'potionB');px(g,hx,hy,'potionG');px(g,hx+1,hy,'potionG');px(g,hx,hy+1,'potionG');px(g,hx+1,hy+1,'potionB');}else if(h==='heart'){px(g,hx,hy-1,'heartI');px(g,hx+2,hy-1,'heartI');px(g,hx,hy,'heartI');px(g,hx+1,hy,'heartI');px(g,hx+2,hy,'heartI');px(g,hx+1,hy+1,'heartI');}else if(h==='star'){px(g,hx+1,hy-2,'starI');px(g,hx,hy-1,'starI');px(g,hx+1,hy-1,'starI');px(g,hx+2,hy-1,'starI');px(g,hx+1,hy,'starI');}else if(h==='fork'){px(g,hx,hy-3,'forkA');px(g,hx-1,hy-3,'forkA');px(g,hx+1,hy-3,'forkA');px(g,hx,hy-2,'forkB');px(g,hx,hy-1,'forkB');px(g,hx,hy,'forkB');} }

  // geom = {cx,cy,rx,ry,nT,nB}
  function buildGrid(t, geom) {
    const { cx, cy, rx, ry, nT, nB } = geom
    const raw = Array.from({ length: H }, () => Array(W).fill(0))
    const clip = Math.min(cy + ry, H - 4)
    for (let y=0;y<H;y++){ if(y>clip)continue; for(let x=0;x<W;x++){ const dx=Math.abs((x+.5-cx)/rx),dy=(y+.5-cy)/ry,n=dy<0?nT:nB; if(Math.pow(dx,n)+Math.pow(Math.abs(dy),n)<1)raw[y][x]=1 } }
    let bL=W,bR=0,bT=H,bB=0
    for (let y=0;y<H;y++)for(let x=0;x<W;x++)if(raw[y][x]){ if(x<bL)bL=x;if(x>bR)bR=x;if(y<bT)bT=y;if(y>bB)bB=y }
    const bW=Math.max(1,bR-bL),bH=Math.max(1,bB-bT)
    const g=raw.map(r=>r.map(v=>v?'s3':null))
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(!raw[y][x])continue; const br=1-((x-bL)/bW*.55+(y-bT)/bH*.45); g[y][x]=br>.78?'s5':br>.58?'s4':br>.38?'s3':br>.2?'s2':'s1' }
    const hlx=cx-rx*.3,hly=cy-ry*.35,hlr=Math.max(2,rx*.2),hlry=Math.max(2,ry*.18)
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(!g[y][x])continue; const d2=(x+.5-hlx)/hlr,d3=(y+.5-hly)/hlry; if(d2*d2+d3*d3<1)g[y][x]='shine' }
    if(t.pattern==='stripes')for(let y=bT;y<=bB;y++){ if((y-bT)%3===0)for(let x=bL;x<=bR;x++)if(g[y][x]&&g[y][x]!=='shine')g[y][x]='pat' }
    else if(t.pattern==='spots')for(let y=bT+1;y<bB;y++)for(let x=bL+1;x<bR;x++){ if((x*7+y*13)%11===0&&g[y][x]&&g[y][x]!=='shine')g[y][x]='pat' }
    else if(t.pattern==='bicolor'){ const sp=bT+Math.round((bB-bT)*.55); for(let y=sp;y<=bB;y++)for(let x=0;x<W;x++)if(g[y][x]&&g[y][x]!=='shine')g[y][x]='pat' }
    if(t.texture==='metallic')for(let y=bT+2;y<bB-1;y+=3)for(let x=bL+2;x<bR-1;x+=4)if(g[y][x]&&g[y][x]!=='outline')g[y][x]='metalA'
    if(t.fx&&t.fx!=='none'){ for(let y=bT;y<=bB;y++)for(let x=bL;x<=bR;x++){ if(!raw[y][x])continue; let near=false; for(const[dx2,dy2]of[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const nx=x+dx2,ny=y+dy2;if(nx<0||ny<0||nx>=W||ny>=H||!raw[ny][nx]){near=true;break;}} if(!near)continue; const h2=(x*3+y*7)%7; if(t.fx==='fire'&&h2<2)g[y][x]=h2===0?'fxFire':'fxFireB'; else if(t.fx==='ice'&&h2<2)g[y][x]=h2===0?'fxIce':'fxIceB'; else if(t.fx==='electric'&&h2<1)g[y][x]='fxElec' } }
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(!g[y][x])continue; for(const[dx2,dy2]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx2,ny=y+dy2;if(nx<0||ny<0||nx>=W||ny>=H||!raw[ny][nx]){ if(raw[y][x])g[y][x]='outline'; break }} }
    const eyeY=Math.round(cy-ry*.18),gap=Math.max(2,Math.round(rx*.28))
    const info={ cx,cy,rx,ry,bT,bB,bL,bR, eL:{x:cx-gap-1,y:eyeY}, eR:{x:cx+gap,y:eyeY}, mo:{x:cx,y:Math.round(cy+ry*.15)}, raw }
    paintCheeks(g,info,t); paintEyes(g,info,t); paintMouth(g,info,t); paintHeadTop(g,info,t); paintHeadwear(g,info,t); paintEars(g,info,t); paintWings(g,info,t); paintItem(g,info,t)
    const shCy=cy+ry+2, shRx=Math.round(rx*.65)
    for(let x=cx-shRx;x<=cx+shRx;x++){ if(x>=0&&x<W&&shCy<H&&!g[shCy][x])g[shCy][x]='shadow' }
    return { g, info }
  }

  function overlay(g, info, t) {
    const i = info
    if (t.effect==='sparkles'){ for(const[sx,sy]of[[3,5],[i.bR+2,i.bT-1]]){px(g,sx,sy-1,'effA');px(g,sx-1,sy,'effA');px(g,sx,sy,'effA');px(g,sx+1,sy,'effA');px(g,sx,sy+1,'effA');} }
    else if (t.effect==='hearts'){ const d=(sx,sy)=>{px(g,sx,sy,'effB');px(g,sx+2,sy,'effB');px(g,sx,sy+1,'effB');px(g,sx+1,sy+1,'effB');px(g,sx+2,sy+1,'effB');px(g,sx+1,sy+2,'effB');}; d(i.bR+1,i.bT-2); }
    else if (t.effect==='music'){ const d=(sx,sy)=>{px(g,sx+1,sy,'effA');px(g,sx+1,sy+1,'effA');px(g,sx,sy+2,'effA');px(g,sx,sy+3,'effA');}; d(i.bR+1,i.bT-3); }
    else if (t.effect==='zzz'){ px(g,i.bR+1,i.bT-4,'effD');px(g,i.bR+2,i.bT-4,'effD');px(g,i.bR+2,i.bT-3,'effD');px(g,i.bR+1,i.bT-2,'effD'); }
    if (t.aura && t.aura!=='none' && info.raw){ for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(info.raw[y]&&info.raw[y][x])continue; if(g[y][x])continue; let adj=false; for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H&&info.raw[ny]&&info.raw[ny][nx]){adj=true;break;}} if(!adj)continue; const h2=(x*7+y*13)%9; if(t.aura==='holy'&&h2<2)g[y][x]='auraHoly'; else if(t.aura==='dark'&&h2<3)g[y][x]='auraDark'; else if(t.aura==='fire'&&y>info.cy&&h2<2)g[y][x]='auraFire'; else if(t.aura==='ice'&&h2<2)g[y][x]='auraIce' } }
  }

  function gridToSvg(g, p) {
    let body = ''
    for (let y=0;y<H;y++){ let x=0; while(x<W){ const k=g[y][x]; if(!k){x++;continue} let run=1; while(x+run<W&&g[y][x+run]===k)run++; body+=`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${p[k]||k}"/>`; x+=run } }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" style="image-rendering:pixelated">${body}</svg>`
  }

  // ── public API (firmas mantenidas) ──
  window.generateCatSvg = function (seed, colorName) {
    const t = pickTraits(seed)
    const base = (typeof colorHex === 'function' ? colorHex(colorName) : null) || '#a6c081'
    const { g, info } = buildGrid(t, baseBP(t.shape))
    overlay(g, info, t)
    return gridToSvg(g, pal(base))
  }

  // Branded mascots: explicit basic traits, no extras, cat ears, custom size.
  window.generatePoporingFromTraits = function (traits, colorName, size) {
    const t = {
      eyes: traits.eyes || 'classic', mouth: traits.mouth || 'smile',
      cheeks: traits.cheeks || 'blush', headTop: traits.headTop || 'none',
      ears: 'cat', headwear: 'none', wings: 'none', item: 'none',
      pattern: 'none', texture: 'normal', fx: 'none', aura: 'none', effect: 'none',
    }
    const base = (typeof colorHex === 'function' ? colorHex(colorName) : null) || colorName || '#a6c081'
    const sz = SIZES[size] || SIZES.normal
    const { g } = buildGrid(t, { cx:16, cy:sz.cy, rx:sz.rx, ry:sz.ry, nT:2, nB:2.8 })
    return gridToSvg(g, pal(base))
  }
  window.POPORING_SIZES = Object.keys(SIZES)

  // cat-editor support: edits the 4 basic traits (derived first from the seed).
  window.POPORING_TRAITS = {
    eyes:    { name: 'ojos',     options: EYE_KEYS, labels: ['clásicos','redondos','punto','dormidos','estrella','corazón','brillo','muertos','enfadados','guiño'] },
    mouth:   { name: 'boca',     options: MO_KEYS,  labels: ['sonrisa','abierta','sonrisilla','ceño','lengua','o','gato','dientes'] },
    cheeks:  { name: 'mejillas', options: CHEEK,    labels: ['sin','rojas','pecas'] },
    headTop: { name: 'cabeza',   options: HEADTOP,  labels: ['nada','hoja','gota','pincho','antena'] },
  }

  window.seedToTraits = function (seed) {
    const r = seedRng(seed)
    return { eyes: r.int(EYE_KEYS.length), mouth: r.int(MO_KEYS.length), cheeks: r.int(CHEEK.length), headTop: r.int(HEADTOP.length) }
  }

  window.traitsToSeed = function (traits) {
    for (let seed = 0; seed < 200000; seed++) {
      const r = seedRng(seed)
      if (r.int(EYE_KEYS.length) !== traits.eyes) continue
      if (r.int(MO_KEYS.length) !== traits.mouth) continue
      if (r.int(CHEEK.length) !== traits.cheeks) continue
      if (r.int(HEADTOP.length) !== traits.headTop) continue
      return seed
    }
    return Math.floor(Math.random() * 0xFFFFFFFF)
  }
})()
