// Chart Scout helpers and views. Epoch coloring is reused by price, log-log, and scout charts.
const EPOCH_COLORS=['#9e9e9e','#1565c0','#f9a825','#2e7d32','#212121'];
const EPOCH_NAMES=['Epoch 1','Epoch 2','Epoch 3','Epoch 4','Epoch 5'];

function epochIndex(t){
  let i=0;
  for(const h of HALVINGS){if(t>=h.time)i++;else break}
  return i;
}
function epochColor(t){return EPOCH_COLORS[epochIndex(t)]||EPOCH_COLORS[0]}

// Split {time,value} points into contiguous epoch segments, repeating the
// boundary point so the line appears continuous.
function splitByEpoch(points){
  const groups=EPOCH_COLORS.map((color,i)=>({epoch:i+1,color,name:EPOCH_NAMES[i],data:[]}));
  let prevEp=-1;
  for(const p of points||[]){
    if(!p||p.value==null||!isFinite(p.value)) continue;
    const ep=epochIndex(p.time);
    if(prevEp>=0&&ep!==prevEp) groups[prevEp].data.push(p);
    groups[ep].data.push(p);
    prevEp=ep;
  }
  return groups.filter(g=>g.data.length);
}

function addEpochLineSeries(chart, points, opts){
  opts=opts||{};
  const series=[];
  const groups=splitByEpoch(points);
  groups.forEach((g,i)=>{
    const last=i===groups.length-1;
    const s=chart.addLineSeries({
      color:g.color,
      lineWidth:opts.lineWidth||2,
      title:opts.titles?g.name:'',
      priceLineVisible:!!opts.priceLineVisible,
      lastValueVisible:!!(opts.lastValueVisible&&last),
      crosshairMarkerVisible:last,
      priceFormat:opts.priceFormat,
    });
    s.setData(g.data);
    series.push(s);
  });
  return series;
}

function addEpochCandleSeries(chart, bars, kind){
  const groups=EPOCH_COLORS.map((color,i)=>({color,data:[]}));
  for(const b of bars||[]){
    if(!b) continue;
    groups[epochIndex(b.time)].data.push(b);
  }
  const series=[];
  for(const g of groups){
    if(!g.data.length) continue;
    let s;
    if(kind==='O'){
      s=chart.addBarSeries({upColor:g.color,downColor:g.color,thinBars:false,borderColor:g.color});
    }else{
      s=chart.addCandlestickSeries({
        upColor:g.color,downColor:g.color,borderVisible:false,
        wickUpColor:g.color,wickDownColor:g.color,
      });
    }
    s.setData(g.data);
    series.push(s);
  }
  return series;
}

function drawEpochUplotLine(u, xs, barAt){
  const ctx=u.ctx, pr=u.pxRatio||window.devicePixelRatio||1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
  ctx.clip();
  ctx.lineWidth=2*pr;
  ctx.lineJoin='round';
  ctx.lineCap='round';
  let ep=-1;
  const flush=()=>{if(ep>=0){ctx.strokeStyle=EPOCH_COLORS[ep];ctx.stroke()}};
  for(let i=0;i<xs.length;i++){
    const b=barAt[i], d=xs[i], px=b&&b.close;
    if(!(d>0)||!(px>0)) continue;
    const e=epochIndex(b.time);
    const x=u.valToPos(d,'x',true), y=u.valToPos(px,'y',true);
    if(!isFinite(x)||!isFinite(y)) continue;
    if(e!==ep){
      flush();
      ctx.beginPath();
      ctx.moveTo(x,y);
      ep=e;
    }else ctx.lineTo(x,y);
  }
  flush();
  ctx.restore();
}

function paintEpochLegend(ctx, x, y, dpr, opts){
  opts=opts||{};
  const size=Math.round((opts.fontSize||11)*dpr);
  ctx.save();
  ctx.font=size+'px Verdana,Arial,sans-serif';
  ctx.textBaseline='middle';
  ctx.textAlign='left';
  const box=Math.round(10*dpr), gap=Math.round(14*dpr), row=Math.round(16*dpr);
  let cy=y;
  const items=opts.items||EPOCH_NAMES.map((name,i)=>({name,color:EPOCH_COLORS[i]}));
  for(const it of items){
    ctx.fillStyle=it.color;
    ctx.fillRect(x,cy-box/2,box,box);
    ctx.fillStyle='#333';
    ctx.fillText(it.name,x+box+Math.round(5*dpr),cy);
    cy+=row;
  }
  ctx.restore();
  return cy;
}

function setEpochLegend(on){
  const el=$('epochLegend');
  if(!el) return;
  if(!on){el.hidden=true;el.innerHTML='';return}
  el.innerHTML=EPOCH_NAMES.map((name,i)=>
    `<span class="leg-item"><span class="swatch" style="background:${EPOCH_COLORS[i]}"></span>${name}</span>`
  ).join('');
  el.hidden=false;
}

function epochEnabled(){return !!( $('ep')&&$('ep').checked )}


let lastRatio=null;
function ratioKind(){return ($('rp')&&$('rp').value)||''}
function isMayerRatio(kind, ma, len){
  return kind==='mayer'||(ma==='SMA'&&+len===200);
}

function weeklySmaOnDaily(daily, weeks){
  const rows=daily.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume||0]);
  const off=345600;
  const weeksRows=typeof aggregate==='function'?aggregate(rows,604800,off):[];
  const sma=TA.SMA(weeksRows.map(r=>r[4]),weeks);
  const pts=weeksRows.map((r,i)=>({time:r[0],value:sma[i]}));
  let j=0;
  return daily.map(b=>{
    while(j+1<pts.length && pts[j+1].time<=b.time) j++;
    const p=pts[j];
    if(!p||p.time>b.time||!(p.value>0)) return null;
    return p.value;
  });
}
function maSpec(kind){
  if(kind==='200d'||kind==='mayer') return {kind:'200d',days:200,title:'Mayer Multiple',source:'200-day SMA',name:'200-day SMA'};
  if(kind==='100w') return {kind:'100w',weeks:100,title:'Price / 100-week SMA',source:'100-week SMA',name:'100-week SMA'};
  if(kind==='200w') return {kind:'200w',weeks:200,title:'Price / 200-week SMA',source:'200-week SMA',name:'200-week SMA'};
  return null;
}
function overlayForMa(daily, kind){
  const spec=maSpec(kind);
  if(!spec) return null;
  if(spec.days) return {spec, values:TA.SMA(daily.map(b=>b.close),spec.days)};
  return {spec, values:weeklySmaOnDaily(daily,spec.weeks)};
}
function percentiles(values, ps){
  const a=values.filter(v=>v!=null&&isFinite(v)&&v>0).slice().sort((x,y)=>x-y);
  if(!a.length) return ps.map(()=>null);
  return ps.map(p=>{
    const i=(a.length-1)*p/100;
    const lo=Math.floor(i), hi=Math.ceil(i);
    return a[lo]+(hi>lo?(a[hi]-a[lo])*(i-lo):0);
  });
}


const DEFAULT_PCT_LIST='1, 5, 20, 50, 80, 95, 99';
function parsePctList(s){
  const raw=s!=null?s:(($('pb')&&$('pb').value)||DEFAULT_PCT_LIST);
  const out=[];
  for(const part of String(raw).split(/[,\s]+/)){
    if(!part) continue;
    const n=parseFloat(part);
    if(isFinite(n)&&n>=0&&n<=100) out.push(+n);
  }
  return [...new Set(out)].sort((a,b)=>a-b);
}
function percentileRank(values, v){
  const a=values.filter(x=>x!=null&&isFinite(x)).slice().sort((x,y)=>x-y);
  if(!a.length||v==null||!isFinite(v)) return null;
  let le=0;
  for(const x of a){ if(x<=v) le++; else break; }
  return 100*le/a.length;
}
function ordinalPct(n){
  if(n==null||!isFinite(n)) return '';
  const s=Math.round(n);
  const m=Math.abs(s)%100, d=Math.abs(s)%10;
  const suf=(m>=11&&m<=13)?'th':d===1?'st':d===2?'nd':d===3?'rd':'th';
  return s+suf;
}
function pctBandColor(p){
  const t=Math.max(0,Math.min(1,(+p)/100));
  const hex=c=>('0'+Math.round(c).toString(16)).slice(-2);
  const lerp=(a,b,u)=>a+(b-a)*u;
  const parse=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const A=t<0.5?parse('#1565c0'):parse('#f9a825');
  const B=t<0.5?parse('#9e9e9e'):parse('#c62828');
  const u=t<0.5?t/0.5:(t-0.5)/0.5;
  return '#'+hex(lerp(A[0],B[0],u))+hex(lerp(A[1],B[1],u))+hex(lerp(A[2],B[2],u));
}
function formatBandPrice(v){
  if(!(v>0)) return '';
  if(v>=1000) return '$'+Math.round(v).toLocaleString('en-US');
  return '$'+usd(v);
}
function attachRatioPercentiles(computed){
  if(!computed||!computed.points||!computed.points.length) return computed;
  const list=parsePctList();
  const vals=computed.points.map(p=>p.value);
  const levels=list.map(p=>({p,value:percentiles(vals,[p])[0],color:pctBandColor(p)}));
  const rankByTime=new Map();
  for(const p of computed.points) rankByTime.set(p.time, percentileRank(vals,p.value));
  computed.pctList=list;
  computed.pctLevels=levels;
  computed.pctRank=computed.last?rankByTime.get(computed.last.time):null;
  computed.pctRankByTime=rankByTime;
  lastRatio=computed;
  return computed;
}
function ratioRankText(computed){
  if(!computed||!computed.last) return '';
  const name=computed.short||computed.title||'Ratio';
  let s=name+' '+formatRatioValue(computed.last.value);
  if(computed.pctRank!=null) s+=', '+ordinalPct(computed.pctRank)+' pct';
  return s;
}
function addRatioPctLines(ls, computed){
  if(!ls||!computed||!computed.pctLevels) return;
  for(const lv of computed.pctLevels){
    if(lv.value==null||!isFinite(lv.value)) continue;
    ls.createPriceLine({price:lv.value,color:lv.color||'#888',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:lv.p+'%: '+formatRatioValue(lv.value)});
  }
}
function priceBandsOn(){return !!($('pbp')&&$('pbp').checked)}
function projectPlOverlay(fromTime, fit, tEnd){
  if(!fit||!(fromTime>0)) return [];
  const end=tEnd||(typeof daysTo2030==='function'?GENESIS+daysTo2030()*86400:fromTime);
  if(!(end>fromTime)) return [];
  const n=80, out=[];
  for(let i=1;i<=n;i++){
    const t=Math.round(fromTime+(end-fromTime)*i/n);
    const d=daysSinceGenesis(t);
    const o=d>0?powerLawPrice(d,fit.a,fit.b):null;
    if(o>0) out.push({time:t,overlay:o});
  }
  return out;
}
function addPricePercentileBands(chart, computed, opts){
  opts=opts||{};
  if(!priceBandsOn()||!chart||!computed||!computed.pctLevels||!computed.points) return [];
  let extras=[];
  if(opts.project!==false && (computed.kind==='pl'||opts.fit)){
    const fit=opts.fit||window.lastPowerFit||(typeof fitPowerLaw==='function'?fitPowerLaw((bars||[]).filter(b=>b&&b.close>0)):null);
    if(fit) extras=projectPlOverlay(computed.points.at(-1).time, fit, opts.tEnd);
  }
  const series=[];
  for(const lv of computed.pctLevels){
    if(lv.value==null||!isFinite(lv.value)) continue;
    const data=computed.points.map(pt=>({time:pt.time,value:lv.value*pt.overlay}))
      .concat(extras.map(p=>({time:p.time,value:lv.value*p.overlay})));
    if(!data.length) continue;
    const last=data.at(-1).value;
    const s=chart.addLineSeries({
      color:lv.color||'#888',
      lineWidth:1,
      lineStyle:2,
      priceLineVisible:false,
      lastValueVisible:true,
      crosshairMarkerVisible:false,
      title:lv.p+'% '+formatBandPrice(last),
    });
    s.setData(data);
    series.push(s);
  }
  return series;
}
function drawUplotHLines(u, pr, levels, opts){
  opts=opts||{};
  const ctx=u.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
  ctx.clip();
  ctx.font=(10*pr)+'px Verdana,Arial,sans-serif';
  ctx.textBaseline='bottom';
  ctx.textAlign='right';
  const right=u.bbox.left+u.bbox.width-2*pr;
  for(const lv of levels||[]){
    const yv=opts.yOf?opts.yOf(lv):lv.value;
    const y=u.valToPos(yv,'y',true);
    if(!isFinite(y)) continue;
    ctx.beginPath();
    ctx.moveTo(u.bbox.left,y);
    ctx.lineTo(u.bbox.left+u.bbox.width,y);
    ctx.strokeStyle=lv.color||opts.color||'#888';
    ctx.lineWidth=1*pr;
    ctx.setLineDash([6*pr,5*pr]);
    ctx.stroke();
    const fmt=opts.format||formatRatioValue;
    const label=opts.label?opts.label(lv):((lv.p!=null?lv.p+'%: ':'')+fmt(yv));
    if(label){
      ctx.setLineDash([]);
      ctx.fillStyle=lv.color||'#555';
      ctx.fillText(label, right, y-2*pr);
    }
  }
  ctx.restore();
}
function drawUplotPriceBands(u, pr, computed, fit, xMax){
  if(!priceBandsOn()||!computed||!computed.pctLevels||!fit) return;
  const ctx=u.ctx;
  const d0=Math.max(u.scales.x.min||1,1e-6), dEnd=xMax||u.scales.x.max;
  if(!(dEnd>d0)) return;
  const N=240;
  ctx.save();
  ctx.beginPath();
  ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
  ctx.clip();
  ctx.font=(10*pr)+'px Verdana,Arial,sans-serif';
  ctx.textAlign='right';
  ctx.textBaseline='bottom';
  for(const lv of computed.pctLevels){
    if(!(lv.value>0)) continue;
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      const d=d0*Math.pow(dEnd/d0,i/N);
      const p=powerLawPrice(d,fit.a,fit.b)*lv.value;
      const x=u.valToPos(d,'x',true), y=u.valToPos(p,'y',true);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.strokeStyle=lv.color||'#888';
    ctx.lineWidth=1.25*pr;
    ctx.setLineDash([6*pr,5*pr]);
    ctx.stroke();
    const pLast=powerLawPrice(dEnd,fit.a,fit.b)*lv.value;
    const y=u.valToPos(pLast,'y',true);
    if(isFinite(y)){
      ctx.setLineDash([]);
      ctx.fillStyle=lv.color||'#555';
      ctx.fillText(lv.p+'% '+formatBandPrice(pLast), u.bbox.left+u.bbox.width-2*pr, y-2*pr);
    }
  }
  ctx.restore();
}

function computeRatio(bars, kind){
  kind=kind||ratioKind();
  lastRatio=null;
  if(!kind||!bars||!bars.length) return null;
  const C=bars.map(b=>b.close);
  let overlay=null, title, short, source, ma=null, len=null;
  if(kind==='mayer'){
    overlay=TA.SMA(C,200); title='Mayer Multiple'; short='Mayer Multiple'; source='200-day SMA'; ma='SMA'; len=200;
  }else if(kind==='a1'||kind==='a2'){
    ma=$(kind).value; len=parseInt($(kind==='a1'?'m1':'m2').value);
    if(!ma||!(len>0)) return null;
    overlay=TA.MA(ma,C,len);
    source=len+'-day '+ma;
    if(isMayerRatio(kind,ma,len)){title='Mayer Multiple';short='Mayer Multiple'}
    else{title='Price / '+source;short=title}
  }else if(kind==='200d'||kind==='100w'||kind==='200w'){
    const ov=overlayForMa(bars,kind); if(!ov) return null;
    overlay=ov.values; title=ov.spec.title; short=ov.spec.title; source=ov.spec.source; ma='SMA'; len=ov.spec.days||ov.spec.weeks;
  }else if(kind==='pl'){
    const sample=bars.filter(b=>b&&b.close>0);
    const fit=typeof fitPowerLaw==='function'?fitPowerLaw(sample):null;
    if(!fit) return null;
    overlay=bars.map(b=>{
      const d=daysSinceGenesis(b.time);
      return d>0?powerLawPrice(d,fit.a,fit.b):null;
    });
    title='Price / Power Law'; short=title; source='Power Law';
  }else return null;
  const points=[];
  for(let i=0;i<bars.length;i++){
    const o=overlay[i], px=bars[i].close;
    if(!(o>0)||!(px>0)) continue;
    points.push({time:bars[i].time,value:px/o,overlay:o,close:px});
  }
  if(points.length<2) return null;
  lastRatio={kind,title,short,source,overlay,points,last:points.at(-1),ma,len};
  return lastRatio;
}
function formatRatioValue(v){
  if(v==null||!isFinite(v)) return '';
  if(v>=10) return v.toFixed(2);
  return v.toFixed(3);
}
function ensureRatioOverlay(chart, bars){
  const kind=ratioKind();
  if(!kind||!chart||!bars) return;
  const C=bars.map(b=>b.close);
  if(kind==='mayer'){
    const has=($('a1')&&$('a1').value==='SMA'&&+$('m1').value===200)||($('a2')&&$('a2').value==='SMA'&&+$('m2').value===200);
    if(!has){
      const ma=TA.SMA(C,200);
      const s=chart.addLineSeries({color:'#e53935',lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:'200-day SMA'});
      s.setData(bars.map((b,i)=>{const v=ma[i];return v==null||!isFinite(v)?{time:b.time}:{time:b.time,value:v}}));
    }
  }
}
function addRatioPanel(computed, opts){
  opts=opts||{};
  if(!computed||!computed.points||computed.points.length<2) return null;
  const host=opts.host||$('subs');
  const el=document.createElement('div');
  el.className='sub scout-ratio'+(opts.big?' big':'');
  el.innerHTML='<span class="lbl">'+computed.title+'</span>';
  if(opts.prepend&&host.firstChild) host.insertBefore(el,host.firstChild);
  else host.appendChild(el);
  const log=opts.log!=null?!!opts.log:!!($('rpl')&&$('rpl').checked);
  const ch=mkChart(el,{timeScale:{visible:!!opts.timeVisible}});
  if(opts.sync!==false) charts.push(ch);
  attachRatioPercentiles(computed);
  const ls=ch.addLineSeries({
    color:opts.color||'#1565c0',
    lineWidth:1.5,
    priceLineVisible:false,
    lastValueVisible:true,
    priceFormat:{type:'price',precision:3,minMove:0.001},
  });
  ls.setData(computed.points.map(p=>({time:p.time,value:p.value})));
  ls.createPriceLine({price:1,color:'#e53935',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'1.0'});
  addRatioPctLines(ls, computed);
  const bandVals=(computed.pctLevels||[]).map(lv=>lv.value).filter(v=>v!=null&&isFinite(v)&&v>0);
  if(bandVals.length){
    const t0=computed.points[0].time, t1=computed.points.at(-1).time;
    const ghost=ch.addLineSeries({color:'rgba(0,0,0,0)',lineVisible:false,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    ghost.setData([{time:t0,value:Math.min(...bandVals,1)},{time:t1,value:Math.max(...bandVals,1)}]);
  }
  ch.priceScale('right').applyOptions({
    mode:log?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal,
    scaleMargins:{top:.08,bottom:.08},
    minimumWidth:80,
  });
  return {chart:ch,computed};
}

window.EPOCH_COLORS=EPOCH_COLORS;
window.EPOCH_NAMES=EPOCH_NAMES;
window.epochIndex=epochIndex;
window.epochColor=epochColor;
window.splitByEpoch=splitByEpoch;
window.addEpochLineSeries=addEpochLineSeries;
window.addEpochCandleSeries=addEpochCandleSeries;
window.drawEpochUplotLine=drawEpochUplotLine;
window.paintEpochLegend=paintEpochLegend;
window.setEpochLegend=setEpochLegend;
window.epochEnabled=epochEnabled;
Object.defineProperty(window,'lastRatio',{get:()=>lastRatio,set:v=>{lastRatio=v}});
window.computeRatio=computeRatio;
window.addRatioPanel=addRatioPanel;
window.ensureRatioOverlay=ensureRatioOverlay;
window.formatRatioValue=formatRatioValue;
window.ratioKind=ratioKind;
window.parsePctList=parsePctList;
window.percentileRank=percentileRank;
window.ordinalPct=ordinalPct;
window.pctBandColor=pctBandColor;
window.attachRatioPercentiles=attachRatioPercentiles;
window.ratioRankText=ratioRankText;
window.addRatioPctLines=addRatioPctLines;
window.addPricePercentileBands=addPricePercentileBands;
window.priceBandsOn=priceBandsOn;
window.DEFAULT_PCT_LIST=DEFAULT_PCT_LIST;
window.pctBandHeaders=function(c){return (!c||!c.pctLevels||!c.pctLevels.length)?[]:c.pctLevels.map(lv=>lv.p+'% band').concat(['Percentile rank'])};
window.pctBandCells=function(c,overlay,time){
  if(!c||!c.pctLevels||!c.pctLevels.length) return [];
  const cells=c.pctLevels.map(lv=>overlay>0&&lv.value!=null?String(+(overlay*lv.value).toPrecision(6)):'');
  const r=time!=null&&c.pctRankByTime?c.pctRankByTime.get(time):null;
  cells.push(r!=null?r.toFixed(1):'');
  return cells;
};



// ---- scout views ----
let scoutPlots=[];
const YEAR_2030=(Date.UTC(2030,11,31)/1000);
function daysTo2030(){return (YEAR_2030-GENESIS)/86400}
function yearsAheadOfPowerLaw(d,price,fit){
  // Closed-form inversion of the shown fit: days* = 10^((log10(price)-a)/b).
  // Positive = price ahead of the power law; negative = behind/below it.
  if(!(d>0)||!(price>0)||!fit||!fit.b) return null;
  const dStar=Math.pow(10,(Math.log10(price)-fit.a)/fit.b);
  return (dStar-d)/365.25;
}
function formatYearsMonths(years){
  if(years==null||!isFinite(years)) return '';
  const neg=years<0;
  const abs=Math.abs(years);
  let y=Math.floor(abs+1e-9);
  let mo=Math.round((abs-y)*12);
  if(mo===12){y+=1;mo=0}
  const sign=neg?'-':(years>0?'+':'');
  if(y===0&&mo===0) return '0 y 0 mo';
  return sign+y+' y '+mo+' mo';
}
function powerLawEquation(fit){
  if(!fit) return '';
  const coeff=Math.pow(10,fit.a);
  return 'y = '+coeff.toExponential(2)+' × x^'+fit.b.toFixed(2);
}
function scoutView(){return ($('vt')&&$('vt').value)||''}
function clearScoutPlots(){
  scoutPlots.forEach(u=>{try{u.destroy()}catch(e){}});
  scoutPlots=[];
}
function yearSplits(min,max,step){
  const out=[];
  const y0=new Date((GENESIS+Math.max(1,min)*86400)*1000).getUTCFullYear();
  const y1=new Date((GENESIS+max*86400)*1000).getUTCFullYear();
  const st=step||((y1-y0>14)?2:1);
  for(let y=y0;y<=y1;y+=st){
    const d=(Date.UTC(y,0,1)/1000-GENESIS)/86400;
    if(d>=min&&d<=max&&d>0) out.push(d);
  }
  return out;
}
function drawYearLabels(u, pr){
  const min=u.scales.x.min, max=u.scales.x.max;
  if(min==null||max==null) return;
  const ctx=u.ctx;
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,u.width*pr,u.height*pr); ctx.clip();
  ctx.font=(10*pr)+'px Verdana,Arial,sans-serif';
  ctx.fillStyle='#333';
  ctx.textAlign='center';
  ctx.textBaseline='top';
  const axisY=(u.bbox.top+u.bbox.height)+4*pr;
  let lastX=-1e9;
  for(const d of yearSplits(min,max)){
    const x=u.valToPos(d,'x',true);
    if(!isFinite(x)||x<u.bbox.left-4*pr||x>u.bbox.left+u.bbox.width+4*pr) continue;
    if(x-lastX<28*pr) continue;
    ctx.fillText(String(yearAtDays(d)),x,axisY);
    lastX=x;
  }
  ctx.restore();
}
function drawPanelTitle(u, title, pr){
  const ctx=u.ctx;
  ctx.save();
  ctx.font='bold '+(11*pr)+'px Verdana,Arial,sans-serif';
  ctx.fillStyle='#333';
  ctx.textAlign='center';
  ctx.textBaseline='top';
  ctx.fillText(title, u.bbox.left+u.bbox.width/2, Math.max(2*pr, u.bbox.top-16*pr));
  ctx.restore();
}
function makeScoutUplot(host, xs, ys, opts){
  opts=opts||{};
  const w=Math.max(320,host.clientWidth||800), h=Math.max(140,host.clientHeight||200);
  const xMin=opts.xMin, xMax=opts.xMax;
  const uopts={
    width:w,height:h,pxAlign:0,
    cursor:{show:true,drag:{x:true,y:false,setScale:true},points:{show:true},sync:{key:opts.syncKey||'scout-pl'}},
    legend:{show:false},
    scales:{
      x:{time:false,distr:3,log:10,range:(u,min,max)=>[xMin!=null?xMin:min,xMax!=null?xMax:max]},
      y: opts.yLinear?{distr:1}:{distr:3,log:10},
    },
    axes:[
      {scale:'x',stroke:'#333',grid:{stroke:'#eee'},ticks:{stroke:'#ccc'},
        size:opts.xLabels?36:4,space:8,font:'10px Verdana,Arial,sans-serif',
        splits:(u,axisIdx,min,max)=>opts.xLabels?yearSplits(min,max):[],
        values:()=>[]},
      {scale:'y',stroke:'#333',grid:{stroke:'#eee'},ticks:{stroke:'#ccc'},size:64,
        font:'11px Verdana,Arial,sans-serif',
        values:(u,splits)=>splits.map(v=>{
          if(v==null||!isFinite(v)) return '';
          if(opts.yFormat) return opts.yFormat(v);
          if(opts.yLinear) return String(+v.toFixed(2));
          return v>0?(v>=1000?compact(v):String(+v.toPrecision(3))):'';
        })},
    ],
    series:[
      {label:'Days'},
      {label:opts.yLabel||'Y',stroke:opts.stroke||'#1565c0',width:opts.lineWidth||1.5,points:{show:false},
        value:(u,v)=>v==null?'':(opts.yFormat?opts.yFormat(v):String(v))},
    ],
    hooks:Object.assign({
      draw:[u=>{
        const pr=u.pxRatio||window.devicePixelRatio||1;
        if(opts.xLabels) drawYearLabels(u,pr);
        if(opts.title) drawPanelTitle(u,opts.title,pr);
        if(opts.onDraw) opts.onDraw(u,pr);
      }],
    },opts.hooks||{}),
    padding:opts.padding||[18,8,0,0],
  };
  const u=new uPlot(uopts,[xs,ys],host);
  scoutPlots.push(u);
  if(!host._scoutRo){
    host._scoutRo=new ResizeObserver(()=>{
      const nw=host.clientWidth, nh=host.clientHeight;
      if(nw&&nh&&u) u.setSize({width:nw,height:nh});
    });
    host._scoutRo.observe(host);
  }
  return u;
}

function renderPowerLawView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-powerlaw');
  $('charts').classList.remove('has-volume');
  const sample=bars.filter(b=>b&&b.close>0);
  const fit=fitPowerLaw(sample);
  const ratio=computeRatio(bars,'pl');
  if(ratio) attachRatioPercentiles(ratio);
  if(!fit){status('Not enough data for a power law fit.');return}
  const xs=[],ys=[],ratioY=[],aheadY=[],barAt=[];
  for(const b of sample){
    const d=daysSinceGenesis(b.time);
    if(!(d>0)) continue;
    xs.push(d); ys.push(b.close); barAt.push(b);
    const pl=powerLawPrice(d,fit.a,fit.b);
    ratioY.push(pl>0?b.close/pl:null);
    aheadY.push(yearsAheadOfPowerLaw(d,b.close,fit));
  }
  if(xs.length<3){status('Not enough points for a power law chart.');return}
  const xMin=xs[0]*0.92, xMax=Math.max(xs[xs.length-1],daysTo2030());
  const eq=powerLawEquation(fit);
  window.lastPowerFit=fit;
  const yaNow=aheadY.at(-1);
  window.lastYearsAhead=yaNow;
  const yaText=formatYearsMonths(yaNow);
  const el=$('plLegend');
  if(el){
    el.hidden=false;
    el.textContent=powerLawLegendText(fit)+'   ·   Years ahead  '+yaText+(ratio&&ratioRankText(ratio)?'   ·   '+ratioRankText(ratio):'');
  }

  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  const rHost=document.createElement('div'); rHost.className='sub scout-panel';
  const aHost=document.createElement('div'); aHost.className='sub scout-panel';
  $('subs').appendChild(rHost);
  $('subs').appendChild(aHost);

  function drawFit(u,pr){
    const ctx=u.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
    ctx.clip();
    const d0=xs[0], dLast=xs[xs.length-1], dEnd=xMax, N=240;
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      const d=d0*Math.pow(dLast/d0,i/N), p=powerLawPrice(d,fit.a,fit.b);
      const x=u.valToPos(d,'x',true), y=u.valToPos(p,'y',true);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.strokeStyle='#e53935';
    ctx.lineWidth=2*pr;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      const d=dLast*Math.pow(dEnd/Math.max(dLast,1e-6),i/N), p=powerLawPrice(d,fit.a,fit.b);
      const x=u.valToPos(d,'x',true), y=u.valToPos(p,'y',true);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.setLineDash([6*pr,5*pr]);
    ctx.stroke();
    ctx.restore();
    // equation box
    const boxX=u.bbox.left+8*pr, boxY=u.bbox.top+8*pr;
    const line1=eq, line2='R² = '+fit.r2.toFixed(4);
    ctx.save();
    ctx.font=(11*pr)+'px Verdana,Arial,sans-serif';
    const w=Math.max(ctx.measureText(line1).width,ctx.measureText(line2).width)+12*pr, h=32*pr;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.strokeStyle='#333';
    ctx.lineWidth=1*pr;
    ctx.fillRect(boxX,boxY,w,h);
    ctx.strokeRect(boxX,boxY,w,h);
    ctx.fillStyle='#111';
    ctx.textAlign='left';
    ctx.textBaseline='top';
    ctx.fillText(line1,boxX+6*pr,boxY+4*pr);
    ctx.fillText(line2,boxX+6*pr,boxY+17*pr);
    ctx.restore();
  }
  function drawHLine(u,pr,yVal,color){
    const y=u.valToPos(yVal,'y',true);
    if(!isFinite(y)) return;
    const ctx=u.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(u.bbox.left,y);
    ctx.lineTo(u.bbox.left+u.bbox.width,y);
    ctx.strokeStyle=color||'#e53935';
    ctx.lineWidth=1*pr;
    ctx.setLineDash([6*pr,5*pr]);
    ctx.stroke();
    ctx.restore();
  }

  makeScoutUplot(main,xs,ys,{
    xMin,xMax,xLabels:true,stroke:'#1565c0',lineWidth:1.5,
    onDraw:(u,pr)=>{drawFit(u,pr); if(ratio) drawUplotPriceBands(u,pr,ratio,fit,xMax);},
    yFormat:v=>v>=1000?compact(v):(v>=1?String(+v.toPrecision(3)):String(+v.toPrecision(2))),
  });
  makeScoutUplot(rHost,xs,ratioY,{
    xMin,xMax,xLabels:false,stroke:'#1565c0',title:'Price / Power Law',
    onDraw:(u,pr)=>{drawHLine(u,pr,1,'#e53935'); if(ratio&&ratio.pctLevels) drawUplotHLines(u,pr,ratio.pctLevels);},
    yFormat:v=>formatRatioValue(v),
  });
  makeScoutUplot(aHost,xs,aheadY,{
    xMin,xMax,xLabels:true,yLinear:true,stroke:'#1565c0',title:'Years Ahead of Power Law',
    onDraw:(u,pr)=>{
      drawHLine(u,pr,0,'#e53935');
      if(yaText){
        const ctx=u.ctx;
        ctx.save();
        ctx.font='bold '+(11*pr)+'px Verdana,Arial,sans-serif';
        ctx.fillStyle='#333';
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText('Currently '+yaText, u.bbox.left+8*pr, u.bbox.top+6*pr);
        ctx.restore();
      }
    },
    yFormat:v=> (v>=0?'+':'')+v.toFixed(1),
  });

  const top=scoutPlots[0];
  top.root.addEventListener?null:null;
  // hover legend
  scoutPlots.forEach(u=>{
    u.hook||null;
  });
  // Use cursor sync: hook setCursor on the first plot
  const prev=top.hooks&&top.hooks.setCursor;
  const setLeg=u=>{
    const i=u.cursor.idx;
    if(i==null||!barAt[i]){$('legend').textContent='';return}
    const b=barAt[i], d=xs[i];
    const bits=[isoUTC(b.time),'day '+d.toFixed(0),'$'+usd(b.close)];
    if(ratioY[i]!=null){
      let rtxt='Price/PL '+formatRatioValue(ratioY[i]);
      const rk=ratio&&ratio.pctRankByTime?ratio.pctRankByTime.get(b.time):null;
      if(rk!=null) rtxt+=' ('+ordinalPct(rk)+' pct)';
      bits.push(rtxt);
    }
    if(aheadY[i]!=null) bits.push('Years ahead '+formatYearsMonths(aheadY[i]));
    $('legend').textContent=bits.join('  ·  ');
  };
  scoutPlots.forEach(u=>u.setCursor&&null);
  // uPlot cursor sync already shares cursor; attach setCursor via existing hook is hard after construct.
  // Listen on mousemove of each root.
  scoutPlots.forEach(u=>{
    u.root.addEventListener('mousemove',()=>setLeg(u));
    u.root.addEventListener('mouseleave',()=>{$('legend').textContent=[yaText?'Years ahead  '+yaText:'', ratio?ratioRankText(ratio):''].filter(Boolean).join('  ·  ')});
  });
}

async function composeScoutImage(){
  if(!scoutPlots.length) return null;
  await waitPaint();
  const canvases=scoutPlots.map(u=>u.ctx.canvas);
  const cssW=scoutPlots[0].width||canvases[0].clientWidth||canvases[0].width;
  const dpr=canvases[0].width/Math.max(1,cssW);
  const width=Math.max(...canvases.map(c=>c.width));
  const pad=Math.round(16*dpr);
  const titleSize=Math.round(15*dpr), titleH=Math.round(28*dpr);
  const sub=window.lastPowerFit?powerLawEquation(window.lastPowerFit)+'   ·   R²='+window.lastPowerFit.r2.toFixed(4):'';
  const subH=sub?Math.round(18*dpr):0;
  let total=pad+titleH+subH+pad;
  for(const c of canvases) total+=c.height;
  const canvas=document.createElement('canvas');
  canvas.width=width; canvas.height=total;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,total);
  ctx.fillStyle='#222'; ctx.font=titleSize+'px Verdana,Arial,sans-serif'; ctx.textBaseline='top';
  ctx.fillText(chartTitleLine(),pad,pad);
  if(sub){ctx.fillStyle='#b86a00';ctx.font=Math.round(11*dpr)+'px Verdana,Arial,sans-serif';ctx.fillText(sub,pad,pad+titleH-Math.round(8*dpr))}
  let y=pad+titleH+subH;
  canvases.forEach((c,i)=>{
    const x=Math.round((width-c.width)/2);
    ctx.drawImage(c,x,y);
    if(i===0) paintWatermark(ctx,x,y,c.width,c.height,dpr,{loglog:true});
    y+=c.height;
  });
  return canvas;
}

async function renderScout(kind){
  kind=kind||scoutView();
  if(kind==='powerlaw'){renderPowerLawView();return true}
  if(kind==='drawdown'){renderDrawdownView();return true}
  if(kind==='ath'){renderAthView();return true}
  if(kind==='sats'){renderSatsView();return true}
  if(kind==='pricema'){await renderPriceMaView();return true}
  if(kind==='returns'){await renderReturnsView();return true}
  return false;
}

window.scoutView=scoutView;
window.renderScout=renderScout;
window.clearScoutPlots=clearScoutPlots;
window.composeScoutImage=composeScoutImage;
window.yearsAheadOfPowerLaw=yearsAheadOfPowerLaw;
window.formatYearsMonths=formatYearsMonths;
window.powerLawEquation=powerLawEquation;


function computeAthSeries(bars){
  let ath=0;
  const aths=[], athLine=[], dd=[], usable=[];
  for(const b of bars||[]){
    if(!b||!(b.close>0)) continue;
    usable.push(b);
    if(b.close>ath){ath=b.close;aths.push({time:b.time,price:b.close})}
    athLine.push({time:b.time,value:ath});
    dd.push({time:b.time,value:ath?(b.close/ath-1)*100:0});
  }
  return {aths,athLine,dd,bars:usable};
}
function syncScoutLw(){
  charts.forEach(c=>c.priceScale('right').applyOptions({minimumWidth:80}));
  charts.forEach(c=>c.timeScale().subscribeVisibleLogicalRangeChange(r=>{
    if(syncing||!r)return;syncing=true;charts.forEach(o=>o!==c&&o.timeScale().setVisibleLogicalRange(r));syncing=false;
  }));
  if(charts[0]){charts[0].timeScale().fitContent();setTimeout(()=>charts[0].timeScale().fitContent(),50)}
}
function hookLegend(chart, fmt){
  chart.subscribeCrosshairMove(p=>{
    const t=p&&p.time;
    $('legend').textContent=t&&fmt?fmt(t):'';
  });
}

function renderDrawdownView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-drawdown');
  $('charts').classList.remove('has-volume');
  const series=computeAthSeries(bars);
  window.lastScout={kind:'drawdown',series};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  const ddChart=mkChart(main,{});
  charts.push(ddChart);
  ddChart.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Normal,scaleMargins:{top:.05,bottom:.08},
    autoScale:true});
  const area=ddChart.addBaselineSeries({
    baseValue:{type:'price',price:0},
    topLineColor:'transparent',topFillColor1:'transparent',topFillColor2:'transparent',
    bottomLineColor:'#e53935',bottomFillColor1:'rgba(229,57,53,0.92)',bottomFillColor2:'rgba(229,57,53,0.85)',
    lineWidth:1,priceLineVisible:false,lastValueVisible:true,
    title:'Drawdown',
    priceFormat:{type:'custom',minMove:0.1,formatter:v=>v.toFixed(0)+'%'},
  });
  area.setData(series.dd);
  ddChart.priceScale('right').applyOptions({scaleMargins:{top:.02,bottom:.05}});

  const host=document.createElement('div');
  host.className='sub scout-panel scout-price';
  host.innerHTML='<span class="lbl">Price (USD) + ATH</span>';
  $('subs').appendChild(host);
  const px=mkChart(host,{localization:{priceFormatter:compact}});
  charts.push(px);
  px.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Logarithmic,scaleMargins:{top:.06,bottom:.08}});
  const close=px.addLineSeries({color:'#f9a825',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'Close'});
  close.setData(series.bars.map(b=>({time:b.time,value:b.close})));
  const ath=px.addLineSeries({color:'#616161',lineWidth:1.5,lineStyle:2,priceLineVisible:false,lastValueVisible:false,title:'ATH'});
  ath.setData(series.athLine);
  hookLegend(px,t=>{
    const b=series.bars.find(x=>x.time===t); if(!b) return '';
    const d=series.dd.find(x=>x.time===t);
    const a=series.athLine.find(x=>x.time===t);
    return isoUTC(t)+'  ·  $'+usd(b.close)+(a?'  ·  ATH $'+usd(a.value):'')+(d?'  ·  DD '+d.value.toFixed(1)+'%':'');
  });
  syncScoutLw();
}



function daysBetweenAths(aths, bars){
  if(!aths.length||!bars.length) return [];
  let i=0, last=aths[0].time;
  const pts=[];
  for(const b of bars){
    if(i+1<aths.length && b.time>=aths[i+1].time){
      // peak at the new ATH bar, then reset
      pts.push({time:b.time,value:(aths[i+1].time-last)/86400});
      last=aths[i+1].time;
      i++;
      continue;
    }
    pts.push({time:b.time,value:Math.max(0,(b.time-last)/86400)});
  }
  return pts;
}

function renderAthView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-ath');
  $('charts').classList.remove('has-volume');
  const series=computeAthSeries(bars);
  const between=daysBetweenAths(series.aths, series.bars);
  window.lastScout={kind:'ath',series,between};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  const px=mkChart(main,{localization:{priceFormatter:compact}});
  charts.push(px);
  px.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Logarithmic,scaleMargins:{top:.06,bottom:.08}});
  const barsHist=px.addHistogramSeries({
    priceScaleId:'athbar',priceLineVisible:false,lastValueVisible:false,base:0,
  });
  px.priceScale('athbar').applyOptions({visible:false,scaleMargins:{top:0,bottom:0}});
  barsHist.setData(series.aths.map(a=>({time:a.time,value:1,color:'rgba(120,120,120,0.4)'})));
  const close=px.addLineSeries({color:'#f9a825',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'Close'});
  close.setData(series.bars.map(b=>({time:b.time,value:b.close})));

  const host=document.createElement('div');
  host.className='sub scout-panel';
  host.innerHTML='<span class="lbl">Days Between ATHs</span>';
  $('subs').appendChild(host);
  const ch=mkChart(host,{});
  charts.push(ch);
  ch.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Normal,scaleMargins:{top:.08,bottom:.08}});
  const saw=ch.addLineSeries({color:'#e53935',lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,title:'Days'});
  saw.setData(between);
  hookLegend(px,t=>{
    const b=series.bars.find(x=>x.time===t); if(!b) return '';
    const isAth=series.aths.some(a=>a.time===t);
    const d=between.find(x=>x.time===t);
    return isoUTC(t)+'  ·  $'+usd(b.close)+(isAth?'  ·  ATH':'')+(d?'  ·  '+Math.round(d.value)+' days since previous ATH':'');
  });
  hookLegend(ch,t=>{
    const d=between.find(x=>x.time===t);
    return d?isoUTC(t)+'  ·  '+Math.round(d.value)+' days since previous ATH':'';
  });
  syncScoutLw();
}



function formatSats(n){
  return Math.round(n).toLocaleString('en-US')+' sats';
}
function attachChartOverlay(chart, paint){
  const host=chart.chartElement();
  if(!host) return null;
  host.style.position='relative';
  const c=document.createElement('canvas');
  c.className='chart-overlay';
  host.appendChild(c);
  const redraw=()=>{
    const dpr=window.devicePixelRatio||1;
    const w=host.clientWidth, h=host.clientHeight;
    if(!w||!h) return;
    c.width=Math.round(w*dpr); c.height=Math.round(h*dpr);
    c.style.width=w+'px'; c.style.height=h+'px';
    const ctx=c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    paint(ctx,chart,w,h);
  };
  chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
  new ResizeObserver(redraw).observe(host);
  setTimeout(redraw,60);
  setTimeout(redraw,250);
  return {canvas:c,redraw};
}

function renderSatsView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-sats');
  $('charts').classList.remove('has-volume');
  const pts=bars.filter(b=>b&&b.close>0).map(b=>({time:b.time,value:1e8/b.close,close:b.close}));
  window.lastScout={kind:'sats',points:pts};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  const fmt=v=>{
    if(v==null||!isFinite(v)||v<=0) return '';
    if(v>=1000) return Math.round(v).toLocaleString('en-US');
    return String(+v.toPrecision(3));
  };
  const ch=mkChart(main,{localization:{priceFormatter:fmt}});
  charts.push(ch);
  ch.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Logarithmic,scaleMargins:{top:.1,bottom:.1},minimumWidth:96});
  const ss=addEpochLineSeries(ch,pts,{lineWidth:2,lastValueVisible:true});
  setEpochLegend(true);
  const series=ss[ss.length-1]||ss[0];
  const labels=[];
  const t0=pts[0].time, t1=pts.at(-1).time;
  for(const h of HALVINGS){
    if(h.time<t0-40*86400||h.time>t1+40*86400) continue;
    const b=nearestBar(h.time);
    if(!b||!(b.close>0)) continue;
    labels.push({time:b.time,sats:1e8/b.close,text:formatSats(1e8/b.close),kind:'halving'});
  }
  const last=pts.at(-1);
  labels.push({time:last.time,sats:last.value,text:formatSats(last.value),kind:'current'});
  window.lastScout.labels=labels;
  attachChartOverlay(ch,(ctx,chart,w,h)=>{
    if(!series) return;
    ctx.save();
    for(const lab of labels){
      const x=chart.timeScale().timeToCoordinate(lab.time);
      const y=series.priceToCoordinate(lab.sats);
      if(x==null) continue;
      ctx.strokeStyle='#e53935';
      ctx.lineWidth=1.25;
      ctx.setLineDash([5,4]);
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x,h);
      ctx.stroke();
      if(y==null) continue;
      ctx.setLineDash([]);
      ctx.font=(lab.kind==='current'?'bold ':'')+'12px Verdana,Arial,sans-serif';
      ctx.fillStyle=lab.kind==='current'?'#111':'#666';
      ctx.textBaseline='bottom';
      const tw=ctx.measureText(lab.text).width;
      let tx=x+8;
      if(lab.kind==='current'||tx+tw>w-8) tx=x-tw-8;
      ctx.strokeStyle='rgba(255,255,255,0.85)';
      ctx.lineWidth=3;
      ctx.strokeText(lab.text,tx,y-4);
      ctx.fillText(lab.text,tx,y-4);
    }
    ctx.restore();
  });
  hookLegend(ch,t=>{
    const p=pts.find(x=>x.time===t); if(!p) return '';
    return isoUTC(t)+'  ·  $'+usd(p.close)+'  ·  '+formatSats(p.value);
  });
  ch.timeScale().fitContent();
  setTimeout(()=>ch.timeScale().fitContent(),50);
}



async function scoutDailyBars(){
  const raw=await getDaily(currentMarket());
  let all=raw.map(toBar).filter(b=>b&&b.close>0);
  if(bars.length){
    const t1=bars.at(-1).time;
    all=all.filter(b=>b.time<=t1+12*3600);
  }
  return all;
}
function sliceDisplay(all){
  if(!bars.length||!all.length) return all;
  const t0=bars[0].time;
  const cut=all.filter(b=>b.time>=t0);
  return cut.length?cut:all;
}

const PCT_BANDS=[
  {lo:80,hi:100,color:'#e53935',name:'>80th'},
  {lo:60,hi:80,color:'#ef6c00',name:'60–80th'},
  {lo:40,hi:60,color:'#f9a825',name:'40–60th'},
  {lo:20,hi:40,color:'#2e7d32',name:'20–40th'},
  {lo:0,hi:20,color:'#1565c0',name:'<20th'},
];
const PCT_LINE_COLORS={20:'#1565c0',40:'#2e7d32',60:'#c9a000',80:'#ef6c00'};

function bandForRatio(v, pctVals){
  if(v==null||!pctVals) return 2;
  if(v>=pctVals[3]) return 0;
  if(v>=pctVals[2]) return 1;
  if(v>=pctVals[1]) return 2;
  if(v>=pctVals[0]) return 3;
  return 4;
}

async function renderPriceMaView(){
  clearCharts();
  const kind=($('pma')&&$('pma').value)||'200d';
  const mode=($('pmm')&&$('pmm').value)||'panel';
  document.body.classList.add('scout-view','scout-pricema');
  document.body.classList.toggle('scout-osc',mode==='osc');
  $('charts').classList.remove('has-volume');
  const daily=await scoutDailyBars();
  const shown=sliceDisplay(daily);
  const ratio=computeRatio(shown, kind) || computeRatio(daily, kind);
  // Recompute ratio on `shown` but overlay needs warmup from `daily`
  const ov=overlayForMa(daily, kind);
  const spec=ov&&ov.spec;
  let points=[];
  if(ov){
    const idx=new Map(daily.map((b,i)=>[b.time,i]));
    for(const b of shown){
      const i=idx.get(b.time); if(i==null) continue;
      const o=ov.values[i];
      if(!(o>0)||!(b.close>0)) continue;
      points.push({time:b.time,value:b.close/o,overlay:o,close:b.close});
    }
  }
  if(points.length<2){status('Not enough data for this moving average.');return}
  const computed={kind,title:spec.title,short:spec.title,source:spec.source,overlay:ov.values,points,last:points.at(-1)};
  lastRatio=computed;
  const pctVals=percentiles(points.map(p=>p.value),[20,40,60,80]);
  window.lastScout={kind:'pricema',mode,spec,computed,pctVals,shown};

  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';

  if(mode==='osc'){
    setEpochLegend(false);
    const ch=mkChart(main,{localization:{priceFormatter:v=>formatRatioValue(v)}});
    charts.push(ch);
    ch.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Logarithmic,scaleMargins:{top:.08,bottom:.08},minimumWidth:80});
    const groups=PCT_BANDS.map(()=>[]);
    for(const p of points) groups[bandForRatio(p.value,pctVals)].push({time:p.time,value:p.value});
    PCT_BANDS.forEach((b,i)=>{
      if(!groups[i].length) return;
      const s=ch.addLineSeries({
        color:b.color,lineWidth:0,lineVisible:false,
        pointMarkersVisible:true,pointMarkersRadius:3,
        priceLineVisible:false,lastValueVisible:false,title:'',
      });
      s.setData(groups[i]);
    });
    [20,40,60,80].forEach((p,i)=>{
      const v=pctVals[i]; if(!(v>0)) return;
      const dummy=ch.addLineSeries({color:PCT_LINE_COLORS[p],lineWidth:0,lineVisible:false,priceLineVisible:false,lastValueVisible:false});
      dummy.setData([{time:points[0].time,value:v},{time:points.at(-1).time,value:v}]);
      dummy.createPriceLine({price:v,color:PCT_LINE_COLORS[p],lineWidth:1,lineStyle:2,axisLabelVisible:true,title:p+'th '+formatRatioValue(v)});
    });
    hookLegend(ch,t=>{
      const p=points.find(x=>x.time===t); if(!p) return '';
      const band=PCT_BANDS[bandForRatio(p.value,pctVals)];
      return isoUTC(t)+'  ·  $'+usd(p.close)+'  ·  '+computed.title+' '+formatRatioValue(p.value)+(band?'  ·  '+band.name:'');
    });
    const legendItems=PCT_BANDS.map((b,i)=>'<span class="leg-item"><span class="swatch" style="background:'+b.color+'"></span>'+b.name+' '+(pctVals[4-i-1]!=null&&false?'':'')+'</span>').join('');
    // percentile line legend
    const pl=$('epochLegend');
    if(pl){
      pl.hidden=false;
      pl.innerHTML=[20,40,60,80].map((p,i)=>'<span class="leg-item"><span class="swatch" style="background:'+PCT_LINE_COLORS[p]+'"></span>'+p+'th '+formatRatioValue(pctVals[i])+'</span>').join('');
    }
    ch.timeScale().fitContent();
    setTimeout(()=>ch.timeScale().fitContent(),50);
    return;
  }

  // two-panel
  const ch=mkChart(main,{localization:{priceFormatter:compact}});
  charts.push(ch);
  ch.priceScale('right').applyOptions({mode:LW.PriceScaleMode.Logarithmic,scaleMargins:{top:.06,bottom:.08}});
  addEpochLineSeries(ch, shown.map(b=>({time:b.time,value:b.close})),{lineWidth:2,lastValueVisible:true});
  setEpochLegend(true);
  const maPts=shown.map((b,i)=>{
    const p=points.find(x=>x.time===b.time);
    return p?{time:b.time,value:p.overlay}:{time:b.time};
  }).filter(p=>p.value!=null);
  ch.addLineSeries({color:'#e53935',lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:spec.name}).setData(maPts);
  addRatioPanel(computed,{log:true,big:true});
  addPricePercentileBands(ch, computed);

  hookLegend(ch,t=>{
    const b=shown.find(x=>x.time===t); if(!b) return '';
    const p=points.find(x=>x.time===t);
    let text=isoUTC(t)+'  ·  $'+usd(b.close);
    if(p){
      text+='  ·  '+spec.name+' $'+usd(p.overlay)+'  ·  '+computed.title+' '+formatRatioValue(p.value);
      const rank=computed.pctRankByTime?computed.pctRankByTime.get(p.time):null;
      if(rank!=null) text+=' ('+ordinalPct(rank)+' pct)';
    }
    return text;
  });
  syncScoutLw();
}



function rollingLookback(daily, years, mode){
  const pts=[];
  let j=0;
  const need=years*365.25*86400;
  for(let i=0;i<daily.length;i++){
    const t=daily[i].time, c=daily[i].close;
    if(!(c>0)) continue;
    const target=t-need;
    while(j+1<i && daily[j+1].time<=target) j++;
    const prevB=daily[j];
    if(!prevB||prevB.time>target||!(prevB.close>0)) continue;
    const days=(t-prevB.time)/86400;
    if(days<years*365.25*0.92) continue;
    let value;
    if(mode==='cagr') value=(Math.pow(c/prevB.close,365.25/days)-1)*100;
    else if(mode==='roi') value=(c/prevB.close-1)*100;
    else value=c/prevB.close;
    if(!isFinite(value)) continue;
    pts.push({time:t,value,close:c,prev:prevB.close,days});
  }
  return pts;
}
function fmtCagr(v){
  if(v==null||!isFinite(v)) return '';
  const abs=Math.abs(v);
  return (v<0?'-':'')+(abs>=10?abs.toFixed(0):abs.toFixed(1))+'%';
}
function fmtRoi(v){
  if(v==null||!isFinite(v)) return '';
  if(v>=1000) return Math.round(v).toLocaleString('en-US')+'%';
  return fmtCagr(v);
}

async function renderReturnsView(){
  clearCharts();
  const mode=($('rm')&&$('rm').value)||'cagr';
  document.body.classList.add('scout-view','scout-returns');
  document.body.classList.toggle('mode-mult',mode==='mult');
  $('charts').classList.remove('has-volume');
  const years=mode==='mult'?1:(parseInt($('rn')&&$('rn').value)||4);
  const labelsOn=!($('rcl')&&$('rcl').checked===false);
  const daily=await scoutDailyBars();
  const shown=sliceDisplay(daily);
  const pts=rollingLookback(daily, years, mode).filter(p=>!shown.length||p.time>=shown[0].time);
  if(pts.length<2){status('Not enough history for a '+years+'-year window.');return}
  window.lastScout={kind:'returns',mode,years,points:pts};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  const isLog=pts.every(p=>p.value>0);
  const fmt=mode==='mult'?v=>formatRatioValue(v):(mode==='roi'?fmtRoi:fmtCagr);
  const ch=mkChart(main,{localization:{priceFormatter:fmt}});
  charts.push(ch);
  ch.priceScale('right').applyOptions({
    mode:isLog?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal,
    scaleMargins:{top:.1,bottom:.08},minimumWidth:80,
  });

  if(mode==='mult'){
    const up=pts.filter(p=>p.value>=1).map(p=>({time:p.time,value:p.value}));
    const dn=pts.filter(p=>p.value<1).map(p=>({time:p.time,value:p.value}));
    if(up.length) ch.addLineSeries({color:'#2e7d32',lineVisible:false,lineWidth:0,pointMarkersVisible:true,pointMarkersRadius:3,priceLineVisible:false,lastValueVisible:false}).setData(up);
    if(dn.length) ch.addLineSeries({color:'#e53935',lineVisible:false,lineWidth:0,pointMarkersVisible:true,pointMarkersRadius:3,priceLineVisible:false,lastValueVisible:true,title:'Multiple'}).setData(dn.length?dn:up);
    const one=ch.addLineSeries({color:'#999',lineWidth:0,lineVisible:false,priceLineVisible:false,lastValueVisible:false});
    one.setData([{time:pts[0].time,value:1},{time:pts.at(-1).time,value:1}]);
    one.createPriceLine({price:1,color:'#888',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'1.0'});
  }else{
    const color=mode==='roi'?'#f9a825':'#7b1fa2';
    const s=ch.addLineSeries({color,lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:mode==='roi'?'ROI':'CAGR'});
    s.setData(pts.map(p=>({time:p.time,value:p.value})));
    if(mode==='roi'&&isLog){
      for(let n=3;n<=6;n++){
        const g=Math.pow(4,n); // 64, 256, ...
        const min=Math.min(...pts.map(p=>p.value)), max=Math.max(...pts.map(p=>p.value));
        if(g<min||g>max) continue;
        s.createPriceLine({price:g,color:'#bdbdbd',lineWidth:1,lineStyle:0,axisLabelVisible:true,title:g.toLocaleString('en-US')+'%'});
      }
    }
    if(labelsOn){
      const marks=[];
      try{
        const cycles=detectCycles(daily);
        const byT=new Map(pts.map(p=>[p.time,p]));
        const near=t=>{
          let best=null,bd=1e18;
          for(const p of pts){const d=Math.abs(p.time-t); if(d<bd){bd=d;best=p}}
          return bd<20*86400?best:null;
        };
        for(const c of cycles){
          const hi=c.high&&near(c.high.time);
          if(hi) marks.push({time:hi.time,position:'aboveBar',color:'#1565c0',shape:'arrowDown',text:c.year+' peak '+fmt(hi.value)});
          const lo=c.endLow&&near(c.endLow.time);
          if(lo&&(!c.high||c.endLow.time!==c.high.time)){
            const y=new Date(c.endLow.time*1000).getUTCFullYear();
            marks.push({time:lo.time,position:'belowBar',color:'#1565c0',shape:'arrowUp',text:y+' low '+fmt(lo.value)});
          }
        }
      }catch(e){}
      let lo=pts[0];
      for(const p of pts){if(p.value<lo.value) lo=p}
      marks.push({time:lo.time,position:'belowBar',color:'#333',shape:'arrowUp',text:'Lowest: '+fmt(lo.value)});
      window.lastScout.lowest=lo;
      if(marks.length) s.setMarkers(marks);
    }
  }
  hookLegend(ch,t=>{
    const p=pts.find(x=>x.time===t); if(!p) return '';
    return isoUTC(t)+'  ·  $'+usd(p.close)+'  ·  '+fmt(p.value)+(mode==='mult'?'x':'');
  });
  ch.timeScale().fitContent();
  setTimeout(()=>ch.timeScale().fitContent(),50);
}

