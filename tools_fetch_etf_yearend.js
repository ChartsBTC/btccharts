// Fetch Yahoo v8 daily charts for the asset-class return ETFs via Chrome,
// then write data/macro/etf_yearend.json through fetch_etf_yearend.py.
// Usage: node tools_fetch_etf_yearend.js
const {chromium}=require('playwright-core');
const {spawnSync}=require('child_process');
const fs=require('fs');
const path=require('path');
const outDir='/tmp/etf-raw';
const symbols=['DBC','IWD','VNQ','IWM','MDY','BIL','SPY','EFA','TIP','BND','HYG','QQQ','CWB','LQD','EMB','TLT','VWO','PFF','IWF','GLD'];
fs.mkdirSync(outDir,{recursive:true});

(async()=>{
  const exe=process.env.CHROME_PATH||'/usr/bin/google-chrome';
  const b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});
  const ctx=await b.newContext({userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'});
  const p=await ctx.newPage();
  try{
    await p.goto('https://finance.yahoo.com/quote/SPY/history',{waitUntil:'domcontentloaded',timeout:45000});
    await p.waitForTimeout(1500);
  }catch(e){console.log('warmup', e.message)}
  const now=Math.floor(Date.now()/1000);
  const start=1259625600; // 2009-12-01
  for(const sym of symbols){
    const dest=path.join(outDir, sym+'.txt');
    if(fs.existsSync(dest) && fs.statSync(dest).size>2000){
      const txt=fs.readFileSync(dest,'utf8');
      if(txt.trim().startsWith('{') && txt.includes('adjclose')){
        console.log(sym, 'reuse', dest, 'bytes', txt.length);
        continue;
      }
    }
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${start}&period2=${now}&interval=1d&includeAdjustedClose=true&events=div%2Csplits`;
    const res=await p.goto(url,{waitUntil:'networkidle',timeout:60000});
    const text=await p.evaluate(()=>document.body.innerText);
    fs.writeFileSync(dest, text);
    console.log(sym, res&&res.status(), 'bytes', text.length, dest);
    if(!text.trim().startsWith('{')) throw new Error(sym+' did not return JSON');
    await p.waitForTimeout(2000);
  }
  await b.close();
  const py=spawnSync('python3',[path.join(__dirname,'fetch_etf_yearend.py'),'--from-dir',outDir],{stdio:'inherit'});
  process.exit(py.status||0);
})().catch(e=>{console.error(e);process.exit(1)});
