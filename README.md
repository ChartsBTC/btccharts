# btccharts-clone
Static bitcoincharts.com-style chart page.

- Serve: `cd /workspace/btccharts-clone && python3 serve.py`, then open http://127.0.0.1:8765/
- Refresh daily caches: `python3 fetch_history.py` (writes data/coinbaseUSD.json, bitstampUSD.json, mtgoxUSD.json, combinedUSD.json). Sources and splice dates: data/SOURCES.md. The page also tops up the latest Coinbase/Bitstamp days live.
- Files: index.html, style.css, app.js, data.js, indicators.js, vendor/lightweight-charts.js (v4.2.3)
- Screenshots: `node tools_screenshot.js` (needs playwright-core in /tmp/pw and google-chrome)
- Cycles view: overlay each 4-year cycle as a line vs days since an anchor (cycle low, cycle high, official halving dates, or Jan 1 every 4 years). Prices can be stacked USD or scaled (multiple of cycle low, % of cycle high, or relative to day 0). In scaled modes the left axis is the multiple (or % of high) and the right axis is that value in current-cycle USD (multiple × the current cycle’s low, high, or day-0 close). Always uses Combined daily history. Settings are in the URL hash (`cy`, `ca`, `cp`).
