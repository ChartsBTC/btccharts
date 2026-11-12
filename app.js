const $=id=>document.getElementById(id);
const LW=LightweightCharts;

const PUBLIC_CHART_BASE='https://chartsbtc.github.io/btccharts/';
const ADVANCED_HASH_IDS=['cy','ll','pl','vt','rp','rpl','ep','ch','cl','hv','pma','pmm','rm','rn','rcl','pb','pbp','blp','blw','da','ca','cp','ym','otd','ott','rb','an'];
function isClassicPage(){return window.CHART_PAGE==='classic'}
function isAdvancedPage(){return window.CHART_PAGE==='advanced'}
function hashHasAdvanced(hash){
  const parts=String(hash||'').replace(/^#/,'').split('z').filter(Boolean);
  const ids=ADVANCED_HASH_IDS.slice().sort((a,b)=>b.length-a.length);
  return parts.some(part=>ids.some(id=>part===id||part.startsWith(id+'g')));
}
function siteRootPath(){
  let path=location.pathname;
  path=path.replace(/\/index\.html$/,'/');
  if(path.endsWith('/advanced/')) path=path.slice(0,-'advanced/'.length);
  else if(/\/advanced$/.test(path)) path=path.replace(/\/advanced$/,'/');
  if(!path.endsWith('/')) path=path.replace(/[^/]+$/,'');
  return path;
}
function pageHref(which, hash){
  const h=String(hash||'').replace(/^#/,'');
  const root=siteRootPath();
  return (which==='advanced'?root+'advanced/':root)+(h?'#'+h:'');
}
function publicPageUrl(which, hash){
  const h=String(hash||'').replace(/^#/,'');
  const base=PUBLIC_CHART_BASE.replace(/\/?$/,'/');
  return (which==='advanced'?base+'advanced/':base)+(h?'#'+h:'');
}



const THEME_KEY='btccharts-theme';
function systemDark(){return !!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)}
function isDark(){return document.documentElement.classList.contains('dark')}
function chartTheme(){
  if(isDark()){
    return {
      bg:'#121212', text:'#e6e6e6', grid:'#2a2a2a', border:'#444',
      cross:'#888', title:'#eee', sub:'#ffb74d',
      exportBg:'#121212', exportTitle:'#eee', muted:'#aaa',
      wmFill:'rgba(255,255,255,0.55)', wmStroke:'rgba(0,0,0,0.65)',
      boxBg:'rgba(24,24,24,0.92)', boxStroke:'#aaa',
    };
  }
  return {
    bg:'#fff', text:'#333', grid:'#eee', border:'#ccc',
    cross:'#999', title:'#222', sub:'#b86a00',
    exportBg:'#fff', exportTitle:'#222', muted:'#666',
    wmFill:'rgba(40,40,40,0.4)', wmStroke:'rgba(255,255,255,0.8)',
    boxBg:'rgba(255,255,255,0.92)', boxStroke:'#333',
  };
}
function applyTheme(dark, opts){
  opts=opts||{};
  dark=!!dark;
  document.documentElement.classList.toggle('dark',dark);
  document.body.classList.toggle('dark',dark);
  const btn=$('themeToggle');
  if(btn) btn.textContent=dark?'Light':'Dark';
  if(typeof syncEpochColors==='function') syncEpochColors();
  if(!opts.skipSave){
    try{localStorage.setItem(THEME_KEY, dark?'dark':'light')}catch(e){}
  }
}
function initTheme(){
  const parts=(location.hash||'').slice(1).split('z').filter(Boolean);
  if(parts.includes('dk')){applyTheme(true);return}
  let saved=null;
  try{saved=localStorage.getItem(THEME_KEY)}catch(e){}
  if(saved==='dark'||saved==='light') applyTheme(saved==='dark',{skipSave:true});
  else applyTheme(systemDark(),{skipSave:true});
}


const FIELDS=['m','r','i','c','s','e','t','b','a1','m1','a2','m2','x','i1','i2','i3','i4','v','cv','l','p','da','cy','ca','cp','ch','cl','hv','ll','pl','ep','rp','rpl','vt','pma','pmm','rm','rn','rcl','pb','pbp','blp','blw','ym','otd','ott','rb','an'];
// populate indicator selects (only implemented ones, original naming)
document.querySelectorAll('select.ind').forEach(s=>{s.innerHTML='<option value="">None</option>'+Object.entries(INDICATORS).map(([k,v])=>`<option value="${k}">${v.label.replace(/ \(.*/,'')}</option>`).join('')});

// ---- URL hash: <id>g<value> joined by z (bitcoincharts format) ----
function buildHash(){const h=[];const skip=isClassicPage()?new Set(ADVANCED_HASH_IDS):null;
  for(const id of FIELDS){if(skip&&skip.has(id))continue;const e=$(id);if(!e)continue;
  if(e.type==='checkbox'){if(e.checked)h.push(id)}else if(e.value)h.push(id+'g'+escape(e.value))}
  if(typeof isDark==='function'&&isDark())h.push('dk');
  return h.join('z')}
function parseHash(hash){ if(!hash)return;
  // reset everything to blank/unchecked; hash fully describes state (original reset v,t,r)
  for(const id of FIELDS){const e=$(id);if(!e)continue;if(id==='m'){e.value='combinedUSD';continue}if(e.type==='checkbox')e.checked=false;else e.value=({m1:'10',m2:'25',ca:'low',cp:'usd',pma:'200d',pmm:'panel',rm:'cagr',rn:'4',pb:'1, 5, 20, 50, 80, 95, 99',blw:'50',ym:'raw',rb:'decade'})[id]||''}
  // Longest-id match so values may contain "g" (e.g. mgmtgoxUSD). The original split("g") would turn that into mtogxUSD.
  const ids=FIELDS.slice().sort((a,b)=>b.length-a.length);
  for(const part of hash.split('z')){const id=ids.find(x=>part===x||part.startsWith(x+'g'));if(!id)continue;const e=$(id);
    if(e.type==='checkbox')e.checked=true;else e.value=unescape(part.slice(id.length+1))}}
function syncCustom(){ $('CustomTimeBox').style.display=$('c').checked?'block':'none'; $('r').style.display=$('c').checked?'none':'';}
function syncViewToggle(){
  const vt=($('vt')&&$('vt').value)||'';
  if(vt && $('cy').checked) $('cy').checked=false;
  const on=$('cy').checked;
  document.body.classList.toggle('cycles-view',on);
  document.body.classList.toggle('scout-view',!!vt && !on);
  document.body.classList.toggle('scout-powerlaw',vt==='powerlaw' && !on);
  document.body.classList.toggle('scout-drawdown',vt==='drawdown' && !on);
  document.body.classList.toggle('scout-ath',vt==='ath' && !on);
  document.body.classList.toggle('scout-sats',vt==='sats' && !on);
  document.body.classList.toggle('scout-pricema',vt==='pricema' && !on);
  document.body.classList.toggle('scout-osc',vt==='pricema' && ($('pmm')&&$('pmm').value==='osc') && !on);
  document.body.classList.toggle('scout-returns',vt==='returns' && !on);
  document.body.classList.toggle('scout-epoch',vt==='epoch' && !on);
  document.body.classList.toggle('scout-calyear',vt==='calyear' && !on);
  document.body.classList.toggle('scout-onthisday',vt==='onthisday' && !on);
  document.body.classList.toggle('scout-hcycles',vt==='hcycles' && !on);
  document.body.classList.toggle('scout-ranges',vt==='ranges' && !on);
  if(vt==='onthisday' && typeof syncOnThisDayUi==='function') syncOnThisDayUi();
  document.body.classList.toggle('mode-mult',vt==='returns' && ($('rm')&&$('rm').value==='mult') && !on);
  document.querySelectorAll('#viewToggle button').forEach(b=>b.classList.toggle('on',(b.dataset.cy==='1')===on && !vt));
  if(!vt && !on) document.querySelectorAll('#viewToggle button').forEach(b=>b.classList.toggle('on',(b.dataset.cy==='1')===false));
  $('main').classList.toggle('cycles',on);
  const pmo=$('priceMaOpts'); if(pmo) pmo.hidden=!(vt==='pricema' && !on);
  const ro=$('returnsOpts'); if(ro) ro.hidden=!(vt==='returns' && !on);
  const yo=$('yearOpts'); if(yo) yo.hidden=!(vt==='calyear' && !on);
  const oo=$('otdOpts'); if(oo) oo.hidden=!(vt==='onthisday' && !on);
  const rbo=$('rangeOpts'); if(rbo) rbo.hidden=!(vt==='ranges' && !on);
  const showPct=!on && (vt==='powerlaw' || (vt==='pricema' && !($('pmm')&&$('pmm').value==='osc')) || (!vt && typeof ratioKind==='function' && ratioKind()));
  document.body.classList.toggle('has-pct-bands', showPct);
  const pbo=$('pctBandOpts'); if(pbo) pbo.hidden=!showPct;
  const bo=$('blendOpts'); if(bo) bo.hidden=!(vt==='powerlaw' && !on);
  if($('blwVal')&&$('blw')) $('blwVal').textContent=$('blw').value;
}


function fmtD(d){return d.toISOString().slice(0,10)}
function setCustomDefaults(){const d=parseInt($('r').value)||29;const now=new Date();
  if(!$('s').value)$('s').value=fmtD(new Date(now-(d-1)*864e5));if(!$('e').value)$('e').value=fmtD(new Date(+now+864e5));}


function isCyclePreset(v){return typeof v==='string'&&/^c(\d{4}|current)$/.test(v)}
let cyclePresetCache=null, cyclePresetAsOf=0;
async function loadDetectedCycles(){
  const raw=await getDaily('combinedUSD');
  const last=raw.length?raw[raw.length-1][0]:0;
  if(cyclePresetCache&&cyclePresetAsOf===last) return cyclePresetCache;
  cyclePresetAsOf=last;
  return cyclePresetCache=detectCycles(raw.map(toBar));
}
async function resolveCyclePreset(code){
  const cycles=await loadDetectedCycles();
  const c=code==='ccurrent'?(cycles.find(x=>x.open)||cycles.at(-1)):cycles.find(x=>x.year===+code.slice(1));
  if(!c) throw new Error('Unknown cycle preset: '+code);
  const start=c.startLow.time;
  const end=c.open?Math.floor(Date.now()/1000):(c.endLow.time+86400);
  return {start,end,cycle:c};
}


function nearestBar(t){
  if(!bars.length) return null;
  let best=bars[0], bd=Math.abs(bars[0].time-t);
  for(const b of bars){const d=Math.abs(b.time-t); if(d<bd){bd=d;best=b}}
  return best;
}
async function priceEventMarkers(){
  const marks=[];
  if(!bars.length||!($('ch')&&($('ch').checked||$('cl').checked||$('hv').checked))) return marks;
  const t0=bars[0].time, t1=bars.at(-1).time;
  const seen=new Set();
  const add=(t,m)=>{const b=nearestBar(t); if(!b) return; if(seen.has(b.time+'|'+m.text)) return; seen.add(b.time+'|'+m.text); marks.push({...m,time:b.time})}
  if($('ch').checked||$('cl').checked){
    const cycles=await loadDetectedCycles();
    for(const c of cycles){
      if($('ch').checked && c.high.time>=t0 && c.high.time<=t1){
        add(c.high.time,{position:'aboveBar',color:'#2e7d32',shape:'arrowDown',text:'H '+c.high.date+' $'+usd(c.high.price),price:c.high.price});
      }
      if($('cl').checked){
        const lows=[{...c.startLow,soFar:false}];
        if(c.endLow && c.endLow.time!==c.startLow.time) lows.push({...c.endLow,soFar:!!c.lowSoFar});
        for(const lo of lows){
          if(lo.time<t0||lo.time>t1) continue;
          add(lo.time,{position:'belowBar',color:'#c62828',shape:'arrowUp',text:(lo.soFar?'L so far ':'L ')+lo.date+' $'+usd(lo.price),price:lo.price});
        }
      }
    }
  }
  if($('hv').checked){
    for(const h of HALVINGS){
      if(h.time<t0-40*86400||h.time>t1+40*86400) continue;
      const b=nearestBar(h.time);
      if(!b||Math.abs(b.time-h.time)>40*86400) continue;
      add(h.time,{position:'aboveBar',color:'#6a1b9a',shape:'circle',text:'Halving '+h.label+' $'+usd(b.close),price:b.close});
    }
  }
  return marks;
}

// ---- charts ----
let charts=[],bars=[],syncing=false;
function mkChart(el,opts={}){const th=chartTheme();return LW.createChart(el,{autoSize:true,layout:{background:{color:th.bg},textColor:th.text,fontSize:11},
  grid:{vertLines:{color:th.grid},horzLines:{color:th.grid}},rightPriceScale:{borderColor:th.border},leftPriceScale:{borderColor:th.border},
  timeScale:{borderColor:th.border,timeVisible:true,secondsVisible:false,minBarSpacing:0.05},crosshair:{mode:0,vertLine:{color:th.cross},horzLine:{color:th.cross}},...opts})}
const ser=(arr)=>bars.map((b,i)=>arr[i]==null||!isFinite(arr[i])?{time:b.time}:{time:b.time,value:arr[i]});
let uplot=null,lastMarks=[];
const GENESIS=Date.UTC(2009,0,3)/1000;
const daysSinceGenesis=t=>(t-GENESIS)/86400;

function yearAtDays(d){
  return new Date((GENESIS+d*86400)*1000).getUTCFullYear();
}
function logLogDayTicks(min,max,dataMin,dataMax){
  let lo=Math.max(1,min||1), hi=Math.max(lo*1.01,max||lo*10);
  // Keep left-padded ticks (e.g. 500d) if the scale shows them, but never
  // label days past the last bar (avoids 2028 / 2036 past the data).
  if(dataMax!=null) hi=Math.min(hi,dataMax);
  if(!(hi>lo)) return [];
  const span=Math.log10(hi/Math.max(lo,dataMin||lo));
  const minors=span>1.0?[1,2,3,5]:span>0.55?[1,1.5,2,3,4,5,7]:[1,1.2,1.5,2,2.5,3,4,5,6,7,8,9];
  const out=[];
  const e0=Math.floor(Math.log10(lo))-1, e1=Math.ceil(Math.log10(hi))+1;
  for(let e=e0;e<=e1;e++){
    const base=10**e;
    if(base<=0) continue;
    for(const m of minors){
      const d=m*base;
      if(d>=lo&&d<=hi) out.push(d);
    }
  }
  return [...new Set(out)].sort((a,b)=>a-b);
}
function drawLogLogXLabels(u){
  const min=u.scales.x.min, max=u.scales.x.max;
  if(min==null||max==null) return;
  const ctx=u.ctx, pr=u.pxRatio||window.devicePixelRatio||1;
  const xs=u.data&&u.data[0];
  const ticks=logLogDayTicks(min,max,xs&&xs[0],xs&&xs[xs.length-1]);
  ctx.save();
  // The series pass may leave a clip on the plot box; labels sit in the axis band.
  ctx.beginPath();
  ctx.rect(0,0,u.width*pr,u.height*pr);
  ctx.clip();
  ctx.font=(11*pr)+'px Verdana,Arial,sans-serif';
  ctx.fillStyle='#333';
  ctx.textAlign='center';
  ctx.textBaseline='top';
  const axisY=(u.bbox.top+u.bbox.height)+5*pr;
  let lastX=-1e9;
  const minGap=70*pr;
  const left=u.bbox.left, right=u.bbox.left+u.bbox.width;
  for(const d of ticks){
    const x=u.valToPos(d,'x',true);
    if(!isFinite(x)||x<left-4*pr||x>right+4*pr) continue;
    if(x-lastX<minGap) continue;
    const dayLab=Math.round(d)+'d';
    ctx.font=(11*pr)+'px Verdana,Arial,sans-serif';
    ctx.fillStyle='#333';
    ctx.fillText(dayLab,x,axisY);
    ctx.font=(10*pr)+'px Verdana,Arial,sans-serif';
    ctx.fillStyle='#555';
    ctx.fillText(String(yearAtDays(d)),x,axisY+13*pr);
    lastX=x;
  }
  ctx.restore();
}


function fitPowerLaw(sample){
  const xs=[],ys=[],used=[];
  for(const b of sample||[]){
    const d=daysSinceGenesis(b.time), p=b.close;
    if(!(d>0)||!(p>0)) continue;
    xs.push(Math.log10(d)); ys.push(Math.log10(p)); used.push(b);
  }
  const n=xs.length; if(n<3) return null;
  let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=0;i<n;i++){sx+=xs[i];sy+=ys[i];sxx+=xs[i]*xs[i];sxy+=xs[i]*ys[i]}
  const den=n*sxx-sx*sx; if(Math.abs(den)<1e-18) return null;
  const b=(n*sxy-sx*sy)/den, a=(sy-b*sx)/n, ymean=sy/n;
  let ssTot=0,ssRes=0;
  for(let i=0;i<n;i++){const yhat=a+b*xs[i];ssRes+=(ys[i]-yhat)**2;ssTot+=(ys[i]-ymean)**2}
  const r2=ssTot>0?1-ssRes/ssTot:0, sigma=Math.sqrt(ssRes/Math.max(1,n-2));
  return {a,b,r2,sigma,n,from:isoUTC(used[0].time),to:isoUTC(used.at(-1).time),t0:used[0].time,t1:used.at(-1).time};
}
function powerLawPrice(days,a,b){return Math.pow(10,a+b*Math.log10(days))}
function powerLawLegendText(fit){
  if(!fit) return '';
  const a=fit.a.toFixed(3), b=(fit.b>=0?'+ ':'- ')+Math.abs(fit.b).toFixed(3);
  return 'Power law:  log\u2081\u2080(price) = '+a+' '+b+'\u00b7log\u2081\u2080(days)   \u00b7   R\u00b2='+fit.r2.toFixed(3)+'   \u00b7   fit '+fit.from+'\u2013'+fit.to+' (n='+fit.n+')';
}
function setPlLegend(fit){
  window.lastPowerFit=fit||null;
  const el=$('plLegend'); if(!el) return;
  if(fit&&$('pl')&&$('pl').checked){el.hidden=false;el.textContent=powerLawLegendText(fit)}
  else{el.hidden=true;el.textContent=''}
}
function visiblePriceBars(chart){
  let src=bars.filter(b=>b&&b.close>0);
  if(chart&&chart.timeScale){
    const vr=chart.timeScale().getVisibleRange();
    if(vr){
      const vis=src.filter(b=>b.time>=vr.from&&b.time<=vr.to);
      // A fresh fitContent can clip a few edge bars; if nearly all data is
      // on screen, fit the full loaded window (market / cycle preset).
      if(vis.length>=src.length*0.95) return src;
      return vis;
    }
  }
  return src;
}
function powerLawPoints(fit,t0,t1,n){
  n=n||240; const mid=[],lo=[],hi=[];
  const d0=Math.max(1e-6,daysSinceGenesis(t0)), d1=Math.max(d0*1.001,daysSinceGenesis(t1));
  const k=Math.pow(10,fit.sigma);
  for(let i=0;i<n;i++){
    const d=d0*Math.pow(d1/d0,i/(n-1)), t=Math.round(GENESIS+d*86400), p=powerLawPrice(d,fit.a,fit.b);
    mid.push({time:t,value:p}); lo.push({time:t,value:p/k}); hi.push({time:t,value:p*k});
  }
  return {mid,lo,hi};
}
function applyPowerLawLW(chart){
  if(!chart||!($('pl')&&$('pl').checked)){setPlLegend(null);return null}
  const sample=visiblePriceBars(chart);
  const fit=fitPowerLaw(sample);
  setPlLegend(fit);
  if(!fit){
    if(plSeries.mid){plSeries.mid.setData([]);plSeries.lo.setData([]);plSeries.hi.setData([])}
    return null;
  }
  const vr=chart.timeScale().getVisibleRange();
  const t0=vr?vr.from:fit.t0, t1=vr?vr.to:fit.t1;
  const pts=powerLawPoints(fit,t0,t1);
  if(!plSeries.mid){
    const sty={priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false};
    plSeries.hi=chart.addLineSeries({color:'rgba(247,147,26,0.4)',lineWidth:1,lineStyle:2,...sty});
    plSeries.lo=chart.addLineSeries({color:'rgba(247,147,26,0.4)',lineWidth:1,lineStyle:2,...sty});
    plSeries.mid=chart.addLineSeries({color:'#f7931a',lineWidth:2,...sty});
  }
  plSeries.hi.setData(pts.hi); plSeries.lo.setData(pts.lo); plSeries.mid.setData(pts.mid);
  return fit;
}
function drawPowerLawUplot(u,xs,barAt){
  if(!($('pl')&&$('pl').checked)){setPlLegend(null);return}
  const min=u.scales.x.min, max=u.scales.x.max;
  const sample=barAt.filter((b,i)=>xs[i]>=min&&xs[i]<=max);
  const fit=fitPowerLaw(sample);
  setPlLegend(fit);
  if(!fit) return;
  const ctx=u.ctx, pr=u.pxRatio||window.devicePixelRatio||1;
  const d0=Math.max(min,1e-6), d1=Math.max(d0*1.001,max), N=240, k=Math.pow(10,fit.sigma);
  ctx.save();
  ctx.beginPath();
  ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
  ctx.clip();
  ctx.beginPath();
  for(let i=0;i<=N;i++){
    const d=d0*Math.pow(d1/d0,i/N), p=powerLawPrice(d,fit.a,fit.b)*k;
    const x=u.valToPos(d,'x',true), y=u.valToPos(p,'y',true);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  for(let i=N;i>=0;i--){
    const d=d0*Math.pow(d1/d0,i/N), p=powerLawPrice(d,fit.a,fit.b)/k;
    ctx.lineTo(u.valToPos(d,'x',true),u.valToPos(p,'y',true));
  }
  ctx.closePath();
  ctx.fillStyle='rgba(247,147,26,0.15)';
  ctx.fill();
  ctx.beginPath();
  for(let i=0;i<=N;i++){
    const d=d0*Math.pow(d1/d0,i/N), p=powerLawPrice(d,fit.a,fit.b);
    const x=u.valToPos(d,'x',true), y=u.valToPos(p,'y',true);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.strokeStyle='#f7931a';
  ctx.lineWidth=2*pr;
  ctx.stroke();
  ctx.restore();
}

let plSeries={};
function clearCharts(){charts.forEach(c=>c.remove());charts=[];plSeries={};if(uplot){try{uplot.destroy()}catch(e){} uplot=null}if(typeof clearScoutPlots==='function')clearScoutPlots();if($('main'))$('main').querySelectorAll('.uplot').forEach(n=>n.remove());$('subs').innerHTML='';document.body.classList.remove('loglog-view','scout-view','scout-powerlaw','scout-drawdown','scout-ath','scout-sats','scout-pricema','scout-osc','scout-returns','mode-mult','scout-blend','scout-epoch','scout-calyear','scout-onthisday','has-otd-table','scout-hcycles','scout-ranges');if(typeof setEpochLegend==='function')setEpochLegend(false);window.lastRatio=null;if($('plLegend')&&!($('pl')&&$('pl').checked)){$('plLegend').hidden=true;$('plLegend').textContent=''}}

async function draw(pushUrl){
  const hash=buildHash();
  const url=location.pathname+location.search+'#'+hash;
  if($('permalink'))$('permalink').value=location.origin+url;
  if(pushUrl===1)history.pushState(hash,'',url);else if(pushUrl===2)history.replaceState(hash,'',url);
  syncViewToggle();syncScaleToggle();
  if($('cy').checked){await drawCycles();return}
  // time window
  const now=Math.floor(Date.now()/1000);let start,end=now,days;
  if(isCyclePreset($('r').value)){
    try{const range=await resolveCyclePreset($('r').value);start=range.start;end=range.end;days=(end-start)/86400}
    catch(e){status('Error: '+e.message);return}
  }else if($('c').checked){start=Date.parse($('s').value)/1000;end=Math.min(now,Date.parse($('e').value)/1000||now);days=(end-start)/86400}
  else if($('r').value){days=+$('r').value;start=now-days*86400}
  else {days=99999;start=0;} // All Data: from the selected market's first cached bar
  const interval=$('i').value||autoInterval(days);
  status('Loading '+interval+' candles…');
  try{bars=await loadBars(interval,start,end,(n,t)=>status(`Loading ${interval} candles… page ${n}/${t}`))}
  catch(e){status('Error: '+e.message);return}
  if(!bars.length){status('No data returned.');return}
  const m=currentMarket();
  status(`${bars.length} ${interval} bars · ${marketLabel(m)} · last ${bars.at(-1).close.toFixed(2)} USD`+(bars._note||''));
  const note=$('sourceNote');
  if(note) note.textContent=(m==='combinedUSD'?SPLICE+' ':'')+'Daily history cached locally. Fine intervals for Coinbase/Bitstamp are fetched live.';
  if(typeof scoutView==='function'&&scoutView()){
    if(await renderScout(scoutView())){if(tableOpen)showTable();else clear_table();return}
  }
  const marks=await priceEventMarkers();
  render(interval,marks);if(tableOpen)showTable();else clear_table();
}
let cycleSeries=[];
async function drawCycles(){
  status('Loading Combined daily history…');
  let all;
  try{all=await getDaily('combinedUSD')}catch(e){status('Error: '+e.message);return}
  all=all.map(toBar);
  if(!all.length){status('No data returned.');return}
  const cycles=detectCycles(all);
  const align=$('ca').value||'low';
  const mode=$('cp').value||CYCLE_PRICE_MODE;
  cycleSeries=buildCycleSeries(all,cycles,align,mode);
  let statusExtra=cycleModeLabel(mode);
  if(mode!=='usd'){
    const ref=currentCycleScaleRef(cycleSeries,mode);
    if(ref) statusExtra+=(mode==='high'
      ?` · right axis: current cycle (100% = $${usd(ref)})`
      :` · right axis: current cycle (1x = $${usd(ref)})`);
  }
  status(`${cycleSeries.length} cycles · Combined daily · align by ${align} · ${statusExtra}`);
  if($('sourceNote')) $('sourceNote').textContent='Cycles use Combined history (daily). '+SPLICE;
  $('cycleTable').innerHTML=cycleTableHtml(cycles);
  $('cycleLegend').innerHTML=cycleLegendHtml(cycleSeries);
  renderCycles(align,mode);
  if(tableOpen)showTable();else clear_table();
}
function cycleUsdAxisFormat(v, isLog){
  if(v==null||!isFinite(v)||v<=0)return '';
  if(isLog) return '$'+compact(v);
  if(v>=100) return '$'+v.toLocaleString('en-US',{maximumFractionDigits:0});
  return '$'+(+v.toPrecision(3));
}
function scaledVisibleMinMax(lines, chart){
  let from=-Infinity,to=Infinity;
  const vr=chart.timeScale().getVisibleRange();
  if(vr){from=vr.from;to=vr.to}
  let min=Infinity,max=-Infinity;
  for(const line of lines){
    for(const p of line.pts){
      if(p.value==null||!(p.value>0)) continue;
      if(p.time<from||p.time>to) continue;
      if(p.value<min)min=p.value;
      if(p.value>max)max=p.value;
    }
  }
  if(!isFinite(min)) return null;
  if(!(max>min)){max=min*1.01;min=min*0.99}
  return {min,max};
}
function renderCycles(align, mode){
  clearCharts();syncScaleToggle();
  $('charts').classList.remove('has-volume');
  mode=mode||$('cp').value||'usd';
  const isLog=$('l').checked;
  const stacked=mode==='usd';
  const ref=stacked?null:currentCycleScaleRef(cycleSeries,mode);
  const mul=(!stacked&&ref)?(mode==='high'?ref/100:ref):null;
  const leftFmt=v=>{
    if(v==null||!isFinite(v)||v<=0)return '';
    if(stacked) return isLog?compact(v):v.toLocaleString('en-US',{maximumFractionDigits:v>=100?0:2});
    return cyclePriceFormat(v, mode);
  };
  const rightFmt=v=>cycleUsdAxisFormat(v,isLog);
  const scaleMode=isLog?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal;
  const margins={top:.08,bottom:.06};
  // Do not set localization.priceFormatter in scaled mode: it overrides every scale
  // and would paint the right-axis USD ticks with the left-axis “x” / “%” formatter.
  const loc=stacked
    ? {priceFormatter:leftFmt,timeFormatter:t=>'Day '+cycleAxisLabel(t)}
    : {timeFormatter:t=>'Day '+cycleAxisLabel(t)};
  const main=mkChart($('main'),{localization:loc,
    leftPriceScale:{visible:!stacked,borderColor:'#ccc',scaleMargins:margins,minimumWidth:56},
    rightPriceScale:{visible:true,borderColor:'#ccc',scaleMargins:margins,minimumWidth:80},
    timeScale:{borderColor:'#ccc',timeVisible:true,secondsVisible:false,minBarSpacing:0.05,rightOffset:4,
      tickMarkFormatter:(t)=>cycleAxisLabel(t)}});
  charts.push(main);
  if(!stacked) main.priceScale('left').applyOptions({mode:scaleMode,scaleMargins:margins,minimumWidth:56});
  main.priceScale('right').applyOptions({mode:scaleMode,scaleMargins:margins,minimumWidth:80});
  const refs=[];
  const byTime=new Map();
  for(const line of cycleSeries){
    const data=line.pts.filter(p=>p.value!=null&&p.value>0).map(p=>({time:p.time,value:p.value}));
    for(const p of data){
      const slot=byTime.get(p.time)||{min:p.value,max:p.value};
      if(p.value<slot.min)slot.min=p.value;
      if(p.value>slot.max)slot.max=p.value;
      byTime.set(p.time,slot);
    }
    const s=main.addLineSeries({color:line.color,lineWidth:line.open?3:2,priceLineVisible:false,lastValueVisible:true,
      title:String(line.cycle?line.cycle.year:line.anchorLabel||''),crosshairMarkerRadius:4,
      priceScaleId:stacked?'right':'left',
      priceFormat:{type:'custom',formatter:leftFmt,minMove:0.0001},
      autoscaleInfoProvider: stacked?undefined:()=>{
        const r=scaledVisibleMinMax(cycleSeries,main);
        if(!r) return null;
        return {priceRange:{minValue:r.min,maxValue:r.max}};
      }});
    s.setData(data);
    const marks=cycleMarkers(line,align);
    if(marks.length) s.setMarkers(marks);
    refs.push({s,line});
  }
  // Invisible right-scale envelopes: value = scaled * current-cycle reference, so
  // the right axis is current-cycle USD and stays locked to the left multiple/% axis.
  if(!stacked && mul && byTime.size){
    const times=[...byTime.keys()].sort((a,b)=>a-b);
    const lo=times.map(t=>({time:t,value:byTime.get(t).min*mul}));
    const hi=times.map(t=>({time:t,value:byTime.get(t).max*mul}));
    const ghostOpt={
      color:'rgba(0,0,0,0)',lineVisible:false,priceLineVisible:false,lastValueVisible:false,
      crosshairMarkerVisible:false,pointMarkersVisible:false,priceScaleId:'right',
      priceFormat:{type:'custom',formatter:rightFmt,minMove:0.01},
      autoscaleInfoProvider:()=>{
        const r=scaledVisibleMinMax(cycleSeries,main);
        if(!r) return null;
        return {priceRange:{minValue:r.min*mul,maxValue:r.max*mul}};
      }
    };
    const g1=main.addLineSeries(ghostOpt); g1.setData(lo);
    const g2=main.addLineSeries({...ghostOpt}); g2.setData(hi);
  }
  main.timeScale().fitContent();setTimeout(()=>main.timeScale().fitContent(),50);
  main.subscribeCrosshairMove(p=>{
    if(!p||p.time==null){$('legend').textContent='';return}
    const day=timeToDay(p.time);
    const bits=['Day '+day];
    for(const {s,line} of refs){
      const v=p.seriesData&&p.seriesData.get(s);
      if(!v||v.value==null) continue;
      const pt=line.pts.find(x=>x.time===p.time);
      const bar=pt&&pt.bar;
      const name=line.cycle?line.cycle.year:line.label.split(' ')[0];
      const date=bar?isoUTC(bar.time):'';
      const usdPx=bar?('$'+usd(bar.close)):'';
      if(mode==='usd') bits.push(`${name}${date?' '+date:''} ${usdPx}`.trim());
      else bits.push(`${name}${date?' '+date:''} ${cyclePriceFormat(v.value,mode)} ${usdPx}`.replace(/ +/g,' ').trim());
    }
    $('legend').textContent=bits.join('  ·  ');
  });
}
// compact price labels for log scale: 1k, 10k, 100k, 2.5k ...
function compact(v){const a=Math.abs(v);if(a>=1e6)return +(v/1e6).toPrecision(3)+'M';if(a>=1e3)return +(v/1e3).toPrecision(3)+'k';return +v.toPrecision(3)+''}
function syncScaleToggle(){
  const ll=$('ll')&&$('ll').checked&&!($('cy')&&$('cy').checked);
  const log=!$('p').checked&&$('l').checked&&!ll;
  const linear=!ll&&!log&&!($('p')&&$('p').checked);
  document.querySelectorAll('#scaleToggle button').forEach(b=>{
    const m=b.dataset.scale||(b.dataset.l==='1'?'log':'linear');
    b.classList.toggle('on',m==='loglog'?ll:m==='log'?log:linear);
  });
  document.body.classList.toggle('loglog-view',!!ll);
}

function renderLogLog(marks){
  clearCharts();syncScaleToggle();
  $('charts').classList.remove('has-volume');
  document.body.classList.add('loglog-view');
  const host=$('main');
  const w=Math.max(320,host.clientWidth||800), h=Math.max(240,host.clientHeight||480);
  const xs=[],ys=[],barAt=[];
  for(const b of bars){
    const d=daysSinceGenesis(b.time);
    if(!(d>0)||!(b.close>0)) continue;
    xs.push(d); ys.push(b.close); barAt.push(b);
  }
  if(xs.length<2){status('Not enough points for a log-log chart.');return}
  const opts={
    width:w,height:h,pxAlign:0,
    cursor:{show:true,drag:{x:true,y:true,setScale:true},points:{show:true}},
    legend:{show:false},
    scales:{x:{time:false,distr:3,log:10},y:{distr:3,log:10}},
    axes:[
      {scale:'x',stroke:'#333',grid:{stroke:'#eee'},ticks:{stroke:'#ccc'},size:48,space:10,font:'11px Verdana,Arial,sans-serif',
        splits:(u,axisIdx,min,max)=>logLogDayTicks(min,max,xs[0],xs[xs.length-1]),
        values:(u,splits)=>splits.map(()=>'')},
      {scale:'y',stroke:'#333',grid:{stroke:'#eee'},ticks:{stroke:'#ccc'},size:64,font:'11px Verdana,Arial,sans-serif',
        values:(u,splits)=>splits.map(v=>v>0?(v>=1000?compact(v):String(+v.toPrecision(3))):'')},
    ],
    series:[
      {label:'Days'},
      {label:'USD',stroke:epochEnabled()?'rgba(0,0,0,0)':'#1a237e',width:2,points:{show:xs.length<=100},
        value:(u,v)=>v==null?'':'$'+(v>=100?Number(v).toLocaleString('en-US',{maximumFractionDigits:0}):(+v.toPrecision(3)))},
    ],
    hooks:{
      setCursor:[u=>{
        const i=u.cursor.idx;
        if(i==null||!barAt[i]){$('legend').textContent='';return}
        const b=barAt[i], d=xs[i];
        $('legend').textContent=isoUTC(b.time)+'  ·  day '+d.toFixed(0)+' since genesis  ·  O '+b.open+' H '+b.high+' L '+b.low+' C '+b.close;
      }],
      draw:[u=>{
        if(epochEnabled()) drawEpochUplotLine(u,xs,barAt);
        drawPowerLawUplot(u,xs,barAt);
        const list=marks||lastMarks||[];
        if(!list.length){drawLogLogXLabels(u);return}
        const ctx=u.ctx, pr=u.pxRatio||window.devicePixelRatio||1;
        ctx.save();
        ctx.font=11*pr+'px Verdana,Arial,sans-serif';
        ctx.lineWidth=Math.max(1,pr);
        for(const m of list){
          const b=nearestBar(m.time); if(!b) continue;
          const d=daysSinceGenesis(b.time), px=m.price||b.close;
          if(!(d>0)||!(px>0)) continue;
          if(d<(u.scales.x.min||0)||d>(u.scales.x.max||Infinity)) continue;
          const x=u.valToPos(d,'x',true), y=u.valToPos(px,'y',true);
          ctx.fillStyle=m.color||'#333';
          ctx.beginPath(); ctx.arc(x,y,3.5*pr,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.85)';
          ctx.lineWidth=3*pr;
          ctx.strokeText(m.text,x+6*pr,y+(m.position==='belowBar'?12: -6)*pr);
          ctx.fillStyle=m.color||'#333';
          ctx.fillText(m.text,x+6*pr,y+(m.position==='belowBar'?12: -6)*pr);
        }
        ctx.restore();
        drawLogLogXLabels(u);
      }],
    },
  };
  uplot=new uPlot(opts,[xs,ys],host);
  setEpochLegend(epochEnabled());
  if(window._llRo) window._llRo.disconnect();
  window._llRo=new ResizeObserver(()=>{
    if(!uplot) return;
    const nw=host.clientWidth, nh=host.clientHeight;
    if(nw&&nh) uplot.setSize({width:nw,height:nh});
  });
  window._llRo.observe(host);
}

function render(interval, marks){
  lastMarks=marks||[];
  if($('ll')&&$('ll').checked&&!($('cy')&&$('cy').checked)){renderLogLog(lastMarks);return}
  clearCharts();syncScaleToggle();
  $('charts').classList.toggle('has-volume',!!$('v').checked);
  const dual=!!($('da')&&$('da').checked);
  const isLog=dual||(($('l').checked&&!$('p').checked));
  const main=mkChart($('main'),{
    localization:{priceFormatter:isLog?compact:v=>v<0?'':v.toLocaleString('en-US',{maximumFractionDigits:2})},
    leftPriceScale:{visible:dual,borderColor:'#ccc',scaleMargins:{top:.05,bottom:$('v').checked?.22:.05}},
  });charts.push(main);
  const ps=main.priceScale('right');
  ps.applyOptions({mode:dual?LW.PriceScaleMode.Normal:($('p').checked?LW.PriceScaleMode.Percentage:$('l').checked?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal),
    scaleMargins:{top:.05,bottom:$('v').checked?.22:.05}});
  if(dual){
    main.priceScale('left').applyOptions({visible:true,mode:LW.PriceScaleMode.Logarithmic,borderColor:'#ccc',minimumWidth:80,
      scaleMargins:{top:.05,bottom:$('v').checked?.22:.05}});
  }
  const O=bars.map(b=>b.open),H=bars.map(b=>b.high),L=bars.map(b=>b.low),C=bars.map(b=>b.close);
  const t=$('t').value;
  let mainSeries=null;
  const epOn=typeof epochEnabled==='function'&&epochEnabled();
  if(epOn&&(t==='S'||t==='O')){
    const ss=addEpochCandleSeries(main,bars,t);
    mainSeries=ss[ss.length-1]||null;
  }else if(epOn){
    let vals=C;
    if(t&&t!=='C'){
      const f={M:i=>(H[i]+L[i])/2,T:i=>(H[i]+L[i]+C[i])/3,W:i=>(H[i]+L[i]+2*C[i])/4}[t];
      if(f) vals=bars.map((_,i)=>f(i));
    }
    const ss=addEpochLineSeries(main,ser(vals),{lineWidth:2,lastValueVisible:true});
    mainSeries=ss[ss.length-1]||null;
  }else if(t==='S'){mainSeries=main.addCandlestickSeries({upColor:'#26a69a',downColor:'#ef5350',borderVisible:false,wickUpColor:'#26a69a',wickDownColor:'#ef5350'});mainSeries.setData(bars)}
  else if(t==='O'){mainSeries=main.addBarSeries({upColor:'#26a69a',downColor:'#ef5350',thinBars:false});mainSeries.setData(bars)}
  else if(t){const f={C:i=>C[i],M:i=>(H[i]+L[i])/2,T:i=>(H[i]+L[i]+C[i])/3,W:i=>(H[i]+L[i]+2*C[i])/4}[t];
    mainSeries=main.addLineSeries({color:'#1a237e',lineWidth:2});mainSeries.setData(ser(bars.map((_,i)=>f(i))))}
  else {mainSeries=main.addLineSeries({visible:false});mainSeries.setData(ser(C))} // keep scale with "None"
  if(mainSeries&&marks&&marks.length) mainSeries.setMarkers(marks);
  if(dual&&mainSeries){
    mainSeries.applyOptions({priceScaleId:'left'});
    const lin=main.addLineSeries({
      color:'#78909c',lineWidth:1,priceScaleId:'right',
      priceLineVisible:false,lastValueVisible:true,title:'Linear',
      priceFormat:{type:'price',precision:2,minMove:0.01},
    });
    lin.setData(bars.map(b=>({time:b.time,value:b.close})));
  }
  setEpochLegend(epOn);
  const line=(arr,color,w=1,style=0)=>main.addLineSeries({color,lineWidth:w,lineStyle:style,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}).setData(ser(arr));
  // price band
  const b=$('b').value;
  if(b==='B'){const m=TA.SMA(C,20),s=TA.stdev(C,20);line(m,'#9e9e9e',1,2);line(m.map((v,i)=>v&&v+2*s[i]),'#9e9e9e');line(m.map((v,i)=>v&&v-2*s[i]),'#9e9e9e')}
  if(b==='D'){line(bars.map((_,i)=>i<19?null:TA.hhll(bars,20,i)[0]),'#9e9e9e');line(bars.map((_,i)=>i<19?null:TA.hhll(bars,20,i)[1]),'#9e9e9e')}
  if(b==='E'){const m=TA.SMA(C,20);line(m.map(v=>v&&v*1.1),'#9e9e9e');line(m.map(v=>v&&v*0.9),'#9e9e9e')}
  // moving averages
  [['a1','m1','#ff9800'],['a2','m2','#2962ff']].forEach(([a,m,col])=>{const n=parseInt($(m).value);if($(a).value&&n>0)line(TA.MA($(a).value,C,n),col,2)});
  if(typeof ensureRatioOverlay==='function') ensureRatioOverlay(main,bars);
  // volume overlay
  if($('v').checked){const vs=main.addHistogramSeries({priceScaleId:'vol',priceFormat:{type:'volume'},lastValueVisible:false,priceLineVisible:false});
    main.priceScale('vol').applyOptions({scaleMargins:{top:.8,bottom:0}});
    vs.setData(bars.map(b=>({time:b.time,value:$('cv').checked?b.volume*b.close:b.volume,color:b.close>=b.open?'#26a69a66':'#ef535066'})))}
  // indicator subpanels
  for(const id of ['i1','i2','i3','i4']){const k=$(id).value;if(!k)continue;const def=INDICATORS[k];
    const el=document.createElement('div');el.className='sub'+($('x').checked?' big':'');el.innerHTML=`<span class="lbl">${def.label}</span>`;$('subs').appendChild(el);
    const ch=mkChart(el,{timeScale:{visible:false}});charts.push(ch);
    for(const s of def.f(bars,{cv:$('cv').checked})){
      if(s.type==='hist')ch.addHistogramSeries({priceLineVisible:false,lastValueVisible:false}).setData(ser(s.data).map(p=>p.value==null?p:{...p,color:s.color||(p.value>=0?'#26a69a99':'#ef535099')}));
      else{const ls=ch.addLineSeries({color:s.color,lineWidth:1.5,priceLineVisible:false});ls.setData(ser(s.data));
        (def.levels||[]).forEach(v=>ls.createPriceLine({price:v,color:'#bbb',lineWidth:1,lineStyle:2,axisLabelVisible:false}))}}
  }
  if(typeof computeRatio==='function'&&ratioKind()){
    const ratio=computeRatio(bars);
    if(ratio){
      if(typeof attachRatioPercentiles==='function') attachRatioPercentiles(ratio);
      addRatioPanel(ratio,{prepend:true});
      if(typeof addPricePercentileBands==='function') addPricePercentileBands(main, ratio, {project:ratio.kind==='pl'});
    }
  }else window.lastRatio=null
  // equal right-scale width + synced scroll/zoom across panels
  charts.forEach(c=>c.priceScale('right').applyOptions({minimumWidth:80}));
  charts.forEach(c=>c.timeScale().subscribeVisibleLogicalRangeChange(r=>{if(syncing||!r)return;syncing=true;charts.forEach(o=>o!==c&&o.timeScale().setVisibleLogicalRange(r));syncing=false}));
  main.timeScale().fitContent();setTimeout(()=>main.timeScale().fitContent(),50);
  if(interval==='Yearly' && mainSeries && (t==='S'||t==='O') && typeof attachChartOverlay==='function'){
    attachChartOverlay(main,(ctx,chart,w,h)=>{
      ctx.save();
      ctx.font='bold 11px Verdana,Arial,sans-serif';
      ctx.textAlign='center';
      for(const b of bars){
        if(!(b.open>0)) continue;
        const x=chart.timeScale().timeToCoordinate(b.time);
        if(x==null) continue;
        const pct=(b.close/b.open-1)*100;
        const up=pct>=0;
        const yRaw=mainSeries.priceToCoordinate(up?b.high:b.low);
        if(yRaw==null) continue;
        const label=Math.round(pct)+'%';
        ctx.textBaseline=up?'bottom':'top';
        const y=up?yRaw-6:yRaw+6;
        ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.strokeText(label,x,y);
        ctx.fillStyle=up?'#1b5e20':'#b71c1c';
        ctx.fillText(label,x,y);
      }
      ctx.restore();
    });
  }
  if(typeof hookFlatSpans==='function') hookFlatSpans(main, mainSeries);
  if(($('pl')&&$('pl').checked)||($('rp')&&$('rp').value==='pl')){let _plT;const refit=()=>{clearTimeout(_plT);_plT=setTimeout(()=>applyPowerLawLW(main),80)};main.timeScale().subscribeVisibleLogicalRangeChange(refit);setTimeout(()=>applyPowerLawLW(main),80)} else setPlLegend(null);
  main.subscribeCrosshairMove(p=>{const bar=p.time&&bars.find(x=>x.time===p.time);
    if(!bar){$('legend').textContent=(typeof ratioRankText==='function'&&window.lastRatio)?ratioRankText(window.lastRatio):'';return}
    let text=`${new Date(bar.time*1000).toISOString().slice(0,16).replace('T',' ')} O ${bar.open} H ${bar.high} L ${bar.low} C ${bar.close} V ${bar.volume.toFixed(2)}`;
    const c=window.lastRatio;
    if(c){
      const rp=c.points&&c.points.find(x=>x.time===bar.time);
      if(rp) text+='  ·  '+(c.short||c.title)+' '+formatRatioValue(rp.value);
      const rk=c.pctRankByTime?c.pctRankByTime.get(bar.time):null;
      if(rk!=null) text+=' ('+ordinalPct(rk)+' pct)';
    }
    $('legend').textContent=text});
}
function status(s){$('status').textContent=s}
// ---- raw data table ----
const PRICE_HEAD=['Timestamp','Open','High','Low','Close','Volume (BTC)','Volume (Currency)','Weighted Price'];
const CYCLE_HEAD=['Cycle','Day #','Date','USD','Scaled'];
let tableOpen=false, tableCsv=[];
function setTableHead(cols){$('chart_table').tHead.innerHTML='<tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr>'}
function clear_table(){
  tableOpen=false; tableCsv=[];
  if($('chart_table').tBodies[0]) $('chart_table').tBodies[0].innerHTML='';
  if($('tableWrap')) $('tableWrap').hidden=true;
  if($('downloadCsv')) $('downloadCsv').hidden=true;
  if($('loadRaw')) $('loadRaw').textContent='Show data';
}
function showTable(){
  if($('cy').checked) fillCycleTable(); else if(typeof scoutView==='function'&&scoutView()==='powerlaw') fillPowerLawTable(); else if(scoutView()==='drawdown') fillDrawdownTable(); else if(scoutView()==='ath') fillAthTable(); else if(scoutView()==='sats') fillSatsTable(); else if(scoutView()==='pricema') fillPriceMaTable(); else if(scoutView()==='returns') fillReturnsTable(); else if(scoutView()==='epoch') fillEpochTable(); else if(scoutView()==='calyear') fillCalYearTable(); else if(scoutView()==='onthisday') fillOnThisDayTable(); else if(scoutView()==='hcycles') fillHcyclesTable(); else if(scoutView()==='ranges') fillRangesTable(); else fillPriceTable();
  tableOpen=true;
  $('tableWrap').hidden=false;
  $('downloadCsv').hidden=false;
  $('loadRaw').textContent='Hide data';
}
function toggleTable(e){if(e)e.preventDefault();if(tableOpen)clear_table();else showTable()}
function fillPriceTable(){
  const epOn=typeof epochEnabled==='function'&&epochEnabled();
  const ratio=typeof computeRatio==='function'&&ratioKind()? (window.lastRatio||computeRatio(bars)):null;
  const head=PRICE_HEAD.slice();
  if(epOn) head.push('Epoch');
  if(ratio){
    if(typeof attachRatioPercentiles==='function'&&!ratio.pctLevels) attachRatioPercentiles(ratio);
    head.push(ratio.source||'Overlay');head.push(ratio.title);
    if(typeof pctBandHeaders==='function') head.push(...pctBandHeaders(ratio));
  }
  setTableHead(head); tableCsv=[head.slice()];
  const ratioByTime=new Map((ratio?ratio.points:[]).map(p=>[p.time,p]));
  $('chart_table').tBodies[0].innerHTML=bars.slice().reverse().map(b=>{
    const w=(b.high+b.low+2*b.close)/4;
    const rec=[new Date(b.time*1000).toISOString().slice(0,19).replace('T',' '),
      String(b.open),String(b.high),String(b.low),String(b.close),
      b.volume.toFixed(2),(b.volume*b.close).toFixed(2),w.toFixed(2)];
    if(epOn) rec.push(String(epochIndex(b.time)+1));
    if(ratio){
      const rp=ratioByTime.get(b.time);
      rec.push(rp&&rp.overlay!=null?String(+rp.overlay.toPrecision(6)):'');
      rec.push(rp?formatRatioValue(rp.value):'');
      if(typeof pctBandCells==='function') rec.push(...pctBandCells(ratio, rp&&rp.overlay, b.time));
    }
    tableCsv.push(rec);
    return '<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
  }).join('');
}
function fillCycleTable(){
  setTableHead(CYCLE_HEAD); tableCsv=[CYCLE_HEAD.slice()];
  const mode=$('cp').value||'usd';
  const parts=[];
  for(const line of (cycleSeries||[])){
    const name=line.cycle?String(line.cycle.year):(line.anchorLabel||line.label||'');
    for(const p of line.pts){
      if(!p.bar) continue;
      const rec=[name,String(p.day),isoUTC(p.bar.time),'$'+usd(p.bar.close),mode==='usd'?'—':cyclePriceFormat(p.value,mode)];
      tableCsv.push(rec);
      parts.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
    }
  }
  $('chart_table').tBodies[0].innerHTML=parts.join('');
}
function fillRangesTable(){
  const s=window.lastScout||{}, bands=s.bands||[], counts=s.counts||[];
  const head=['Band low','Band high','Days'];
  setTableHead(head); tableCsv=[head.slice()];
  const rows=[];
  bands.forEach((b,i)=>{
    const rec=[String(b.lo), b.open?'∞':String(b.hi), String(counts[i]||0)];
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(v=>'<td>'+v+'</td>').join('')+'</tr>');
  });
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillHcyclesTable(){
  const s=window.lastScout||{}, cycles=s.cycles||[];
  const head=['Days since halving'].concat(cycles.map(c=>c.label));
  setTableHead(head); tableCsv=[head.slice()];
  const maxD=Math.max(0,...cycles.map(c=>c.pts.length?c.pts.at(-1).day:0));
  const maps=cycles.map(c=>new Map(c.pts.map(p=>[p.day,p.price])));
  const rows=[];
  for(let d=0;d<=maxD;d++){
    const rec=[String(d)].concat(maps.map(m=>m.has(d)?String(+m.get(d).toFixed(2)):''));
    if(rec.slice(1).some(Boolean)){ tableCsv.push(rec); rows.push('<tr>'+rec.map(v=>'<td>'+v+'</td>').join('')+'</tr>'); }
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillOnThisDayTable(){
  const s=window.lastScout||{}, rows=s.rows||[], rets=s.rets||[];
  const head=['Year','Date','Close'];
  setTableHead(head); tableCsv=[head.slice()];
  const body=[];
  for(const r of rows.slice().reverse()){
    const rec=[String(r.year), r.date, String(+r.price.toFixed(2))];
    tableCsv.push(rec);
    body.push('<tr>'+rec.map(v=>'<td>'+v+'</td>').join('')+'</tr>');
  }
  if(rets.length){
    tableCsv.push([]);
    tableCsv.push(['Lookback','Then','Now','ROI %','CAGR %']);
    for(const r of rets){
      tableCsv.push([String(r.years)+' years', String(+r.then.price.toFixed(2))+' ('+r.then.year+')', String(+r.now.price.toFixed(2))+' ('+r.now.year+')', (r.roi*100).toFixed(2), (r.cagr*100).toFixed(2)]);
    }
  }
  $('chart_table').tBodies[0].innerHTML=body.join('');
}
function fillCalYearTable(){
  const s=window.lastScout||{};
  const series=s.series||[];
  const head=['Date'].concat(series.map(x=>String(x.year)));
  setTableHead(head); tableCsv=[head.slice()];
  const byX=new Map();
  for(const ser of series){
    for(const p of ser.pts){
      const key=String(p.m).padStart(2,'0')+'-'+String(p.day).padStart(2,'0');
      if(!byX.has(key)) byX.set(key,{m:p.m,day:p.day,row:{}});
      byX.get(key).row[ser.year]=p.v;
    }
  }
  const keys=[...byX.keys()].sort();
  const rows=[];
  for(const k of keys){
    const it=byX.get(k);
    const rec=[k].concat(series.map(ser=>it.row[ser.year]!=null?String(+it.row[ser.year].toFixed(2)):''));
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(v=>'<td>'+v+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillEpochTable(){
  const cs=window.lastScout&&window.lastScout.candles, head=['Epoch','Start','End','Open','High','Low','Close','Change %'];
  setTableHead(head); tableCsv=[head.slice()];
  const rows=[];
  for(const c of (cs||[])){
    const rec=[String(c.epoch),isoUTC(c.start),isoUTC(c.end),String(c.open),String(c.high),String(c.low),String(c.close),c.pct!=null?c.pct.toFixed(2):''];
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(v=>'<td>'+v+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillReturnsTable(){
  const s=window.lastScout||{}, mode=s.mode||'cagr', col=mode==='cagr'?'CAGR %':mode==='roi'?'ROI %':'1-year multiple';
  const head=['Date','Close',col];
  setTableHead(head); tableCsv=[head.slice()];
  const fmt=mode==='mult'?formatRatioValue:(mode==='roi'?fmtRoi:fmtCagr);
  const rows=[];
  for(const p of (s.points||[]).slice().reverse()){
    const rec=[isoUTC(p.time),String(p.close), mode==='mult'?formatRatioValue(p.value):String(+p.value.toFixed(2))];
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillPriceMaTable(){
  const c=window.lastRatio, pct=window.lastScout&&window.lastScout.pctVals;
  if(c&&typeof attachRatioPercentiles==='function'&&!c.pctLevels) attachRatioPercentiles(c);
  const head=['Date','Close',(c&&c.source)||'MA',(c&&c.title)||'Ratio'];
  if(c&&typeof pctBandHeaders==='function') head.push(...pctBandHeaders(c));
  setTableHead(head); tableCsv=[head.slice()];
  const rows=[];
  for(const p of (c?c.points:[]).slice().reverse()){
    const rec=[isoUTC(p.time),String(p.close),p.overlay!=null?String(+p.overlay.toPrecision(6)):'',formatRatioValue(p.value)];
    if(c&&typeof pctBandCells==='function') rec.push(...pctBandCells(c, p.overlay, p.time));
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillSatsTable(){
  const pts=window.lastScout&&window.lastScout.points, head=['Date','Close','Sats per dollar','Epoch'];
  setTableHead(head); tableCsv=[head.slice()];
  const rows=[];
  for(const p of (pts||[]).slice().reverse()){
    const rec=[isoUTC(p.time),String(p.close),String(Math.round(p.value)),String(epochIndex(p.time)+1)];
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillAthTable(){
  const ser=window.lastScout&&window.lastScout.series, between=window.lastScout&&window.lastScout.between, head=['Date','Close','New ATH','Days since previous ATH'];
  setTableHead(head); tableCsv=[head.slice()];
  const athSet=new Set((ser?ser.aths:[]).map(a=>a.time));
  const dayBy=new Map((between||[]).map(p=>[p.time,p.value]));
  const rows=[];
  for(const b of (ser?ser.bars:bars).slice().reverse()){
    const rec=[isoUTC(b.time),String(b.close),athSet.has(b.time)?'yes':'',dayBy.has(b.time)?String(Math.round(dayBy.get(b.time))):''];
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillDrawdownTable(){
  const ser=window.lastScout&&window.lastScout.series, head=['Date','Close','ATH','Drawdown %'];
  setTableHead(head); tableCsv=[head.slice()];
  const athBy=new Map((ser?ser.athLine:[]).map(p=>[p.time,p.value]));
  const ddBy=new Map((ser?ser.dd:[]).map(p=>[p.time,p.value]));
  const rows=[];
  for(const b of (ser?ser.bars:bars).slice().reverse()){
    const rec=[isoUTC(b.time),String(b.close),athBy.has(b.time)?String(athBy.get(b.time)):'',ddBy.has(b.time)?ddBy.get(b.time).toFixed(2):''];
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function fillPowerLawTable(){
  const fit=window.lastPowerFit, c=window.lastRatio;
  if(c&&typeof attachRatioPercentiles==='function'&&!c.pctLevels) attachRatioPercentiles(c);
  const blend=window.lastBlend, blendOn=!!(blend&&($('blp')&&$('blp').checked));
  const head=['Date','Close','Power Law','Price / Power Law','Years Ahead'];
  if(c&&typeof pctBandHeaders==='function') head.push(...pctBandHeaders(c));
  if(blendOn) head.push('Ratio pct','Years ahead pct','Blended pct');
  setTableHead(head); tableCsv=[head.slice()];
  const blendBy=new Map((blend&&blend.points||[]).map(p=>[p.time,p]));
  const rows=[];
  for(const b of (bars||[]).slice().reverse()){
    if(!(b.close>0)) continue;
    const d=daysSinceGenesis(b.time);
    const pl=fit&&d>0?powerLawPrice(d,fit.a,fit.b):null;
    const ratio=pl>0?b.close/pl:null;
    const ahead=(fit&&d>0)?yearsAheadOfPowerLaw(d,b.close,fit):null;
    const rec=[isoUTC(b.time),String(b.close),pl!=null?String(+pl.toPrecision(6)):'',ratio!=null?formatRatioValue(ratio):'',ahead!=null?ahead.toFixed(3):''];
    if(c&&typeof pctBandCells==='function') rec.push(...pctBandCells(c, pl, b.time));
    if(blendOn){
      const bp=blendBy.get(b.time);
      rec.push(bp&&bp.ratioRank!=null?bp.ratioRank.toFixed(1):'', bp&&bp.aheadRank!=null?bp.aheadRank.toFixed(1):'', bp&&bp.blend!=null?bp.blend.toFixed(1):'');
    }
    tableCsv.push(rec);
    rows.push('<tr>'+rec.map(c=>'<td>'+c+'</td>').join('')+'</tr>');
  }
  $('chart_table').tBodies[0].innerHTML=rows.join('');
}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function downloadCsv(e){
  if(e)e.preventDefault();
  if(!tableOpen) showTable();
  const text=tableCsv.map(r=>r.map(csvEscape).join(',')).join('\n')+'\n';
  downloadBlob(new Blob([text],{type:'text/csv;charset=utf-8'}),'btccharts-data.csv');
}

// ---- chart image export (watermark + title + panes) ----
const WATERMARK_TEXT='chartsbtc.github.io/btccharts';
function isLikelyIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
function isMobileUa(){
  return isLikelyIOS()||/Mobi|Android/i.test(navigator.userAgent);
}
function chartTitleLine(){
  const vt=($('vt')&&$('vt').value)||'';
  if(vt==='powerlaw'||vt==='drawdown'||vt==='ath'||vt==='sats'||vt==='pricema'||vt==='returns'||vt==='epoch'||vt==='calyear'||vt==='onthisday'||vt==='hcycles'||vt==='ranges'){
    const m=currentMarket();
    const name=m==='combinedUSD'?'BTC/USD Combined':('BTC/USD '+marketLabel(m).replace(/ \(USD\)/,''));
    if(vt==='ranges'){
      const pow=($('rb')&&$('rb').value)==='pow2';
      return name+' · Days in price ranges'+(pow?' (powers of 2)':'');
    }
    if(vt==='hcycles'){
      return name+' · Halving cycles (USD)';
    }
    if(vt==='onthisday'){
      const md=typeof readOnThisDay==='function'?readOnThisDay():{m:0,d:0};
      const lab=md&&md.m?(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][md.m-1]+' '+String(md.d).padStart(2,'0')):'this day';
      return name+' · Price on '+lab;
    }
    if(vt==='calyear'){
      const idx=($('ym')&&$('ym').value)==='idx';
      return name+' · '+(idx?'Annual performance (indexed to Jan 1)':'Price history by year');
    }
    if(vt==='epoch'){
      return name+' · Halving-epoch candles';
    }
    if(vt==='returns'){
      const mode=($('rm')&&$('rm').value)||'cagr';
      const n=mode==='mult'?1:(parseInt($('rn')&&$('rn').value)||4);
      const label=mode==='cagr'?n+'-year CAGR':mode==='roi'?n+'-year ROI':'1-year price multiple';
      return name+' · '+label;
    }
    if(vt==='pricema'){
      const spec=typeof maSpec==='function'?maSpec(($('pma')&&$('pma').value)||'200d'):null;
      const mode=($('pmm')&&$('pmm').value)==='osc'?'oscillator':'Price / MA';
      return name+' · '+(($('i').value)||'Daily')+' · '+(spec?spec.name+' · ':'')+mode;
    }
    const label={powerlaw:'Power Law',drawdown:'Drawdown from ATH',ath:'ATHs and days between',sats:'Sats per dollar'}[vt];
    return name+' · '+(($('i').value)||'Daily')+' · '+label;
  }
  const scale=($('ll')&&$('ll').checked)?'Log-Log':($('p').checked?'Percentage':($('l').checked?'Log':'Linear'));
  if($('cy').checked){
    const align={low:'low',high:'high',halving:'halving date',calendar:'4-year calendar'}[$('ca').value]||$('ca').value;
    const mode={usd:'stacked USD',low:'multiple of low',high:'% of cycle high',day0:'relative to day 0'}[$('cp').value]||$('cp').value;
    return `Cycles aligned by ${align} · ${mode}`+($('l').checked?' · Log':'');
  }
  const m=currentMarket();
  const name=m==='combinedUSD'?'BTC/USD Combined':('BTC/USD '+marketLabel(m).replace(/ \(USD\)/,''));
  let days=60;
  if(typeof isCyclePreset==='function'&&isCyclePreset($('r').value)&&bars.length){
    days=(bars.at(-1).time-bars[0].time)/86400;
  }else if($('c').checked&&$('s').value){
    const end=Date.parse($('e').value)||Date.now();
    days=Math.max(1,(end-Date.parse($('s').value))/864e5);
  }else if($('r').value) days=+$('r').value||60;
  else if(bars.length) days=Math.max(1,(bars.at(-1).time-bars[0].time)/86400);
  const interval=$('i').value||autoInterval(days);
  if($('da')&&$('da').checked){
    const preset=(typeof isCyclePreset==='function'&&isCyclePreset($('r').value))
      ?(($('r').value==='ccurrent'?'Current cycle':($('r').value||'').replace(/^c/,'').replace(/(\d{4})/, '$1 cycle'))+' · '):(($('r').value&&$('r').value!=='all'&&!$('c').checked)?$('r').selectedOptions[0]&&$('r').selectedOptions[0].text+' · ':'');
    return `${name} · ${preset||''}${interval} · Dual axis (log + linear)`+(($('pl')&&$('pl').checked)?' · Power Law':'')+(typeof epochEnabled==='function'&&epochEnabled()?' · Epoch colors':'')+(window.lastRatio?' · '+window.lastRatio.title:'');
  }
  const preset=(typeof isCyclePreset==='function'&&isCyclePreset($('r').value))
    ?($('r').selectedOptions[0]?$('r').selectedOptions[0].text+' · ':'')
    :'';
  return `${name} · ${preset}${interval} · ${scale}`+(($('pl')&&$('pl').checked)?' · Power Law':'')+(typeof epochEnabled==='function'&&epochEnabled()?' · Epoch colors':'')+(window.lastRatio?' · '+window.lastRatio.title:'');
}
function exportFilename(){
  const slug=chartTitleLine().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return 'btccharts-'+(slug||'chart')+'.png';
}
function canvasToBlob(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('toBlob failed')),'image/png'));
}
function downloadBlob(blob,name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
}
function flashCopyStatus(msg,ms){
  const el=$('copyStatus'); if(!el)return;
  el.textContent=msg; el.hidden=false;
  clearTimeout(flashCopyStatus._t);
  flashCopyStatus._t=setTimeout(()=>{el.hidden=true},ms||2500);
}
function paintWatermark(ctx,x,y,w,h,dpr,opts){
  opts=opts||{};
  const size=Math.max(11,Math.round(13*dpr));
  ctx.save();
  ctx.font=`${size}px Verdana,Arial,sans-serif`;
  ctx.textBaseline='bottom';
  ctx.textAlign='left';
  // Sit in the plot, above the time axis (and above volume if it is on).
  let left=14*dpr, bottom=36*dpr;
  if(opts.cycles||opts.loglog) left=72*dpr;
  if(opts.volume) bottom=h*0.22+12*dpr;
  if(opts.loglog) bottom=52*dpr;
  const tx=x+left, ty=y+h-bottom;
  ctx.lineWidth=Math.max(2,3*dpr);
  const th=chartTheme();
  ctx.strokeStyle=th.wmStroke;
  ctx.strokeText(WATERMARK_TEXT,tx,ty);
  ctx.fillStyle=th.wmFill;
  ctx.fillText(WATERMARK_TEXT,tx,ty);
  ctx.restore();
}
function waitPaint(){
  return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
async function composeChartImage(){
  await waitPaint();
  if(typeof composeScoutImage==='function'){
    const scout=await composeScoutImage();
    if(scout) return scout;
  }
  if(uplot){
    const cv=uplot.ctx.canvas;
    const cssW=uplot.width||cv.clientWidth||cv.width;
    const dpr=cv.width/Math.max(1,cssW);
    const width=cv.width, pad=Math.round(16*dpr);
    const sub=($('pl')&&$('pl').checked&&window.lastPowerFit)?powerLawLegendText(window.lastPowerFit):'';
    const titleSize=Math.round(15*dpr), titleH=Math.round(28*dpr), subH=sub?Math.round(18*dpr):0;
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=pad+titleH+subH+cv.height+pad;
    const ctx=canvas.getContext('2d');
    const th=chartTheme();
    ctx.fillStyle=th.exportBg; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=th.exportTitle; ctx.font=titleSize+'px Verdana,Arial,sans-serif'; ctx.textBaseline='top';
    ctx.fillText(chartTitleLine(),pad,pad);
    if(sub){ctx.fillStyle=th.sub;ctx.font=Math.round(11*dpr)+'px Verdana,Arial,sans-serif';ctx.fillText(sub,pad,pad+titleH-Math.round(8*dpr))}
    ctx.drawImage(cv,0,pad+titleH+subH);
    paintWatermark(ctx,0,pad+titleH+subH,width,cv.height,dpr,{loglog:true});
    if(typeof epochEnabled==='function'&&epochEnabled()&&typeof paintEpochLegend==='function'){
      paintEpochLegend(ctx,pad+Math.round(72*dpr),pad+titleH+subH+Math.round(10*dpr),dpr);
    }
    return canvas;
  }
  if(!charts.length) throw new Error('No chart to export');
  const panes=charts.map((c,i)=>{
    const cv=c.takeScreenshot();
    const el=c.chartElement();
    const host=el&&el.parentElement;
    const lbl=i>0&&host?host.querySelector('.lbl'):null;
    const cssW=(el&&el.clientWidth)||cv.width;
    const overlay=el&&el.querySelector('canvas.chart-overlay');
    return {cv,label:lbl?lbl.textContent:'',cssW,overlay};
  });
  const dpr=panes[0].cv.width/Math.max(1,panes[0].cssW);
  const width=Math.max(...panes.map(p=>p.cv.width));
  const pad=Math.round(16*dpr);
  const title=chartTitleLine();
  const titleSize=Math.round(15*dpr);
  const titleH=Math.round(28*dpr);
  const sub=($('pl')&&$('pl').checked&&window.lastPowerFit)?powerLawLegendText(window.lastPowerFit):'';
  const subH=sub?Math.round(18*dpr):0;
  const legendItems=($('cy').checked&&typeof cycleSeries!=='undefined')?cycleSeries:[];
  const legendRow=legendItems.length?Math.round(20*dpr):0;
  const legendRows=legendItems.length?Math.ceil(legendItems.length/3):0;
  const legendH=legendRows*legendRow;
  let totalH=pad+titleH+subH+legendH+pad;
  for(const p of panes) totalH+=p.cv.height;
  const canvas=document.createElement('canvas');
  canvas.width=width+0;
  canvas.height=totalH;
  const ctx=canvas.getContext('2d');
  const th=chartTheme();
  ctx.fillStyle=th.exportBg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=th.exportTitle;
  ctx.font=`${titleSize}px Verdana,Arial,sans-serif`;
  ctx.textBaseline='top';
  ctx.fillText(title,pad,pad);
  if(sub){ctx.fillStyle=th.sub;ctx.font=Math.round(11*dpr)+'px Verdana,Arial,sans-serif';ctx.fillText(sub,pad,pad+titleH-Math.round(8*dpr));ctx.fillStyle=th.exportTitle;ctx.font=titleSize+'px Verdana,Arial,sans-serif'}
  let y=pad+titleH+subH;
  if(legendItems.length){
    ctx.font=`${Math.round(12*dpr)}px Verdana,Arial,sans-serif`;
    ctx.textBaseline='middle';
    let cx=pad, cy=y+legendRow/2, maxW=width-pad*2;
    const box=Math.round(10*dpr), gap=Math.round(14*dpr);
    for(const line of legendItems){
      const label=(line.label||'')+(line.open?' (in progress)':'');
      const tw=ctx.measureText(label).width+box+Math.round(6*dpr)+gap;
      if(cx+tw>pad+maxW){cx=pad;cy+=legendRow}
      ctx.fillStyle=line.color||'#333';
      ctx.fillRect(cx,cy-box/2,box,box);
      ctx.fillStyle=th.text;
      ctx.fillText(label,cx+box+Math.round(5*dpr),cy);
      cx+=tw;
    }
    y+=legendH;
  }
  let mainY=y, mainH=panes[0].cv.height;
  for(const [i,p] of panes.entries()){
    const x=Math.round((width-p.cv.width)/2);
    ctx.drawImage(p.cv,x,y);
    if(p.overlay) ctx.drawImage(p.overlay,x,y,p.cv.width,p.cv.height);
    if(p.label){
      ctx.font=`${Math.round(11*dpr)}px Verdana,Arial,sans-serif`;
      ctx.textBaseline='top';
      const tx=x+Math.round(6*dpr), ty=y+Math.round(4*dpr);
      const tw=ctx.measureText(p.label).width+Math.round(6*dpr);
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillRect(tx-2,ty-1,tw,Math.round(14*dpr));
      ctx.fillStyle='#555';
      ctx.fillText(p.label,tx,ty);
    }
    if(i===0){mainY=y;mainH=p.cv.height}
    y+=p.cv.height;
  }
  paintWatermark(ctx,0,mainY,width,mainH,dpr,{cycles:!!$('cy').checked,volume:!$('cy').checked&&!!$('v').checked});
  if(typeof paintEpochLegend==='function'&&$('epochLegend')&&!$('epochLegend').hidden&&!($('cy')&&$('cy').checked)){
    paintEpochLegend(ctx,pad+Math.round(8*dpr),mainY+Math.round(10*dpr),dpr);
  }
  return canvas;
}
async function copyChartImage(e){
  if(e) e.preventDefault();
  try{
    const canvas=await composeChartImage();
    const blob=await canvasToBlob(canvas);
    const file=new File([blob],exportFilename(),{type:'image/png'});
    try{
      if(!navigator.clipboard||!window.ClipboardItem) throw new Error('clipboard unavailable');
      const payload=isLikelyIOS()?Promise.resolve(blob):blob;
      await navigator.clipboard.write([new ClipboardItem({'image/png':payload})]);
      flashCopyStatus('Copied');
    }catch(err){
      if(isMobileUa()&&typeof navigator.share==='function'){
        try{
          const share={files:[file],title:chartTitleLine(),text:WATERMARK_TEXT};
          if(!navigator.canShare||navigator.canShare({files:[file]})){
            await navigator.share(share);
            return canvas;
          }
        }catch(err2){ if(err2&&err2.name==='AbortError') return canvas; }
      }
      downloadBlob(blob,exportFilename());
      flashCopyStatus('Downloaded');
    }
    return canvas;
  }catch(err){
    flashCopyStatus('Export failed');
    throw err;
  }
}
async function downloadChartPng(e){
  if(e) e.preventDefault();
  const canvas=await composeChartImage();
  downloadBlob(await canvasToBlob(canvas),exportFilename());
  flashCopyStatus('Downloaded');
  return canvas;
}
// Headless tests and bookmarklets use the same compose path.
window.composeChartImage=composeChartImage;
window.exportChartPng=async()=>canvasToBlob(await composeChartImage());


function currentPermalink(){
  const hash=buildHash();
  const which=(isAdvancedPage()||(!isClassicPage()&&hashHasAdvanced(hash)))?'advanced':'classic';
  return publicPageUrl(which, hash);
}
function shareCaption(){
  const bits=[];
  const vt=($('vt')&&$('vt').value)||'';
  if(vt==='powerlaw'){
    bits.push('BTC/USD combined history, power law fit');
    if(window.lastPowerFit){
      const f=window.lastPowerFit;
      bits.push((typeof powerLawEquation==='function'?powerLawEquation(f):'')+', R²='+f.r2.toFixed(3));
    }
    if(window.lastRatio&&window.lastRatio.last) bits.push(typeof ratioRankText==='function'?ratioRankText(window.lastRatio):('Price/Power Law '+formatRatioValue(window.lastRatio.last.value)));
    if($('blp')&&$('blp').checked&&window.lastBlend&&typeof blendCaptionText==='function') bits.push(blendCaptionText(window.lastBlend));
    if(bars.length){
      const last=bars.at(-1);
      bits.push('Last $'+Number(last.close).toLocaleString('en-US',{maximumFractionDigits:0})+' on '+isoUTC(last.time));
      const d=daysSinceGenesis(last.time);
      const ya=window.lastPowerFit?yearsAheadOfPowerLaw(d,last.close,window.lastPowerFit):null;
      if(ya!=null) bits.push('Years ahead '+(typeof formatYearsMonths==='function'?formatYearsMonths(ya):(ya>=0?'+':'')+ya.toFixed(2)));
    }
    return bits.join('. ')+'.';
  }
  if(vt==='drawdown'){
    bits.push('Bitcoin drawdown from all-time highs');
    const ser=window.lastScout&&window.lastScout.series;
    if(ser&&ser.dd.length){
      const last=ser.dd.at(-1), ath=ser.athLine.at(-1);
      bits.push('Currently '+last.value.toFixed(1)+'% from ATH ($'+usd(ath.value)+')');
    }
    if(bars.length) bits.push('Last $'+Number(bars.at(-1).close).toLocaleString('en-US',{maximumFractionDigits:0})+' on '+isoUTC(bars.at(-1).time));
    return bits.join('. ')+'.';
  }
  if(vt==='ath'){
    bits.push('Bitcoin all-time highs and days between them');
    const ser=window.lastScout&&window.lastScout.series;
    if(ser&&ser.aths.length){
      const last=ser.aths.at(-1);
      const gap=window.lastScout.between&&window.lastScout.between.at(-1);
      bits.push(ser.aths.length+' closing ATHs, last $'+usd(last.price)+' on '+isoUTC(last.time)+(gap?', '+Math.round(gap.value)+' days since':'') );
    }
    return bits.join('. ')+'.';
  }
  if(vt==='sats'){
    bits.push('Satoshi per US dollar, log scale, colored by halving epoch');
    const pts=window.lastScout&&window.lastScout.points;
    if(pts&&pts.length){
      const last=pts.at(-1);
      bits.push('Currently '+formatSats(last.value)+' ($'+usd(last.close)+')');
    }
    return bits.join('. ')+'.';
  }
  if(vt==='pricema'){
    const c=window.lastRatio;
    const pct=window.lastScout&&window.lastScout.pctVals;
    bits.push('BTC/USD '+(c&&c.source?c.source:'moving average')+' ('+(($('pmm')&&$('pmm').value)==='osc'?'percentile oscillator':'price and ratio')+')');
    if(c&&c.last) bits.push(typeof ratioRankText==='function'?ratioRankText(c):(c.title+' '+formatRatioValue(c.last.value)));
    if(pct&&pct.length) bits.push('percentiles 20/40/60/80 = '+pct.map(v=>formatRatioValue(v)).join(', '));
    if(bars.length) bits.push('Last $'+Number(bars.at(-1).close).toLocaleString('en-US',{maximumFractionDigits:0})+' on '+isoUTC(bars.at(-1).time));
    return bits.join('. ')+'.';
  }
  if(vt==='ranges'){
    const s=window.lastScout||{};
    bits.push('Days Bitcoin has spent in each price range ('+(s.mode==='pow2'?'powers of 2':'orders of magnitude')+')');
    const bands=s.bands||[], counts=s.counts||[];
    const parts=[];
    bands.forEach((b,i)=>{ if(counts[i]) parts.push((counts[i])+' days in '+formatBandEdge(b.lo)+(b.open?'+':'–'+formatBandEdge(b.hi))); });
    if(parts.length) bits.push(parts.join(', '));
    return bits.join('. ')+'.';
  }
  if(vt==='hcycles'){
    const s=window.lastScout||{};
    const cur=(s.cycles||[]).find(c=>c.current)||(s.cycles||[]).at(-1);
    const last=cur&&cur.pts&&cur.pts.at(-1);
    bits.push('Bitcoin halving cycles in US dollars, with a min/max envelope');
    if(last) bits.push('current cycle day '+last.day+', last '+formatUsdLabel(last.price));
    return bits.join('. ')+'.';
  }
  if(vt==='onthisday'){
    const s=window.lastScout||{};
    const lab=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(s.month||1)-1]+' '+String(s.day||'').padStart(2,'0');
    bits.push('Bitcoin closing price on '+lab+' each year');
    const last=s.rows&&s.rows.at(-1);
    if(last) bits.push(last.year+' '+formatUsdLabel(last.price));
    const rets=s.rets||[];
    for(const r of rets){
      bits.push(r.years+'-year ROI '+((r.roi*100).toFixed(0))+'%, CAGR '+((r.cagr*100).toFixed(1))+'%');
    }
    return bits.join('. ')+'.';
  }
  if(vt==='calyear'){
    const s=window.lastScout||{};
    const idx=s.mode==='idx';
    bits.push('Bitcoin price history by calendar year'+(idx?', indexed to the current year\'s January 1 close':', raw USD on a linear scale'));
    if(s.jan1&&idx) bits.push(s.current+' Jan 1 $'+Number(s.jan1).toLocaleString('en-US',{maximumFractionDigits:0}));
    const cur=s.series&&s.series.find(x=>x.current);
    const last=cur&&cur.pts&&cur.pts.at(-1);
    if(last) bits.push(s.current+' last $'+Number(last.v).toLocaleString('en-US',{maximumFractionDigits:0}));
    return bits.join('. ')+'.';
  }
  if(vt==='epoch'){
    bits.push('Bitcoin halving-epoch candles (one candle per era)');
    const cs=window.lastScout&&window.lastScout.candles;
    if(cs&&cs.length){
      const last=cs.at(-1);
      bits.push(cs.length+' epochs, current era '+isoUTC(last.start)+' to '+isoUTC(last.end)+' '+(last.pct!=null?Math.round(last.pct)+'%':'')+' close '+formatUsdBox(last.close));
    }
    return bits.join('. ')+'.';
  }
  if(vt==='returns'){
    const s=window.lastScout||{};
    const last=s.points&&s.points.at(-1);
    const mode=s.mode||'cagr';
    const n=s.years||4;
    const fmt=mode==='mult'?formatRatioValue:(mode==='roi'?fmtRoi:fmtCagr);
    bits.push('BTC/USD trailing '+(mode==='mult'?'1-year price multiple':n+'-year '+(mode==='roi'?'ROI':'CAGR')));
    if(last) bits.push('currently '+fmt(last.value)+(mode==='mult'?'x':''));
    if(s.lowest) bits.push('lowest '+fmt(s.lowest.value));
    return bits.join('. ')+'.';
  }
  if($('cy')&&$('cy').checked){
    const align={low:'cycle low',high:'cycle high',halving:'halving date',calendar:'4-year calendar'}[$('ca').value]||$('ca').value;
    const mode={usd:'stacked USD',low:'multiple of cycle low',high:'% of cycle high',day0:'relative to day 0'}[$('cp').value]||$('cp').value;
    bits.push('Bitcoin cycles aligned by '+align+', '+mode+(($('l')&&$('l').checked)?', log':''));
  }else{
    const m=currentMarket();
    const market=m==='combinedUSD'?'combined history':marketLabel(m).replace(/ \(USD\)/,'');
    const scale=($('da')&&$('da').checked)?'dual axis (log + linear)':(($('ll')&&$('ll').checked)?'log-log':(($('p')&&$('p').checked)?'percentage':(($('l')&&$('l').checked)?'log':'linear')));
    let line='BTC/USD '+market+', '+scale;
    if($('pl')&&$('pl').checked) line+=' with power law fit';
    const marks=[];
    if($('ch')&&$('ch').checked) marks.push('cycle highs');
    if($('cl')&&$('cl').checked) marks.push('cycle lows');
    if($('hv')&&$('hv').checked) marks.push('halvings');
    if(typeof epochEnabled==='function'&&epochEnabled()) marks.push('colored by halving epoch');
    if(marks.length) line+=' ('+marks.join(', ')+')';
    bits.push(line);
  }
  if($('pl')&&$('pl').checked&&window.lastPowerFit){
    const f=window.lastPowerFit;
    bits.push('log₁₀(price) = '+f.a.toFixed(3)+' + '+f.b.toFixed(3)+'·log₁₀(days), R²='+f.r2.toFixed(3));
  }
  if(bars.length){
    const last=bars.at(-1);
    bits.push('Last $'+Number(last.close).toLocaleString('en-US',{maximumFractionDigits:0})+' on '+isoUTC(last.time));
  }
  if(window.lastRatio&&window.lastRatio.last){
    bits.push(typeof ratioRankText==='function'?ratioRankText(window.lastRatio):(window.lastRatio.title+' '+formatRatioValue(window.lastRatio.last.value)));
  }
  if(window.lastAnns&&window.lastAnns.length){
    bits.push('Flat spans: '+window.lastAnns.map(m=>m.label).join('; '));
  }
  return bits.join('. ')+'.';
}
function xIntentUrl(text,url){
  const u=new URL('https://x.com/intent/post');
  if(text) u.searchParams.set('text',text);
  if(url) u.searchParams.set('url',url);
  return u.toString();
}
function openXIntent(text,url){
  window.open(xIntentUrl(text,url),'_blank','noopener,noreferrer');
}
function shareMenuEl(){return $('shareMenu')}
function setShareMenu(open){
  const menu=shareMenuEl(), btn=$('postToX');
  if(!menu||!btn) return;
  menu.hidden=!open;
  btn.setAttribute('aria-expanded',open?'true':'false');
}
function toggleShareMenu(e){
  if(e) e.preventDefault();
  const menu=shareMenuEl(); if(!menu) return;
  setShareMenu(menu.hidden);
}
function postLinkToX(e){
  if(e) e.preventDefault();
  setShareMenu(false);
  openXIntent(shareCaption(), currentPermalink());
}
async function postImageToX(e){
  if(e) e.preventDefault();
  setShareMenu(false);
  const caption=shareCaption(), url=currentPermalink();
  let file=null;
  try{
    const canvas=await composeChartImage();
    const blob=await canvasToBlob(canvas);
    file=new File([blob],exportFilename(),{type:'image/png'});
  }catch(err){
    flashCopyStatus('Export failed');
    openXIntent(caption,url);
    return;
  }
  if(isMobileUa()&&typeof navigator.share==='function'){
    try{
      const payload={files:[file],title:chartTitleLine(),text:caption,url};
      if(!navigator.canShare||navigator.canShare({files:[file]})){
        await navigator.share(payload);
        return;
      }
    }catch(err){
      if(err&&err.name==='AbortError') return;
    }
  }
  try{
    if(!navigator.clipboard||!window.ClipboardItem) throw new Error('clipboard unavailable');
    const payload=isLikelyIOS()?Promise.resolve(file):file;
    await navigator.clipboard.write([new ClipboardItem({'image/png':payload})]);
    flashCopyStatus('Image copied — paste it into the post (Ctrl/Cmd+V)',8000);
  }catch(err){
    flashCopyStatus('Could not copy image — the post will include the link',5000);
  }
  openXIntent(caption,url);
}
window.shareCaption=shareCaption;
window.currentPermalink=currentPermalink;
window.xIntentUrl=xIntentUrl;

// ---- events ----
document.querySelectorAll('#scaleToggle button').forEach(b=>b.onclick=()=>{
  const mode=b.dataset.scale||(b.dataset.l==='1'?'log':'linear');
  if(mode==='loglog'){$('ll').checked=true;$('l').checked=false;$('p').checked=false}
  else if(mode==='log'){$('ll').checked=false;$('l').checked=true;$('p').checked=false}
  else {$('ll').checked=false;$('l').checked=false;$('p').checked=false}
  draw(1)});
document.querySelectorAll('#viewToggle button').forEach(b=>b.onclick=()=>{const want=b.dataset.cy==='1';
  if($('vt')) $('vt').value='';
  if($('cy').checked===want && !want){draw(1);return}
  $('cy').checked=want;if(want)$('p').checked=false;draw(1)});
$('vt')&&$('vt').addEventListener('change',()=>{if($('vt').value)$('cy').checked=false;draw(1)});
['pma','pmm','rm','rn','rcl','pb','pbp','blp','blw','ym','ott','rb'].forEach(id=>$(id)&&$(id).addEventListener('change',()=>draw(1)));
['otdMonth','otdDay'].forEach(id=>$(id)&&$(id).addEventListener('change',()=>{
  if(typeof writeOnThisDay==='function') writeOnThisDay({m:parseInt($('otdMonth').value,10),d:parseInt($('otdDay').value,10)});
  draw(1);
}));
$('blw')&&$('blw').addEventListener('input',()=>{if($('blwVal'))$('blwVal').textContent=$('blw').value});
$('annAdd')&&$('annAdd').addEventListener('click',()=>{
  const a=$('annStart')&&$('annStart').value, b=$('annEnd')&&$('annEnd').value;
  if(!a||!b){flashCopyStatus('Choose a start and end date',2500);return}
  if(typeof addFlatSpan==='function') addFlatSpan(a,b);
  draw(1);
});
$('annList')&&$('annList').addEventListener('click',e=>{
  const btn=e.target.closest('[data-ann-remove]'); if(!btn) return;
  if(typeof removeFlatSpan==='function') removeFlatSpan(+btn.dataset.annRemove);
  draw(1);
});
$('chartoptions').addEventListener('change',e=>{if(e.target.id==='c'){if($('c').checked)setCustomDefaults();else{$('s').value=$('e').value=''}syncCustom()}
  if(e.target.id==='r'){$('c').checked=false;$('s').value=$('e').value='';syncCustom()}draw(1)});
$('ca').addEventListener('change',()=>draw(1));
['ch','cl','hv','pl','ep'].forEach(id=>$(id)&&$(id).addEventListener('change',()=>draw(1)));
$('cp').addEventListener('change',()=>draw(1));
$('SubmitButton').onclick=()=>draw(1);
const shift=d=>{if(!$('c').checked){$('c').checked=true;setCustomDefaults();syncCustom()}
  for(const id of['s','e'])$(id).value=fmtD(new Date(Date.parse($(id).value)+d*864e5));draw(1)};
$('Prev').onclick=()=>shift(-1);$('Next').onclick=()=>shift(1);
$('getPermalink').onclick=e=>{e.preventDefault();$('permalinkbox').hidden=!$('permalinkbox').hidden;$('permalink').select()};
$('copyImage').onclick=copyChartImage;
$('postToX')&&($('postToX').onclick=toggleShareMenu);
$('shareMenu')&&$('shareMenu').addEventListener('click',e=>{
  const btn=e.target.closest('[data-share]'); if(!btn) return;
  if(btn.dataset.share==='image') postImageToX(e); else postLinkToX(e);
});
document.addEventListener('click',e=>{
  const wrap=e.target.closest&&e.target.closest('.share-wrap');
  if(!wrap) setShareMenu(false);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape') setShareMenu(false)});
$('downloadPng').onclick=downloadChartPng;
$('loadRaw').onclick=toggleTable;
$('downloadCsv').onclick=downloadCsv;
$('larger').onclick=e=>{e.preventDefault();document.body.classList.toggle('wide')};
window.onpopstate=()=>{if(isClassicPage()&&hashHasAdvanced(location.hash)){location.replace(pageHref('advanced', location.hash.slice(1)));return}parseHash(location.hash.slice(1));initTheme();syncCustom();syncViewToggle();draw(0)};
// init: original defaults = 60 days, candlestick, MA 10/25 lengths, volume on
if(isClassicPage()&&hashHasAdvanced(location.hash)){location.replace(pageHref('advanced', location.hash.slice(1)));}
else{parseHash(location.hash.slice(1));initTheme();syncCustom();syncViewToggle();draw(2);}

window.isDark=isDark;
window.chartTheme=chartTheme;
window.applyTheme=applyTheme;
