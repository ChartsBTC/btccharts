function T(){
  return (typeof chartTheme==='function'&&chartTheme())||{bg:'#fff',text:'#333',grid:'#eee',border:'#ccc',title:'#222',sub:'#b86a00',exportBg:'#fff',exportTitle:'#222',boxBg:'rgba(255,255,255,0.92)',boxStroke:'#333'};
}
// Chart Scout helpers and views. Epoch coloring is reused by price, log-log, and scout charts.
const EPOCH_COLORS_LIGHT=['#9e9e9e','#1565c0','#f9a825','#2e7d32','#212121'];
const EPOCH_COLORS_DARK=['#bdbdbd','#64b5f6','#ffd54f','#81c784','#f5f5f5'];
const EPOCH_COLORS=EPOCH_COLORS_LIGHT.slice();
function syncEpochColors(){const src=(typeof isDark==='function'&&isDark())?EPOCH_COLORS_DARK:EPOCH_COLORS_LIGHT;for(let i=0;i<src.length;i++)EPOCH_COLORS[i]=src[i]}

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
    ctx.fillStyle=T().text;
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
function ratioKind(){if(typeof currentCompare==='function'&&currentCompare())return 'compare';return ($('rp')&&$('rp').value)||''}
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
  if(/^(off|none|false)$/i.test(String(raw).trim())) return [];
  const out=[];
  for(const part of String(raw).split(/[,\s]+/)){
    if(!part) continue;
    const n=parseFloat(part);
    if(isFinite(n)&&n>=0&&n<=100) out.push(+n);
  }
  return [...new Set(out)].sort((a,b)=>a-b);
}
function ratioMaSeconds(spec){
  const m=String(spec||(($('rma')&&$('rma').value)||'')).trim().toLowerCase();
  const n=parseFloat(m);
  if(!isFinite(n)||n<=0) return 0;
  if(m.endsWith('y')) return n*365.25*86400;
  if(m.endsWith('m')) return n*(365.25/12)*86400;
  if(m.endsWith('w')) return n*7*86400;
  if(m.endsWith('d')) return n*86400;
  return n*86400;
}
function trailingTimeMA(points, seconds){
  if(!points||!points.length||!(seconds>0)) return [];
  const out=[];
  let i0=0;
  for(let i=0;i<points.length;i++){
    const t=points[i].time;
    while(i0<i && points[i0].time<t-seconds) i0++;
    if(t-(points[i0]&&points[i0].time||t)<seconds*0.85) continue;
    let s=0,n=0;
    for(let j=i0;j<=i;j++){ const v=points[j].value; if(v>0){s+=v;n++} }
    if(n) out.push({time:t,value:s/n});
  }
  return out;
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
      priceScaleId:typeof series1ScaleId==='function'?series1ScaleId():'right',
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
  }else if(kind==='compare'){
    const cmp=window.lastCompare;
    if(!cmp||!cmp.byTime) return null;
    overlay=bars.map(b=>{const v=cmp.byTime.get(b.time);return v>0?v:null});
    title=cmp.title||'Compare'; short=cmp.short||title; source=cmp.source||'Compare';
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
  const a=Math.abs(v);
  if(a>=1000) return v.toLocaleString('en-US',{maximumFractionDigits:1});
  if(a>=1) return v.toFixed(2);
  if(a>=0.01) return v.toFixed(4);
  if(a>=0.0001) return v.toFixed(6);
  return v.toExponential(2);
}
function ensureRatioOverlay(chart, bars){
  const kind=ratioKind();
  if(!kind||!chart||!bars) return;
  const C=bars.map(b=>b.close);
  if(kind==='mayer'){
    const has=($('a1')&&$('a1').value==='SMA'&&+$('m1').value===200)||($('a2')&&$('a2').value==='SMA'&&+$('m2').value===200);
    if(!has){
      const ma=TA.SMA(C,200);
      const s=chart.addLineSeries({color:'#e53935',lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:'200-day SMA',priceScaleId:typeof series1ScaleId==='function'?series1ScaleId():'right'});
      s.setData(bars.map((b,i)=>{const v=ma[i];return v==null||!isFinite(v)?{time:b.time}:{time:b.time,value:v}}));
    }
  }
}
function addRatioPanel(computed, opts){
  opts=opts||{};
  if(!computed||!computed.points||computed.points.length<2) return null;
  const host=opts.host||$('subs');
  const el=document.createElement('div');
  const fat=opts.big||(($('rma')&&$('rma').value)||($('rme')&&$('rme').checked));
  el.className='sub scout-ratio'+(fat?' big':'');
  el.innerHTML='<span class="lbl">'+computed.title+'</span>';
  if(opts.prepend&&host.firstChild) host.insertBefore(el,host.firstChild);
  else host.appendChild(el);
  const log=opts.log!=null?!!opts.log:!!($('rpl')&&$('rpl').checked);
  const ch=mkChart(el,{timeScale:{visible:!!opts.timeVisible}});
  if(opts.sync!==false) charts.push(ch);
  attachRatioPercentiles(computed);
  const lastV=computed.last&&computed.last.value;
  const prec=lastV!=null&&Math.abs(lastV)<0.01?6:lastV!=null&&Math.abs(lastV)<1?4:3;
  const cols=(typeof compareLineColors==='function'&&computed.kind==='compare')?compareLineColors(currentMarket(),currentCompare()):null;
  const hideEnd=$('el')&&$('el').checked;
  const ls=ch.addLineSeries({
    color:opts.color||(cols&&cols.ratio)||'#1565c0',
    lineWidth:2,
    priceLineVisible:false,
    lastValueVisible:!hideEnd,
    priceFormat:{type:'price',precision:prec,minMove:Math.pow(10,-prec)},
  });
  const ratioTimes=opts.times||((typeof bars!=='undefined'&&bars&&bars.length)?bars.map(b=>b.time):null);
  const ratioPts=typeof window.padPointsToTimes==='function'?window.padPointsToTimes(computed.points.map(p=>({time:p.time,value:p.value})),ratioTimes):computed.points.map(p=>({time:p.time,value:p.value}));
  ls.setData(ratioPts);
  if(typeof window.markAlignSeries==='function') window.markAlignSeries(ch,ls,ratioPts,'right');
  if(!($('rme')&&$('rme').checked)){
    ls.createPriceLine({price:1,color:'#e53935',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'1.0'});
  }
  const maSec=ratioMaSeconds();
  if(maSec>0){
    const ma=trailingTimeMA(computed.points, maSec);
    if(ma.length>1){
      const maSpec=($('rma')&&$('rma').value)||'';
      const ms=ch.addLineSeries({
        color:(cols&&cols.ma)||'#616161',
        lineWidth:2,lineStyle:2,
        priceLineVisible:false,lastValueVisible:false,
        title:(maSpec.replace('y','-year')||'MA')+' MA',
        priceFormat:{type:'price',precision:prec,minMove:Math.pow(10,-prec)},
      });
      ms.setData(typeof window.padPointsToTimes==='function'?window.padPointsToTimes(ma,ratioTimes):ma);
      computed.ma=ma;
      computed.maLast=ma.at(-1);
    }
  }
  if($('rme')&&$('rme').checked){
    const vals=computed.points.map(p=>p.value).filter(v=>v>0&&isFinite(v));
    if(vals.length){
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      computed.mean=mean;
      ls.createPriceLine({price:mean,color:(cols&&cols.mean)||'#9e9e9e',lineWidth:1,lineStyle:3,axisLabelVisible:true,title:'Mean ('+formatRatioValue(mean)+')'});
    }
  }
  const pctOn=parsePctList().length>0;
  if(pctOn) addRatioPctLines(ls, computed);
  const bandVals=pctOn?(computed.pctLevels||[]).map(lv=>lv.value).filter(v=>v!=null&&isFinite(v)&&v>0):[];
  if(bandVals.length){
    const t0=computed.points[0].time, t1=computed.points.at(-1).time;
    const ghost=ch.addLineSeries({color:'rgba(0,0,0,0)',lineVisible:false,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    ghost.setData([{time:t0,value:Math.min(...bandVals,1)},{time:t1,value:Math.max(...bandVals,1)}]);
  }
  ch.priceScale('left').applyOptions({visible:true,minimumWidth:80,borderColor:'#ccc'});
  ch.priceScale('right').applyOptions({
    mode:log?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal,
    scaleMargins:{top:.08,bottom:.08},
    minimumWidth:80,
  });
  if($('el')&&$('el').checked&&computed.last&&typeof attachChartOverlay==='function'){
    const label='Current: '+formatRatioValue(computed.last.value);
    const when=(()=>{const d=new Date(computed.last.time*1000);return d.toLocaleString('en-US',{month:'short',year:'numeric',timeZone:'UTC'})})();
    attachChartOverlay(ch,(ctx,chart,w,h)=>{
      const x=chart.timeScale().timeToCoordinate(computed.last.time);
      const y=ls.priceToCoordinate(computed.last.value);
      if(x==null||y==null) return;
      ctx.save();
      ctx.font='bold 12px Verdana,Arial,sans-serif';
      ctx.textBaseline='bottom';
      const tw=Math.max(ctx.measureText(label).width, ctx.measureText(when).width);
      const px=Math.min(w-tw-10, Math.max(8,x-tw-8));
      const py=y-6;
      const stroke=(typeof isDark==='function'&&isDark())?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.9)';
      ctx.lineWidth=3; ctx.strokeStyle=stroke;
      ctx.fillStyle=(cols&&cols.ratio)||'#1565c0';
      ctx.strokeText(label,px,py-12);
      ctx.fillText(label,px,py-12);
      ctx.strokeText(when,px,py);
      ctx.fillText(when,px,py);
      ctx.beginPath();
      ctx.strokeStyle=(cols&&cols.ratio)||'#1565c0';
      ctx.lineWidth=1.2;
      ctx.moveTo(px+tw+2, py-8);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle=(cols&&cols.ratio)||'#1565c0';
      ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }
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
window.blendCaptionText=blendCaptionText;
window.blendOn=blendOn;

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
  if(window._scoutCanvasCleanup){try{window._scoutCanvasCleanup()}catch(e){}}
  window._scoutCanvasCleanup=null;
  window.scoutCanvas=null;
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
  ctx.fillStyle=T().text;
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
  ctx.fillStyle=T().text;
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
      y: Object.assign(opts.yLinear?{distr:1}:{distr:3,log:10}, opts.yRange?{range:(u,min,max)=>opts.yRange}:{}),
    },
    axes:[
      {scale:'x',stroke:T().text,grid:{stroke:T().grid},ticks:{stroke:T().border},
        size:opts.xLabels?36:4,space:8,font:'10px Verdana,Arial,sans-serif',
        splits:(u,axisIdx,min,max)=>opts.xLabels?yearSplits(min,max):[],
        values:()=>[]},
      {scale:'y',stroke:T().text,grid:{stroke:T().grid},ticks:{stroke:T().border},size:64,
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


function ranksOf(values){
  const idx=[];
  for(let i=0;i<values.length;i++){ const v=values[i]; if(v!=null&&isFinite(v)) idx.push(i); }
  const sorted=idx.map(i=>values[i]).sort((a,b)=>a-b);
  const out=values.map(()=>null);
  const n=sorted.length;
  if(!n) return out;
  for(const i of idx){
    const v=values[i];
    let lo=0, hi=n;
    while(lo<hi){ const m=(lo+hi)>>1; if(sorted[m]<=v) lo=m+1; else hi=m; }
    out[i]=100*lo/n;
  }
  return out;
}
function blendScoreColor(s){
  const t=Math.max(0,Math.min(1,(+s)/100));
  const hex=c=>('0'+Math.round(c).toString(16)).slice(-2);
  const lerp=(a,b,u)=>a+(b-a)*u;
  const parse=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const A=t<0.5?parse('#2e7d32'):parse('#f9a825');
  const B=t<0.5?parse('#f9a825'):parse('#e53935');
  const u=t<0.5?t/0.5:(t-0.5)/0.5;
  return '#'+hex(lerp(A[0],B[0],u))+hex(lerp(A[1],B[1],u))+hex(lerp(A[2],B[2],u));
}
function drawBlendSeries(u, pr, xs, ys){
  const ctx=u.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(u.bbox.left,u.bbox.top,u.bbox.width,u.bbox.height);
  ctx.clip();
  ctx.lineWidth=2*pr;
  ctx.lineJoin='round';
  ctx.lineCap='round';
  ctx.setLineDash([]);
  for(let i=1;i<xs.length;i++){
    if(ys[i]==null||ys[i-1]==null) continue;
    const x0=u.valToPos(xs[i-1],'x',true), y0=u.valToPos(ys[i-1],'y',true);
    const x1=u.valToPos(xs[i],'x',true), y1=u.valToPos(ys[i],'y',true);
    if(!isFinite(x0)||!isFinite(y0)||!isFinite(x1)||!isFinite(y1)) continue;
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
    ctx.strokeStyle=blendScoreColor((ys[i-1]+ys[i])/2);
    ctx.stroke();
  }
  ctx.restore();
}
function blendWeight(){
  const n=parseFloat($('blw')&&$('blw').value);
  return (isFinite(n)?Math.max(0,Math.min(100,n)):50)/100;
}
function blendOn(){return !!($('blp')&&$('blp').checked)}
function blendCaptionText(b){
  if(!b||b.last==null) return '';
  const wr=Math.round(b.weight*100), wa=100-wr;
  return 'Blended '+ordinalPct(b.last)+' pct (Price/PL '+ordinalPct(b.ratioRank)+', Years ahead '+ordinalPct(b.aheadRank)+'), weight '+wr+'/'+wa;
}

function renderPowerLawView(){
  clearCharts();
  const showBlend=blendOn();
  document.body.classList.add('scout-view','scout-powerlaw');
  document.body.classList.toggle('scout-blend',showBlend);
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
  const wRatio=blendWeight();
  const ratioRanks=ranksOf(ratioY);
  const aheadRanks=ranksOf(aheadY);
  const blendY=ratioRanks.map((r,i)=>{
    const a=aheadRanks[i];
    return (r==null||a==null)?null:(wRatio*r+(1-wRatio)*a);
  });
  const lastBlend=blendY.at(-1);
  window.lastBlend=showBlend||lastBlend!=null?{
    weight:wRatio,
    last:lastBlend,
    ratioRank:ratioRanks.at(-1),
    aheadRank:aheadRanks.at(-1),
    points:barAt.map((b,i)=>({time:b.time,blend:blendY[i],ratioRank:ratioRanks[i],aheadRank:aheadRanks[i]})),
  }:null;

  const el=$('plLegend');
  if(el){
    el.hidden=false;
    el.textContent=[powerLawLegendText(fit),'Years ahead  '+yaText, ratio?ratioRankText(ratio):'', showBlend?blendCaptionText(window.lastBlend):''].filter(Boolean).join('   ·   ');
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
    ctx.fillStyle=T().boxBg;
    ctx.strokeStyle=T().boxStroke;
    ctx.lineWidth=1*pr;
    ctx.fillRect(boxX,boxY,w,h);
    ctx.strokeRect(boxX,boxY,w,h);
    ctx.fillStyle=T().text;
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

  if(showBlend){
    const bHost=document.createElement('div'); bHost.className='sub scout-panel';
    $('subs').appendChild(bHost);
    const refLines=parsePctList().map(p=>({p,value:p,color:pctBandColor(p)}));
    makeScoutUplot(bHost,xs,blendY,{
      xMin,xMax,xLabels:true,yLinear:true,yRange:[0,100],
      stroke:'rgba(0,0,0,0)',lineWidth:0,title:'Blended Percentile',
      onDraw:(u,pr)=>{
        drawUplotHLines(u,pr,refLines,{format:v=>Math.round(v)+'%',label:lv=>lv.p+'%'});
        drawBlendSeries(u,pr,xs,blendY);
        const cur=blendCaptionText(window.lastBlend);
        if(cur){
          const ctx=u.ctx;
          ctx.save();
          ctx.font='bold '+(11*pr)+'px Verdana,Arial,sans-serif';
          ctx.fillStyle=T().text;
          ctx.textAlign='left';
          ctx.textBaseline='top';
          ctx.fillText(cur, u.bbox.left+8*pr, u.bbox.top+6*pr);
          ctx.restore();
        }
      },
      yFormat:v=>Math.round(v)+'%',
    });
  }

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
    if(showBlend&&blendY[i]!=null) bits.push('Blended '+ordinalPct(blendY[i])+' pct (Price/PL '+ordinalPct(ratioRanks[i])+', Years ahead '+ordinalPct(aheadRanks[i])+')');
    $('legend').textContent=bits.join('  ·  ');
  };
  scoutPlots.forEach(u=>u.setCursor&&null);
  // uPlot cursor sync already shares cursor; attach setCursor via existing hook is hard after construct.
  // Listen on mousemove of each root.
  scoutPlots.forEach(u=>{
    u.root.addEventListener('mousemove',()=>setLeg(u));
    u.root.addEventListener('mouseleave',()=>{$('legend').textContent=[yaText?'Years ahead  '+yaText:'', ratio?ratioRankText(ratio):'', showBlend?blendCaptionText(window.lastBlend):''].filter(Boolean).join('  ·  ')});
  });
}

async function composeScoutImage(){
  await waitPaint();
  if(window.lastScout&&window.lastScout.kind==='annualreturns'&&typeof composeAnnualReturnsImage==='function'){
    const img=composeAnnualReturnsImage();
    if(img) return img;
  }
  if(window.lastScout&&window.lastScout.kind==='corrections'&&typeof composeCorrectionsImage==='function'){
    const img=composeCorrectionsImage();
    if(img) return img;
  }
  if(window.lastScout&&window.lastScout.kind==='assetreturns'&&typeof composeAssetReturnsImage==='function'){
    const img=composeAssetReturnsImage();
    if(img) return img;
  }
  if(window.scoutCanvas && !scoutPlots.length){
    const src=window.scoutCanvas;
    const cssW=src.clientWidth||src.width, dpr=src.width/Math.max(1,cssW);
    const pad=Math.round(16*dpr), titleSize=Math.round(15*dpr), titleH=Math.round(28*dpr);
    const canvas=document.createElement('canvas');
    canvas.width=src.width; canvas.height=src.height+pad+titleH+pad;
    const ctx=canvas.getContext('2d');
    const th=T();
    ctx.fillStyle=th.exportBg;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=th.exportTitle; ctx.font=titleSize+'px Verdana,Arial,sans-serif'; ctx.textBaseline='top';
    ctx.fillText(chartTitleLine(),pad,pad);
    ctx.drawImage(src,0,pad+titleH);
    // 200w never-down already paints the watermark on the main panel.
    if(!(window.lastScout&&window.lastScout.kind==='200wnevrdown')){
      paintWatermark(ctx,0,pad+titleH,src.width,src.height,dpr,{});
    }
    return canvas;
  }
  if(!scoutPlots.length) return null;
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
  const th=T();
  ctx.fillStyle=th.exportBg; ctx.fillRect(0,0,width,total);
  ctx.fillStyle=th.exportTitle; ctx.font=titleSize+'px Verdana,Arial,sans-serif'; ctx.textBaseline='top';
  ctx.fillText(chartTitleLine(),pad,pad);
  if(sub){ctx.fillStyle=th.sub;ctx.font=Math.round(11*dpr)+'px Verdana,Arial,sans-serif';ctx.fillText(sub,pad,pad+titleH-Math.round(8*dpr))}
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
  if(kind==='epoch'){await renderEpochCandlesView();return true}
  if(kind==='calyear'){await renderCalYearView();return true}
  if(kind==='onthisday'){await renderOnThisDayView();return true}
  if(kind==='hcycles'){await renderHcyclesView();return true}
  if(kind==='spiral'){await renderSpiralView();return true}
  if(kind==='ranges'){await renderRangesView();return true}
  if(kind==='annualreturns'){
    if(typeof isV2Page==='function'&&!isV2Page()) return false;
    await renderAnnualReturnsView();return true
  }
  if(kind==='corrections'){
    if(typeof isV2Page==='function'&&!isV2Page()) return false;
    await renderCorrectionsView();return true
  }
  if(kind==='assetreturns'){
    if(typeof isV2Page==='function'&&!isV2Page()) return false;
    await renderAssetReturnsView();return true
  }
  if(kind==='200wnevrdown'){
    if(typeof isV2Page==='function'&&!isV2Page()) return false;
    await renderNeverDownView();return true
  }
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
function syncScoutLw(times){
  const t=times||(window.lastScout&&window.lastScout.shown?window.lastScout.shown.map(b=>b.time):((typeof bars!=='undefined'&&bars)?bars.map(b=>b.time):null));
  if(typeof window.alignStackedCharts==='function') window.alignStackedCharts(charts,{times:t});
  else {
    charts.forEach(c=>c.priceScale('right').applyOptions({minimumWidth:80}));
    charts.forEach(c=>c.timeScale().subscribeVisibleLogicalRangeChange(r=>{
      if(syncing||!r)return;syncing=true;charts.forEach(o=>o!==c&&o.timeScale().setVisibleLogicalRange(r));syncing=false;
    }));
  }
  if(charts[0]){
    const _refit=()=>{charts[0].timeScale().fitContent();if(typeof window.equalizeChartGutters==='function')window.equalizeChartGutters(charts,t)};
    charts[0].timeScale().fitContent();
    setTimeout(_refit,50);
    setTimeout(_refit,280);
  }
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
  const pxSeries=addEpochLineSeries(ch, shown.map(b=>({time:b.time,value:b.close})),{lineWidth:2,lastValueVisible:true});
  if(typeof window.markAlignSeries==='function') window.markAlignSeries(ch, (pxSeries&&pxSeries.length)?pxSeries[pxSeries.length-1]:pxSeries, shown.map(b=>({time:b.time,value:b.close})),'right');
  setEpochLegend(true);
  const maPts=shown.map((b,i)=>{
    const p=points.find(x=>x.time===b.time);
    return p?{time:b.time,value:p.overlay}:{time:b.time};
  }).filter(p=>p.value!=null);
  ch.addLineSeries({color:'#e53935',lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:spec.name}).setData(maPts);
  addRatioPanel(computed,{log:true,big:true,times:shown.map(b=>b.time)});
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
  syncScoutLw(shown.map(b=>b.time));
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
  window.lastScout={kind:'returns',mode,years,points:pts,shown};
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
window.blendCaptionText=blendCaptionText;
window.blendOn=blendOn;
window.ranksOf=ranksOf;


function epochCandleSlices(daily){
  if(!daily||!daily.length) return [];
  const last=daily.at(-1).time;
  let start=daily[0].time;
  const cuts=HALVINGS.map(h=>h.time).filter(t=>t>start && t<=last);
  const ends=[...cuts, last];
  const out=[];
  for(let i=0;i<ends.length;i++){
    const t1=ends[i];
    const slice=daily.filter(b=>b.time>=start && b.time<=t1);
    if(slice.length){
      const o=slice[0].open, c=slice.at(-1).close;
      out.push({
        epoch:i+1,
        start:slice[0].time,
        end:slice.at(-1).time,
        open:o,
        high:Math.max(...slice.map(b=>b.high)),
        low:Math.min(...slice.map(b=>b.low)),
        close:c,
        volume:slice.reduce((s,b)=>s+(b.volume||0),0),
        pct:o>0?(c/o-1)*100:null,
        label:isoUTC(slice[0].time)+' – '+isoUTC(slice.at(-1).time),
      });
    }
    start=t1+86400;
  }
  return out;
}
function formatUsdBox(v){
  if(v==null||!isFinite(v)) return '';
  if(v>=1000) return '$'+Math.round(v).toLocaleString('en-US');
  if(v>=1) return '$'+Math.round(v);
  const s=v.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  return '$'+s;
}
function attachPaintCanvas(host, paint){
  host.innerHTML='';
  host.style.position='relative';
  const c=document.createElement('canvas');
  c.className='scout-canvas';
  c.style.display='block';
  c.style.width='100%';
  c.style.height='100%';
  host.appendChild(c);
  const redraw=()=>{
    const dpr=window.devicePixelRatio||1;
    const w=host.clientWidth, h=host.clientHeight;
    if(!w||!h) return;
    c.width=Math.round(w*dpr); c.height=Math.round(h*dpr);
    c.style.width=w+'px'; c.style.height=h+'px';
    const ctx=c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    paint(ctx,w,h,c);
  };
  const ro=new ResizeObserver(redraw);
  ro.observe(host);
  const cleanup=()=>{try{ro.disconnect()}catch(e){}; if(c.parentNode)c.parentNode.removeChild(c)};
  window._scoutCanvasCleanup=cleanup;
  window.scoutCanvas=c;
  setTimeout(redraw,30);
  setTimeout(redraw,200);
  return {canvas:c,redraw,cleanup};
}

async function renderEpochCandlesView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-epoch');
  $('charts').classList.remove('has-volume');
  const daily=await scoutDailyBars();
  const shown=sliceDisplay(daily);
  const candles=epochCandleSlices(shown);
  if(candles.length<1){status('Not enough data for epoch candles.');return}
  window.lastScout={kind:'epoch',candles,shown};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  setEpochLegend(false);

  attachPaintCanvas(main,(ctx,w,h,canvas)=>{
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle=T().bg;
    ctx.fillRect(0,0,w,h);
    const padL=64, padR=20, padT=28, padB=52;
    const plotW=w-padL-padR, plotH=h-padT-padB;
    if(plotW<50||plotH<50) return;
    const minP=Math.max(0.005, Math.min(...candles.map(c=>c.low))*0.6);
    const maxP=Math.max(...candles.map(c=>c.high))*1.8;
    const yOf=p=>padT+plotH*(1-(Math.log10(p)-Math.log10(minP))/(Math.log10(maxP)-Math.log10(minP)));
    // grid
    ctx.strokeStyle=T().grid; ctx.lineWidth=1;
    const ticks=[];
    for(const e of [-2,-1,0,1,2,3,4,5,6]) ticks.push(Math.pow(10,e));
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.fillStyle=T().text;
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(const t of ticks){
      if(t<minP||t>maxP) continue;
      const y=yOf(t);
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.strokeStyle='#eee'; ctx.stroke();
      const lab=t>=1000?'$'+compact(t):'$'+String(t);
      ctx.fillStyle='#333'; ctx.fillText(lab, padL-6, y);
    }
    ctx.strokeStyle=T().border;
    ctx.strokeRect(padL,padT,plotW,plotH);

    const n=candles.length, slot=plotW/n, bodyW=Math.min(86, slot*0.42);
    canvas._slots=candles.map((cnd,i)=>{
      const cx=padL+slot*(i+0.5);
      return {candle:cnd,cx,bodyW,yHigh:yOf(cnd.high),yLow:yOf(cnd.low),yOpen:yOf(cnd.open),yClose:yOf(cnd.close)};
    });

    canvas._slots.forEach((s,i)=>{
      const cnd=s.candle;
      const up=cnd.close>=cnd.open;
      const col=up?'#2e7d32':'#e53935';
      const yTop=Math.min(s.yOpen,s.yClose), yBot=Math.max(s.yOpen,s.yClose);
      const bodyH=Math.max(2, yBot-yTop);
      // wick
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(s.cx,s.yHigh); ctx.lineTo(s.cx,s.yLow); ctx.stroke();
      // body
      ctx.fillStyle=col;
      ctx.fillRect(s.cx-s.bodyW/2, yTop, s.bodyW, bodyH);
      // hatch for a bit of texture like the ref? skip
      // % label above wick
      const pl=cnd.pct==null?'':(Math.round(cnd.pct)+'%');
      ctx.font='bold 12px Verdana,Arial,sans-serif';
      ctx.fillStyle=T().text;
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText(pl, s.cx, s.yHigh-6);
      // OHLC box
      const lines=['Open: '+formatUsdBox(cnd.open),'High: '+formatUsdBox(cnd.high),'Low: '+formatUsdBox(cnd.low),'Close: '+formatUsdBox(cnd.close)];
      ctx.font='11px Verdana,Arial,sans-serif';
      const tw=Math.max(...lines.map(t=>ctx.measureText(t).width));
      const boxW=tw+14, boxH=16*lines.length+8;
      let bx=s.cx+s.bodyW/2+8, by=yTop+Math.max(8, bodyH*0.25);
      if(i===n-1){
        // Park the last box in the empty lower-right area, clear of the previous box.
        bx=Math.max(padL+4, s.cx-boxW-8);
        by=padT+plotH-boxH-16;
      }else if(bx+boxW>padL+plotW-6){
        bx=s.cx-s.bodyW/2-8-boxW;
      }
      if(bx<padL+4) bx=padL+4;
      if(by+boxH>padT+plotH-4) by=padT+plotH-4-boxH;
      if(by<padT+4) by=padT+4;
      ctx.fillStyle=T().boxBg;
      ctx.strokeStyle=T().boxStroke; ctx.lineWidth=1;
      ctx.fillRect(bx,by,boxW,boxH);
      ctx.strokeRect(bx,by,boxW,boxH);
      ctx.fillStyle=T().text;
      ctx.textAlign='left'; ctx.textBaseline='top';
      lines.forEach((t,k)=>ctx.fillText(t, bx+7, by+5+k*16));
      // x labels
      ctx.font='10px Verdana,Arial,sans-serif';
      ctx.fillStyle=T().text;
      ctx.textAlign='center'; ctx.textBaseline='top';
      const a=isoUTC(cnd.start), b=isoUTC(cnd.end);
      ctx.fillText(a+' –', s.cx, padT+plotH+8);
      ctx.fillText(b, s.cx, padT+plotH+22);
    });
  });

  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    cnv.addEventListener('mousemove',ev=>{
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left;
      const slots=cnv._slots||[];
      const s=slots.find(sl=>Math.abs(sl.cx-x)<(sl.bodyW+20));
      if(!s){$('legend').textContent='';return}
      const c=s.candle;
      $('legend').textContent='Epoch '+c.epoch+'  ·  '+c.label+'  ·  O '+formatUsdBox(c.open)+' H '+formatUsdBox(c.high)+' L '+formatUsdBox(c.low)+' C '+formatUsdBox(c.close)+(c.pct!=null?'  ·  '+Math.round(c.pct)+'%':'');
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
  }
}
window.formatUsdBox=formatUsdBox;
window.epochCandleSlices=epochCandleSlices;
window.syncEpochColors=syncEpochColors;
window.T=T;


const CALYEAR_COLORS={
  2011:'#90caf9',2012:'#ce93d8',2013:'#80cbc4',2014:'#bcaaa4',2015:'#a5d6a7',2016:'#b0bec5',
  2017:'#c9a227',2018:'#29b6f6',2019:'#fbc02d',2020:'#7e57c2',2021:'#ec407a',
  2022:'#43a047',2023:'#ef9a9a',2024:'#6d4c41',2025:'#fb8c00'
};
function calYearColor(year, current, dark){
  if(year===current) return dark?'#fafafa':'#111';
  return CALYEAR_COLORS[year]||('hsl('+(year*47)%360+' 55% 42%)');
}
function utcYmd(t){
  const d=new Date(t*1000);
  return {y:d.getUTCFullYear(),m:d.getUTCMonth()+1,day:d.getUTCDate()};
}
function dayXOfYear(m, day){
  // x = days since Jan 1 on a leap calendar (2020), so Feb 29 has a slot
  return (Date.UTC(2020,m-1,day)-Date.UTC(2020,0,1))/86400000;
}
function firstBarOfYear(daily, year){
  for(const b of daily){ if(utcYmd(b.time).y===year) return b; }
  return null;
}
function groupDailyByYear(daily){
  const years=new Map();
  for(const b of daily){
    if(!(b&&b.close>0)) continue;
    const {y,m,day}=utcYmd(b.time);
    let arr=years.get(y);
    if(!arr){arr=[];years.set(y,arr)}
    arr.push({bar:b,m,day,x:dayXOfYear(m,day),close:b.close});
  }
  return years;
}
function formatAxisUsd(v, linear){
  if(v==null||!isFinite(v)) return '';
  if(v===0) return '$0';
  const a=Math.abs(v);
  if(a>=1e6) return '$'+(v/1e6).toLocaleString('en-US',{maximumFractionDigits:v%1e6?2:0})+'M';
  if(linear && a>=1000) return '$'+Math.round(v).toLocaleString('en-US');
  if(a>=1000) return '$'+Math.round(v).toLocaleString('en-US');
  if(a>=1) return '$'+Math.round(v);
  return '$'+v.toFixed(2);
}
function niceLinearMax(v){
  if(!(v>0)) return 1;
  const exp=Math.pow(10,Math.floor(Math.log10(v)));
  for(const m of [1,1.2,1.5,2,2.5,3,4,5,6,8,10]){
    if(v<=m*exp) return m*exp;
  }
  return 10*exp;
}
function calYearMode(){return ($('ym')&&$('ym').value)==='idx'?'idx':'raw'}

async function renderCalYearView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-calyear');
  $('charts').classList.remove('has-volume');
  const daily=await scoutDailyBars();
  const byYear=groupDailyByYear(daily);
  const years=[...byYear.keys()].sort((a,b)=>a-b);
  if(!years.length){status('Not enough data for a calendar-year overlay.');return}
  const current=years.at(-1);
  const mode=calYearMode();
  // Raw linear: 2017+ (earlier years hug the axis). Indexed: 2020+ to match the reference scale.
  const minYear=mode==='idx'?2020:2017;
  const shown=years.filter(y=>y>=minYear);
  const jan1=firstBarOfYear(daily, current);
  const jan1Px=jan1?jan1.close:null;
  const series=shown.map(y=>{
    const pts=byYear.get(y).slice();
    const open=firstBarOfYear(daily,y);
    const base=open?open.close:null;
    const values=pts.map(p=>{
      let v=p.close;
      if(mode==='idx'){
        if(!(base>0)||!(jan1Px>0)) v=null;
        else v=p.close/base*jan1Px;
      }
      return {x:p.x,v,m:p.m,day:p.day,bar:p.bar};
    }).filter(p=>p.v!=null&&p.v>0);
    return {year:y,pts:values,current:y===current,open:open&&open.close};
  }).filter(s=>s.pts.length>1);
  window.lastScout={kind:'calyear',mode,current,jan1:jan1Px,series,minYear};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  setEpochLegend(false);
  const last=series.find(s=>s.current);
  const lastPt=last&&last.pts.at(-1);
  status(series.length+' calendar years · '+(mode==='idx'?'indexed to '+current+' Jan 1 '+formatAxisUsd(jan1Px):'raw USD, linear')+(lastPt?' · '+current+' last '+formatAxisUsd(lastPt.v):''));

  attachPaintCanvas(main,(ctx,w,h)=>{
    const th=T();
    const dark=typeof isDark==='function'&&isDark();
    ctx.fillStyle=th.bg; ctx.fillRect(0,0,w,h);
    const padL=72, padR=108, padT=18, padB=44;
    const plotW=w-padL-padR, plotH=h-padT-padB;
    if(plotW<80||plotH<80) return;
    const xMin=0, xMax=dayXOfYear(12,31); // 0..365 inclusive through Dec 31 / next Jan
    let yMin,yMax;
    const allV=series.flatMap(s=>s.pts.map(p=>p.v));
    if(mode==='idx'){
      const lo=Math.min(...allV), hi=Math.max(...allV);
      yMin=Math.max(lo/1.25, 1);
      yMax=hi*1.15;
    }else{
      yMin=0;
      yMax=niceLinearMax(Math.max(...allV)*1.05);
    }
    const xOf=x=>padL+plotW*((x-xMin)/(xMax-xMin));
    const yOf=v=>{
      if(mode==='idx'){
        const a=Math.log(yMin), b=Math.log(yMax);
        return padT+plotH*(1-(Math.log(v)-a)/(b-a));
      }
      return padT+plotH*(1-(v-yMin)/(yMax-yMin));
    };
    // grid + axes
    ctx.font='11px Verdana,Arial,sans-serif';
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    ctx.strokeStyle=th.grid; ctx.lineWidth=1;
    ctx.fillStyle=th.text; ctx.textAlign='center'; ctx.textBaseline='top';
    for(let m=1;m<=12;m++){
      const x=xOf(dayXOfYear(m,1));
      ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+plotH); ctx.stroke();
      ctx.fillText(months[m-1], x, padT+plotH+8);
    }
    // right-edge Jan tick (next year)
    const xEnd=xOf(xMax);
    ctx.beginPath(); ctx.moveTo(xEnd,padT); ctx.lineTo(xEnd,padT+plotH); ctx.stroke();
    if(mode==='idx') ctx.fillText('Jan', xEnd, padT+plotH+8);

    const yTicks=[];
    if(mode==='idx'){
      const start=10000;
      for(let v=start;v<=yMax*1.05;v*=2) yTicks.push(v);
    }else{
      const step=yMax/6;
      for(let i=0;i<=6;i++) yTicks.push(step*i);
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(const v of yTicks){
      if(mode==='idx'&&(v<yMin*0.98||v>yMax*1.02)) continue;
      if(mode!=='idx'&&(v<0||v>yMax*1.001)) continue;
      const y=yOf(Math.max(mode==='idx'?yMin:0, v)||(mode==='idx'?yMin:0));
      if(mode==='idx'&&v<yMin) continue;
      if(v===0 && mode==='idx') continue;
      ctx.strokeStyle=th.grid; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
      ctx.fillStyle=th.text;
      ctx.fillText(formatAxisUsd(v, mode!=='idx'), padL-8, y);
    }
    ctx.strokeStyle=th.border; ctx.strokeRect(padL,padT,plotW,plotH);

    // lines, current year last (on top)
    const drawLine=(s,w,col)=>{
      ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath();
      let started=false;
      for(const p of s.pts){
        const x=xOf(p.x), y=yOf(p.v);
        if(!isFinite(x)||!isFinite(y)) continue;
        if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
      }
      ctx.stroke();
    };
    const rest=series.filter(s=>!s.current);
    const cur=series.find(s=>s.current);
    for(const s of rest) drawLine(s, 1.5, calYearColor(s.year, current, dark));
    if(cur) drawLine(cur, 2.6, calYearColor(cur.year, current, dark));

    // legend, current year first
    const items=[...series].sort((a,b)=>b.year-a.year);
    const lx=padL+plotW+16, ly=padT+4;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.font='12px Verdana,Arial,sans-serif';
    items.forEach((s,i)=>{
      const y=ly+i*18;
      const col=calYearColor(s.year, current, dark);
      ctx.strokeStyle=col; ctx.lineWidth=s.current?2.6:1.8;
      ctx.beginPath(); ctx.moveTo(lx,y); ctx.lineTo(lx+16,y); ctx.stroke();
      ctx.fillStyle=th.text;
      ctx.font=(s.current?'bold ':'')+'12px Verdana,Arial,sans-serif';
      ctx.fillText(String(s.year), lx+22, y);
    });

    ctx.fillStyle=th.muted||th.text;
    ctx.font='10px Verdana,Arial,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('Date', padL+plotW/2, h-4);
  });

  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    cnv.addEventListener('mousemove',ev=>{
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left, y=ev.clientY-rect.top;
      const w=rect.width, h=rect.height;
      const padL=72, padR=108, padT=18, padB=44;
      const plotW=w-padL-padR, plotH=h-padT-padB;
      const xMin=0, xMax=dayXOfYear(12,31);
      if(x<padL||x>padL+plotW||y<padT||y>padT+plotH){$('legend').textContent='';return}
      const xv=xMin+(x-padL)/plotW*(xMax-xMin);
      // find nearest day across series
      let best=null, bestD=8;
      for(const s of series){
        for(const p of s.pts){
          const d=Math.abs(p.x-xv);
          if(d<bestD){bestD=d;best={s,p}}
        }
      }
      if(!best){$('legend').textContent='';return}
      const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][best.p.m-1];
      $('legend').textContent=best.s.year+'  '+mon+' '+best.p.day+'  ·  '+formatAxisUsd(best.p.v)+(mode==='idx'?' indexed':'');
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
  }
}
window.renderCalYearView=renderCalYearView;
window.calYearMode=calYearMode;
window.formatAxisUsd=formatAxisUsd;

function daysInMonth(year, month){
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function defaultMonthDay(){
  const n=new Date();
  return {m:n.getMonth()+1, d:n.getDate()};
}
function parseMonthDay(s){
  const m=String(s||'').trim().match(/^(\d{1,2})-(\d{1,2})$/);
  if(!m) return null;
  const mo=+m[1], d=+m[2];
  if(mo<1||mo>12||d<1||d>31) return null;
  return {m:mo,d};
}
function readOnThisDay(){
  const parsed=parseMonthDay($('otd')&&$('otd').value);
  if(parsed) return parsed;
  return defaultMonthDay();
}
function writeOnThisDay(md, opts){
  opts=opts||{};
  const v=String(md.m).padStart(2,'0')+'-'+String(md.d).padStart(2,'0');
  if($('otd')) $('otd').value=v;
  if($('otdMonth')) $('otdMonth').value=String(md.m);
  if($('otdDay')){
    const max=31;
    $('otdDay').value=String(Math.min(max,md.d));
  }
  return v;
}
function syncOnThisDayUi(){
  const md=readOnThisDay();
  writeOnThisDay(md);
  return md;
}
function formatUsdLabel(v){
  if(v==null||!isFinite(v)) return '';
  if(v>=1000) return '$'+Math.round(v).toLocaleString('en-US');
  if(v>=1) return '$'+Math.round(v);
  if(v>=0.01) return '$'+v.toFixed(2);
  return '$'+v.toPrecision(2);
}
function barOnMonthDay(daily, year, month, day){
  const dim=daysInMonth(year, month);
  const useDay=Math.min(day, dim);
  const target=Date.UTC(year, month-1, useDay)/1000;
  let best=null, bestDt=3*86400;
  for(const b of daily){
    const dt=Math.abs(b.time-target);
    if(dt<=bestDt){best=b;bestDt=dt}
  }
  return best;
}
function onThisDayRows(daily, month, day){
  const years=[];
  for(const b of daily){
    const y=utcYmd(b.time).y;
    if(!years.includes(y)) years.push(y);
  }
  years.sort((a,b)=>a-b);
  const rows=[];
  for(const y of years){
    if(y<2011) continue;
    const bar=barOnMonthDay(daily,y,month,day);
    if(!bar) continue;
    rows.push({year:y,bar,price:bar.close,date:isoUTC(bar.time)});
  }
  return rows;
}
function onThisDayReturns(rows){
  if(!rows.length) return [];
  const byYear=new Map(rows.map(r=>[r.year,r]));
  const latest=rows.at(-1);
  const out=[];
  for(const n of [4,8,12]){
    const then=byYear.get(latest.year-n);
    if(!then||!(then.price>0)||!(latest.price>0)) continue;
    const roi=latest.price/then.price-1;
    const cagr=Math.pow(latest.price/then.price,1/n)-1;
    out.push({years:n, then, now:latest, roi, cagr});
  }
  return out;
}
function monthDayLabel(m,d){
  const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const short=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return {full:(names[m-1]||'')+' '+d, short:(short[m-1]||'')+' '+String(d).padStart(2,'0')};
}

async function renderOnThisDayView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-onthisday');
  $('charts').classList.remove('has-volume');
  const md=syncOnThisDayUi();
  const daily=await scoutDailyBars();
  const rows=onThisDayRows(daily, md.m, md.d);
  if(!rows.length){status('No daily closes for that date.');return}
  const rets=onThisDayReturns(rows);
  const showTab=!!($('ott')&&$('ott').checked);
  document.body.classList.toggle('has-otd-table', showTab);
  window.lastScout={kind:'onthisday',month:md.m,day:md.d,rows,rets};
  const lab=monthDayLabel(md.m, md.d);
  const last=rows.at(-1);
  status(rows.length+' years on '+lab.full+' · last '+formatUsdLabel(last.price)+' in '+last.year);
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  setEpochLegend(false);

  attachPaintCanvas(main,(ctx,w,h)=>{
    const th=T();
    ctx.fillStyle=th.bg; ctx.fillRect(0,0,w,h);
    const padL=58, padR=28, padT=14, padB=48;
    const plotW=w-padL-padR, plotH=h-padT-padB;
    if(plotW<80||plotH<80) return;
    const prices=rows.map(r=>r.price);
    const lo=Math.min(...prices);
    const pMin=lo>=1?1:Math.max(0.1, lo/2);
    const pMax=Math.max(...prices)*1.7;
    const xOf=v=>padL+plotW*((Math.log10(v)-Math.log10(pMin))/(Math.log10(pMax)-Math.log10(pMin)));
    const n=rows.length;
    const slot=plotH/n;
    const barH=Math.max(6, Math.min(26, slot*0.7));
    // newest at top: row 0 is last year
    const ordered=rows.slice().reverse();
    // grid
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.strokeStyle=th.grid; ctx.lineWidth=1;
    const ticks=[];
    for(let e=-1;e<=7;e++) ticks.push(Math.pow(10,e));
    ctx.fillStyle=th.text; ctx.textAlign='center'; ctx.textBaseline='top';
    for(const t of ticks){
      if(t<pMin||t>pMax) continue;
      const x=xOf(t);
      ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+plotH); ctx.strokeStyle=th.grid; ctx.stroke();
      const lab=t>=1?formatUsdLabel(t):'$'+t;
      ctx.fillStyle=th.text;
      ctx.fillText(lab, x, padT+plotH+8);
    }
    ctx.strokeStyle=th.border; ctx.strokeRect(padL,padT,plotW,plotH);
    ctx.fillStyle=th.muted||th.text;
    ctx.font='10px Verdana,Arial,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('Bitcoin price (log scale)', padL+plotW/2, h-4);

    ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.font='11px Verdana,Arial,sans-serif';
    ordered.forEach((r,i)=>{
      const cy=padT+slot*(i+0.5);
      const x0=xOf(pMin), x1=xOf(r.price);
      const y=cy-barH/2;
      ctx.fillStyle='#f5a623';
      ctx.fillRect(x0, y, Math.max(2,x1-x0), barH);
      ctx.strokeStyle='#e09100'; ctx.lineWidth=1;
      ctx.strokeRect(x0, y, Math.max(2,x1-x0), barH);
      // year label
      ctx.fillStyle=th.text;
      ctx.textAlign='right'; ctx.textBaseline='middle';
      ctx.font='11px Verdana,Arial,sans-serif';
      ctx.fillText(String(r.year), padL-8, cy);
      // price on bar
      const text=formatUsdLabel(r.price);
      ctx.font='bold 11px Verdana,Arial,sans-serif';
      const tw=ctx.measureText(text).width;
      const inside=(x1-x0)>tw+16;
      ctx.fillStyle='#111';
      ctx.textAlign=inside?'right':'left';
      ctx.fillText(text, inside?x1-6:x1+6, cy);
    });
  });

  if(showTab && rets.length){
    const el=document.createElement('div');
    el.className='otd-wrap';
    const fmtPct=v=>{const n=v*100; const s=(Math.abs(n)>=1000?n.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1}):n.toFixed(1)).replace(/\.0$/,''); return s+'%';}
    el.innerHTML='<table class="otd-table"><thead><tr><th>Lookback</th><th>Then</th><th>Now</th><th>ROI</th><th>CAGR</th></tr></thead><tbody>'+
      rets.map(r=>'<tr><td>'+r.years+' years</td><td>'+formatUsdLabel(r.then.price)+' ('+r.then.year+')</td><td>'+formatUsdLabel(r.now.price)+' ('+r.now.year+')</td><td>'+fmtPct(r.roi)+'</td><td>'+fmtPct(r.cagr)+'</td></tr>').join('')+
      '</tbody></table>';
    $('subs').appendChild(el);
  }

  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    cnv.addEventListener('mousemove',ev=>{
      const rect=cnv.getBoundingClientRect();
      const y=ev.clientY-rect.top;
      const h=rect.height, padT=14, padB=48, plotH=h-padT-padB;
      const ordered=rows.slice().reverse();
      const slot=plotH/ordered.length;
      const i=Math.floor((y-padT)/slot);
      if(i<0||i>=ordered.length){$('legend').textContent='';return}
      const r=ordered[i];
      $('legend').textContent=r.year+'  '+r.date+'  ·  '+formatUsdLabel(r.price);
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
  }
}
window.renderOnThisDayView=renderOnThisDayView;
window.syncOnThisDayUi=syncOnThisDayUi;
window.readOnThisDay=readOnThisDay;
window.writeOnThisDay=writeOnThisDay;
window.formatUsdLabel=formatUsdLabel;

function halvingUsdCycles(daily){
  const hs=HALVINGS.slice();
  const lastT=daily.at(-1).time;
  const cycles=[];
  for(let i=0;i<hs.length;i++){
    const start=hs[i].time;
    const end=i+1<hs.length?hs[i+1].time:lastT;
    const pts=[];
    for(const b of daily){
      if(b.time<start-12*3600) continue;
      if(b.time>end+12*3600) break;
      if(!(b.close>0)) continue;
      pts.push({day:Math.round((b.time-start)/86400), price:b.close, bar:b});
    }
    if(pts.length<2) continue;
    cycles.push({
      i:i+1,
      label:hs[i].label,
      start, end,
      current:i===hs.length-1,
      pts,
    });
  }
  return cycles;
}
function envelopeOfCycles(cycles){
  let maxD=0;
  for(const c of cycles) maxD=Math.max(maxD, c.pts.at(-1).day);
  const mins=new Array(maxD+1).fill(null);
  const maxs=new Array(maxD+1).fill(null);
  for(const c of cycles){
    // interpolate missing days with last value (daily should be dense)
    const by=new Map(c.pts.map(p=>[p.day,p.price]));
    let last=null;
    for(let d=0;d<=c.pts.at(-1).day;d++){
      if(by.has(d)) last=by.get(d);
      if(!(last>0)) continue;
      if(mins[d]==null||last<mins[d]) mins[d]=last;
      if(maxs[d]==null||last>maxs[d]) maxs[d]=last;
    }
  }
  return {mins,maxs,maxD};
}

async function renderHcyclesView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-hcycles');
  $('charts').classList.remove('has-volume');
  const daily=await scoutDailyBars();
  const cycles=halvingUsdCycles(daily);
  if(cycles.length<2){status('Not enough halving cycles to plot.');return}
  const env=envelopeOfCycles(cycles);
  window.lastScout={kind:'hcycles',cycles,env};
  const cur=cycles.find(c=>c.current)||cycles.at(-1);
  const last=cur.pts.at(-1);
  status(cycles.length+' halving cycles · current day '+last.day+' · last '+formatUsdLabel(last.price));
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  setEpochLegend(false);

  const lineColors=['#8d6e63','#ef6c00','#1565c0','#111'];
  attachPaintCanvas(main,(ctx,w,h)=>{
    const th=T();
    const dark=typeof isDark==='function'&&isDark();
    ctx.fillStyle=th.bg; ctx.fillRect(0,0,w,h);
    const padL=64, padR=136, padT=16, padB=44;
    const plotW=w-padL-padR, plotH=h-padT-padB;
    if(plotW<80||plotH<80) return;
    const xMax=Math.max(env.maxD, 1400);
    let yMax=0;
    for(const c of cycles) for(const p of c.pts) if(p.price>yMax) yMax=p.price;
    yMax=niceLinearMax(yMax*1.08);
    const xOf=d=>padL+plotW*(d/xMax);
    const yOf=v=>padT+plotH*(1-v/yMax);
    // grid
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.strokeStyle=th.grid; ctx.lineWidth=1;
    const xStep=xMax>1600?200:100;
    ctx.fillStyle=th.text; ctx.textAlign='center'; ctx.textBaseline='top';
    for(let d=0;d<=xMax;d+=xStep){
      const x=xOf(d);
      ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+plotH); ctx.strokeStyle=th.grid; ctx.stroke();
      ctx.fillStyle=th.text; ctx.fillText(String(d), x, padT+plotH+8);
    }
    const yTicks=6;
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let i=0;i<=yTicks;i++){
      const v=yMax*i/yTicks;
      const y=yOf(v);
      ctx.strokeStyle=th.grid; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
      ctx.fillStyle=th.text; ctx.fillText(formatAxisUsd(v,true), padL-8, y);
    }
    ctx.strokeStyle=th.border; ctx.strokeRect(padL,padT,plotW,plotH);
    ctx.fillStyle=th.muted||th.text;
    ctx.font='10px Verdana,Arial,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('Days since halving', padL+plotW/2, h-4);

    // envelope, colored by slope of the upper bound (runs of up/down)
    const upFill=dark?'rgba(255,152,0,0.38)':'rgba(255,152,0,0.35)';
    const dnFill=dark?'rgba(66,165,245,0.38)':'rgba(66,165,245,0.38)';
    const ok=d=>env.maxs[d]>0&&env.mins[d]>0;
    const risingAt=d=>ok(d)&&ok(d+1)&&env.maxs[d+1]>=env.maxs[d];
    let d=0;
    while(d<env.maxD){
      while(d<env.maxD&&!ok(d)) d++;
      if(d>=env.maxD) break;
      // Color by a 14-day slope so daily noise doesn't stripe the fill.
      const up=ok(d)&&ok(Math.min(d+14,env.maxD))&&env.maxs[Math.min(d+14,env.maxD)]>=env.maxs[d];
      let e=d+1;
      while(e<env.maxD&&ok(e)&&risingAt(e)===up) e++;
      ctx.fillStyle=up?upFill:dnFill;
      ctx.beginPath();
      ctx.moveTo(xOf(d), yOf(env.maxs[d]));
      for(let i=d+1;i<=e;i++) if(ok(i)) ctx.lineTo(xOf(i), yOf(env.maxs[i]));
      for(let i=e;i>=d;i--) if(ok(i)) ctx.lineTo(xOf(i), yOf(env.mins[i]));
      ctx.closePath();
      ctx.fill();
      d=e;
    }

    // cycle lines, current on top
    const draw=c=>{
      const col=c.current?(dark?'#f5f5f5':'#111'):(lineColors[(c.i-1)%lineColors.length]);
      ctx.strokeStyle=col; ctx.lineWidth=c.current?2.2:1.3; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath();
      let started=false;
      for(const p of c.pts){
        if(p.day<0) continue;
        const x=xOf(p.day), y=yOf(p.price);
        if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
      }
      ctx.stroke();
    };
    cycles.filter(c=>!c.current).forEach(draw);
    const curC=cycles.find(c=>c.current);
    if(curC) draw(curC);

    // legend
    ctx.font='12px Verdana,Arial,sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    cycles.forEach((c,i)=>{
      const y=padT+8+i*18;
      const col=c.current?(dark?'#f5f5f5':'#111'):(lineColors[(c.i-1)%lineColors.length]);
      ctx.strokeStyle=col; ctx.lineWidth=c.current?2.2:1.8;
      ctx.beginPath(); ctx.moveTo(padL+plotW+14,y); ctx.lineTo(padL+plotW+30,y); ctx.stroke();
      ctx.fillStyle=th.text;
      ctx.font=(c.current?'bold ':'')+'12px Verdana,Arial,sans-serif';
      ctx.fillText(c.label+(c.current?'  now':''), padL+plotW+36, y);
    });
  });

  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    cnv.addEventListener('mousemove',ev=>{
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left;
      const w=rect.width, padL=64, padR=110, plotW=w-padL-padR;
      const xMax=Math.max(env.maxD, 1400);
      if(x<padL||x>padL+plotW){$('legend').textContent='';return}
      const day=Math.round((x-padL)/plotW*xMax);
      const bits=['Day '+day];
      for(const c of cycles){
        const p=c.pts.find(pt=>pt.day===day)||c.pts.reduce((best,pt)=>Math.abs(pt.day-day)<Math.abs((best?best.day:1e9)-day)?pt:best,null);
        if(p&&Math.abs(p.day-day)<=2) bits.push(c.label.replace('Halving ','')+' '+formatUsdLabel(p.price));
      }
      if(env.mins[day]!=null) bits.push('envelope '+formatUsdLabel(env.mins[day])+'–'+formatUsdLabel(env.maxs[day]));
      $('legend').textContent=bits.join('  ·  ');
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
  }
}
window.renderHcyclesView=renderHcyclesView;

function rangeBandMode(){return ($('rb')&&$('rb').value)==='pow2'?'pow2':'decade'}
function makePriceBands(mode, minP, maxP){
  const bands=[];
  if(mode==='pow2'){
    let lo=1;
    const top=Math.max(1, maxP);
    while(lo<top*2){
      const hi=lo*2;
      bands.push({lo, hi: hi>top*1.01?Infinity:hi, open:hi>top*1.01});
      if(!isFinite(bands.at(-1).hi)||bands.at(-1).open) break;
      lo=hi;
      if(lo>1e9) break;
    }
  }else{
    let lo=1;
    while(lo<=1e8){
      const hi=lo*10;
      const open=lo>=100000;
      bands.push({lo, hi:open?Infinity:hi, open});
      if(open) break;
      lo=hi;
    }
  }
  return bands.filter(b=>maxP>=b.lo && minP< (isFinite(b.hi)?b.hi:Infinity)*10);
}
function countDaysInBands(daily, bands){
  const counts=bands.map(()=>0);
  for(const b of daily){
    const p=b.close;
    if(!(p>0)) continue;
    for(let i=0;i<bands.length;i++){
      const bd=bands[i];
      if(p>=bd.lo && (bd.open||p<bd.hi)){counts[i]++;break}
    }
  }
  return counts;
}
function formatBandEdge(v){
  if(!isFinite(v)) return '';
  if(v>=1e6) return '$'+(v/1e6).toLocaleString('en-US',{maximumFractionDigits:2}).replace(/\.0$/,'')+'M';
  if(v>=1000) return '$'+Math.round(v).toLocaleString('en-US');
  return '$'+String(v);
}
function bandLabel(band, days, mode){
  if(mode==='pow2' || band.open || band.lo<=1) return days+' days';
  return days+' days between '+formatBandEdge(band.lo)+' and '+formatBandEdge(band.hi);
}

async function renderRangesView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-ranges');
  $('charts').classList.remove('has-volume');
  const daily=await scoutDailyBars();
  const pts=daily.filter(b=>b&&b.close>0);
  if(pts.length<2){status('Not enough data for price-range days.');return}
  const mode=rangeBandMode();
  const minP=Math.min(...pts.map(b=>b.close));
  const maxP=Math.max(...pts.map(b=>b.close));
  const bands=makePriceBands(mode, minP, maxP);
  const counts=countDaysInBands(pts, bands);
  window.lastScout={kind:'ranges',mode,bands,counts,pts};
  const longest=Math.max(0,...counts);
  status(pts.length+' daily closes · '+bands.length+' '+ (mode==='pow2'?'power-of-2':'order-of-magnitude')+' bands · longest '+longest+' days');
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  setEpochLegend(false);

  attachPaintCanvas(main,(ctx,w,h)=>{
    const th=T();
    const dark=typeof isDark==='function'&&isDark();
    ctx.fillStyle=th.bg; ctx.fillRect(0,0,w,h);
    const padL=72, padR=20, padT=28, padB=40;
    const plotW=w-padL-padR, plotH=h-padT-padB;
    if(plotW<80||plotH<80) return;
    const t0=pts[0].time, t1=pts.at(-1).time;
    const yMin=Math.max(0.5, Math.pow(10, Math.floor(Math.log10(minP))));
    const yMax=Math.pow(10, Math.ceil(Math.log10(maxP*1.05)));
    const dayMax=Math.max(365, Math.ceil(longest/365)*365 + 365);
    const xTime=t=>padL+plotW*((t-t0)/Math.max(1,t1-t0));
    const xDays=d=>padL+plotW*(d/dayMax);
    const yOf=v=>{
      const a=Math.log10(yMin), b=Math.log10(yMax);
      return padT+plotH*(1-(Math.log10(v)-a)/(b-a));
    };
    // horizontal grid + left labels
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    const yTicks=[];
    if(mode==='pow2'){
      for(let v=1;v<=yMax;v*=2) yTicks.push(v);
    }else{
      for(let e=0;e<=8;e++) yTicks.push(Math.pow(10,e));
    }
    for(const v of yTicks){
      if(v<yMin*0.999||v>yMax*1.001) continue;
      const y=yOf(v);
      ctx.strokeStyle=th.grid; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
      ctx.fillStyle=th.text; ctx.fillText(formatBandEdge(v), padL-8, y);
    }
    // bottom date axis
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillStyle=th.text;
    const y0=new Date(t0*1000).getUTCFullYear();
    const y1=new Date(t1*1000).getUTCFullYear();
    const step=(y1-y0>12)?2:1;
    for(let y=y0;y<=y1;y+=step){
      const t=Date.UTC(y,0,1)/1000;
      if(t<t0||t>t1) continue;
      const x=xTime(t);
      ctx.strokeStyle=th.grid; ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+plotH); ctx.stroke();
      ctx.fillStyle=th.text; ctx.fillText(String(y), x, padT+plotH+8);
    }
    // top days axis
    ctx.textBaseline='bottom';
    for(let d=0;d<=dayMax;d+=365){
      const x=xDays(d);
      ctx.strokeStyle=th.grid; ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+plotH); ctx.stroke();
      ctx.fillStyle=th.muted||th.text; ctx.fillText(String(d), x, padT-4);
    }
    ctx.strokeStyle=th.border; ctx.strokeRect(padL,padT,plotW,plotH);

    // bars
    const barFill=dark?'rgba(200,200,200,0.28)':'rgba(80,80,80,0.22)';
    const barStroke=dark?'rgba(220,220,220,0.45)':'rgba(60,60,60,0.35)';
    bands.forEach((bd,i)=>{
      const days=counts[i];
      if(!days) return;
      const top=bd.open?yOf(yMax):yOf(Math.min(bd.hi, yMax));
      const bot=yOf(Math.max(bd.lo, yMin));
      const y=Math.min(top,bot), hgt=Math.max(2, Math.abs(bot-top));
      const x0=padL, bw=Math.max(1, xDays(days)-padL);
      ctx.fillStyle=barFill;
      ctx.fillRect(x0, y, bw, hgt);
      ctx.strokeStyle=barStroke; ctx.lineWidth=1;
      ctx.strokeRect(x0, y, bw, hgt);
      const text=bandLabel(bd, days, mode);
      ctx.font='bold 12px Verdana,Arial,sans-serif';
      ctx.fillStyle=th.text;
      ctx.textAlign='left'; ctx.textBaseline='middle';
      const tw=ctx.measureText(text).width;
      if(bw>tw+16) ctx.fillText(text, x0+8, y+hgt/2);
      else ctx.fillText(text, x0+bw+8, y+hgt/2);
    });

    // price line on top
    ctx.strokeStyle=dark?'#e879f9':'#c026d3';
    ctx.lineWidth=1.6; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath();
    let started=false;
    for(const b of pts){
      const x=xTime(b.time), y=yOf(Math.max(yMin, b.close));
      if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
    }
    ctx.stroke();

    ctx.fillStyle=th.muted||th.text;
    ctx.font='10px Verdana,Arial,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('Date', padL+plotW/2, h-4);
  });
}
window.renderRangesView=renderRangesView;
window.rangeBandMode=rangeBandMode;
window.formatBandEdge=formatBandEdge;

const ANN_COLORS=['#f9a825','#ec407a','#26a69a','#7e57c2'];
function parseFlatSpans(){
  const raw=($('an')&&$('an').value)||'';
  return String(raw).split(';').map(s=>s.trim()).filter(Boolean).map(s=>{
    const parts=s.split(',').map(x=>x.trim());
    if(parts.length<2) return null;
    return {start:parts[0], end:parts[1]};
  }).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.start)&&/^\d{4}-\d{2}-\d{2}$/.test(x.end));
}
function writeFlatSpans(spans){
  const v=(spans||[]).map(s=>s.start+','+s.end).join(';');
  if($('an')) $('an').value=v;
  return v;
}
function isoToTime(iso){return Date.parse(iso+'T00:00:00Z')/1000}
function barNearTime(daily, t){
  let best=null, bestDt=3*86400;
  for(const b of daily){
    const dt=Math.abs(b.time-t);
    if(dt<=bestDt){best=b;bestDt=dt}
  }
  return best;
}
function formatSpanYears(y){
  if(!(y>=0) || !isFinite(y)) return '';
  const months=Math.round(y*12);
  const yr=Math.round(y);
  if(Math.abs(y-yr)<=0.12) return yr===1?'1 year':yr+' years';
  const ys=Math.floor(months/12), mo=months%12;
  if(!ys) return mo+' month'+(mo===1?'':'s');
  return ys+' year'+(ys===1?'':'s')+(mo?(' '+mo+' month'+(mo===1?'':'s')):'');
}
function formatKx(k){
  if(!(k>0)) return '';
  if(k>=10) return k.toFixed(1).replace(/\.0$/,'')+'x';
  return (Math.round(k*10)/10).toString().replace(/\.0$/,'')+'x';
}
function describeFlatSpan(daily, startIso, endIso){
  let t0=isoToTime(startIso), t1=isoToTime(endIso);
  if(!isFinite(t0)||!isFinite(t1)) return null;
  if(t1<t0){const t=t0;t0=t1;t1=t; const s=startIso;startIso=endIso;endIso=s}
  const b0=barNearTime(daily,t0), b1=barNearTime(daily,t1);
  if(!b0||!b1||!(b0.close>0)) return null;
  const level=b0.close;
  const years=(b1.time-b0.time)/(365.25*86400);
  let maxAfter=null;
  for(const b of daily){
    if(b.time>b1.time && (maxAfter==null||b.close>maxAfter.close)) maxAfter=b;
  }
  const k=maxAfter&&level>0?maxAfter.close/level:null;
  let label=formatSpanYears(years)+', zero gains';
  if(k!=null&&k>=1.2) label+=', then '+formatKx(k);
  return {startIso,endIso,b0,b1,level,years,k,maxAfter,label};
}
function renderAnnList(){
  const el=$('annList'); if(!el) return;
  const spans=parseFlatSpans();
  el.innerHTML=spans.map((s,i)=>{
    const lab=(window.lastAnns&&window.lastAnns[i]&&window.lastAnns[i].label)||(s.start+' → '+s.end);
    return '<span class="ann-chip" data-i="'+i+'">'+lab+' <button type="button" data-ann-remove="'+i+'" aria-label="Remove">×</button></span>';
  }).join(' ');
}
async function hookFlatSpans(chart, series){
  window._priceSeries=series;
  renderAnnList();
  const raw=parseFlatSpans();
  if(!raw.length||!chart||!series) {window.lastAnns=[];return}
  let daily=bars;
  try{ if(typeof scoutDailyBars==='function') daily=await scoutDailyBars(); }catch(e){}
  const metas=raw.map(s=>describeFlatSpan(daily,s.start,s.end)).filter(Boolean);
  for(const m of metas){
    if(m.maxAfter&&m.k!=null&&m.k>=1.2){
      m.path=daily.filter(b=>b.time>=m.b1.time&&b.time<=m.maxAfter.time&&b.close>0).map(b=>({time:b.time,value:b.close}));
    }
  }
  window.lastAnns=metas;
  renderAnnList();
  if(chart&&!chart._annClick){
    chart._annClick=true;
    chart.subscribeClick(param=>{
      if(!param||param.time==null) return;
      const iso=typeof isoUTC==='function'?isoUTC(param.time):new Date(param.time*1000).toISOString().slice(0,10);
      const startEl=$('annStart'), endEl=$('annEnd');
      if(!startEl) return;
      if(!startEl.value||(startEl.value&&endEl&&endEl.value)){
        startEl.value=iso; if(endEl) endEl.value='';
        if($('legend')) $('legend').textContent='Start '+iso+' — click the end of the span';
      }else{
        if(endEl) endEl.value=iso;
        if(typeof addFlatSpan==='function') addFlatSpan(startEl.value, iso);
        if(typeof draw==='function') draw(1);
      }
    });
  }
  if(!metas.length||typeof attachChartOverlay!=='function') return;
  attachChartOverlay(chart,(ctx,ch,w,h)=>{
    const ts=ch.timeScale();
    metas.forEach((m,i)=>{
      const color=ANN_COLORS[i%ANN_COLORS.length];
      const x0=ts.timeToCoordinate(m.b0.time);
      const x1=ts.timeToCoordinate(m.b1.time);
      const y=series.priceToCoordinate(m.level);
      if(x0==null||x1==null||y==null) return;
      const xa=Math.min(x0,x1), xb=Math.max(x0,x1);
      ctx.save();
      // subsequent rally along the actual price path
      if(m.path&&m.path.length>1){
        ctx.strokeStyle='#2e7d32'; ctx.lineWidth=2; ctx.lineJoin='round';
        ctx.beginPath();
        let started=false;
        for(const p of m.path){
          const x=ts.timeToCoordinate(p.time);
          const py=series.priceToCoordinate(p.value);
          if(x==null||py==null) continue;
          if(!started){ctx.moveTo(x,py);started=true}else ctx.lineTo(x,py);
        }
        if(started) ctx.stroke();
        const last=m.maxAfter;
        const x2=ts.timeToCoordinate(last.time);
        const y2=series.priceToCoordinate(last.close);
        if(x2!=null&&y2!=null){
          ctx.fillStyle='#2e7d32';
          ctx.beginPath(); ctx.arc(x2,y2,3.5,0,Math.PI*2); ctx.fill();
          ctx.font='bold 12px Verdana,Arial,sans-serif';
          ctx.textAlign='left'; ctx.textBaseline='bottom';
          const then='then '+formatKx(m.k);
          ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,0.85)';
          ctx.strokeText(then, x2+6, y2-6);
          ctx.fillStyle='#1b5e20';
          ctx.fillText(then, x2+6, y2-6);
        }
      }
      ctx.strokeStyle=color; ctx.lineWidth=2.4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(xa,y); ctx.lineTo(xb,y); ctx.stroke();
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(xa,y,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(xb,y,4,0,Math.PI*2); ctx.fill();
      const label=m.label.replace(/, then .*$/,'');
      ctx.font='bold 13px Verdana,Arial,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      const mid=(xa+xb)/2;
      ctx.lineWidth=3; ctx.strokeStyle=typeof isDark==='function'&&isDark()?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.9)';
      ctx.strokeText(label, mid, y-8);
      ctx.fillStyle=color;
      ctx.fillText(label, mid, y-8);
      ctx.restore();
    });
  });
}
function addFlatSpan(start, end){
  if(!start||!end) return false;
  const spans=parseFlatSpans();
  const key=start+','+end, rev=end+','+start;
  if(spans.some(s=>s.start+','+s.end===key||s.start+','+s.end===rev)) return false;
  spans.push({start,end});
  writeFlatSpans(spans);
  return true;
}
function removeFlatSpan(i){
  const spans=parseFlatSpans();
  spans.splice(i,1);
  writeFlatSpans(spans);
}
window.parseFlatSpans=parseFlatSpans;
window.writeFlatSpans=writeFlatSpans;
window.describeFlatSpan=describeFlatSpan;
window.hookFlatSpans=hookFlatSpans;
window.addFlatSpan=addFlatSpan;
window.removeFlatSpan=removeFlatSpan;
window.renderAnnList=renderAnnList;
window.formatSpanYears=formatSpanYears;
window.formatKx=formatKx;

const SPIRAL_GENESIS=Date.UTC(2009,0,3)/1000;
const SPIRAL_EPOCH_BLOCKS=210000;
const SPIRAL_BLOCK_SEC=600;
const SPIRAL_EPOCH_LEN=SPIRAL_EPOCH_BLOCKS*SPIRAL_BLOCK_SEC;
const SPIRAL_MIN_PX=0.05;
const SPIRAL_RINGS=[1,10,100,1000,10000,100000,1000000];
const SPIRAL_SPOKE_BLOCKS=[26250,52500,78750,105000,131250,157500,183750];

function spiralCuts(){
  return [SPIRAL_GENESIS].concat(HALVINGS.map(h=>h.time));
}
function spiralNextHalvingTime(){
  const last=HALVINGS.length?HALVINGS[HALVINGS.length-1].time:SPIRAL_GENESIS;
  return last+SPIRAL_EPOCH_LEN;
}
function spiralEpoch(t){
  const cuts=spiralCuts();
  let i=0;
  while(i+1<cuts.length && t>=cuts[i+1]) i++;
  const t0=cuts[i];
  const t1=(i+1<cuts.length)?cuts[i+1]:(t0+SPIRAL_EPOCH_LEN);
  const span=Math.max(1,t1-t0);
  let frac=(t-t0)/span;
  if(frac<0) frac=0;
  if(frac>1) frac=1;
  return {epoch:i, frac:frac, t0:t0, t1:t1, blocks:frac*SPIRAL_EPOCH_BLOCKS, pct:frac*100, next:t1};
}
function spiralPolar(frac, r, cx, cy){
  const a=2*Math.PI*frac;
  return {x:cx+r*Math.sin(a), y:cy-r*Math.cos(a)};
}
function spiralRadiusOf(price, r0, r1){
  const p=Math.max(SPIRAL_MIN_PX, Math.min(1e6, price));
  const lo=Math.log10(SPIRAL_MIN_PX), hi=Math.log10(1e6);
  return r0+(r1-r0)*((Math.log10(p)-lo)/(hi-lo));
}
function spiralRingLabel(v){
  if(v>=1000000) return '$1M';
  if(v>=1000) return '$'+(v/1000)+'k';
  return '$'+String(v);
}
function spiralBottoms(bars){
  if(typeof detectCycles!=='function'||!bars||!bars.length) return [];
  const cycles=detectCycles(bars);
  const out=[];
  const seen=new Set();
  const add=(pt,kind)=>{
    if(!pt||!pt.time) return;
    if(seen.has(pt.time)) return;
    seen.add(pt.time);
    out.push({time:pt.time, price:pt.close!=null?pt.close:pt.price, date:pt.date||(typeof isoUTC==='function'?isoUTC(pt.time):''), kind:kind||'bottom'});
  };
  for(const c of cycles){
    if(c===cycles[0] && c.startLow) add(c.startLow,'start');
    if(c.endLow) add(c.endLow, c.open||c.lowSoFar?'recent':'bottom');
  }
  out.sort((a,b)=>a.time-b.time);
  return out;
}
function spiralBarAt(bars, t){
  if(!bars||!bars.length) return null;
  let best=bars[0], bd=Math.abs(bars[0].time-t);
  for(const b of bars){const d=Math.abs(b.time-t); if(d<bd){bd=d;best=b}}
  return best;
}

async function renderSpiralView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-spiral');
  $('charts').classList.remove('has-volume');
  const raw=await getDaily('combinedUSD');
  const allBars=raw.map(toBar).filter(b=>b&&b.close>0);
  const cut=Date.UTC(2011,0,1)/1000;
  let daily=allBars;
  if($('sf')&&$('sf').checked) daily=allBars.filter(b=>b.time>=cut);
  if(daily.length<10){status('Not enough Bitcoin history to draw the spiral.');return}
  const highlight=!($('sh')&&$('sh').value==='off');
  const t0=daily[0].time;
  const aths=computeAthSeries(allBars).aths.filter(a=>a.time>=t0);
  const bottoms=spiralBottoms(allBars).filter(b=>b.time>=t0);
  const last=daily.at(-1);
  const pos=spiralEpoch(last.time);
  const nextT=spiralNextHalvingTime();
  const nextDate=isoUTC(nextT);
  const epochNo=pos.epoch+1;
  window.lastScout={kind:'spiral', last, pos, nextHalving:nextDate, bottoms, aths, from2011:!!($('sf')&&$('sf').checked), highlight};
  status('Bitcoin Spiral · Combined daily · epoch '+epochNo+' · '+pos.pct.toFixed(1)+'% of the way · last $'+usd(last.close)+' · next halving ~ '+nextDate);
  if($('sourceNote')){
    const splice=(typeof SPLICE==='string'?SPLICE+' ':'');
    $('sourceNote').textContent=splice+'Angle is date-based (no block heights): official halving dates, linear interpolation between them, and ~10 minutes per block after 2024-04-20. Next halving ~ '+nextDate+'.';
  }
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  setEpochLegend(false);

  attachPaintCanvas(main,(ctx,w,h,canvas)=>{
    const th=T();
    const dark=typeof isDark==='function'&&isDark();
    ctx.fillStyle=th.bg; ctx.fillRect(0,0,w,h);
    const padL=118, padR=96, padT=72, padB=46;
    const cx=padL+(w-padL-padR)/2;
    const cy=padT+(h-padT-padB)/2;
    const rMax=Math.max(40, Math.min((w-padL-padR)/2, (h-padT-padB)/2)-4);
    const rMin=Math.max(10, rMax*0.06);
    const rOf=p=>spiralRadiusOf(p, rMin, rMax);
    const xy=(frac,price)=>spiralPolar(frac, rOf(price), cx, cy);

    // rings + spokes
    ctx.lineWidth=1;
    ctx.strokeStyle=dark?'#3a3a3a':'#d8d8d8';
    for(const v of SPIRAL_RINGS){
      const r=rOf(v);
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx,cy,rMax,0,Math.PI*2); ctx.strokeStyle=dark?'#555':'#bbb'; ctx.stroke();
    const spokeFracs=[0].concat(SPIRAL_SPOKE_BLOCKS.map(b=>b/SPIRAL_EPOCH_BLOCKS));
    ctx.strokeStyle=dark?'#3a3a3a':'#d8d8d8';
    for(const f of spokeFracs){
      const a=2*Math.PI*f;
      ctx.beginPath();
      ctx.moveTo(cx+rMin*Math.sin(a), cy-rMin*Math.cos(a));
      ctx.lineTo(cx+rMax*Math.sin(a), cy-rMax*Math.cos(a));
      ctx.stroke();
    }

    // spoke labels
    ctx.fillStyle=th.text;
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const labelR=rMax+16;
    const spokeLabs=[''].concat(SPIRAL_SPOKE_BLOCKS.map(b=>{
      const k=b/1000;
      return (k%1?k.toFixed(2):String(k))+'k blocks';
    }));
    spokeFracs.forEach((f,i)=>{
      if(i===0) return; // 0° used for price labels on the right? 0 is top; 105k is bottom. Price labels go on the right (52.5k / 90°).
      const p=spiralPolar(f, labelR, cx, cy);
      let align='center', base='middle';
      if(f>0.02 && f<0.23){align='left'}
      else if(f>0.27 && f<0.48){align='left'}
      else if(f>0.52 && f<0.73){align='right'}
      else if(f>0.77 && f<0.98){align='right'}
      ctx.textAlign=align;
      ctx.fillText(spokeLabs[i], p.x, p.y);
    });

    // price labels sit on the right-hand spoke, just above the rings;
    // the 52.5k spoke label stays outside the outer ring.
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.fillStyle=th.muted||th.text;
    for(const v of SPIRAL_RINGS){
      const r=rOf(v);
      ctx.fillText(spiralRingLabel(v), cx+r, cy-5);
    }

    // title + subtitle + legend
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle=th.title||th.text;
    ctx.font='bold 20px Verdana,Arial,sans-serif';
    ctx.fillText('Bitcoin Spiral', 16, 12);
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.fillStyle=th.muted||th.text;
    ctx.fillText('Pre-halving, halving 1, 2, 3, 4  ·  0, 210k, 420k, 630k, 840k blocks', w/2-10, 16);
    // legend
    const items=[
      {kind:'line', color:'#f5a623', label:"Bitcoin"},
      {kind:'dot', color:'#0d47a1', label:"ATH's"},
      {kind:'dot', color:'#9b1b1b', label:'Bottoms'},
      {kind:'dot', color:'#2e7d32', label:'Halvings'},
    ];
    let ly=42;
    items.forEach(it=>{
      if(it.kind==='line'){
        ctx.strokeStyle=it.color; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(16,ly+6); ctx.lineTo(40,ly+6); ctx.stroke();
      }else{
        ctx.fillStyle=it.color;
        ctx.beginPath(); ctx.arc(28,ly+6,5,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle=th.text; ctx.font='12px Verdana,Arial,sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='left';
      ctx.fillText(it.label, 48, ly+6);
      ly+=18;
    });

    // date-based note
    ctx.font='10px Verdana,Arial,sans-serif';
    ctx.fillStyle=th.muted||th.text;
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('Positions are date-based (no block heights)  ·  next halving ~ '+nextDate, cx, h-8);

    // points
    const pts=[];
    const maxEpoch=spiralEpoch(last.time).epoch;
    daily.forEach(b=>{
      const ep=spiralEpoch(b.time);
      const p=xy(ep.frac, b.close);
      pts.push(Object.assign(p,{time:b.time,price:b.close,epoch:ep.epoch,frac:ep.frac,pct:ep.pct,blocks:ep.blocks}));
    });

    // draw one path per epoch so the wrap at 0° does not cut across the chart
    const byEp=[];
    for(const p of pts){
      const bucket=byEp[p.epoch]||(byEp[p.epoch]=[]);
      bucket.push(p);
    }
    // close previous epoch at frac=1 with the first point of the next (same price/radius, top spoke)
    for(let e=0;e<byEp.length-1;e++){
      const cur=byEp[e], nxt=byEp[e+1];
      if(cur&&cur.length&&nxt&&nxt.length){
        const p=nxt[0];
        cur.push({x:xy(1,p.price).x, y:xy(1,p.price).y, time:p.time, price:p.price, epoch:e, frac:1, pct:100, blocks:SPIRAL_EPOCH_BLOCKS});
      }
    }
    const orange='#f5a623';
    const muted=dark?'rgba(245,166,35,0.55)':'rgba(245,166,35,0.5)';
    byEp.forEach((path,e)=>{
      if(!path||path.length<2) return;
      const isCur=highlight && e===maxEpoch;
      ctx.strokeStyle=(!highlight||isCur)?orange:muted;
      ctx.lineWidth=isCur?3.4:2.2;
      ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath();
      path.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.stroke();
    });

    function dot(x,y,color,r){
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=dark?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.8)';
      ctx.lineWidth=1; ctx.stroke();
    }

    // ATH dots (closing highs)
    aths.forEach(a=>{
      const ep=spiralEpoch(a.time);
      const p=xy(ep.frac, a.price);
      dot(p.x,p.y,'#0d47a1',2.6);
    });
    // bottoms
    bottoms.forEach(b=>{
      const ep=spiralEpoch(b.time);
      const p=xy(ep.frac, b.price);
      dot(p.x,p.y,'#9b1b1b',4.2);
    });
    // halvings at 0°
    HALVINGS.forEach(h=>{
      const b=spiralBarAt(daily, h.time);
      if(!b) return;
      const p=xy(0, b.close);
      dot(p.x,p.y,'#2e7d32',5);
    });

    canvas._spiral={pts, cx, cy, rMin, rMax, bottoms, aths};
  });

  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    const onMove=ev=>{
      const pack=cnv._spiral; if(!pack||!pack.pts||!pack.pts.length) return;
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left, y=ev.clientY-rect.top;
      let best=null, bd=12;
      for(const p of pack.pts){
        const d=Math.hypot(p.x-x,p.y-y);
        if(d<bd){bd=d;best=p}
      }
      if(!best){$('legend').textContent='';return}
      const bits=[isoUTC(best.time), '$'+usd(best.price), 'epoch '+(best.epoch+1), best.pct.toFixed(1)+'% of the turn', '~'+Math.round(best.blocks).toLocaleString('en-US')+' of 210,000 blocks (est.)'];
      const ath=pack.aths&&pack.aths.find(a=>a.time===best.time);
      if(ath) bits.push('ATH');
      const bot=pack.bottoms&&pack.bottoms.find(b=>b.time===best.time);
      if(bot) bits.push(bot.kind==='recent'?'cycle low so far':'cycle bottom');
      $('legend').textContent=bits.join('  ·  ');
    };
    cnv.addEventListener('mousemove', onMove);
    cnv.addEventListener('mouseleave', ()=>{$('legend').textContent=''});
  }
}
window.renderSpiralView=renderSpiralView;

function yearEndCloses(daily){
  const map=new Map();
  for(const b of daily||[]){
    if(!b||!(b.close>0)||b.time==null) continue;
    const y=new Date(b.time*1000).getUTCFullYear();
    const prev=map.get(y);
    if(!prev||b.time>prev.time) map.set(y,b);
  }
  return map;
}
function formatAnnualPrice(v){
  if(v==null||!isFinite(v)) return '';
  const sign=v<0?'-':'';
  const abs=Math.abs(v);
  let body;
  if(abs>=1000) body=Math.round(abs).toLocaleString('en-US');
  else if(abs>=100) body=String(Math.round(abs));
  else if(abs>=10){body=(Math.round(abs*10)/10).toFixed(1); if(body.endsWith('.0')) body=body.slice(0,-2)}
  else body=abs.toFixed(2);
  return sign+body;
}
function formatAnnualPct(p){
  if(p==null||!isFinite(p)) return '';
  const n=Math.round(p);
  return (n>0?'+':'')+n+'%';
}
function annualUsesDollar(market){
  return market!=='cpiAUCSL' && market!=='cpiAUCNS';
}
function annualPriceLabel(v, market){
  const n=formatAnnualPrice(v);
  if(!n) return '';
  return annualUsesDollar(market)?'$'+n:n;
}
function computeAnnualReturns(daily, opts){
  opts=opts||{};
  const startYear=opts.startYear||2011;
  const ends=yearEndCloses(daily);
  const years=[...ends.keys()].sort((a,b)=>a-b);
  if(!years.length) return [];
  const lastYear=years[years.length-1];
  const lastBar=ends.get(lastYear);
  const lastDate=new Date(lastBar.time*1000);
  const ytd=lastDate.getUTCMonth()!==11 || lastDate.getUTCDate()<31;
  const market=opts.market||'';
  const rows=[];
  for(let y=startYear;y<=lastYear;y++){
    const prev=ends.get(y-1);
    const end=ends.get(y);
    if(!prev||!end||!(prev.close>0)||!(end.close>0)) continue;
    const isYtd=y===lastYear && ytd;
    const pct=(end.close/prev.close-1)*100;
    rows.push({
      year:y,
      ytd:isYtd,
      yearLabel:isYtd?y+' YTD':String(y),
      start:prev.close,
      startTime:prev.time,
      startLabel:annualPriceLabel(prev.close, market),
      end:end.close,
      endTime:end.time,
      endLabel:annualPriceLabel(end.close, market),
      pct,
      pctRound:Math.round(pct),
      pctLabel:formatAnnualPct(pct),
      up:pct>=0
    });
  }
  return rows;
}
function annualReturnsTitle(market, rows){
  const last=rows&&rows.length?rows.at(-1).year:new Date().getUTCFullYear();
  const first=rows&&rows.length?rows[0].year:2011;
  const btc=!market||typeof isBtcMarket!=='function'||isBtcMarket(market);
  const who=btc?'Bitcoin':((typeof shortMarketLabel==='function'?shortMarketLabel(market):null)||(typeof marketLabel==='function'?marketLabel(market):'Series'));
  return who+' Returns: '+first+' - '+last;
}
function symlogY(v, linthresh){
  linthresh=linthresh||100;
  const s=v<0?-1:v>0?1:0;
  const a=Math.abs(v);
  if(a<=linthresh) return s*(a/linthresh);
  return s*(1+Math.log10(a/linthresh));
}
function paintAnnualReturnsBars(ctx, w, h, rows, opts){
  opts=opts||{};
  const th=typeof T==='function'?T():{bg:'#fff',text:'#333',grid:'#eee',border:'#ccc',muted:'#666'};
  ctx.fillStyle=opts.bg||th.bg;
  ctx.fillRect(0,0,w,h);
  if(!rows||!rows.length) return;
  const padL=56, padR=16, padT=26, padB=36;
  const plotW=w-padL-padR, plotH=h-padT-padB;
  if(plotW<80||plotH<60) return;
  const linthresh=100;
  const maxAbs=Math.max(100, ...rows.map(r=>Math.abs(r.pct)));
  const yMax=symlogY(maxAbs*1.15, linthresh);
  const yMin=-symlogY(Math.max(100, ...rows.map(r=>r.pct<0?Math.abs(r.pct):0))*1.15, linthresh);
  // include room for the biggest positive and any negatives; always show a bit of the other side
  const lo=Math.min(yMin, -0.6);
  const hi=Math.max(yMax, 0.6);
  const yOf=v=>{
    const y=symlogY(v, linthresh);
    return padT+plotH*(1-(y-lo)/(hi-lo));
  };
  const ticks=[0,50,100,200,500,1000,2000,5000,10000];
  const allTicks=[];
  for(const t of ticks){
    if(t===0){allTicks.push(0);continue}
    allTicks.push(t); allTicks.push(-t);
  }
  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.strokeStyle=th.grid; ctx.lineWidth=1;
  for(const t of allTicks){
    const yv=symlogY(t, linthresh);
    if(yv<lo||yv>hi) continue;
    const y=yOf(t);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
    ctx.fillStyle=th.muted||th.text;
    const lab=t===0?'0':(t>0?'+':'')+t+'%';
    ctx.fillText(lab, padL-6, y);
  }
  ctx.strokeStyle=th.border; ctx.strokeRect(padL,padT,plotW,plotH);
  const zero=yOf(0);
  ctx.strokeStyle=th.text; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(padL,zero); ctx.lineTo(padL+plotW,zero); ctx.stroke();
  const n=rows.length;
  const slot=plotW/n;
  const barW=Math.max(6, Math.min(28, slot*0.62));
  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='center';
  rows.forEach((r,i)=>{
    const cx=padL+slot*(i+0.5);
    const y=yOf(r.pct);
    const top=Math.min(y,zero), bot=Math.max(y,zero);
    ctx.fillStyle=r.up?'#2e7d32':'#c62828';
    ctx.fillRect(cx-barW/2, top, barW, Math.max(2, bot-top));
    const lab=r.pctLabel||formatAnnualPct(r.pct);
    ctx.fillStyle=r.up?'#1b5e20':'#b71c1c';
    if(typeof isDark==='function'&&isDark()) ctx.fillStyle=r.up?'#a5d6a7':'#ef9a9a';
    ctx.textBaseline=r.up?'bottom':'top';
    const ly=r.up?top-3:bot+3;
    ctx.font='bold 9px Verdana,Arial,sans-serif';
    ctx.fillText(lab, cx, ly);
    ctx.font='10px Verdana,Arial,sans-serif';
    ctx.fillStyle=th.text;
    ctx.textBaseline='top';
    const yearLab="'"+String(r.year).slice(2)+(r.ytd?'*':'');
    ctx.fillText(yearLab, cx, padT+plotH+6);
  });
  ctx.fillStyle=th.muted||th.text;
  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('% change (symlog)', padL+plotW/2, h-1);
}

function annualReturnsTableHtml(title, rows){
  const body=rows.map(r=>{
    const cls=r.up?'up':'down';
    return '<tr class="'+cls+'">'+
      '<td class="yr">'+r.yearLabel+'</td>'+
      '<td>'+r.startLabel+'</td>'+
      '<td>'+r.endLabel+'</td>'+
      '<td class="pct">'+r.pctLabel+'</td>'+
      '</tr>';
  }).join('');
  return '<div class="annual-returns-wrap">'+
    '<h3 class="annual-returns-title">'+title+'</h3>'+
    '<table class="annual-returns"><thead><tr>'+
    '<th>Year</th><th>Year Start</th><th>Year End</th><th>% Change</th>'+
    '</tr></thead><tbody>'+body+'</tbody></table></div>';
}

async function renderAnnualReturnsView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-annualreturns');
  $('charts').classList.remove('has-volume');
  const m=typeof currentMarket==='function'?currentMarket():'combinedUSD';
  // Use the daily cache (plus live top-up), not the display interval's last
  // bar. All Data auto-picks Monthly, whose last bar is the month start and
  // would truncate the current year's YTD close.
  const raw=await getDaily(m);
  let daily=raw.map(toBar).filter(b=>b&&b.close>0);
  if($('c')&&$('c').checked&&$('e')&&$('e').value){
    const end=Date.parse($('e').value)/1000;
    if(end) daily=daily.filter(b=>b.time<=end+12*3600);
  }
  const rows=computeAnnualReturns(daily,{startYear:2011,market:m});
  const title=annualReturnsTitle(m, rows);
  window.lastScout={kind:'annualreturns',market:m,rows,title,daily};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  if(typeof setEpochLegend==='function') setEpochLegend(false);
  if(!rows.length){
    const msg=document.createElement('p');
    msg.className='annual-returns-empty';
    msg.textContent='Not enough year-end closes on this series to compute annual returns (need a prior-year close and a year-end close from 2011 onward).';
    main.appendChild(msg);
    status('Not enough data for annual returns on '+(typeof marketLabel==='function'?marketLabel(m):m)+'.');
    return;
  }
  const last=rows.at(-1);
  status(rows.length+' calendar years · '+(typeof marketLabel==='function'?marketLabel(m):m)+' · last '+last.endLabel+' ('+last.yearLabel+' '+last.pctLabel+')');
  const wrap=document.createElement('div');
  wrap.innerHTML=annualReturnsTableHtml(title, rows);
  $('subs').appendChild(wrap.firstChild);
  attachPaintCanvas(main,(ctx,w,h)=>{
    paintAnnualReturnsBars(ctx,w,h,rows,{});
  });
  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    cnv.addEventListener('mousemove',ev=>{
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left;
      const w=rect.width, padL=56, padR=16, plotW=w-padL-padR;
      const i=Math.floor((x-padL)/ (plotW/rows.length));
      if(i<0||i>=rows.length){$('legend').textContent='';return}
      const r=rows[i];
      const when=typeof isoUTC==='function'?isoUTC(r.endTime):'';
      $('legend').textContent=r.yearLabel+'  ·  start '+r.startLabel+'  ·  end '+r.endLabel+(when?' on '+when:'')+'  ·  '+r.pctLabel;
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
  }
}

function paintAnnualReturnsTable(ctx, x, y, w, title, rows, dpr){
  const th=typeof T==='function'?T():{bg:'#fff',text:'#333',title:'#222',border:'#ccc'};
  const dark=typeof isDark==='function'&&isDark();
  const scale=dpr||1;
  const pad=Math.round(16*scale);
  const titleSize=Math.round(16*scale);
  const rowH=Math.round(22*scale);
  const headH=Math.round(24*scale);
  const tableW=Math.min(w-pad*2, Math.round(560*scale));
  const tableLeft=x+Math.round((w-tableW)/2);
  const cols=[0.18,0.28,0.28,0.26];
  const colX=i=>{
    let a=0; for(let k=0;k<i;k++) a+=cols[k];
    return tableLeft+a*tableW;
  };
  const colW=i=>cols[i]*tableW;
  ctx.fillStyle=th.title||th.text;
  ctx.font='bold '+titleSize+'px Verdana,Arial,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(title, x+w/2, y);
  const ty=y+titleSize+Math.round(10*scale);
  const headers=['Year','Year Start','Year End','% Change'];
  ctx.font='bold '+Math.round(11*scale)+'px Verdana,Arial,sans-serif';
  ctx.fillStyle=th.text;
  ctx.textBaseline='middle';
  for(let i=0;i<4;i++){
    ctx.textAlign=i===0?'left':'right';
    const tx=i===0?colX(i)+Math.round(8*scale):colX(i)+colW(i)-Math.round(8*scale);
    ctx.fillText(headers[i], tx, ty+headH/2);
  }
  ctx.strokeStyle=th.border; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(tableLeft, ty+headH); ctx.lineTo(tableLeft+tableW, ty+headH); ctx.stroke();
  rows.forEach((r,ri)=>{
    const ry=ty+headH+ri*rowH;
    const vals=[r.yearLabel, r.startLabel, r.endLabel, r.pctLabel];
    if(!r.up){
      ctx.fillStyle=dark?'rgba(198,40,40,0.22)':'#ffcdd2';
      ctx.fillRect(colX(3), ry, colW(3), rowH);
    }else{
      ctx.fillStyle=dark?'rgba(46,125,50,0.28)':'#c8e6c9';
      ctx.fillRect(colX(3), ry, colW(3), rowH);
    }
    ctx.font=Math.round(12*scale)+'px Verdana,Arial,sans-serif';
    if(ri===0) ctx.font='bold '+Math.round(12*scale)+'px Verdana,Arial,sans-serif';
    // year bold always
    for(let i=0;i<4;i++){
      if(i===0) ctx.font='bold '+Math.round(12*scale)+'px Verdana,Arial,sans-serif';
      else ctx.font=Math.round(12*scale)+'px Verdana,Arial,sans-serif';
      if(!r.up) ctx.fillStyle=dark?'#ef9a9a':'#c62828';
      else if(i===3) ctx.fillStyle=dark?'#c8e6c9':'#1b5e20';
      else ctx.fillStyle=th.text;
      ctx.textAlign=i===0?'left':'right';
      const tx=i===0?colX(i)+Math.round(8*scale):colX(i)+colW(i)-Math.round(8*scale);
      ctx.fillText(vals[i], tx, ry+rowH/2);
    }
    ctx.strokeStyle=th.border;
    ctx.beginPath(); ctx.moveTo(tableLeft, ry+rowH); ctx.lineTo(tableLeft+tableW, ry+rowH); ctx.stroke();
  });
  const tableH=titleSize+Math.round(10*scale)+headH+rows.length*rowH;
  return tableH+Math.round(12*scale);
}

function composeAnnualReturnsImage(){
  const s=window.lastScout||{};
  const rows=s.rows||[];
  const title=s.title||chartTitleLine();
  const src=window.scoutCanvas;
  const dpr=(src&&src.clientWidth)?(src.width/Math.max(1,src.clientWidth)):(window.devicePixelRatio||1);
  const cssW=src&&src.clientWidth?src.clientWidth:720;
  const width=Math.round(Math.max(720, cssW)*dpr);
  const pad=Math.round(16*dpr);
  const titleH=0; // table painter draws the title
  const tableH=paintAnnualReturnsTable(
    // measure: title + head + rows
    {fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillStyle:'',font:'',textAlign:'',textBaseline:'',strokeStyle:'',lineWidth:0},
    0,pad,width,title,rows,dpr
  );
  const chartCssH=src? (src.clientHeight||320) : 320;
  const chartH=Math.round(chartCssH*dpr);
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=pad+tableH+chartH+pad;
  const ctx=canvas.getContext('2d');
  const th=typeof T==='function'?T():{exportBg:'#fff'};
  ctx.fillStyle=th.exportBg||th.bg||'#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const used=paintAnnualReturnsTable(ctx,0,pad,width,title,rows,dpr);
  const chartY=pad+used;
  if(src){
    ctx.drawImage(src, 0, chartY, width, chartH);
  }else{
    ctx.save();
    ctx.translate(0, chartY);
    // paint in CSS pixels then scale? easier to set transform
    ctx.setTransform(dpr,0,0,dpr,0,chartY);
    paintAnnualReturnsBars(ctx, width/dpr, chartCssH, rows, {bg:th.exportBg||th.bg});
    ctx.setTransform(1,0,0,1,0,0);
    ctx.restore();
  }
  if(typeof paintWatermark==='function'){
    paintWatermark(ctx,0,chartY,width,chartH,dpr,{});
  }
  return canvas;
}

window.renderAnnualReturnsView=renderAnnualReturnsView;
window.computeAnnualReturns=computeAnnualReturns;
window.composeAnnualReturnsImage=composeAnnualReturnsImage;
window.formatAnnualPrice=formatAnnualPrice;
window.formatAnnualPct=formatAnnualPct;

const NEVERDOWN_ASSETS=[
  {id:'BTC',name:'Bitcoin',color:'#ef6c00'},
  {id:'QQQ',name:'QQQ',color:'#7b1fa2'},
  {id:'SPY',name:'SPY',color:'#1565c0'},
  {id:'GLD',name:'GLD',color:'#c9a017'},
  {id:'AGG',name:'AGG',color:'#2e7d32'},
  {id:'TLT',name:'TLT',color:'#6d4c41'},
];
const NEVERDOWN_TICKS=[1,2,5,10,20,50,100,200,500];
let etfWeeklyCache=null;
async function loadEtfWeekly(){
  if(etfWeeklyCache) return etfWeeklyCache;
  const root=(window.CHART_PAGE==='advanced'||window.CHART_PAGE==='v2')?'../data/':'data/';
  const r=await fetch(root+'macro/etf_weekly.json',{cache:'no-cache'});
  if(!r.ok) throw new Error('Failed to load weekly ETF cache ('+r.status+')');
  etfWeeklyCache=await r.json();
  return etfWeeklyCache;
}
function btcSundayCloses(daily){
  const out=[];
  for(const b of daily||[]){
    if(!b||!(b.close>0)||b.time==null) continue;
    const d=new Date(b.time*1000);
    if(d.getUTCDay()!==0) continue;
    out.push({time:b.time,close:b.close});
  }
  return out;
}
function sma200Of(closes){
  const out=[];
  if(!closes||closes.length<200) return out;
  let sum=0;
  for(let i=0;i<closes.length;i++){
    sum+=closes[i].close;
    if(i>=200) sum-=closes[i-200].close;
    if(i>=199) out.push({time:closes[i].time,sma:sum/200});
  }
  return out;
}
function isoWeek(t){
  return (typeof isoUTC==='function'?isoUTC(t):new Date(t*1000).toISOString().slice(0,10));
}
function computeNeverDown(btcDaily, etfJson){
  const btcW=btcSundayCloses(btcDaily);
  const btcSma=sma200Of(btcW);
  if(!btcSma.length) return {error:'Not enough Bitcoin Sunday closes for a 200-week average.'};
  const anchor=btcSma[0];
  const series={};
  series.BTC={id:'BTC',name:'Bitcoin',color:'#ef6c00',sma:btcSma,base:anchor.sma};
  const missing=[];
  for(const a of NEVERDOWN_ASSETS){
    if(a.id==='BTC') continue;
    const pack=etfJson&&etfJson.series&&etfJson.series[a.id];
    const closes=(pack&&pack.closes||[]).map(r=>({time:r[0],close:r[1]})).filter(p=>p.close>0);
    const sma=sma200Of(closes);
    if(!sma.length){missing.push(a.id);continue}
    const at=sma.find(p=>p.time===anchor.time)||sma.find(p=>p.time>=anchor.time);
    if(!at||!(at.sma>0)){missing.push(a.id);continue}
    series[a.id]={id:a.id,name:a.name,color:a.color,sma:sma,base:at.sma};
  }
  const startT=anchor.time;
  let endT=anchor.time;
  Object.values(series).forEach(s=>{if(s.sma.length) endT=Math.max(endT,s.sma.at(-1).time)});
  const assets=NEVERDOWN_ASSETS.map(a=>series[a.id]).filter(Boolean);
  const packed=assets.map(s=>{
    const by=new Map(s.sma.filter(p=>p.time>=startT).map(p=>[p.time,p.sma]));
    const times=[...by.keys()].sort((x,y)=>x-y);
    const pts=times.map((t,i)=>{
      const sma=by.get(t);
      const prev=i?by.get(times[i-1]):null;
      const indexed=sma/s.base;
      const down=prev!=null&&sma<prev;
      return {time:t,sma,indexed,down};
    });
    let downs=0, streak=0;
    for(let i=0;i<pts.length;i++) if(pts[i].down) downs++;
    for(let i=pts.length-1;i>=1;i--){
      if(pts[i].indexed>pts[i-1].indexed) streak++;
      else break;
    }
    const last=pts.at(-1);
    return {id:s.id,name:s.name,color:s.color,base:s.base,pts,downs,streak,last};
  });
  const btc=packed.find(s=>s.id==='BTC');
  return {anchor, startT, endT, assets:packed, missing, btc, source:etfJson&&(etfJson.source||''), asOf:etfJson&&etfJson.asOf};
}
function formatMult(v){
  if(!(v>0)) return '';
  if(v>=100) return (Math.round(v*10)/10).toFixed(v>=100&&v%1<0.05?0:1).replace(/\.0$/,'')+'x';
  return v.toFixed(1)+'x';
}
function paintNeverDown(ctx,w,h,pack){
  const th=typeof T==='function'?T():{bg:'#fff',text:'#333',grid:'#eee',border:'#ccc',muted:'#666',title:'#222'};
  const dark=typeof isDark==='function'&&isDark();
  ctx.fillStyle=th.bg; ctx.fillRect(0,0,w,h);
  const assets=pack.assets||[];
  if(!assets.length) return;
  const calloutH=24, axisTitleH=16, stripH=22, stripGap=4, nStrips=assets.length;
  const stripsBlock=nStrips*(stripH+stripGap)-stripGap;
  const creditH=28, padL=58, padR=86, padB=26;
  const mainTop=calloutH+axisTitleH;
  const mainH=h-mainTop-padB-stripsBlock-creditH;
  const plotW=w-padL-padR;
  if(plotW<80||mainH<80) return;

  const btc=pack.btc;
  const streak=btc?btc.streak:0;
  ctx.fillStyle=th.title||th.text;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  const callout="Bitcoin's 200-week average has risen "+streak+" week"+(streak===1?'':'s')+" in a row";
  let calloutSize=14;
  ctx.font='bold '+calloutSize+'px Verdana,Arial,sans-serif';
  while(calloutSize>11 && ctx.measureText(callout).width>w-16){
    calloutSize--; ctx.font='bold '+calloutSize+'px Verdana,Arial,sans-serif';
  }
  ctx.fillText(callout, 8, calloutH/2);
  ctx.fillStyle=th.muted||th.text;
  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='bottom';
  ctx.fillText('200-week avg, indexed (May 2014 = 1x)', padL, mainTop-4);

  const allV=[];
  assets.forEach(s=>s.pts.forEach(p=>{if(p.indexed>0) allV.push(p.indexed)}));
  const vmin=1, vmax=Math.max(500, Math.max(...allV)*1.15);
  const yOf=v=>{
    const lo=Math.log10(vmin), hi=Math.log10(vmax);
    return mainTop+mainH*(1-(Math.log10(Math.max(v,vmin*0.5))-lo)/(hi-lo));
  };
  const t0=pack.startT, t1=pack.endT;
  const xOf=t=>padL+plotW*((t-t0)/Math.max(1,t1-t0));

  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.strokeStyle=th.grid; ctx.lineWidth=1;
  for(const tick of NEVERDOWN_TICKS){
    if(tick<vmin||tick>vmax) continue;
    const y=yOf(tick);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
    ctx.fillStyle=th.muted||th.text;
    ctx.fillText(tick+'x', padL-6, y);
  }
  ctx.strokeStyle=th.border; ctx.strokeRect(padL,mainTop,plotW,mainH);
  // year ticks (skip odd years on narrow canvases so labels don't collide)
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle=th.muted||th.text;
  const y0=new Date(t0*1000).getUTCFullYear();
  const y1=new Date(t1*1000).getUTCFullYear();
  const yearStep=plotW<480?2:1;
  for(let y=y0;y<=y1;y++){
    const t=Date.UTC(y,0,1)/1000;
    if(t<t0-20*86400||t>t1+20*86400) continue;
    if(t>=t0&&t<=t1){
      const x=xOf(t);
      ctx.strokeStyle=th.grid;
      ctx.beginPath(); ctx.moveTo(x,mainTop); ctx.lineTo(x,mainTop+mainH); ctx.stroke();
    }
    if((y-y0)%yearStep) continue;
    const x=xOf(Math.max(t0, Math.min(t1,t)));
    ctx.fillStyle=th.muted||th.text;
    ctx.fillText(String(y), x, mainTop+mainH+6);
  }

  // lines: normal, then red down segments on top
  assets.forEach(s=>{
    const pts=s.pts;
    if(pts.length<2) return;
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.strokeStyle=s.color; ctx.lineWidth=1.8;
    ctx.beginPath();
    pts.forEach((p,i)=>{const x=xOf(p.time), y=yOf(p.indexed); if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y)});
    ctx.stroke();
    ctx.strokeStyle='#c62828'; ctx.lineWidth=3.2;
    let run=false;
    pts.forEach((p,i)=>{
      if(!i) return;
      const x0=xOf(pts[i-1].time), y0=yOf(pts[i-1].indexed);
      const x1=xOf(p.time), y1=yOf(p.indexed);
      if(p.down){
        if(!run){ctx.beginPath(); ctx.moveTo(x0,y0); run=true}
        ctx.lineTo(x1,y1);
      }else if(run){ctx.stroke(); run=false}
    });
    if(run) ctx.stroke();
  });

  // end labels, stacked if needed
  const labels=assets.map(s=>{
    const last=s.last; if(!last) return null;
    return {s, text:s.name+' '+formatMult(last.indexed), y:yOf(last.indexed), color:s.color};
  }).filter(Boolean).sort((a,b)=>a.y-b.y);
  ctx.font='bold 11px Verdana,Arial,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  const minGap=16, yLo=mainTop+8, yHi=mainTop+mainH-8;
  let lastY=yLo-minGap;
  labels.forEach(lab=>{
    let y=Math.max(yLo, Math.min(yHi, lab.y));
    if(y-lastY<minGap) y=lastY+minGap;
    lastY=y;
    const x=padL+plotW+6;
    ctx.lineWidth=3;
    ctx.strokeStyle=dark?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.9)';
    ctx.fillStyle=lab.color;
    ctx.strokeText(lab.text, x, y);
    ctx.fillText(lab.text, x, y);
  });

  // strips
  const stripTop=mainTop+mainH+padB;
  const lastTimes=new Map();
  assets.forEach((s,i)=>{
    const y=stripTop+i*(stripH+stripGap);
    ctx.fillStyle=dark?'#1a1a1a':'#f7f7f7';
    ctx.fillRect(padL,y,plotW,stripH);
    ctx.strokeStyle=th.border; ctx.lineWidth=1;
    ctx.strokeRect(padL,y,plotW,stripH);
    const slot=plotW/Math.max(1,s.pts.length);
    ctx.fillStyle='#c62828';
    s.pts.forEach((p,idx)=>{
      if(!p.down) return;
      const x=xOf(p.time);
      const bw=Math.max(1.2, slot*0.8);
      ctx.fillRect(x-bw/2, y+2, bw, stripH-4);
    });
    ctx.fillStyle=s.color;
    ctx.font='bold 10px Verdana,Arial,sans-serif';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.fillText(s.name, padL-6, y+stripH/2);
    ctx.fillStyle=th.text;
    ctx.font='11px Verdana,Arial,sans-serif';
    ctx.textAlign='left';
    ctx.fillText(String(s.downs), padL+plotW+6, y+stripH/2);
  });

  // watermark in the open upper-left of the main plot (lines all start near 1x)
  const wm=typeof WATERMARK_TEXT==='string'?WATERMARK_TEXT:'chartsbtc.github.io/btccharts';
  ctx.save();
  ctx.font='12px Verdana,Arial,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  const wmx=padL+10, wmy=mainTop+12;
  ctx.lineWidth=3;
  ctx.strokeStyle=dark?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.85)';
  ctx.strokeText(wm, wmx, wmy);
  ctx.fillStyle=dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.28)';
  ctx.fillText(wm, wmx, wmy);
  ctx.restore();

  ctx.fillStyle=th.muted||th.text;
  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  const creditY=stripTop+stripsBlock+creditH/2;
  ctx.fillText('Chart idea: @dotkrueger  ·  down-week counts on the right', padL, creditY);
}

async function renderNeverDownView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-neverdown');
  $('charts').classList.remove('has-volume');
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  if(typeof setEpochLegend==='function') setEpochLegend(false);
  let daily=[], etf=null, etfErr=null;
  try{daily=await getDaily('combinedUSD'); daily=daily.map(toBar).filter(b=>b&&b.close>0)}
  catch(e){status('Error loading Bitcoin history: '+e.message);return}
  try{etf=await loadEtfWeekly()}
  catch(e){etfErr=e.message; console.warn(e)}
  const pack=computeNeverDown(daily, etf);
  if(pack.error){status(pack.error);return}
  window.lastScout={kind:'200wnevrdown',pack};
  const btc=pack.btc&&pack.btc.last;
  const missing=pack.missing&&pack.missing.length?('  ·  missing '+pack.missing.join(', ')):''
    +(etfErr?('  ·  ETF cache: '+etfErr):'');
  status((pack.btc?('Bitcoin '+formatMult(pack.btc.last&&pack.btc.last.indexed)+'  ·  risen '+pack.btc.streak+' weeks in a row'):'200-week averages')+missing);
  const note=$('sourceNote');
  if(note){
    note.textContent='Bitcoin Sunday closes from the Combined daily cache (live-updated). ETF Friday closes are Yahoo dividend-adjusted total return (SPY, QQQ, GLD, AGG, TLT). Indexed to the first full Bitcoin 200-week window (week of 11 May 2014). Chart idea: @dotkrueger.';
  }
  attachPaintCanvas(main,(ctx,w,h)=>paintNeverDown(ctx,w,h,pack));
  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    cnv.addEventListener('mousemove',ev=>{
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left;
      const w=rect.width, padL=58, padR=78, plotW=w-padL-padR;
      const t0=pack.startT, t1=pack.endT;
      const t=t0+(t1-t0)*((x-padL)/Math.max(1,plotW));
      if(x<padL||x>padL+plotW){$('legend').textContent='';return}
      const bits=[isoWeek(t)];
      pack.assets.forEach(s=>{
        let best=null,bd=1e18;
        for(const p of s.pts){const d=Math.abs(p.time-t); if(d<bd){bd=d;best=p}}
        if(best&&bd<=10*86400) bits.push(s.name+' '+formatMult(best.indexed)+(best.down?' down':''));
      });
      $('legend').textContent=bits.join('  ·  ');
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
  }
}
window.renderNeverDownView=renderNeverDownView;
window.computeNeverDown=computeNeverDown;
window.formatMult=formatMult;

function utcDay(t){
  return Date.parse(new Date(t*1000).toISOString().slice(0,10)+'T00:00:00Z')/1000;
}
function daysBetweenUtc(t0, t1){
  return Math.round((utcDay(t1)-utcDay(t0))/86400);
}
function formatCorrDate(t){
  if(t==null||!isFinite(t)) return '?';
  const d=new Date(t*1000);
  const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return mon+' '+d.getUTCDate()+', '+d.getUTCFullYear();
}
function computeMajorCorrections(daily, opts){
  opts=opts||{};
  const start=opts.startTime!=null?opts.startTime:Date.UTC(2010,8,1)/1000; // 1 Sep 2010
  const market=opts.market||'';
  const bars=[];
  for(const b of daily||[]){
    if(!b||!(b.close>0)||b.time==null) continue;
    if(b.time<start) continue;
    bars.push(b);
  }
  const rows=[];
  let ath=0, peak=null, trough=null;
  function closeRow(newHighBar, ongoing){
    if(!peak||!trough||!(trough.close<peak.close)) return;
    const dd=(trough.close/peak.close-1)*100;
    if(dd>-30) return;
    const ret=(peak.close/trough.close-1)*100;
    const days=daysBetweenUtc(peak.time, trough.time);
    const recovDays=(!ongoing&&newHighBar)?daysBetweenUtc(peak.time, newHighBar.time):null;
    rows.push({
      peakTime:peak.time,
      troughTime:trough.time,
      newHighTime:ongoing||!newHighBar?null:newHighBar.time,
      high:peak.close,
      low:trough.close,
      dd,
      ret,
      days,
      recovDays,
      ongoing:!!ongoing,
      periodLabel:formatCorrDate(peak.time)+' – '+formatCorrDate(trough.time)+(ongoing?' (ongoing)':''),
      highLabel:typeof annualPriceLabel==='function'?annualPriceLabel(peak.close, market):String(Math.round(peak.close)),
      lowLabel:typeof annualPriceLabel==='function'?annualPriceLabel(trough.close, market):String(Math.round(trough.close)),
      ddLabel:typeof formatAnnualPct==='function'?formatAnnualPct(dd):(Math.round(dd)+'%'),
      retLabel:typeof formatAnnualPct==='function'?formatAnnualPct(ret):(Math.round(ret)+'%'),
      newHighLabel:ongoing||!newHighBar?'?':formatCorrDate(newHighBar.time),
      recovDaysLabel:recovDays==null?'?':String(recovDays)
    });
  }
  for(const b of bars){
    if(b.close>ath){
      closeRow(b, false);
      ath=b.close;
      peak=b;
      trough=b;
    }else if(peak && (trough==null || b.close<trough.close)){
      trough=b;
    }
  }
  closeRow(null, true);
  // newest first
  rows.reverse();
  let recordDays=0;
  for(const r of rows) if(r.days>recordDays) recordDays=r.days;
  for(const r of rows) r.record=recordDays>0 && r.days===recordDays;
  return {rows, bars, recordDays, start};
}

function correctionsTitle(market){
  const btc=!market||typeof isBtcMarket!=='function'||isBtcMarket(market);
  const who=btc?'Bitcoin':((typeof shortMarketLabel==='function'?shortMarketLabel(market):null)||(typeof marketLabel==='function'?marketLabel(market):'Series'));
  return who+' Major Corrections From All-Time Highs';
}

function ddShade(pct, dark){
  const t=Math.min(1, Math.max(0, (Math.abs(pct)-30)/60));
  if(dark){
    const r=Math.round(90+80*t), g=Math.round(28-10*t), b=Math.round(28-10*t);
    return {bg:'rgba('+r+','+g+','+b+','+(0.35+0.5*t)+')', fg:t>0.45?'#ffcdd2':'#ef9a9a'};
  }
  const r=Math.round(255-60*t), g=Math.round(205-175*t), b=Math.round(210-175*t);
  return {bg:'rgb('+r+','+g+','+b+')', fg:t>0.55?'#fff':'#b71c1c'};
}

function correctionsTableHtml(title, pack){
  const rows=pack.rows||[];
  const body=rows.map((r,i)=>{
    const cls=['corr-row', r.ongoing?'ongoing':'', r.record?'record':'', i===pack.selected?'on':''].filter(Boolean).join(' ');
    const depth=Math.min(5, Math.max(0, Math.round((Math.abs(r.dd)-30)/12)));
    return '<tr class="'+cls+'" data-i="'+i+'" data-depth="'+depth+'">'+
      '<td class="period">'+r.periodLabel+'</td>'+
      '<td class="days">'+r.days+'</td>'+
      '<td>'+r.highLabel+'</td>'+
      '<td>'+r.lowLabel+'</td>'+
      '<td class="pct dd">'+r.ddLabel+'</td>'+
      '<td class="pct ret">'+r.retLabel+'</td>'+
      '<td>'+r.newHighLabel+'</td>'+
      '<td>'+r.recovDaysLabel+'</td>'+
      '</tr>';
  }).join('');
  return '<div class="corrections-wrap">'+
    '<h3 class="corrections-title">'+title+'</h3>'+
    '<p class="corrections-sub">Every decline of 30% or more from a closing all-time high, September 2010 to now. High, low and drawdown use daily closes, the same as Drawdown from ATH. Newest first.</p>'+
    '<div class="corrections-scroll"><table class="corrections"><thead><tr>'+
    '<th>Correction Period</th><th># Days</th><th>High</th><th>Low</th><th>% Decline</th>'+
    '<th>% Return to New High</th><th>New High Date</th><th># Days Prior High to New High</th>'+
    '</tr></thead><tbody>'+body+'</tbody></table></div></div>';
}

function paintCorrectionsSparkline(ctx, w, h, pack, opts){
  opts=opts||{};
  const th=typeof T==='function'?T():{bg:'#fff',text:'#333',grid:'#eee',border:'#ccc',muted:'#666'};
  ctx.fillStyle=opts.bg||th.bg;
  ctx.fillRect(0,0,w,h);
  const rows=pack.rows||[];
  const bars=pack.bars||[];
  if(!bars.length){
    ctx.fillStyle=th.muted; ctx.font='12px Verdana,Arial,sans-serif';
    ctx.fillText('No data', 16, 24);
    return;
  }
  let ath=0;
  const pts=[];
  for(const b of bars){
    if(b.close>ath) ath=b.close;
    pts.push({time:b.time, close:b.close, ath, dd:ath?(b.close/ath-1)*100:0});
  }
  const padL=52, padR=16, padT=22, padB=28;
  const plotW=w-padL-padR, plotH=h-padT-padB;
  if(plotW<80||plotH<40) return;
  const t0=pts[0].time, t1=pts.at(-1).time;
  const yMin=Math.min(-30, Math.min(...pts.map(p=>p.dd))*1.06);
  const xOf=t=>padL+plotW*(t-t0)/Math.max(1,t1-t0);
  const yOf=v=>padT+plotH*(v-0)/(yMin-0);
  const dark=typeof isDark==='function'&&isDark();
  // shade each correction peak→trough
  rows.forEach((r,i)=>{
    const x1=xOf(r.peakTime), x2=xOf(r.troughTime);
    const sel=i===(pack.selected||0);
    ctx.fillStyle=sel?(dark?'rgba(247,147,26,0.28)':'rgba(247,147,26,0.22)'):(dark?'rgba(198,40,40,0.12)':'rgba(229,57,53,0.08)');
    ctx.fillRect(Math.min(x1,x2), padT, Math.max(2, Math.abs(x2-x1)), plotH);
  });
  // grid
  ctx.font='10px Verdana,Arial,sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  const ticks=[0,-20,-40,-60,-80,-100];
  for(const t of ticks){
    if(t<yMin) continue;
    const y=yOf(t);
    ctx.strokeStyle=th.grid; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
    ctx.fillStyle=th.muted;
    ctx.fillText(t===0?'0':(t+'%'), padL-6, y);
  }
  ctx.strokeStyle=th.border; ctx.strokeRect(padL,padT,plotW,plotH);
  // area
  ctx.beginPath();
  ctx.moveTo(xOf(pts[0].time), yOf(0));
  for(const p of pts) ctx.lineTo(xOf(p.time), yOf(p.dd));
  ctx.lineTo(xOf(pts.at(-1).time), yOf(0));
  ctx.closePath();
  ctx.fillStyle=dark?'rgba(229,57,53,0.45)':'rgba(229,57,53,0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xOf(pts[0].time), yOf(pts[0].dd));
  for(const p of pts) ctx.lineTo(xOf(p.time), yOf(p.dd));
  ctx.strokeStyle='#e53935'; ctx.lineWidth=1.4;
  ctx.stroke();
  // year ticks
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle=th.muted;
  const y0=new Date(t0*1000).getUTCFullYear();
  const yN=new Date(t1*1000).getUTCFullYear();
  for(let y=y0;y<=yN;y++){
    const t=Date.UTC(y,0,1)/1000;
    if(t<t0||t>t1) continue;
    const x=xOf(t);
    ctx.strokeStyle=th.grid;
    ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+plotH); ctx.stroke();
    if(y%2===0 || (yN-y0)<=8) ctx.fillText(String(y), x, padT+plotH+6);
  }
  ctx.fillStyle=th.text;
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.font='11px Verdana,Arial,sans-serif';
  const last=pts.at(-1);
  const sel=rows[pack.selected||0];
  let cap='Drawdown from closing ATHs';
  if(last) cap+='  ·  now '+last.dd.toFixed(1)+'%';
  if(sel) cap+='  ·  selected '+sel.periodLabel+'  '+sel.ddLabel;
  ctx.fillText(cap, padL, 4);
  pack._spark={t0,t1,padL,padR,plotW};
}

function correctionsTableRowH(dpr){return Math.round(22*dpr)}

function paintCorrectionsTable(ctx, x, y, w, title, pack, dpr){
  const th=typeof T==='function'?T():{bg:'#fff',text:'#333',title:'#222',border:'#ccc',muted:'#666'};
  const dark=typeof isDark==='function'&&isDark();
  const scale=dpr||1;
  const pad=Math.round(12*scale);
  const titleSize=Math.round(16*scale);
  const subSize=Math.round(10*scale);
  const rowH=correctionsTableRowH(scale);
  const headH=Math.round(36*scale);
  const tableW=w-pad*2;
  const tableLeft=x+pad;
  // period, days, high, low, dd, ret, new high, recov days
  const cols=[0.24,0.07,0.10,0.10,0.10,0.13,0.15,0.11];
  const colX=i=>{let a=0; for(let k=0;k<i;k++) a+=cols[k]; return tableLeft+a*tableW};
  const colW=i=>cols[i]*tableW;
  ctx.fillStyle=th.title||th.text;
  ctx.font='bold '+titleSize+'px Verdana,Arial,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(title, x+w/2, y);
  const sub='Daily closes, 30% or more from an all-time high. Newest first.';
  ctx.font=subSize+'px Verdana,Arial,sans-serif';
  ctx.fillStyle=th.muted||th.text;
  ctx.fillText(sub, x+w/2, y+titleSize+Math.round(4*scale));
  const ty=y+titleSize+subSize+Math.round(12*scale);
  const headers=['Correction Period','# Days','High','Low','% Decline','% Return to New High','New High Date','# Days Prior High to New High'];
  ctx.font='bold '+Math.round(9*scale)+'px Verdana,Arial,sans-serif';
  ctx.fillStyle=th.text;
  ctx.textBaseline='middle';
  for(let i=0;i<headers.length;i++){
    const left=i===0;
    ctx.textAlign=left?'left':'right';
    const tx=left?colX(i)+Math.round(6*scale):colX(i)+colW(i)-Math.round(6*scale);
    // wrap long headers into two lines if needed
    const words=headers[i];
    ctx.fillText(words, tx, ty+headH/2, colW(i)-Math.round(8*scale));
  }
  ctx.strokeStyle=th.border; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(tableLeft, ty+headH); ctx.lineTo(tableLeft+tableW, ty+headH); ctx.stroke();
  const rows=pack.rows||[];
  rows.forEach((r,ri)=>{
    const ry=ty+headH+ri*rowH;
    if(r.record){
      ctx.fillStyle=dark?'rgba(247,147,26,0.18)':'#fff3e0';
      ctx.fillRect(tableLeft, ry, tableW, rowH);
    }
    const shade=ddShade(r.dd, dark);
    ctx.fillStyle=shade.bg;
    ctx.fillRect(colX(4), ry, colW(4), rowH);
    const vals=[r.periodLabel, String(r.days), r.highLabel, r.lowLabel, r.ddLabel, r.retLabel, r.newHighLabel, r.recovDaysLabel];
    for(let i=0;i<vals.length;i++){
      ctx.font=((r.ongoing||i===0)?'bold ':'')+Math.round(11*scale)+'px Verdana,Arial,sans-serif';
      if(i===4) ctx.fillStyle=shade.fg;
      else if(r.record) ctx.fillStyle=dark?'#ffcc80':'#e65100';
      else ctx.fillStyle=th.text;
      const left=i===0;
      ctx.textAlign=left?'left':'right';
      const tx=left?colX(i)+Math.round(6*scale):colX(i)+colW(i)-Math.round(6*scale);
      ctx.fillText(vals[i], tx, ry+rowH/2, colW(i)-Math.round(8*scale));
    }
    ctx.strokeStyle=th.border;
    ctx.beginPath(); ctx.moveTo(tableLeft, ry+rowH); ctx.lineTo(tableLeft+tableW, ry+rowH); ctx.stroke();
  });
  const tableH=titleSize+subSize+Math.round(12*scale)+headH+rows.length*rowH;
  return tableH+Math.round(12*scale);
}

function composeCorrectionsImage(){
  const s=window.lastScout||{};
  const pack=s.pack||{rows:s.rows||[], bars:s.bars||[], selected:s.selected||0};
  const title=s.title||chartTitleLine();
  const src=window.scoutCanvas;
  const dpr=(src&&src.clientWidth)?(src.width/Math.max(1,src.clientWidth)):(window.devicePixelRatio||1);
  const cssW=src&&src.clientWidth?src.clientWidth:960;
  const width=Math.round(Math.max(880, cssW)*dpr);
  const pad=Math.round(16*dpr);
  const dummy={fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},closePath(){},fill(){},fillStyle:'',font:'',textAlign:'',textBaseline:'',strokeStyle:'',lineWidth:0};
  const tableH=paintCorrectionsTable(dummy,0,pad,width,title,pack,dpr);
  const chartCssH=src?(src.clientHeight||220):220;
  const chartH=Math.round(chartCssH*dpr);
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=pad+tableH+chartH+pad;
  const ctx=canvas.getContext('2d');
  const th=typeof T==='function'?T():{exportBg:'#fff'};
  ctx.fillStyle=th.exportBg||th.bg||'#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const used=paintCorrectionsTable(ctx,0,pad,width,title,pack,dpr);
  const chartY=pad+used;
  if(src){
    ctx.drawImage(src, 0, chartY, width, chartH);
  }else{
    ctx.setTransform(dpr,0,0,dpr,0,chartY);
    paintCorrectionsSparkline(ctx, width/dpr, chartCssH, pack, {bg:th.exportBg||th.bg});
    ctx.setTransform(1,0,0,1,0,0);
  }
  if(typeof paintWatermark==='function'){
    paintWatermark(ctx,0,chartY,width,chartH,dpr,{});
  }
  return canvas;
}

function bindCorrectionsInteractions(wrap, pack){
  function select(i, scroll){
    if(i==null||i<0||i>=pack.rows.length) return;
    pack.selected=i;
    if(window.lastScout) window.lastScout.selected=i;
    wrap.querySelectorAll('tr.corr-row').forEach(tr=>tr.classList.toggle('on', +tr.dataset.i===i));
    if(window.scoutCanvas && window._correctionsRedraw) window._correctionsRedraw();
  }
  wrap.addEventListener('click',e=>{
    const tr=e.target.closest('tr.corr-row');
    if(!tr) return;
    select(+tr.dataset.i);
  });
  const cnv=window.scoutCanvas;
  if(cnv){
    cnv.style.cursor='crosshair';
    const hit=ev=>{
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left;
      const sp=pack._spark;
      if(!sp) return null;
      const t=sp.t0+(sp.t1-sp.t0)*((x-sp.padL)/Math.max(1,sp.plotW));
      let best=-1, bd=1e18;
      pack.rows.forEach((r,i)=>{
        const mid=(r.peakTime+r.troughTime)/2;
        const d=Math.abs(t-mid);
        const inside=t>=r.peakTime && t<=(r.newHighTime||pack.bars.at(-1).time);
        if(inside && d<bd){bd=d; best=i}
      });
      return best;
    };
    cnv.addEventListener('mousemove',ev=>{
      const sp=pack._spark;
      if(!sp){$('legend').textContent='';return}
      const rect=cnv.getBoundingClientRect();
      const x=ev.clientX-rect.left;
      if(x<sp.padL||x>sp.padL+sp.plotW){$('legend').textContent='';return}
      const t=sp.t0+(sp.t1-sp.t0)*((x-sp.padL)/Math.max(1,sp.plotW));
      let bar=null, bd=1e18;
      for(const b of pack.bars){const d=Math.abs(b.time-t); if(d<bd){bd=d;bar=b}}
      if(!bar) return;
      let ath=0;
      for(const b of pack.bars){ if(b.time>bar.time) break; if(b.close>ath) ath=b.close; }
      const dd=ath?(bar.close/ath-1)*100:0;
      const i=hit(ev);
      const m=window.lastScout&&window.lastScout.market;
      const px=typeof annualPriceLabel==='function'?annualPriceLabel(bar.close, m):String(bar.close);
      const bits=[(typeof isoUTC==='function'?isoUTC(bar.time):''),'close '+px, 'DD '+dd.toFixed(1)+'%'];
      if(i!=null&&i>=0) bits.push(pack.rows[i].periodLabel+' '+pack.rows[i].ddLabel);
      $('legend').textContent=bits.join('  ·  ');
    });
    cnv.addEventListener('mouseleave',()=>{$('legend').textContent=''});
    cnv.addEventListener('click',ev=>{
      const i=hit(ev);
      if(i!=null&&i>=0) select(i);
    });
  }
  window.selectCorrection=select;
}

async function renderCorrectionsView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-corrections');
  $('charts').classList.remove('has-volume');
  const m=typeof currentMarket==='function'?currentMarket():'combinedUSD';
  const raw=await getDaily(m);
  let daily=raw.map(toBar).filter(b=>b&&b.close>0);
  if($('c')&&$('c').checked&&$('e')&&$('e').value){
    const end=Date.parse($('e').value)/1000;
    if(end) daily=daily.filter(b=>b.time<=end+12*3600);
  }
  const computed=computeMajorCorrections(daily,{market:m});
  const title=correctionsTitle(m);
  const pack=Object.assign({selected:0, market:m, title}, computed);
  window.lastScout={kind:'corrections',market:m,rows:pack.rows,bars:pack.bars,pack,title,selected:0};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  if(typeof setEpochLegend==='function') setEpochLegend(false);
  if(!pack.rows.length){
    const msg=document.createElement('p');
    msg.className='corrections-empty';
    msg.textContent='No declines of 30% or more from a closing all-time high on this series (from September 2010).';
    main.appendChild(msg);
    status('No 30%+ closing corrections on '+(typeof marketLabel==='function'?marketLabel(m):m)+'.');
    return;
  }
  const cur=pack.rows.find(r=>r.ongoing)||pack.rows[0];
  const rec=pack.rows.find(r=>r.record);
  status(pack.rows.length+' corrections of 30%+  ·  '+(typeof marketLabel==='function'?marketLabel(m):m)+
    '  ·  current '+cur.ddLabel+' from ATH ('+cur.periodLabel+', '+cur.days+' days)'+
    (rec?'  ·  longest '+rec.days+' days ('+rec.periodLabel.replace(' (ongoing)','')+')':''));
  const note=$('sourceNote');
  if(note){
    const splice=(m==='combinedUSD'&&typeof SPLICE==='string')?(SPLICE+' '):'';
    note.textContent=splice+'Daily closing prices (same convention as Drawdown from ATH), from September 2010. A correction runs from a closing all-time high to the lowest close before the next closing all-time high, and is kept if that drop is 30% or more. Chart idea: Charlie Bilello.';
  }
  const wrap=document.createElement('div');
  wrap.innerHTML=correctionsTableHtml(title, pack);
  $('subs').appendChild(wrap.firstChild);
  const host=$('subs').querySelector('.corrections-wrap');
  const painter=(ctx,w,h)=>{
    paintCorrectionsSparkline(ctx,w,h,pack,{});
  };
  const attached=attachPaintCanvas(main, painter);
  window._correctionsRedraw=attached&&attached.redraw;
  bindCorrectionsInteractions(host, pack);
}

window.renderCorrectionsView=renderCorrectionsView;
window.computeMajorCorrections=computeMajorCorrections;
window.composeCorrectionsImage=composeCorrectionsImage;

const ASSET_RETURN_TICKERS=['DBC','IWD','VNQ','IWM','MDY','BIL','SPY','EFA','TIP','BND','HYG','QQQ','CWB','LQD','EMB','TLT','VWO','PFF','IWF','GLD'];
let etfYearendCache=null;
async function loadEtfYearend(){
  if(etfYearendCache) return etfYearendCache;
  const root=(window.CHART_PAGE==='advanced'||window.CHART_PAGE==='v2')?'../data/':'data/';
  const r=await fetch(root+'macro/etf_yearend.json',{cache:'no-cache'});
  if(!r.ok) throw new Error('Failed to load ETF year-end cache ('+r.status+')');
  etfYearendCache=await r.json();
  return etfYearendCache;
}

function formatAssetPct(p, asMultiple){
  if(p==null||!isFinite(p)) return '–';
  if(asMultiple && Math.abs(p)>=10){
    const m=1+p;
    const body=m>=100?Math.round(m).toLocaleString('en-US'):(m>=10?m.toFixed(1):m.toFixed(2));
    return body+'x';
  }
  const pct=p*100;
  const sign=pct>0?'+':pct<0?'':'';
  if(Math.abs(pct)>=100) return sign+Math.round(pct).toLocaleString('en-US')+'%';
  return sign+pct.toFixed(1)+'%';
}

function yearEndMapFromDaily(daily){
  const map=typeof yearEndCloses==='function'?yearEndCloses(daily):new Map();
  const out=new Map();
  for(const [y,b] of map){
    if(!b||!(b.close>0)) continue;
    out.set(+y, {date:typeof isoUTC==='function'?isoUTC(b.time):'', time:b.time, close:b.close});
  }
  return out;
}

function yearEndMapFromEtf(series){
  const out=new Map();
  if(!series||!series.years) return out;
  for(const [y,o] of Object.entries(series.years)){
    if(!o||!(o.adjclose>0)) continue;
    out.set(+y, {date:o.date, time:o.time, close:o.adjclose});
  }
  return out;
}

function assetPeriodReturn(end, start){
  if(!end||!start||!(start.close>0)||!(end.close>0)) return null;
  return end.close/start.close-1;
}

function computeAssetReturns(btcDaily, etfCache, opts){
  opts=opts||{};
  const startYear=opts.startYear||2011;
  const assets=[];
  const btcMarket=opts.market||'combinedUSD';
  const btcMap=yearEndMapFromDaily(btcDaily);
  const btcLast=(btcDaily&&btcDaily.length)?btcDaily[btcDaily.length-1]:null;
  const lastYear=btcLast?new Date(btcLast.time*1000).getUTCFullYear():new Date().getUTCFullYear();
  const calYears=[];
  for(let y=startYear;y<lastYear;y++) calYears.push(y);
  const ytdYear=lastYear;

  function buildRow(name, id, map, lastBar, kind){
    const last=lastBar&&lastBar.close>0?{date:lastBar.date||(typeof isoUTC==='function'?isoUTC(lastBar.time):''), time:lastBar.time, close:lastBar.close}:null;
    const cells={};
    for(const y of calYears){
      cells[y]=assetPeriodReturn(map.get(y), map.get(y-1));
    }
    const ytd=assetPeriodReturn(last, map.get(ytdYear-1));
    const start=map.get(startYear-1);
    const cum=assetPeriodReturn(last, start);
    let ann=null, years=null;
    if(cum!=null && start && last && last.time>start.time){
      const days=(typeof daysBetweenUtc==='function')?daysBetweenUtc(start.time, last.time):Math.round((last.time-start.time)/86400);
      years=days/365.25;
      if(years>0 && (1+cum)>0) ann=Math.pow(1+cum, 1/years)-1;
    }
    return {name, id, kind, cells, ytd, cum, ann, years, last, start, map};
  }

  const btcLastBar=btcLast?{time:btcLast.time, close:btcLast.close, date:typeof isoUTC==='function'?isoUTC(btcLast.time):''}:null;
  assets.push(buildRow('Bitcoin','BTC',btcMap,btcLastBar,'btc'));

  const series=(etfCache&&etfCache.series)||{};
  const missing=[];
  for(const sym of ASSET_RETURN_TICKERS){
    const s=series[sym];
    if(!s){ missing.push(sym); continue; }
    const map=yearEndMapFromEtf(s);
    const last={time:s.lastTime, close:s.lastAdjclose, date:s.last};
    if(!(last.close>0)){ missing.push(sym); continue; }
    assets.push(buildRow(sym,sym,map,last,'etf'));
  }
  assets.sort((a,b)=>{
    const av=a.ytd, bv=b.ytd;
    if(av==null&&bv==null) return a.name.localeCompare(b.name);
    if(av==null) return 1;
    if(bv==null) return -1;
    return av-bv;
  });

  function footerFor(getter){
    const vals=assets.map(a=>({name:a.name, v:getter(a)})).filter(x=>x.v!=null&&isFinite(x.v));
    if(!vals.length) return {high:null, low:null, pctPos:null};
    let high=vals[0], low=vals[0];
    let pos=0;
    for(const x of vals){
      if(x.v>high.v) high=x;
      if(x.v<low.v) low=x;
      if(x.v>=0) pos++;
    }
    return {high, low, pctPos:pos/vals.length, n:vals.length};
  }
  const footCols={};
  for(const y of calYears) footCols[y]=footerFor(a=>a.cells[y]);
  footCols.ytd=footerFor(a=>a.ytd);
  footCols.cum=footerFor(a=>a.cum);
  footCols.ann=footerFor(a=>a.ann);

  return {
    assets, missing, calYears, ytdYear, startYear,
    asOf: etfCache&&etfCache.asOf,
    btcAsOf: btcLastBar&&btcLastBar.date,
    market: btcMarket,
    footCols
  };
}

function assetReturnsTitle(){ return 'Asset Class Total Returns Since 2011'; }

function assetCellClass(v){
  if(v==null||!isFinite(v)) return 'na';
  return v>=0?'up':'down';
}

function assetReturnsTableHtml(title, pack){
  const years=pack.calYears||[];
  const ytdLab=pack.ytdYear+' YTD';
  const cumLab=(pack.startYear)+'–'+String(pack.ytdYear).slice(2);
  const head=['Asset', ytdLab, cumLab, 'Ann.'].concat(years.map(String));
  function cell(v, kind){
    const cls=assetCellClass(v);
    return '<td class="pct '+cls+'">'+formatAssetPct(v, kind==='cum')+'</td>';
  }
  const body=pack.assets.map(a=>{
    const tds=['<td class="asset">'+a.name+'</td>', cell(a.ytd,'ytd'), cell(a.cum,'cum'), cell(a.ann,'ann')]
      .concat(years.map(y=>cell(a.cells[y],'y')));
    return '<tr>'+tds.join('')+'</tr>';
  }).join('');
  function footRow(label, pick){
    const tds=['<td class="asset">'+label+'</td>'];
    const keys=['ytd','cum','ann'].concat(years);
    keys.forEach(k=>{
      const f=pack.footCols[k];
      const item=f&&f[pick];
      if(pick==='pctPos'){
        const v=f&&f.pctPos;
        tds.push('<td class="foot">'+((v==null)?'–':(Math.round(v*100)+'%'))+'</td>');
      }else if(!item){
        tds.push('<td class="foot">–</td>');
      }else{
        const kind=k==='cum'?'cum':'y';
        tds.push('<td class="foot"><span class="fn">'+item.name+'</span><span class="fv">'+formatAssetPct(item.v, kind==='cum')+'</span></td>');
      }
    });
    return '<tr class="foot-'+label.toLowerCase().replace(/[^a-z]+/g,'')+'">'+tds.join('')+'</tr>';
  }
  const foot=footRow('Highest','high')+footRow('Lowest','low')+footRow('% Positive','pctPos');
  const asOf=pack.btcAsOf||pack.asOf||'';
  const sub='Calendar-year total returns, sorted by '+ytdLab+' (worst first). ETF figures use dividend-adjusted Yahoo closes; Bitcoin uses the same daily-close math as Annual Returns. As of '+asOf+'.';
  return '<div class="asset-returns-wrap">'+
    '<h3 class="asset-returns-title">'+title+'</h3>'+
    '<p class="asset-returns-sub">'+sub+'</p>'+
    '<div class="asset-returns-scroll"><table class="asset-returns"><thead><tr>'+
    head.map((h,i)=>'<th'+(i===0?' class="asset"':'')+'>'+h+'</th>').join('')+
    '</tr></thead><tbody>'+body+'</tbody><tfoot>'+foot+'</tfoot></table></div></div>';
}

function paintAssetReturnsTable(ctx, x, y, w, title, pack, dpr){
  const th=typeof T==='function'?T():{bg:'#fff',text:'#333',title:'#222',border:'#ccc',muted:'#666'};
  const dark=typeof isDark==='function'&&isDark();
  const scale=dpr||1;
  const pad=Math.round(12*scale);
  const titleSize=Math.round(16*scale);
  const subSize=Math.round(10*scale);
  const rowH=Math.round(20*scale);
  const headH=Math.round(28*scale);
  const years=pack.calYears||[];
  const nNum=years.length+3;
  const nameW=Math.round(72*scale);
  const tableLeft=x+pad;
  const tableW=w-pad*2;
  const numW=(tableW-nameW)/nNum;
  const colX=i=>tableLeft+(i===0?0:nameW+(i-1)*numW);
  const colW=i=>i===0?nameW:numW;
  ctx.fillStyle=th.title||th.text;
  ctx.font='bold '+titleSize+'px Verdana,Arial,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(title, x+w/2, y);
  const ytdLab=pack.ytdYear+' YTD';
  const sub='Total returns, sorted by '+ytdLab+' (worst first). ETFs: Yahoo adjclose. Bitcoin: daily closes. As of '+(pack.btcAsOf||pack.asOf||'')+'.';
  ctx.font=subSize+'px Verdana,Arial,sans-serif';
  ctx.fillStyle=th.muted||th.text;
  ctx.fillText(sub, x+w/2, y+titleSize+Math.round(4*scale), tableW);
  const ty=y+titleSize+subSize+Math.round(12*scale);
  const headers=['Asset', ytdLab, (pack.startYear)+'–'+String(pack.ytdYear).slice(2), 'Ann.'].concat(years.map(String));
  ctx.font='bold '+Math.round(9*scale)+'px Verdana,Arial,sans-serif';
  ctx.fillStyle=th.text;
  ctx.textBaseline='middle';
  headers.forEach((h,i)=>{
    ctx.textAlign=i===0?'left':'center';
    const tx=i===0?colX(i)+Math.round(4*scale):colX(i)+colW(i)/2;
    ctx.fillText(h, tx, ty+headH/2, colW(i)-Math.round(4*scale));
  });
  ctx.strokeStyle=th.border; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(tableLeft, ty+headH); ctx.lineTo(tableLeft+tableW, ty+headH); ctx.stroke();

  function shade(v){
    if(v==null||!isFinite(v)) return {bg:'transparent', fg:th.muted};
    if(v>=0) return {bg:dark?'rgba(46,125,50,0.35)':'#c8e6c9', fg:dark?'#c8e6c9':'#1b5e20'};
    return {bg:dark?'rgba(198,40,40,0.32)':'#ffcdd2', fg:dark?'#ffcdd2':'#b71c1c'};
  }
  function paintRow(vals, ry, opts){
    opts=opts||{};
    vals.forEach((cell,i)=>{
      if(i>0 && cell.v!=null && !opts.plain){
        const s=shade(cell.v);
        ctx.fillStyle=s.bg;
        ctx.fillRect(colX(i), ry, colW(i), rowH);
      }else if(opts.foot){
        ctx.fillStyle=dark?'#1a1a1a':'#f6f6f6';
        ctx.fillRect(colX(i), ry, colW(i), rowH);
      }
      ctx.font=((i===0||opts.foot)?'bold ':'')+Math.round(opts.foot?8:10)*scale+'px Verdana,Arial,sans-serif';
      if(i===0) ctx.fillStyle=th.text;
      else if(opts.plain||opts.foot) ctx.fillStyle=th.text;
      else ctx.fillStyle=shade(cell.v).fg;
      ctx.textAlign=i===0?'left':'center';
      const tx=i===0?colX(i)+Math.round(4*scale):colX(i)+colW(i)/2;
      ctx.fillText(cell.text, tx, ry+rowH/2, colW(i)-Math.round(4*scale));
    });
    ctx.strokeStyle=th.border;
    ctx.beginPath(); ctx.moveTo(tableLeft, ry+rowH); ctx.lineTo(tableLeft+tableW, ry+rowH); ctx.stroke();
  }
  pack.assets.forEach((a,ri)=>{
    const vals=[{text:a.name,v:null},
        {text:formatAssetPct(a.ytd), v:a.ytd},
        {text:formatAssetPct(a.cum,true), v:a.cum},
        {text:formatAssetPct(a.ann), v:a.ann}]
      .concat(years.map(y=>({text:formatAssetPct(a.cells[y]), v:a.cells[y]})));
    paintRow(vals, ty+headH+ri*rowH, {});
  });
  const footStart=ty+headH+pack.assets.length*rowH;
  const footDefs=[
    {label:'Highest', pick:'high'},
    {label:'Lowest', pick:'low'},
    {label:'% Positive', pick:'pctPos'}
  ];
  footDefs.forEach((fd,fi)=>{
    const keys=['ytd','cum','ann'].concat(years);
    const vals=[{text:fd.label,v:null}].concat(keys.map(k=>{
      const f=pack.footCols[k];
      if(fd.pick==='pctPos') return {text:(f&&f.pctPos!=null)?(Math.round(f.pctPos*100)+'%'):'–', v:null};
      const item=f&&f[fd.pick];
      if(!item) return {text:'–', v:null};
      const kind=k==='cum'?'cum':'y';
      return {text:item.name+' '+formatAssetPct(item.v, kind==='cum'), v:null};
    }));
    paintRow(vals, footStart+fi*rowH, {foot:true, plain:true});
  });
  const tableH=titleSize+subSize+Math.round(12*scale)+headH+(pack.assets.length+3)*rowH;
  return tableH+Math.round(12*scale);
}

function composeAssetReturnsImage(){
  const s=window.lastScout||{};
  const pack=s.pack||{};
  const title=s.title||assetReturnsTitle();
  const dpr=window.devicePixelRatio||1;
  const cssW=Math.max(1100, (document.querySelector('.asset-returns')||{}).clientWidth||1100);
  const width=Math.round(cssW*dpr);
  const pad=Math.round(16*dpr);
  const dummy={fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillStyle:'',font:'',textAlign:'',textBaseline:'',strokeStyle:'',lineWidth:0};
  const tableH=paintAssetReturnsTable(dummy,0,pad,width,title,pack,dpr);
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=pad+tableH+pad;
  const ctx=canvas.getContext('2d');
  const th=typeof T==='function'?T():{exportBg:'#fff'};
  ctx.fillStyle=th.exportBg||th.bg||'#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  paintAssetReturnsTable(ctx,0,pad,width,title,pack,dpr);
  if(typeof paintWatermark==='function'){
    paintWatermark(ctx,0,pad,width,tableH,dpr,{});
  }
  return canvas;
}

async function renderAssetReturnsView(){
  clearCharts();
  document.body.classList.add('scout-view','scout-assetreturns');
  $('charts').classList.remove('has-volume');
  const m=typeof currentMarket==='function'?currentMarket():'combinedUSD';
  const btcMarket=(typeof isBtcMarket==='function'&&isBtcMarket(m))?m:'combinedUSD';
  let daily=[], etf=null, etfErr='';
  try{
    const raw=await getDaily(btcMarket);
    daily=raw.map(toBar).filter(b=>b&&b.close>0);
  }catch(e){status('Error loading Bitcoin history: '+e.message);return}
  try{etf=await loadEtfYearend()}
  catch(e){etfErr=e.message; console.warn(e)}
  const pack=computeAssetReturns(daily, etf, {market:btcMarket, startYear:2011});
  const title=assetReturnsTitle();
  window.lastScout={kind:'assetreturns', market:btcMarket, pack, title, rows:pack.assets};
  const main=$('main');
  main.innerHTML='';
  $('subs').innerHTML='';
  if(typeof setEpochLegend==='function') setEpochLegend(false);
  if(!pack.assets.length){
    const msg=document.createElement('p');
    msg.className='asset-returns-empty';
    msg.textContent='Not enough data to compute asset-class returns.';
    main.appendChild(msg);
    status('Not enough data for asset-class returns.');
    return;
  }
  const btc=pack.assets.find(a=>a.id==='BTC');
  const gld=pack.assets.find(a=>a.id==='GLD');
  const miss=pack.missing&&pack.missing.length?('  ·  missing '+pack.missing.join(', ')):''+(etfErr?('  ·  ETF cache: '+etfErr):'');
  status(pack.assets.length+' assets  ·  Bitcoin '+(btc?formatAssetPct(btc.ytd):'')+' YTD  ·  Gold '+(gld?formatAssetPct(gld.ytd):'')+' YTD  ·  as of '+(pack.btcAsOf||pack.asOf||'')+miss);
  const note=$('sourceNote');
  if(note){
    note.textContent='Bitcoin uses Combined daily closes (same year-end math as Annual Returns). ETFs are Yahoo dividend- and split-adjusted closes (total return), year-end and latest session cached in data/macro/etf_yearend.json. Sorted by '+pack.ytdYear+' YTD, worst first. Chart idea: Charlie Bilello.';
  }
  const wrap=document.createElement('div');
  wrap.innerHTML=assetReturnsTableHtml(title, pack);
  $('subs').appendChild(wrap.firstChild);
  // no sparkline; leave main empty so the table can use the space
}

window.renderAssetReturnsView=renderAssetReturnsView;
window.computeAssetReturns=computeAssetReturns;
window.composeAssetReturnsImage=composeAssetReturnsImage;
window.formatAssetPct=formatAssetPct;
