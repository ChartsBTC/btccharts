// Bitcoin 4-year cycle overlay. Price mode is raw USD for now; cycleY() is the hook for a later normalized mode.
const CYCLE_PRICE_MODE='usd'; // next feature: 'index' (100 at day 0)
const CYCLE_COLORS=['#8d6e63','#ef6c00','#1565c0','#6a1b9a','#00897b'];
const HALVINGS=[
  {time:Date.UTC(2012,10,28)/1000,label:'2012-11-28'},
  {time:Date.UTC(2016,6,9)/1000,label:'2016-07-09'},
  {time:Date.UTC(2020,4,11)/1000,label:'2020-05-11'},
  {time:Date.UTC(2024,3,20)/1000,label:'2024-04-20'},
];
const CALENDAR_ANCHORS=[2011,2015,2019,2023].map(y=>({time:Date.UTC(y,0,1)/1000,label:y+'-01-01'}));
// Fake epoch so the time axis can be labeled as "days since anchor"
const DAY0=Date.UTC(2000,0,1)/1000;
const dayToTime=d=>DAY0+d*86400;
const timeToDay=t=>Math.round((t-DAY0)/86400);
const isoUTC=t=>new Date(t*1000).toISOString().slice(0,10);
const usd=n=>n>=1000?n.toLocaleString('en-US',{maximumFractionDigits:0}):(+n.toPrecision(3)).toString();

function effectiveLow(b){
  const body=Math.min(b.open,b.close);
  // Ignore isolated dump wicks (e.g. 2010-08-30 low of $0.032 vs a ~$0.063 body).
  return (b.low>0 && b.low<body*0.6)?body:b.low;
}
// Hook for a future scaled/normalized mode (e.g. 100 at the anchor).
function cycleY(bar, ctx, mode=CYCLE_PRICE_MODE){
  if(bar==null||!isFinite(bar.close))return null;
  if(mode==='index'){const a=ctx&&ctx.anchorValue;return a?100*bar.close/a:null}
  return bar.close;
}

function detectCycles(bars){
  const n=bars.length, MIN_SEP=800*86400, WIN=180*86400;
  const cands=[];
  for(let i=0;i<n;i++){
    let lo=i,hi=i;
    while(lo>0 && bars[i].time-bars[lo-1].time<=WIN)lo--;
    while(hi<n-1 && bars[hi+1].time-bars[i].time<=WIN)hi++;
    let best=lo;
    for(let j=lo;j<=hi;j++) if(bars[j].high>bars[best].high||(bars[j].high===bars[best].high&&j<best)) best=j;
    if(best===i)cands.push(i);
  }
  const highs=[];
  [...cands].sort((a,b)=>bars[b].high-bars[a].high).forEach(i=>{
    if(highs.every(j=>Math.abs(bars[i].time-bars[j].time)>=MIN_SEP)) highs.push(i);
  });
  highs.sort((a,b)=>a-b);

  const lowIn=(a,b)=>{let k=a;for(let i=a;i<=b;i++) if(effectiveLow(bars[i])<effectiveLow(bars[k])) k=i;return k};

  const cycles=[];
  for(let p=0;p<highs.length;p++){
    const start=p===0?lowIn(0,highs[0]):lowIn(highs[p-1],highs[p]);
    let endLow=null, endIdx=n-1, open=false;
    if(p+1<highs.length){endIdx=lowIn(highs[p],highs[p+1]);endLow=bars[endIdx]}
    else{
      const k=lowIn(highs[p],n-1);
      const retrace=1-effectiveLow(bars[k])/bars[highs[p]].high;
      if(retrace>=0.70){endIdx=k;endLow=bars[k]}
      else {open=true;endIdx=n-1}
    }
    const hi=bars[highs[p]], loStart=bars[start], loEnd=endLow;
    cycles.push({
      iHigh:highs[p], iStart:start, iEnd:endIdx, open,
      year:new Date(hi.time*1000).getUTCFullYear(),
      high:{time:hi.time, price:hi.high, close:hi.close, date:isoUTC(hi.time)},
      startLow:{time:loStart.time, price:effectiveLow(loStart), close:loStart.close, date:isoUTC(loStart.time)},
      endLow:loEnd?{time:loEnd.time, price:effectiveLow(loEnd), close:loEnd.close, date:isoUTC(loEnd.time)}:null,
      color:CYCLE_COLORS[p%CYCLE_COLORS.length],
    });
  }
  return cycles;
}

function barsFromDay(all, anchorTime, d0, d1){
  const t0=anchorTime+d0*86400, t1=anchorTime+d1*86400;
  const out=[];
  for(const b of all){
    if(b.time<t0||b.time>t1)continue;
    out.push({day:Math.round((b.time-anchorTime)/86400), bar:b});
  }
  return out;
}

// Build one line per cycle (or per calendar/halving window) aligned to day 0.
function buildCycleSeries(all, cycles, align, mode=CYCLE_PRICE_MODE){
  const lines=[];
  if(align==='low'||align==='high'){
    for(const c of cycles){
      const anchor=align==='low'?c.startLow.time:c.high.time;
      const ctx={anchorValue:align==='low'?c.startLow.close:c.high.close, cycle:c};
      let d0,d1;
      if(align==='low'){d0=0;d1=Math.round(((c.endLow?c.endLow.time:all.at(-1).time)-anchor)/86400)}
      else{
        d0=Math.round((c.startLow.time-anchor)/86400);
        d1=Math.round(((c.endLow?c.endLow.time:all.at(-1).time)-anchor)/86400);
      }
      const pts=barsFromDay(all,anchor,d0,d1).map(({day,bar})=>({time:dayToTime(day),value:cycleY(bar,ctx,mode),day,bar}));
      const label=align==='low'?`${c.year}  ·  low ${c.startLow.date}`:`${c.year}  ·  high ${c.high.date}`;
      lines.push({cycle:c,label,color:c.color,anchor,pts,align,open:c.open});
    }
  }else{
    const anchors=align==='halving'?HALVINGS:CALENDAR_ANCHORS;
    const d0=align==='halving'?-400:0;
    const d1=align==='halving'?1200:1461;
    anchors.forEach((a,i)=>{
      const hit=all.find(b=>b.time>=a.time)||all.find(b=>Math.abs(b.time-a.time)<2*86400);
      const ctx={anchorValue:hit?hit.close:null, cycle:null};
      const pts=barsFromDay(all,a.time,d0,d1).map(({day,bar})=>({time:dayToTime(day),value:cycleY(bar,ctx,mode),day,bar}));
      const endYear=new Date((a.time+Math.min(d1,1461)*86400)*1000).getUTCFullYear();
      const label=align==='halving'?`Halving ${a.label}`:`${a.label.slice(0,4)}–${String(endYear).slice(2)}`;
      lines.push({cycle:null,label,color:CYCLE_COLORS[i%CYCLE_COLORS.length],anchor:a.time,pts,align,open:false,anchorLabel:a.label});
    });
  }
  return lines.filter(l=>l.pts.length>2);
}

function cycleMarkers(line, align){
  const marks=[];
  const add=(day,text,color,pos)=>{
    const p=line.pts.find(x=>x.day===day);
    if(p) marks.push({time:p.time,position:pos||'aboveBar',color,shape:'circle',text});
  };
  if(!line.cycle){
    add(0,'0','#555','inBar');
    return marks;
  }
  const c=line.cycle;
  const anchor=line.anchor;
  const d=t=>Math.round((t-anchor)/86400);
  if(align==='low'){
    add(0,'L '+c.startLow.date,'#c62828','belowBar');
    add(d(c.high.time),'H '+c.high.date,'#2e7d32','aboveBar');
    if(c.endLow) add(d(c.endLow.time),'L '+c.endLow.date,'#c62828','belowBar');
  }else if(align==='high'){
    add(0,'H '+c.high.date,'#2e7d32','aboveBar');
    add(d(c.startLow.time),'L '+c.startLow.date,'#c62828','belowBar');
    if(c.endLow) add(d(c.endLow.time),'L '+c.endLow.date,'#c62828','belowBar');
  }
  return marks;
}

function cycleTableHtml(cycles){
  const rows=cycles.map(c=>{
    const days=Math.round((c.high.time-c.startLow.time)/86400);
    const dd=c.endLow?((1-c.endLow.price/c.high.price)*100).toFixed(0)+'%':'—';
    return `<tr>
      <td><span class="swatch" style="background:${c.color}"></span> ${c.year}${c.open?' <em>(current)</em>':''}</td>
      <td>${c.startLow.date}</td><td>$${usd(c.startLow.price)}</td>
      <td>${c.high.date}${c.open?' <em>so far</em>':''}</td><td>$${usd(c.high.price)}</td>
      <td>${c.endLow?c.endLow.date:'—'}</td><td>${c.endLow?'$'+usd(c.endLow.price):'—'}</td>
      <td>${days}</td><td>${c.open?'in progress':dd}</td>
    </tr>`;
  }).join('');
  return `<table class="data cycles">
    <thead><tr><th>Cycle</th><th>Start low</th><th>Price</th><th>High</th><th>Price</th><th>End low</th><th>Price</th><th>Days to high</th><th>Drawdown</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="small">Highs and lows are detected automatically from Combined daily history (major peaks at least ~800 days apart; isolated wick lows ignored). The 2011-11 low falls in a Mt. Gox data gap and uses the Coinmetrics reference rate. Current-cycle high is the peak so far. “Days to high” is counted from that cycle’s starting low.</p>`;
}

function cycleLegendHtml(lines){
  return lines.map(l=>`<span class="leg-item"><span class="swatch" style="background:${l.color}"></span>${l.label}${l.open?' (in progress)':''}</span>`).join('');
}

function cycleAxisLabel(t){
  const d=timeToDay(t);
  return d===0?'0':String(d);
}
