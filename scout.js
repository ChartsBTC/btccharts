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


// ---- scout views ----
let scoutPlots=[];
const YEAR_2030=(Date.UTC(2030,11,31)/1000);
function daysTo2030(){return (YEAR_2030-GENESIS)/86400}
function yearsAheadOfPowerLaw(d,price,fit){
  if(!(d>0)||!(price>0)||!fit||!fit.b) return null;
  const dStar=Math.pow(10,(Math.log10(price)-fit.a)/fit.b);
  return (dStar-d)/365.25;
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
  setPlLegend(fit);
  const ratio=computeRatio(bars,'pl');
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
    onDraw:(u,pr)=>drawFit(u,pr),
    yFormat:v=>v>=1000?compact(v):(v>=1?String(+v.toPrecision(3)):String(+v.toPrecision(2))),
  });
  makeScoutUplot(rHost,xs,ratioY,{
    xMin,xMax,xLabels:false,stroke:'#1565c0',title:'Price / Power Law',
    onDraw:(u,pr)=>drawHLine(u,pr,1,'#e53935'),
    yFormat:v=>formatRatioValue(v),
  });
  makeScoutUplot(aHost,xs,aheadY,{
    xMin,xMax,xLabels:true,yLinear:true,stroke:'#1565c0',title:'Years Ahead of Power Law',
    onDraw:(u,pr)=>drawHLine(u,pr,0,'#e53935'),
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
    if(ratioY[i]!=null) bits.push('Price/PL '+formatRatioValue(ratioY[i]));
    if(aheadY[i]!=null) bits.push('Years ahead '+(aheadY[i]>=0?'+':'')+aheadY[i].toFixed(2));
    $('legend').textContent=bits.join('  ·  ');
  };
  scoutPlots.forEach(u=>u.setCursor&&null);
  // uPlot cursor sync already shares cursor; attach setCursor via existing hook is hard after construct.
  // Listen on mousemove of each root.
  scoutPlots.forEach(u=>{
    u.root.addEventListener('mousemove',()=>setLeg(u));
    u.root.addEventListener('mouseleave',()=>{$('legend').textContent=''});
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

function renderScout(kind){
  kind=kind||scoutView();
  if(kind==='powerlaw'){renderPowerLawView();return true}
  if(kind==='drawdown'){renderDrawdownView();return true}
  if(kind==='ath'){renderAthView();return true}
  return false;
}

window.scoutView=scoutView;
window.renderScout=renderScout;
window.clearScoutPlots=clearScoutPlots;
window.composeScoutImage=composeScoutImage;
window.yearsAheadOfPowerLaw=yearsAheadOfPowerLaw;
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

