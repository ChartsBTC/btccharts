// Data layer: per-market daily caches + live pagination (Coinbase / Bitstamp).
const CB='https://api.exchange.coinbase.com/products/BTC-USD/candles';
const BS='https://www.bitstamp.net/api/v2/ohlc/btcusd/';
const MARKETS={
  combinedUSD:{label:'Combined history',live:'coinbase'},
  coinbaseUSD:{label:'Coinbase (USD)',live:'coinbase'},
  bitstampUSD:{label:'Bitstamp (USD)',live:'bitstamp'},
  mtgoxUSD:{label:'Mt. Gox (USD)',live:null},
};
// Combined splice (UTC): Mt. Gox through 2013-12-31, Bitstamp 2014-01-01–2016-12-31, Coinbase from 2017-01-01.
const SPLICE='Combined history: Mt. Gox through 2013-12-31, then Bitstamp from 2014-01-01 through 2016-12-31, then Coinbase from 2017-01-01.';
// interval name -> [seconds, native granularity used to build it]
const INTERVALS={'1-min':[60,60],'5-min':[300,300],'15-min':[900,900],'30-min':[1800,900],'Hourly':[3600,3600],
  '2-hour':[7200,3600],'6-hour':[21600,21600],'12-hour':[43200,21600],'Daily':[86400,86400],'Weekly':[604800,86400]};
const BS_STEP={'1-min':60,'5-min':300,'15-min':900,'30-min':1800,'Hourly':3600,'2-hour':7200,'6-hour':21600,'12-hour':43200,'Daily':86400};
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
  const base=await (await fetch('data/'+market+'.json',{cache:'no-cache'})).json();
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
function autoInterval(days){if(days<=1)return'5-min';if(days<=2)return'15-min';if(days<=5)return'Hourly';if(days<=10)return'2-hour';if(days<=30)return'6-hour';if(days<=1460)return'Daily';return'Weekly'}
async function loadBars(interval,start,end,onProgress){
  const market=currentMarket();
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
