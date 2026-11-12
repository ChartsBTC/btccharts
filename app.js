const $=id=>document.getElementById(id);
const LW=LightweightCharts;
const FIELDS=['m','r','i','c','s','e','t','b','a1','m1','a2','m2','x','i1','i2','i3','i4','v','cv','l','p','cy','ca','cp','ch','cl','hv','ll'];
// populate indicator selects (only implemented ones, original naming)
document.querySelectorAll('select.ind').forEach(s=>{s.innerHTML='<option value="">None</option>'+Object.entries(INDICATORS).map(([k,v])=>`<option value="${k}">${v.label.replace(/ \(.*/,'')}</option>`).join('')});

// ---- URL hash: <id>g<value> joined by z (bitcoincharts format) ----
function buildHash(){const h=[];for(const id of FIELDS){const e=$(id);
  if(e.type==='checkbox'){if(e.checked)h.push(id)}else if(e.value)h.push(id+'g'+escape(e.value))}return h.join('z')}
function parseHash(hash){ if(!hash)return;
  // reset everything to blank/unchecked; hash fully describes state (original reset v,t,r)
  for(const id of FIELDS){const e=$(id);if(id==='m'){e.value='combinedUSD';continue}if(e.type==='checkbox')e.checked=false;else e.value=({m1:'10',m2:'25',ca:'low',cp:'usd'})[id]||''}
  // Longest-id match so values may contain "g" (e.g. mgmtgoxUSD). The original split("g") would turn that into mtogxUSD.
  const ids=FIELDS.slice().sort((a,b)=>b.length-a.length);
  for(const part of hash.split('z')){const id=ids.find(x=>part===x||part.startsWith(x+'g'));if(!id)continue;const e=$(id);
    if(e.type==='checkbox')e.checked=true;else e.value=unescape(part.slice(id.length+1))}}
function syncCustom(){ $('CustomTimeBox').style.display=$('c').checked?'block':'none'; $('r').style.display=$('c').checked?'none':'';}
function syncViewToggle(){
  const on=$('cy').checked;
  document.body.classList.toggle('cycles-view',on);
  document.querySelectorAll('#viewToggle button').forEach(b=>b.classList.toggle('on',(b.dataset.cy==='1')===on));
  $('main').classList.toggle('cycles',on);
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
function mkChart(el,opts={}){return LW.createChart(el,{autoSize:true,layout:{background:{color:'#fff'},textColor:'#333',fontSize:11},
  grid:{vertLines:{color:'#eee'},horzLines:{color:'#eee'}},rightPriceScale:{borderColor:'#ccc'},
  timeScale:{borderColor:'#ccc',timeVisible:true,secondsVisible:false,minBarSpacing:0.05},crosshair:{mode:0},...opts})}
const ser=(arr)=>bars.map((b,i)=>arr[i]==null||!isFinite(arr[i])?{time:b.time}:{time:b.time,value:arr[i]});
let uplot=null,lastMarks=[];
const GENESIS=Date.UTC(2009,0,3)/1000;
const daysSinceGenesis=t=>(t-GENESIS)/86400;
function clearCharts(){charts.forEach(c=>c.remove());charts=[];if(uplot){try{uplot.destroy()}catch(e){} uplot=null}if($('main'))$('main').querySelectorAll('.uplot').forEach(n=>n.remove());$('subs').innerHTML='';document.body.classList.remove('loglog-view')}

async function draw(pushUrl){
  const hash=buildHash();
  const url=location.href.replace(/#.*$/,'')+'#'+hash;$('permalink').value=url;
  if(pushUrl===1)history.pushState(hash,'','#'+hash);else if(pushUrl===2)history.replaceState(hash,'','#'+hash);
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
      {scale:'x',stroke:'#333',grid:{stroke:'#eee'},ticks:{stroke:'#ccc'},size:40,space:10,font:'11px Verdana,Arial,sans-serif',
        splits:(u,axisIdx,min,max)=>{
          const out=[];
          const dataMaxY=new Date((GENESIS+xs[xs.length-1]*86400)*1000).getUTCFullYear();
          const y0=new Date((GENESIS+Math.max(1,min)*86400)*1000).getUTCFullYear();
          const y1=Math.min(dataMaxY, new Date((GENESIS+max*86400)*1000).getUTCFullYear());
          const step=y1-y0>10?2:1;
          for(let y=y0;y<=y1;y+=step){
            const d=(Date.UTC(y,0,1)/1000-GENESIS)/86400;
            if(d>=min&&d<=max&&d>0) out.push(d);
          }
          return out;
        },
        values:(u,splits)=>splits.map(()=>'')},
      {scale:'y',stroke:'#333',grid:{stroke:'#eee'},ticks:{stroke:'#ccc'},size:64,font:'11px Verdana,Arial,sans-serif',
        values:(u,splits)=>splits.map(v=>v>0?(v>=1000?compact(v):String(+v.toPrecision(3))):'')},
    ],
    series:[
      {label:'Days'},
      {label:'USD',stroke:'#1a237e',width:2,points:{show:xs.length<=100},
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
        const list=marks||lastMarks||[];
        if(!list.length) return;
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
        // Year labels along the log-x axis (uPlot hides later log ticks as “too close”).
        const min=u.scales.x.min, max=u.scales.x.max;
        if(min!=null&&max!=null){
          ctx.font=(11*pr)+'px Verdana,Arial,sans-serif';
          ctx.fillStyle='#333';
          ctx.textAlign='center';
          ctx.textBaseline='top';
          const axisY=(u.bbox.top+u.bbox.height)+8*pr;
          const dataMaxY=new Date((GENESIS+xs[xs.length-1]*86400)*1000).getUTCFullYear();
          const y0=new Date((GENESIS+Math.max(1,min)*86400)*1000).getUTCFullYear();
          const y1=Math.min(dataMaxY, new Date((GENESIS+max*86400)*1000).getUTCFullYear());
          const step=y1-y0>10?2:1;
          for(let y=y0;y<=y1;y+=step){
            const d=(Date.UTC(y,0,1)/1000-GENESIS)/86400;
            if(d<min||d>max||!(d>0)) continue;
            ctx.fillText(String(y),u.valToPos(d,'x',true),axisY);
          }
        }
        ctx.restore();
      }],
    },
  };
  uplot=new uPlot(opts,[xs,ys],host);
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
  const isLog=$('l').checked&&!$('p').checked;
  const main=mkChart($('main'),{localization:{priceFormatter:isLog?compact:v=>v<0?'':v.toLocaleString('en-US',{maximumFractionDigits:2})}});charts.push(main);
  const ps=main.priceScale('right');
  ps.applyOptions({mode:$('p').checked?LW.PriceScaleMode.Percentage:$('l').checked?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal,
    scaleMargins:{top:.05,bottom:$('v').checked?.22:.05}});
  const O=bars.map(b=>b.open),H=bars.map(b=>b.high),L=bars.map(b=>b.low),C=bars.map(b=>b.close);
  const t=$('t').value;
  let mainSeries=null;
  if(t==='S'){mainSeries=main.addCandlestickSeries({upColor:'#26a69a',downColor:'#ef5350',borderVisible:false,wickUpColor:'#26a69a',wickDownColor:'#ef5350'});mainSeries.setData(bars)}
  else if(t==='O'){mainSeries=main.addBarSeries({upColor:'#26a69a',downColor:'#ef5350',thinBars:false});mainSeries.setData(bars)}
  else if(t){const f={C:i=>C[i],M:i=>(H[i]+L[i])/2,T:i=>(H[i]+L[i]+C[i])/3,W:i=>(H[i]+L[i]+2*C[i])/4}[t];
    mainSeries=main.addLineSeries({color:'#1a237e',lineWidth:2});mainSeries.setData(ser(bars.map((_,i)=>f(i))))}
  else {mainSeries=main.addLineSeries({visible:false});mainSeries.setData(ser(C))} // keep scale with "None"
  if(mainSeries&&marks&&marks.length) mainSeries.setMarkers(marks);
  const line=(arr,color,w=1,style=0)=>main.addLineSeries({color,lineWidth:w,lineStyle:style,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}).setData(ser(arr));
  // price band
  const b=$('b').value;
  if(b==='B'){const m=TA.SMA(C,20),s=TA.stdev(C,20);line(m,'#9e9e9e',1,2);line(m.map((v,i)=>v&&v+2*s[i]),'#9e9e9e');line(m.map((v,i)=>v&&v-2*s[i]),'#9e9e9e')}
  if(b==='D'){line(bars.map((_,i)=>i<19?null:TA.hhll(bars,20,i)[0]),'#9e9e9e');line(bars.map((_,i)=>i<19?null:TA.hhll(bars,20,i)[1]),'#9e9e9e')}
  if(b==='E'){const m=TA.SMA(C,20);line(m.map(v=>v&&v*1.1),'#9e9e9e');line(m.map(v=>v&&v*0.9),'#9e9e9e')}
  // moving averages
  [['a1','m1','#ff9800'],['a2','m2','#2962ff']].forEach(([a,m,col])=>{const n=parseInt($(m).value);if($(a).value&&n>0)line(TA.MA($(a).value,C,n),col,2)});
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
  // equal right-scale width + synced scroll/zoom across panels
  charts.forEach(c=>c.priceScale('right').applyOptions({minimumWidth:80}));
  charts.forEach(c=>c.timeScale().subscribeVisibleLogicalRangeChange(r=>{if(syncing||!r)return;syncing=true;charts.forEach(o=>o!==c&&o.timeScale().setVisibleLogicalRange(r));syncing=false}));
  main.timeScale().fitContent();setTimeout(()=>main.timeScale().fitContent(),50);
  main.subscribeCrosshairMove(p=>{const bar=p.time&&bars.find(x=>x.time===p.time);
    $('legend').textContent=bar?`${new Date(bar.time*1000).toISOString().slice(0,16).replace('T',' ')} O ${bar.open} H ${bar.high} L ${bar.low} C ${bar.close} V ${bar.volume.toFixed(2)}`:''});
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
  if($('cy').checked) fillCycleTable(); else fillPriceTable();
  tableOpen=true;
  $('tableWrap').hidden=false;
  $('downloadCsv').hidden=false;
  $('loadRaw').textContent='Hide data';
}
function toggleTable(e){if(e)e.preventDefault();if(tableOpen)clear_table();else showTable()}
function fillPriceTable(){
  setTableHead(PRICE_HEAD); tableCsv=[PRICE_HEAD.slice()];
  $('chart_table').tBodies[0].innerHTML=bars.slice().reverse().map(b=>{
    const w=(b.high+b.low+2*b.close)/4;
    const rec=[new Date(b.time*1000).toISOString().slice(0,19).replace('T',' '),
      String(b.open),String(b.high),String(b.low),String(b.close),
      b.volume.toFixed(2),(b.volume*b.close).toFixed(2),w.toFixed(2)];
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
  const preset=(typeof isCyclePreset==='function'&&isCyclePreset($('r').value))
    ?($('r').selectedOptions[0]?$('r').selectedOptions[0].text+' · ':'')
    :'';
  return `${name} · ${preset}${interval} · ${scale}`;
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
function flashCopyStatus(msg){
  const el=$('copyStatus'); if(!el)return;
  el.textContent=msg; el.hidden=false;
  clearTimeout(flashCopyStatus._t);
  flashCopyStatus._t=setTimeout(()=>{el.hidden=true},2500);
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
  if(opts.cycles) left=72*dpr;
  if(opts.volume) bottom=h*0.22+12*dpr;
  const tx=x+left, ty=y+h-bottom;
  ctx.lineWidth=Math.max(2,3*dpr);
  ctx.strokeStyle='rgba(255,255,255,0.8)';
  ctx.strokeText(WATERMARK_TEXT,tx,ty);
  ctx.fillStyle='rgba(40,40,40,0.4)';
  ctx.fillText(WATERMARK_TEXT,tx,ty);
  ctx.restore();
}
function waitPaint(){
  return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
async function composeChartImage(){
  await waitPaint();
  if(uplot){
    const cv=uplot.ctx.canvas;
    const cssW=uplot.width||cv.clientWidth||cv.width;
    const dpr=cv.width/Math.max(1,cssW);
    const width=cv.width, pad=Math.round(16*dpr), title=chartTitleLine();
    const titleSize=Math.round(15*dpr), titleH=Math.round(28*dpr);
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=pad+titleH+cv.height+pad;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#222'; ctx.font=titleSize+'px Verdana,Arial,sans-serif'; ctx.textBaseline='top';
    ctx.fillText(title,pad,pad);
    ctx.drawImage(cv,0,pad+titleH);
    paintWatermark(ctx,0,pad+titleH,width,cv.height,dpr,{cycles:true});
    return canvas;
  }
  if(!charts.length) throw new Error('No chart to export');
  const panes=charts.map((c,i)=>{
    const cv=c.takeScreenshot();
    const el=c.chartElement();
    const host=el&&el.parentElement;
    const lbl=i>0&&host?host.querySelector('.lbl'):null;
    const cssW=(el&&el.clientWidth)||cv.width;
    return {cv,label:lbl?lbl.textContent:'',cssW};
  });
  const dpr=panes[0].cv.width/Math.max(1,panes[0].cssW);
  const width=Math.max(...panes.map(p=>p.cv.width));
  const pad=Math.round(16*dpr);
  const title=chartTitleLine();
  const titleSize=Math.round(15*dpr);
  const titleH=Math.round(28*dpr);
  const legendItems=($('cy').checked&&typeof cycleSeries!=='undefined')?cycleSeries:[];
  const legendRow=legendItems.length?Math.round(20*dpr):0;
  const legendRows=legendItems.length?Math.ceil(legendItems.length/3):0;
  const legendH=legendRows*legendRow;
  let totalH=pad+titleH+legendH+pad;
  for(const p of panes) totalH+=p.cv.height;
  const canvas=document.createElement('canvas');
  canvas.width=width+0;
  canvas.height=totalH;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#222';
  ctx.font=`${titleSize}px Verdana,Arial,sans-serif`;
  ctx.textBaseline='top';
  ctx.fillText(title,pad,pad);
  let y=pad+titleH;
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
      ctx.fillStyle='#333';
      ctx.fillText(label,cx+box+Math.round(5*dpr),cy);
      cx+=tw;
    }
    y+=legendH;
  }
  let mainY=y, mainH=panes[0].cv.height;
  for(const [i,p] of panes.entries()){
    const x=Math.round((width-p.cv.width)/2);
    ctx.drawImage(p.cv,x,y);
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

// ---- events ----
document.querySelectorAll('#scaleToggle button').forEach(b=>b.onclick=()=>{
  const mode=b.dataset.scale||(b.dataset.l==='1'?'log':'linear');
  if(mode==='loglog'){$('ll').checked=true;$('l').checked=false;$('p').checked=false}
  else if(mode==='log'){$('ll').checked=false;$('l').checked=true;$('p').checked=false}
  else {$('ll').checked=false;$('l').checked=false;$('p').checked=false}
  draw(1)});
document.querySelectorAll('#viewToggle button').forEach(b=>b.onclick=()=>{const want=b.dataset.cy==='1';
  if($('cy').checked===want)return;$('cy').checked=want;if(want)$('p').checked=false;draw(1)});
$('chartoptions').addEventListener('change',e=>{if(e.target.id==='c'){if($('c').checked)setCustomDefaults();else{$('s').value=$('e').value=''}syncCustom()}
  if(e.target.id==='r'){$('c').checked=false;$('s').value=$('e').value='';syncCustom()}draw(1)});
$('ca').addEventListener('change',()=>draw(1));
['ch','cl','hv'].forEach(id=>$(id)&&$(id).addEventListener('change',()=>draw(1)));
$('cp').addEventListener('change',()=>draw(1));
$('SubmitButton').onclick=()=>draw(1);
const shift=d=>{if(!$('c').checked){$('c').checked=true;setCustomDefaults();syncCustom()}
  for(const id of['s','e'])$(id).value=fmtD(new Date(Date.parse($(id).value)+d*864e5));draw(1)};
$('Prev').onclick=()=>shift(-1);$('Next').onclick=()=>shift(1);
$('getPermalink').onclick=e=>{e.preventDefault();$('permalinkbox').hidden=!$('permalinkbox').hidden;$('permalink').select()};
$('copyImage').onclick=copyChartImage;
$('downloadPng').onclick=downloadChartPng;
$('loadRaw').onclick=toggleTable;
$('downloadCsv').onclick=downloadCsv;
$('larger').onclick=e=>{e.preventDefault();document.body.classList.toggle('wide')};
window.onpopstate=()=>{parseHash(location.hash.slice(1));syncCustom();syncViewToggle();draw(0)};
// init: original defaults = 60 days, candlestick, MA 10/25 lengths, volume on
parseHash(location.hash.slice(1));syncCustom();syncViewToggle();draw(2);
