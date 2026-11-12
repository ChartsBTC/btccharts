const $=id=>document.getElementById(id);
const LW=LightweightCharts;
const FIELDS=['m','r','i','c','s','e','t','b','a1','m1','a2','m2','x','i1','i2','i3','i4','v','cv','l','p'];
// populate indicator selects (only implemented ones, original naming)
document.querySelectorAll('select.ind').forEach(s=>{s.innerHTML='<option value="">None</option>'+Object.entries(INDICATORS).map(([k,v])=>`<option value="${k}">${v.label.replace(/ \(.*/,'')}</option>`).join('')});

// ---- URL hash: <id>g<value> joined by z (bitcoincharts format) ----
function buildHash(){const h=[];for(const id of FIELDS){const e=$(id);
  if(e.type==='checkbox'){if(e.checked)h.push(id)}else if(e.value)h.push(id+'g'+escape(e.value))}return h.join('z')}
function parseHash(hash){ if(!hash)return;
  // reset everything to blank/unchecked; hash fully describes state (original reset v,t,r)
  for(const id of FIELDS){const e=$(id);if(id==='m'){e.value='combinedUSD';continue}if(e.type==='checkbox')e.checked=false;else e.value=({m1:'10',m2:'25'})[id]||''}
  // Longest-id match so values may contain "g" (e.g. mgmtgoxUSD). The original split("g") would turn that into mtogxUSD.
  const ids=FIELDS.slice().sort((a,b)=>b.length-a.length);
  for(const part of hash.split('z')){const id=ids.find(x=>part===x||part.startsWith(x+'g'));if(!id)continue;const e=$(id);
    if(e.type==='checkbox')e.checked=true;else e.value=unescape(part.slice(id.length+1))}}
function syncCustom(){ $('CustomTimeBox').style.display=$('c').checked?'block':'none'; $('r').style.display=$('c').checked?'none':'';}
function fmtD(d){return d.toISOString().slice(0,10)}
function setCustomDefaults(){const d=parseInt($('r').value)||29;const now=new Date();
  if(!$('s').value)$('s').value=fmtD(new Date(now-(d-1)*864e5));if(!$('e').value)$('e').value=fmtD(new Date(+now+864e5));}

// ---- charts ----
let charts=[],bars=[],syncing=false;
function mkChart(el,opts={}){return LW.createChart(el,{autoSize:true,layout:{background:{color:'#fff'},textColor:'#333',fontSize:11},
  grid:{vertLines:{color:'#eee'},horzLines:{color:'#eee'}},rightPriceScale:{borderColor:'#ccc'},
  timeScale:{borderColor:'#ccc',timeVisible:true,secondsVisible:false,minBarSpacing:0.05},crosshair:{mode:0},...opts})}
const ser=(arr)=>bars.map((b,i)=>arr[i]==null||!isFinite(arr[i])?{time:b.time}:{time:b.time,value:arr[i]});
function clearCharts(){charts.forEach(c=>c.remove());charts=[];$('subs').innerHTML=''}

async function draw(pushUrl){
  const hash=buildHash();
  const url=location.href.replace(/#.*$/,'')+'#'+hash;$('permalink').value=url;
  if(pushUrl===1)history.pushState(hash,'','#'+hash);else if(pushUrl===2)history.replaceState(hash,'','#'+hash);
  // time window
  const now=Math.floor(Date.now()/1000);let start,end=now,days;
  if($('c').checked){start=Date.parse($('s').value)/1000;end=Math.min(now,Date.parse($('e').value)/1000||now);days=(end-start)/86400}
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
  render(interval);clear_table();
}
// compact price labels for log scale: 1k, 10k, 100k, 2.5k ...
function compact(v){const a=Math.abs(v);if(a>=1e6)return +(v/1e6).toPrecision(3)+'M';if(a>=1e3)return +(v/1e3).toPrecision(3)+'k';return +v.toPrecision(3)+''}
function syncScaleToggle(){document.querySelectorAll('#scaleToggle button').forEach(b=>b.classList.toggle('on',(b.dataset.l==='1')===$('l').checked))}
function render(interval){
  clearCharts();syncScaleToggle();
  const isLog=$('l').checked&&!$('p').checked;
  const main=mkChart($('main'),{localization:{priceFormatter:isLog?compact:v=>v<0?'':v.toLocaleString('en-US',{maximumFractionDigits:2})}});charts.push(main);
  const ps=main.priceScale('right');
  ps.applyOptions({mode:$('p').checked?LW.PriceScaleMode.Percentage:$('l').checked?LW.PriceScaleMode.Logarithmic:LW.PriceScaleMode.Normal,
    scaleMargins:{top:.05,bottom:$('v').checked?.22:.05}});
  const O=bars.map(b=>b.open),H=bars.map(b=>b.high),L=bars.map(b=>b.low),C=bars.map(b=>b.close);
  const t=$('t').value;
  if(t==='S'){main.addCandlestickSeries({upColor:'#26a69a',downColor:'#ef5350',borderVisible:false,wickUpColor:'#26a69a',wickDownColor:'#ef5350'}).setData(bars)}
  else if(t==='O'){main.addBarSeries({upColor:'#26a69a',downColor:'#ef5350',thinBars:false}).setData(bars)}
  else if(t){const f={C:i=>C[i],M:i=>(H[i]+L[i])/2,T:i=>(H[i]+L[i]+C[i])/3,W:i=>(H[i]+L[i]+2*C[i])/4}[t];
    main.addLineSeries({color:'#1a237e',lineWidth:2}).setData(ser(bars.map((_,i)=>f(i))))}
  else main.addLineSeries({visible:false}).setData(ser(C)); // keep scale with "None"
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
function clear_table(){$('chart_table').hidden=true;$('chart_table').tBodies[0].innerHTML=''}
$('loadRaw').onclick=e=>{e.preventDefault();const tb=$('chart_table').tBodies[0];
  tb.innerHTML=bars.slice().reverse().map(b=>{const w=(b.high+b.low+2*b.close)/4;
    return `<tr><td>${new Date(b.time*1000).toISOString().slice(0,19).replace('T',' ')}</td><td>${b.open}</td><td>${b.high}</td><td>${b.low}</td><td>${b.close}</td><td>${b.volume.toFixed(2)}</td><td>${(b.volume*b.close).toFixed(2)}</td><td>${w.toFixed(2)}</td></tr>`}).join('');
  $('chart_table').hidden=false};
// ---- events ----
document.querySelectorAll('#scaleToggle button').forEach(b=>b.onclick=()=>{const want=b.dataset.l==='1';
  if($('l').checked===want&&!$('p').checked)return;$('l').checked=want;$('p').checked=false;draw(1)});
$('chartoptions').addEventListener('change',e=>{if(e.target.id==='c'){if($('c').checked)setCustomDefaults();else{$('s').value=$('e').value=''}syncCustom()}
  if(e.target.id==='r')$('c').checked=false,syncCustom();draw(1)});
$('SubmitButton').onclick=()=>draw(1);
const shift=d=>{if(!$('c').checked){$('c').checked=true;setCustomDefaults();syncCustom()}
  for(const id of['s','e'])$(id).value=fmtD(new Date(Date.parse($(id).value)+d*864e5));draw(1)};
$('Prev').onclick=()=>shift(-1);$('Next').onclick=()=>shift(1);
$('getPermalink').onclick=e=>{e.preventDefault();$('permalinkbox').hidden=!$('permalinkbox').hidden;$('permalink').select()};
$('larger').onclick=e=>{e.preventDefault();document.body.classList.toggle('wide')};
window.onpopstate=()=>{parseHash(location.hash.slice(1));syncCustom();draw(0)};
// init: original defaults = 60 days, candlestick, MA 10/25 lengths, volume on
parseHash(location.hash.slice(1));syncCustom();draw(2);
