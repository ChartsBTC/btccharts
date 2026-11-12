#!/usr/bin/env python3
"""Fetch/refresh full BTC-USD daily history from Coinbase into data/daily.json (paginated, 300/req)."""
import json,time,urllib.request,datetime as dt,os
P='data/daily.json'; G=86400
rows={}
if os.path.exists(P):
    for r in json.load(open(P)): rows[r[0]]=r
start=max(rows) if rows else int(dt.datetime(2015,7,20,tzinfo=dt.timezone.utc).timestamp())
now=int(time.time())
while start<now:
    end=min(start+299*G,now)
    u=f"https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity={G}&start={dt.datetime.utcfromtimestamp(start).isoformat()}Z&end={dt.datetime.utcfromtimestamp(end).isoformat()}Z"
    for k in range(5):
        try:
            d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'btccharts-clone'}),timeout=30));break
        except Exception as e: time.sleep(2)
    for t,lo,hi,o,c,v in d: rows[t]=[t,o,hi,lo,c,v]   # store as t,o,h,l,c,v
    start=end; time.sleep(0.35)
out=[rows[k] for k in sorted(rows)]
json.dump(out,open(P,'w'),separators=(',',':'))
print(len(out),'days', dt.datetime.utcfromtimestamp(out[0][0]).date(),'->',dt.datetime.utcfromtimestamp(out[-1][0]).date())
