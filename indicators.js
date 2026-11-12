// Indicator math. bars: [{time,open,high,low,close,volume}]; series = arrays aligned to bars (null = undefined)
const TA = {
  SMA(x,n){const o=[];let s=0;for(let i=0;i<x.length;i++){s+=x[i];if(i>=n)s-=x[i-n];o.push(i>=n-1?s/n:null)}return o},
  EMA(x,n){const o=[],k=2/(n+1);let e=null;for(let i=0;i<x.length;i++){if(x[i]==null){o.push(null);continue}e=e==null?x[i]:x[i]*k+e*(1-k);o.push(e)}
    for(let i=0;i<Math.min(n-1,o.length);i++)o[i]=null;return o},
  WMA(x,n){const o=[],d=n*(n+1)/2;for(let i=0;i<x.length;i++){if(i<n-1){o.push(null);continue}let s=0;for(let j=0;j<n;j++)s+=x[i-j]*(n-j);o.push(s/d)}return o},
  TMA(x,n){const a=Math.ceil((n+1)/2);const f=TA.SMA(x,a);const o=[];const m=TA.SMA(f.map(v=>v??0),a);return m.map((v,i)=>i<n-1?null:v)},
  MA(t,x,n){return TA[t](x,n)},
  stdev(x,n){const m=TA.SMA(x,n);return x.map((_,i)=>{if(m[i]==null)return null;let s=0;for(let j=0;j<n;j++)s+=(x[i-j]-m[i])**2;return Math.sqrt(s/n)})},
  RSI(c,n=14){const o=[null];let g=0,l=0;for(let i=1;i<c.length;i++){const d=c[i]-c[i-1],up=Math.max(d,0),dn=Math.max(-d,0);
    if(i<=n){g+=up/n;l+=dn/n;o.push(i==n?100-100/(1+g/(l||1e-12)):null)}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n;o.push(100-100/(1+g/(l||1e-12)))}}return o},
  MACD(c){const a=TA.EMA(c,12),b=TA.EMA(c,26);const m=c.map((_,i)=>a[i]!=null&&b[i]!=null?a[i]-b[i]:null);
    const fi=m.findIndex(v=>v!=null);const s=Array(fi).fill(null).concat(TA.EMA(m.slice(fi),9));return{macd:m,signal:s,hist:m.map((v,i)=>v!=null&&s[i]!=null?v-s[i]:null)}},
  Momentum(c,n=10){return c.map((v,i)=>i>=n?v-c[i-n]:null)},
  ROC(c,n=10){return c.map((v,i)=>i>=n?100*(v/c[i-n]-1):null)},
  hhll(B,n,i){let h=-Infinity,l=Infinity;for(let j=Math.max(0,i-n+1);j<=i;j++){h=Math.max(h,B[j].high);l=Math.min(l,B[j].low)}return[h,l]},
  WilliamR(B,n=14){return B.map((b,i)=>{if(i<n-1)return null;const[h,l]=TA.hhll(B,n,i);return -100*(h-b.close)/((h-l)||1)})},
  FStoch(B,n=14){const k=B.map((b,i)=>{if(i<n-1)return null;const[h,l]=TA.hhll(B,n,i);return 100*(b.close-l)/((h-l)||1)});return{k,d:TA.SMA(k.map(v=>v??0),3).map((v,i)=>k[i-2]==null?null:v)}},
  SStoch(B){const f=TA.FStoch(B);const k=f.d;return{k,d:TA.SMA(k.map(v=>v??0),3).map((v,i)=>k[i-2]==null?null:v)}},
  OBV(B){let s=0;return B.map((b,i)=>{if(i>0)s+=b.close>B[i-1].close?b.volume:b.close<B[i-1].close?-b.volume:0;return s})},
  ATR(B,n=14){const tr=B.map((b,i)=>i?Math.max(b.high-b.low,Math.abs(b.high-B[i-1].close),Math.abs(b.low-B[i-1].close)):b.high-b.low);return TA.EMA(tr,2*n-1)},
  CCI(B,n=20){const tp=B.map(b=>(b.high+b.low+b.close)/3),m=TA.SMA(tp,n);return tp.map((v,i)=>{if(m[i]==null)return null;let d=0;for(let j=0;j<n;j++)d+=Math.abs(tp[i-j]-m[i]);return (v-m[i])/(0.015*d/n||1)})},
};
// Sub-panel indicator registry: returns [{name,type:'line'|'hist',data,color}], optional fixed levels
const INDICATORS = {
  RSI:{label:'RSI (14)',levels:[30,70],f:B=>[{name:'RSI',data:TA.RSI(B.map(b=>b.close)),color:'#7b1fa2'}]},
  MACD:{label:'MACD (12,26,9)',f:B=>{const r=TA.MACD(B.map(b=>b.close));return[{name:'hist',type:'hist',data:r.hist},{name:'MACD',data:r.macd,color:'#1565c0'},{name:'Signal',data:r.signal,color:'#e65100'}]}},
  Vol:{label:'Volume',f:(B,o)=>[{name:'Vol',type:'hist',data:B.map(b=>o.cv?b.volume*b.close:b.volume),color:'#78909c'}]},
  Momentum:{label:'Momentum (10)',levels:[0],f:B=>[{name:'Mom',data:TA.Momentum(B.map(b=>b.close)),color:'#00838f'}]},
  ROC:{label:'Rate of Change (10)',levels:[0],f:B=>[{name:'ROC',data:TA.ROC(B.map(b=>b.close)),color:'#00838f'}]},
  WilliamR:{label:"William's %R (14)",levels:[-20,-80],f:B=>[{name:'%R',data:TA.WilliamR(B),color:'#6a1b9a'}]},
  FStoch:{label:'Fast Stochastic (14,3)',levels:[20,80],f:B=>{const r=TA.FStoch(B);return[{name:'%K',data:r.k,color:'#1565c0'},{name:'%D',data:r.d,color:'#e65100'}]}},
  SStoch:{label:'Slow Stochastic (14,3)',levels:[20,80],f:B=>{const r=TA.SStoch(B);return[{name:'%K',data:r.k,color:'#1565c0'},{name:'%D',data:r.d,color:'#e65100'}]}},
  OBV:{label:'On Balance Volume',f:B=>[{name:'OBV',data:TA.OBV(B),color:'#2e7d32'}]},
  ATR:{label:'Avg True Range (14)',f:B=>[{name:'ATR',data:TA.ATR(B),color:'#5d4037'}]},
  CCI:{label:'Commodity Channel Index (20)',levels:[-100,100],f:B=>[{name:'CCI',data:TA.CCI(B),color:'#ad1457'}]},
};
