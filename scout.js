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
  const ls=ch.addLineSeries({
    color:opts.color||'#1565c0',
    lineWidth:1.5,
    priceLineVisible:false,
    lastValueVisible:true,
    priceFormat:{type:'price',precision:3,minMove:0.001},
  });
  ls.setData(computed.points.map(p=>({time:p.time,value:p.value})));
  ls.createPriceLine({price:1,color:'#e53935',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'1.0'});
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
