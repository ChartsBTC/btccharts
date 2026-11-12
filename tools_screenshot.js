const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:1100}});
p.on('console',m=>m.type()==='error'&&console.log('CONSOLE',m.text()));p.on('pageerror',e=>console.log('PAGEERR',e.message));
const base='http://127.0.0.1:8765/';
const shots=[['01-default-60d-candlestick',''],['02-all-history-daily-log','#igDailyztgSza1gSMAzm1g50za2gSMAzm2g200zvzl'],
 ['03-30d-hourly-rsi-macd','#rg30zigHourlyztgSza1gEMAzm1g10za2gEMAzm2g25zi1gRSIzi2gMACDzv']];
for(const [n,h] of shots){await p.goto(base+'index.html'+h);await p.waitForFunction(()=>/bars ·|Error|No data/.test(document.getElementById('status').textContent),null,{timeout:90000});
 await p.waitForTimeout(800);console.log(n,await p.textContent('#status'),await p.inputValue('#permalink'));await p.screenshot({path:`/workspace/btccharts-clone/screenshots/${n}.png`,fullPage:true});}
await p.click('#loadRaw');console.log('rows',await p.locator('#chart_table tbody tr').count());
await b.close()})();
