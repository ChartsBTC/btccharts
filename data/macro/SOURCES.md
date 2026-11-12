# Macro series sources

Free public datasets only. Nothing was paid for or signed up for. Refresh with
`python3 fetch_macro.py` from the repo root.

Row format matches the existing market caches so the same loader can read them:

```
[unix_utc_midnight, open, high, low, close, volume]
```

Compact JSON, no spaces. Close-only series (CPI, or a bar with no OHLC) store
`O = H = L = C` and `volume = 0`. Yahoo daily bars are dated by the
America/New_York session date, then stored as that date's UTC midnight (the
same convention as `combinedUSD.json`). CPI months are dated the 1st of the
month, UTC midnight (FRED convention). Pre-1970 dates (S&P 500, CPI) use
negative Unix timestamps; they are valid JSON numbers and valid JS Date values.

Market-style ids (planned dropdown entries, not wired in the UI yet):

| id | file | series |
| --- | --- | --- |
| `goldUSD` | `goldUSD.json` | Gold USD, COMEX continuous futures proxy |
| `spx` | `spx.json` | S&P 500 price index |
| `spxTR` | `spxTR.json` | S&P 500 total return |
| `aapl` `msft` `googl` `amzn` `nvda` `meta` `tsla` | same-name `.json` | Mag 7, split+dividend adjusted |
| (companions) | `aapl_raw.json` etc. | Mag 7, split-unadjusted OHLC |
| `cpiAUCSL` | `cpiAUCSL.json` | CPI-U seasonally adjusted, monthly |
| `cpiAUCNS` | `cpiAUCNS.json` | CPI-U not seasonally adjusted, monthly |

## Trading-day vs 24/7 alignment (recommended)

These files keep **native observations only**. Equity, futures, and index files
are trading-day bars (weekends and exchange holidays omitted). CPI is monthly.
They are **not** forward-filled to calendar days in this cache.

Bitcoin market files (`combinedUSD` and friends) are 24/7 calendar days. When
the compare-to UI draws a second line or a `series1/series2` ratio:

1. Build the union of dates (or use BTC's calendar-day index as the master
   timeline).
2. **Forward-fill (LOCF)** the macro series onto that timeline: weekends and
   holidays keep the previous close. Do not interpolate, and do not fill
   backward before a series starts (META begins at its 2012-05-18 IPO; CPI
   should stay at the last published month until the next month's 1st).
3. After a CPI month starts, the index stays at that month's value until the
   next published month (October 2025 is missing — see CPI notes — so
   September 2025 should carry forward through 2025-10-31).
4. For inflation adjustment, use `series / cpiAUCSL` (or NSA) with the same
   LOCF, then optionally rebase to 1.0 or 100 at a start date.

Forward-filling inside the JSON would bloat the files, invent bars the source
never printed, and make a later "don't fill" chart harder. Alignment belongs
at compare time.

## goldUSD — COMEX gold continuous futures (Yahoo `GC=F`)

Not LBMA spot and not a London PM fix. Yahoo's `XAUUSD=X` returns 404
(delisted). LBMA (`prices.lbma.org.uk`) returned Cloudflare 403 from this
host. FRED CSV/API and Stooq CSVs were also blocked (see "Sources that did
not work"). `GLD` / `IAU` ETFs work on Yahoo but start later (2004–2005) and
include an expense ratio.

`GC=F` is the continuous front-month COMEX gold futures contract as Yahoo
stitches it. Daily OHLC and volume from the Yahoo v8 chart API. Open/high/low
are scaled to Adj Close when the two differ; they are usually identical for
this contract. First Yahoo print is typically 2000-08-30, which covers the
full BTC history (from 2010-07-17).

Caveats: contract rolls can leave small gaps or jumps that a spot series would
not show; this is a futures proxy, not cash gold. Weekend gaps are expected
(CME has a Friday–Sunday break).

Coverage, row count, and size are listed in the series table at the bottom
(filled from the last refresh).

## spx — S&P 500 price index (Yahoo `^GSPC`)

Price-only index: dividends are not reinvested. This is the headline S&P 500
level. History on Yahoo goes back to 1927. Trading days only.

## spxTR — S&P 500 total return (Yahoo `^SP500TR`)

Same index with dividends reinvested. Yahoo's total-return series typically
starts in January 1988, so it does **not** cover the whole `^GSPC` history. It
does cover the BTC era. Use `spxTR` when comparing total wealth to
buy-and-hold BTC; use `spx` when comparing to the published index level.

## Mag 7 stocks (Yahoo: `AAPL`, `MSFT`, `GOOGL`, `AMZN`, `NVDA`, `META`, `TSLA`)

Daily bars from the Yahoo v8 chart API with `includeAdjustedClose=true` and
`events=div,splits`.

**Main files** (`aapl.json`, …) are split- and dividend-adjusted. Each bar's
open/high/low is scaled by `adjclose / close` so the candle sits on the
adjusted close. That close is the series to use for ratios and
"compare to" charts (a 4-for-1 split should not look like an 75% crash).

**Companion `*_raw.json` files** hold split-unadjusted OHLC (and volume
reversed the same way). If Yahoo's `quote` close already jumps by the split
ratio on the effective date, the quote OHLC is stored as-is. If the quote
series is already split-adjusted, historical prices are multiplied (and
volume divided) by the product of later split ratios from Yahoo's split
events. Dividends are *not* added back in the raw files; raw means
split-unadjusted.

Known split checks (effective dates):

- AAPL: 7-for-1 on 2014-06-09; 4-for-1 on 2020-08-31
- TSLA: 5-for-1 on 2020-08-31; 3-for-1 on 2022-08-25
- NVDA: 4-for-1 on 2021-07-20; 10-for-1 on 2024-06-10
- GOOGL: ~1.998-for-1 on 2014-04-03 (Class C issuance); 20-for-1 on 2022-07-18
- AMZN: 20-for-1 on 2022-06-06
- META: no recent split
- MSFT: last split was in 2003 (before the BTC era)

Coverage notes:

- **META** (Facebook) IPO is 2012-05-18; the series does not reach 2010-07-17.
- **TSLA** IPO is 2010-06-29, just before BTC combined history starts.
- **GOOGL** is Class A (the post-2014 ticker); Yahoo's history goes back to
  the 2004 Google IPO.
- Tickers follow today's symbols (`META` not `FB`, `GOOGL` not `GOOG`).
  `GOOG` (Class C) is a different share class and is not included.

## cpiAUCSL — CPI-U seasonally adjusted, monthly

BLS Public Data API (no key, unregistered limits: 25 queries/day, 10 years
per query), series `CUSR0000SA0`. This is the same series FRED publishes as
`CPIAUCSL`. FRED downloads were not used because they were blocked or
required an API key (see below).

- **957** monthly rows, **1947-01-01** through **2026-10-01**, 39,703 bytes
  at last refresh.
- Each row is `[t, v, v, v, v, 0]` with `t` = 1st of the month, UTC midnight.
- Spot checks: Jan 1947 = 21.48; Dec 1982 = 97.7; Jul 2010 = 217.605; Jan
  2020 = 259.127; Dec 2024 = 317.604; Oct 2026 = 337.476.
- **Gap: October 2025 is unpublished.** The API returns `-` with footnote
  code `X`: "Data unavailable due to the 2025 lapse in appropriations."
  September 2025 (324.245) should be forward-filled through that month at
  compare time. November 2025 is 325.063.

Index base is 1982–84 = 100. Seasonal-adjustment factors are revised; values
for recent years can move slightly on a later refresh.

## cpiAUCNS — CPI-U not seasonally adjusted, monthly

BLS Public Data API series `CUUR0000SA0` (FRED `CPIAUCNS`).

- **1,365** monthly rows, **1913-01-01** through **2026-10-01**, 54,175 bytes
  at last refresh.
- Spot checks: Jan 1913 = 9.8; Jan 1947 = 21.5; Dec 1982 = 97.6; Jul 2010 =
  218.011; Jan 2020 = 257.971; Dec 2024 = 315.605; Oct 2026 = 337.511.
- Same **October 2025** gap (footnote X, lapse in appropriations). September
  2025 is 324.800; November 2025 is 324.122.

NSA is the official "headline" year-over-year CPI. SA is usually the better
divisor for month-to-month inflation adjustment of a daily price series.

## Sources that did not work from this host

Tried, then abandoned so the refresh script can run unattended:

- **FRED** `fredgraph.csv?id=…`, `data/*.txt`, and the official FRED API:
  HTTP/2 `INTERNAL_ERROR`, HTTP/1.1 timeouts with 0 bytes, or HTTP 400
  "api_key is not set". Creating a FRED account / key was out of scope.
  `files.stlouisfed.org` 404'd.
- **BLS flat-file downloads** (`download.bls.gov`): HTTP 403 even with a
  browser User-Agent. The Public Data API works without a key and is what we
  use for CPI.
- **Stooq** daily CSV (`stooq.com` / `stooq.pl` `/q/d/l/?s=…`): HTTP 200 but
  a JavaScript SHA-256 proof-of-work interstitial. The `/__verify` POST from
  this host returned 403 (no cookie issued), so it cannot be automated here.
- **LBMA** (`prices.lbma.org.uk`): Cloudflare 403.
- **Yahoo `XAUUSD=X`**: HTTP 404. Not a usable spot-gold symbol.
- **Nasdaq** historical JSON/CSV (`api.nasdaq.com`,
  `nasdaq.com/api/v1/historical/…`): empty `totalRecords: 0` or 404.

Yahoo's chart API itself works from this host but rate-limits aggressively
(HTTP 429) after a burst. `fetch_macro.py` backs off for minutes and pauses
between symbols. If a refresh still 429s, wait and rerun; already-written
files are left in place.

## License / terms notes

- **BLS** CPI is U.S. government public information. Attribution to the
  Bureau of Labor Statistics is good practice.
- **Yahoo Finance** chart data is delayed market data provided for personal /
  non-commercial use under Yahoo's terms. The exchanges (CME, NYSE, Nasdaq,
  S&P Dow Jones Indices, etc.) own the underlying prints. These JSON files
  are a local research cache for this project, not a redistributable commercial
  data product. Re-run `fetch_macro.py` rather than treating the snapshots as
  authoritative.

## Last refresh coverage

Refresh date: 2026-11-12, early morning America/Los_Angeles. US equities and
indexes last complete bar is **2026-11-11** (the cash session had not opened
yet). COMEX gold (`GC=F`) already has a **2026-11-12** bar. That date mismatch
is expected, not a gap.

This host's IP was HTTP 429 from Yahoo during the first pull, so the Yahoo
files were assembled from 3-year daily v8 chart windows (validated complete
`1d` payloads) and written with the same `convert_yahoo` path as
`fetch_macro.py`. The script remains the unattended refresh path: 5-year daily
chunks, 10–30 minute 429 backoff, and a pause between symbols.

| id | start | end | rows | bytes |
| --- | --- | --- | ---: | ---: |
| `goldUSD` | 2000-08-30 | 2026-11-12 | 6,577 | 524,852 |
| `spx` | 1927-12-30 | 2026-11-11 | 24,834 | 2,315,715 |
| `spxTR` | 1988-01-04 | 2026-11-11 | 9,789 | 823,688 |
| `aapl` | 1980-12-12 | 2026-11-11 | 11,572 | 1,162,723 |
| `aapl_raw` | 1980-12-12 | 2026-11-11 | 11,572 | 1,075,754 |
| `msft` | 1986-03-13 | 2026-11-11 | 10,246 | 1,006,005 |
| `msft_raw` | 1986-03-13 | 2026-11-11 | 10,246 | 881,252 |
| `googl` | 2004-08-19 | 2026-11-11 | 5,594 | 548,717 |
| `googl_raw` | 2004-08-19 | 2026-11-11 | 5,594 | 532,766 |
| `amzn` | 1997-05-15 | 2026-11-11 | 7,420 | 712,559 |
| `amzn_raw` | 1997-05-15 | 2026-11-11 | 7,420 | 700,892 |
| `nvda` | 1999-01-22 | 2026-11-11 | 6,995 | 708,440 |
| `nvda_raw` | 1999-01-22 | 2026-11-11 | 6,995 | 675,879 |
| `meta` | 2012-05-18 | 2026-11-11 | 3,642 | 354,406 |
| `meta_raw` | 2012-05-18 | 2026-11-11 | 3,642 | 339,218 |
| `tsla` | 2010-06-29 | 2026-11-11 | 4,119 | 397,924 |
| `tsla_raw` | 2010-06-29 | 2026-11-11 | 4,119 | 393,054 |
| `cpiAUCSL` | 1947-01-01 | 2026-10-01 | 957 | 39,703 |
| `cpiAUCNS` | 1913-01-01 | 2026-10-01 | 1,365 | 54,175 |

Sanity checks on this refresh:

- S&P 500 Black Monday 1987-10-19 close 224.84, −20.47% from 282.70 on 10-16.
- March 2009 low 676.53 on 2009-03-09; COVID low 2,237.40 on 2020-03-23.
- One historical `spx` gap longer than 10 days: 1933-03-03 → 1933-03-15
  (Bank Holiday; markets were closed March 6–14). Not a fetch hole.
- AAPL 7:1 (2014-06-09) and 4:1 (2020-08-31): adjusted close continuous,
  raw close jumps by ~7× and ~4×.
- NVDA 4:1 (2021-07-20) and 10:1 (2024-06-10): same pattern.
- AMZN 20:1 (2022-06-06) and TSLA 5:1 / 3:1 (2020-08-31 / 2022-08-25): same.
- GOOGL 1.998:1 (2014-04-03, Class C issuance) and 20:1 (2022-07-18): same.
- MSFT last split 2003-02-18 2:1, also continuous on the adjusted file.
- META has no split events; raw equals quote OHLC.
- Gold 2011-08-22 close 1,888.70; 2020-08-06 close 2,069.40; 2026-11-12
  close 3,931.90.
- CPI-U values match the published BLS prints listed in the CPI sections.
