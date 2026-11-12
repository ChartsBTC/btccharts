# Daily history sources

All of these are free public datasets. Nothing was paid for or signed up for.

## coinbaseUSD — 2015-07-20 to present
Coinbase Exchange public candles API:
`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400`
(paginated at 300 candles per request). Refreshed by `fetch_history.py`. The page also tops up the latest days live.

## bitstampUSD — 2011-08-18 to present
Bitstamp public OHLC API:
`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1000&start=...`
First printed day in this API is 2011-08-18 (the exchange launched that month; slightly earlier than the often-cited September 2011). No missing days in the daily series. One isolated bad high on 2011-11-25 ($15 vs a ~$2.50 body) was clamped.

## mtgoxUSD — 2010-07-17 to 2014-02-25
bitcoincharts.com's live full-history CSVs (`api.bitcoincharts.com/v1/csv/mtgoxUSD.csv.gz`) are offline (TLS/500). Wayback Machine has copies (~60 MB, August 2016 snapshot) but was blocking automated downloads from this host (HTTP 429).

Used instead:
- Bitcoinity.org daily export (Kacper Cieśla / comboy), free, no signup:
  `https://data.bitcoinity.org/export_data.csv?currency=USD&exchange=mtgox&data_type=price|volume&timespan=all&r=day`
  Columns: avg (used as close / VWAP), max (high), min (low), volume in BTC. Open is the previous day's close.
- Last day with trades: **2014-02-25**. The site did not print after that (withdrawal halt 2014-02-07, market failed 2014-02-25/26).
- Bitcoinity is missing most daily bars from **2011-06-20 to 2011-11-28** (only a handful of monthly points). Those 156 days are filled with the Coinmetrics community reference rate `PriceUSD` (free, no key):
  `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d`
  Filled bars are close-only (O=previous close, H/L/C=reference price, volume=0). This is a reference rate, not raw Mt. Gox prints.

## combinedUSD — 2010-07-17 to present (default market)
Stitched, no missing days:
1. **Mt. Gox** through **2013-12-31**
2. **Bitstamp** from **2014-01-01** through **2016-12-31**
3. **Coinbase** from **2017-01-01** onward

## Cleaning
- Drop bars with non-positive prices.
- Clamp isolated wicks whose high is >3× the body and >3× neighbouring highs, or whose low is <1/3 of the body and neighbouring lows (Coinbase 2017-04-15 $0.06 low; Bitstamp 2011-11-25 $15 high). Real crashes (June 2011, April 2013, February 2014) are left intact because open/close also moved.
