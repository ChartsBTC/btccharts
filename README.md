# btccharts-clone
Static bitcoincharts.com-style chart page.

- Serve: `cd /workspace/btccharts-clone && python3 serve.py`, then open http://127.0.0.1:8765/
- Refresh daily caches: `python3 fetch_history.py` (writes data/coinbaseUSD.json, bitstampUSD.json, mtgoxUSD.json, combinedUSD.json). Sources and splice dates: data/SOURCES.md. The page also tops up the latest Coinbase/Bitstamp days live.
- Files: index.html, style.css, app.js, data.js, indicators.js, vendor/lightweight-charts.js (v4.2.3), vendor/uPlot.iife.min.js (v1.6.32)
- Screenshots: `node tools_screenshot.js` (needs playwright-core in /tmp/pw and google-chrome)
- Cycles view: overlay each 4-year cycle as a line vs days since an anchor (cycle low, cycle high, official halving dates, or Jan 1 every 4 years). Prices can be stacked USD or scaled (multiple of cycle low, % of cycle high, or relative to day 0). In scaled modes the left axis is the multiple (or % of high) and the right axis is that value in current-cycle USD (multiple × the current cycle’s low, high, or day-0 close). Always uses Combined daily history. Settings are in the URL hash (`cy`, `ca`, `cp`).
- Intervals: Monthly, Quarterly, and Yearly candles are calendar-aligned aggregates of daily history. “4-Year Cycle” builds one candle per detected cycle (start low to the next low, or today for the open cycle). Auto interval uses Monthly for ranges longer than 8 years. Hash values: `igMonthly`, `igQuarterly`, `igYearly`, `igCycle`.
- Chart image: a watermark (`chartsbtc.github.io/btccharts`) sits on every view and is included in Copy image / Download PNG. Show data (with Download CSV) works in price and Cycles views. Time Period includes cycle presets (`rgc2017`, `rgccurrent`).
- Price-view markers: Cycle highs, Cycle lows, and Halvings (`ch`, `cl`, `hv`) drop date+price labels on the chart.
- Log-Log scale (`ll`): the x-axis is days since the 2009-01-03 genesis, log-scaled (vendored uPlot). Hover, markers, and export still work.
- Power Law (`pl`): ordinary-least-squares fit of `log10(price) = a + b·log10(days since genesis)` to the data shown (visible range, market, or cycle preset). The mid line and optional ±1σ residual bands redraw when the window changes. The legend shows the formula, R², and fit range. The fit is included in exported images.
