// Data layer: per-market daily caches + live pagination (Coinbase / Bitstamp).
const CB='https://api.exchange.coinbase.com/products/BTC-USD/candles';
const BS='https://www.bitstamp.net/api/v2/ohlc/btcusd/';
const MARKETS={
  combinedUSD:{label:'Combined history',live:'coinbase',short:'BTC'},
  coinbaseUSD:{label:'Coinbase (USD)',live:'coinbase',short:'Coinbase'},
  bitstampUSD:{label:'Bitstamp (USD)',live:'bitstamp',short:'Bitstamp'},
  mtgoxUSD:{label:'Mt. Gox (USD)',live:null,short:'Mt. Gox'},
  goldUSD:{label:'Gold (USD)',live:null,kind:'macro',short:'Gold',unit:'USD'},
  goldLBMA:{label:'Gold (DataHub monthly)',live:null,kind:'macro',short:'Gold',unit:'USD'},
  spx:{label:'S&P 500',live:null,kind:'macro',short:'S&P 500'},
  spxShiller:{label:'S&P 500 (Shiller monthly)',live:null,kind:'macro',short:'S&P 500'},
  spxTR:{label:'S&P 500 total return',live:null,kind:'macro',short:'S&P 500 TR'},
  aapl:{label:'Apple (AAPL)',live:null,kind:'macro',short:'AAPL',unit:'USD'},
  msft:{label:'Microsoft (MSFT)',live:null,kind:'macro',short:'MSFT',unit:'USD'},
  googl:{label:'Alphabet (GOOGL)',live:null,kind:'macro',short:'GOOGL',unit:'USD'},
  amzn:{label:'Amazon (AMZN)',live:null,kind:'macro',short:'AMZN',unit:'USD'},
  nvda:{label:'NVIDIA (NVDA)',live:null,kind:'macro',short:'NVDA',unit:'USD'},
  meta:{label:'Meta (META)',live:null,kind:'macro',short:'META',unit:'USD'},
  tsla:{label:'Tesla (TSLA)',live:null,kind:'macro',short:'TSLA',unit:'USD'},
  cpiAUCSL:{label:'CPI-U (SA)',live:null,kind:'macro',short:'CPI'},
};
const MACRO_IDS=['goldUSD','goldLBMA','spx','spxShiller','spxTR','aapl','msft','googl','amzn','nvda','meta','tsla','cpiAUCSL'];
const BTC_IDS=['combinedUSD','coinbaseUSD','bitstampUSD','mtgoxUSD'];
function isMacroMarket(m){return !!(MARKETS[m]&&MARKETS[m].kind==='macro')}
function isBtcMarket(m){return !!(MARKETS[m]&&MARKETS[m].kind!=='macro')}
function shortMarketLabel(m){return (MARKETS[m]&&MARKETS[m].short)||marketLabel(m)}
function currentCompare(){const cm=document.getElementById('cm')?.value;if(!cm||!MARKETS[cm]||cm===currentMarket())return '';return cm}
function dailyUrl(market){
  const root=(window.CHART_PAGE==='advanced')?'../data/':'data/';
  return root+(isMacroMarket(market)?'macro/':'')+market+'.json';
}
function isMonthlySeries(srcRows){
  if(!srcRows||srcRows.length<4) return false;
  const ts=srcRows.map(r=>Array.isArray(r)?r[0]:r.time).filter(t=>t!=null);
  const n=Math.min(12,ts.length-1); if(n<3) return false;
  const gaps=[];
  for(let i=ts.length-n;i<ts.length;i++) gaps.push((ts[i]-ts[i-1])/86400);
  gaps.sort((a,b)=>a-b);
  return gaps[Math.floor(gaps.length/2)]>=20;
}
function locfAlignCloses(srcRows, times, opts){
  opts=opts||{};
  const src=srcRows.map(r=>Array.isArray(r)?{time:r[0],close:r[4]}:r).filter(r=>r&&r.time!=null);
  const firstT=src.length?src[0].time:null;
  let lastT=src.length?src[src.length-1].time:null;
  // Monthly prints (CPI) stay valid until the next release; extend LOCF to series 1's end.
  if(opts.extend||isMonthlySeries(srcRows)) lastT=times.length?times[times.length-1]:lastT;
  const out=new Array(times.length).fill(null);
  let j=0, last=null;
  for(let i=0;i<times.length;i++){
    const t=times[i];
    if(firstT==null||t<firstT||(lastT!=null&&t>lastT)) continue;
    while(j<src.length&&src[j].time<=t){
      if(src[j].close>0) last={time:src[j].time,close:src[j].close};
      j++;
    }
    if(last) out[i]=last.close;
  }
  return out;
}
function ensureOpt(select, group, id, label){
  if(!select||select.querySelector('option[value="'+id+'"]')) return;
  let g=null;
  if(group){
    g=[...select.querySelectorAll('optgroup')].find(x=>x.label===group);
    if(!g){g=document.createElement('optgroup'); g.label=group; select.appendChild(g)}
  }
  const o=document.createElement('option'); o.value=id; o.textContent=label;
  (g||select).appendChild(o);
}
function populateMarketSelects(){
  const m=document.getElementById('m');
  if(m) for(const id of MACRO_IDS) ensureOpt(m,'Macro',id,MARKETS[id].label);
  const cm=document.getElementById('cm');
  if(cm){
    for(const id of BTC_IDS) ensureOpt(cm,'Bitcoin',id,MARKETS[id].label);
    for(const id of MACRO_IDS) ensureOpt(cm,'Macro',id,MARKETS[id].label);
  }
}
// Combined splice (UTC): Mt. Gox through 2013-12-31, Bitstamp 2014-01-01–2016-12-31, Coinbase from 2017-01-01.
const SPLICE='Combined history: Mt. Gox through 2013-12-31, then Bitstamp from 2014-01-01 through 2016-12-31, then Coinbase from 2017-01-01.';
// interval name -> [seconds, native granularity used to build it]
const INTERVALS={'1-min':[60,60],'5-min':[300,300],'15-min':[900,900],'30-min':[1800,900],'Hourly':[3600,3600],
  '2-hour':[7200,3600],'3-hour':[10800,3600],'6-hour':[21600,21600],'12-hour':[43200,21600],'Daily':[86400,86400],'Weekly':[604800,86400]};
const BS_STEP={'1-min':60,'5-min':300,'15-min':900,'30-min':1800,'Hourly':3600,'2-hour':7200,'3-hour':3600,'6-hour':21600,'12-hour':43200,'Daily':86400};
const MAX_REQ=60;
const mem={};const dailyCache={};
const toBar=r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4],volume:r[5]});
function currentMarket(){const m=document.getElementById('m')?.value;return MARKETS[m]?m:'combinedUSD'}
function marketLabel(m){return (MARKETS[m]||MARKETS.combinedUSD).label}

async function cbPage(g,start,end){
  const u=`${CB}?granularity=${g}&start=${new Date(start*1000).toISOString()}&end=${new Date(end*1000).toISOString()}`;
  for(let k=0;k<5;k++){const r=await fetch(u);if(r.ok){return (await r.json()).map(([t,lo,hi,o,c,v])=>[t,o,hi,lo,c,v])}
    await new Promise(s=>setTimeout(s,400*(k+1)))}
  throw new Error('Coinbase request failed');
}
async function bsPage(step,start,end){
  // Bitstamp: start/limit (max 1000). step is seconds.
  const limit=Math.min(1000, Math.ceil((end-start)/step)+2);
  const u=`${BS}?step=${step}&limit=${limit}&start=${start}`;
  for(let k=0;k<5;k++){const r=await fetch(u);if(r.ok){const o=(await r.json()).data.ohlc||[];
    return o.map(x=>[+[x.timestamp],+x.open,+x.high,+x.low,+x.close,+x.volume]).filter(r=>r[0]<end)}
    await new Promise(s=>setTimeout(s,400*(k+1)))}
  throw new Error('Bitstamp request failed');
}
async function fetchRange(src,g,start,end,onProgress){
  const key=src+':'+g+':'+start+':'+end;if(mem[key])return mem[key];
  const step=300*g,pages=Math.ceil((end-start)/step);
  if(pages>MAX_REQ)start=end-MAX_REQ*step;
  const rows={};let n=0,page=src==='bitstamp'?bsPage:cbPage;
  for(let s=start;s<end;s+=step){const e=Math.min(s+step,end);
    (await page(g,s,e)).forEach(r=>rows[r[0]]=r);onProgress&&onProgress(++n,Math.min(pages,MAX_REQ));
    await new Promise(r=>setTimeout(r,120));}
  return mem[key]=Object.keys(rows).sort((a,b)=>a-b).map(k=>rows[k]);
}
function clampRow(r){const lo=Math.min(r[1],r[4]),hi=Math.max(r[1],r[4]);
  return [r[0],r[1],r[2]>hi*3&&r[2]>0?hi:r[2],r[3]<lo/3?lo:r[3],r[4],r[5]]}
async function getDaily(market){
  market=market||currentMarket();
  if(dailyCache[market])return dailyCache[market];
  const base=await (await fetch(dailyUrl(market),{cache:'no-cache'})).json();
  const live=(MARKETS[market]||{}).live;
  const last=base.length?base[base.length-1][0]:0;
  const now=Math.floor(Date.now()/1000);let fresh=[];
  if(live&&now-last>20*3600){
    try{fresh=await fetchRange(live,86400,last,now)}catch(e){console.warn(e)}
  }
  const m=new Map(base.map(r=>[r[0],r]));fresh.forEach(r=>m.set(r[0],clampRow(r)));
  return dailyCache[market]=[...m.values()].sort((a,b)=>a[0]-b[0]);
}
function aggregate(rows,sec,offset=0){
  const out=[];let cur=null;
  for(const r of rows){const b=Math.floor((r[0]-offset)/sec)*sec+offset;
    if(!cur||cur[0]!==b){cur&&out.push(cur);cur=[b,r[1],r[2],r[3],r[4],r[5]]}
    else{cur[2]=Math.max(cur[2],r[2]);cur[3]=Math.min(cur[3],r[3]);cur[4]=r[4];cur[5]+=r[5]}}
  cur&&out.push(cur);return out;
}

function startOfMonthUTC(t){const d=new Date(t*1000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000}
function startOfQuarterUTC(t){const d=new Date(t*1000);return Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3,1)/1000}
function startOfYearUTC(t){const d=new Date(t*1000);return Date.UTC(d.getUTCFullYear(),0,1)/1000}
const CAL_BUCKET={Monthly:startOfMonthUTC,Quarterly:startOfQuarterUTC,Yearly:startOfYearUTC};
function aggregateCalendar(rows,bucket){
  const out=[];let cur=null;
  for(const r of rows){
    const b=bucket(r[0]);
    if(!cur||cur[0]!==b){cur&&out.push(cur);cur=[b,r[1],r[2],r[3],r[4],r[5]]}
    else{cur[2]=Math.max(cur[2],r[2]);cur[3]=Math.min(cur[3],r[3]);cur[4]=r[4];cur[5]+=r[5]}
  }
  cur&&out.push(cur);return out;
}
function barsFromCycles(daily,start,end){
  const cycles=detectCycles(daily);
  const now=Math.floor(Date.now()/1000);
  const out=[];
  for(const c of cycles){
    const t0=c.startLow.time, t1=c.open?now:(c.endLow?c.endLow.time:now);
    if(t1<start||t0>=end) continue;
    const slice=daily.filter(b=>b.time>=t0&&b.time<=t1);
    if(!slice.length) continue;
    out.push({
      time:t0, open:slice[0].open,
      high:Math.max(...slice.map(b=>b.high)),
      low:Math.min(...slice.map(b=>b.low)),
      close:slice.at(-1).close,
      volume:slice.reduce((s,b)=>s+b.volume,0),
    });
  }
  return out;
}
function autoInterval(days){if(days<=1)return'5-min';if(days<=2)return'15-min';if(days<=5)return'Hourly';if(days<=10)return'2-hour';if(days<=30)return'6-hour';if(days<=1460)return'Daily';if(days<=2920)return'Weekly';return'Monthly'}
async function loadBars(interval,start,end,onProgress){
  const market=currentMarket();
  if(interval==='Cycle'||CAL_BUCKET[interval]){
    const daily=(await getDaily(market)).map(toBar);
    const bars=interval==='Cycle'
      ? barsFromCycles(daily,start,end)
      : aggregateCalendar(daily.filter(b=>b.time>=start&&b.time<end).map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume]),CAL_BUCKET[interval]).map(toBar);
    bars._note='';
    return bars;
  }
  const [sec,g]=INTERVALS[interval];
  let rows, note='';
  if(g===86400){rows=(await getDaily(market)).filter(r=>r[0]>=start-sec&&r[0]<end)}
  else{
    const live=(MARKETS[market]||{}).live;
    // Finer than daily: live APIs only exist for Coinbase and Bitstamp (and Combined's recent Coinbase leg).
    // Mt. Gox (and Combined windows that start before Coinbase) fall back to the daily cache.
    if(market==='bitstampUSD'){const step=BS_STEP[interval]||g;rows=await fetchRange('bitstamp',step,start,end,onProgress);
      if(step!==sec)rows=aggregate(rows,sec,sec===604800?345600:0);return rows.filter(r=>r[0]+sec>start).map(toBar)}
    if(live==='coinbase'&&start>=1437350400){rows=await fetchRange('coinbase',g,start,end,onProgress)}
    else {rows=(await getDaily(market)).filter(r=>r[0]>=start-sec&&r[0]<end);note=' (daily cache; no sub-day history for this market/range)'}
  }
  if(sec!==g)rows=aggregate(rows,sec,sec===604800?345600:0);
  const bars=rows.filter(r=>r[0]+sec>start).map(toBar);
  bars._note=note;return bars;
}
populateMarketSelects();
window.isMacroMarket=isMacroMarket;
window.isBtcMarket=isBtcMarket;
window.shortMarketLabel=shortMarketLabel;
window.currentCompare=currentCompare;
window.locfAlignCloses=locfAlignCloses;
window.MACRO_IDS=MACRO_IDS;
