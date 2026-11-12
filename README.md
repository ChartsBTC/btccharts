# btccharts-clone
Static bitcoincharts.com-style chart page.

- Serve: `cd /workspace/btccharts-clone && python3 serve.py`, then open http://127.0.0.1:8765/
- Refresh daily caches: `python3 fetch_history.py` (writes data/coinbaseUSD.json, bitstampUSD.json, mtgoxUSD.json, combinedUSD.json). Sources and splice dates: data/SOURCES.md. The page also tops up the latest Coinbase/Bitstamp days live.
- Files: index.html, style.css, app.js, data.js, indicators.js, vendor/lightweight-charts.js (v4.2.3)
- Screenshots: `node tools_screenshot.js` (needs playwright-core in /tmp/pw and google-chrome)
