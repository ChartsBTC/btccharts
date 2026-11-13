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
  ls.setData(computed.points.map(p=>({time:p.time,value:p.value})));
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
      ms.setData(ma);
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
    paintWatermark(ctx,0,pad+titleH,src.width,src.height,dpr,{});
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
  if(kind==='ranges'){await renderRangesView();return true}
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
  window.lastScout={kind:'epoch',candles};
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
