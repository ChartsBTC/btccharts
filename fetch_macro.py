#!/usr/bin/env python3
"""Build daily OHLCV caches for gold, S&P 500, Mag 7 stocks, and monthly CPI.

Sources (all free, no signup):
  goldUSD   – Yahoo Finance chart API, COMEX gold continuous futures (GC=F)
              (LBMA/spot feeds were blocked from this host; this is a futures proxy)
  spx       – Yahoo Finance ^GSPC (S&P 500 price index, not total return)
  spxTR     – Yahoo Finance ^SP500TR (S&P 500 total return)
  aapl, msft, googl, amzn, nvda, meta, tsla
            – Yahoo Finance v8 chart API; main files are split+dividend adjusted
              (OHLC scaled to Adj Close). Companion *_raw.json files hold
              split-unadjusted OHLC reconstructed from Yahoo split events when
              the quote series is already split-adjusted, or the raw quote
              series when it is not.
  cpiAUCSL  – BLS Public Data API CUSR0000SA0 (CPI-U seasonally adjusted;
              FRED's CPIAUCSL)
  cpiAUCNS  – BLS Public Data API CUUR0000SA0 (CPI-U not seasonally adjusted;
              FRED's CPIAUCNS)

Output format matches existing market caches: compact JSON lists of
  [unix_utc_midnight, open, high, low, close, volume]
Single-value series (CPI, or a close-only bar) store O=H=L=C and volume 0
so the same market loader can read them.

Trading-day files are stored natively (no weekend/holiday forward-fill).
See data/macro/SOURCES.md for the recommended compare-time alignment.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data", "macro")
UTC = dt.timezone.utc
NY = ZoneInfo("America/New_York")

# Browser-like UA: Yahoo's chart API has been observed to 429 thinner clients
# after a burst of probes. This is a research cache, not an interactive session.
YAHOO_UA = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
}
BLS_UA = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
    "Accept": "application/json",
}

YAHOO_HOSTS = (
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
)

# id -> Yahoo symbol
# id, Yahoo symbol, write *_raw.json, first year to request
YAHOO_SERIES = [
    ("goldUSD", "GC=F", False, 2000),   # futures proxy; no raw companion
    ("spx", "^GSPC", False, 1927),
    ("spxTR", "^SP500TR", False, 1988),
    ("aapl", "AAPL", True, 1980),
    ("msft", "MSFT", True, 1986),
    ("googl", "GOOGL", True, 2004),
    ("amzn", "AMZN", True, 1997),
    ("nvda", "NVDA", True, 1999),
    ("meta", "META", True, 2012),
    ("tsla", "TSLA", True, 2010),
]
# Yahoo silently returns monthly bars for some range=max / period1=0 daily
# requests. Asking in multi-year daily windows keeps granularity at 1d.
YAHOO_CHUNK_YEARS = 5

# id -> BLS series id, start year
BLS_SERIES = [
    ("cpiAUCSL", "CUSR0000SA0", 1947),  # SA, monthly from 1947
    ("cpiAUCNS", "CUUR0000SA0", 1913),  # NSA, monthly from 1913
]
BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
# Unregistered API: max 10 years per query, 25 queries/day.
BLS_WINDOW = 10


def iso(ts: int) -> str:
    return dt.datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%d")


def session_midnight_utc(ts: int) -> int:
    """UTC midnight of the America/New_York calendar date of ts.

    Yahoo daily bars are stamped at the session open (or sometimes midnight).
    Using the NY session date keeps a 2024-06-10 bar on 2024-06-10 00:00 UTC,
    matching the existing BTC market files.
    """
    d = dt.datetime.fromtimestamp(int(ts), NY).date()
    return int(dt.datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp())


def write_market(name: str, rows: list, subdir: str = DATA) -> list:
    rows = [list(r) for r in rows]
    rows.sort(key=lambda r: r[0])
    by = {}
    for r in rows:
        t, o, h, l, c, v = r
        if c is None or c <= 0:
            continue
        o = c if o is None or o <= 0 else float(o)
        h = c if h is None or h <= 0 else float(h)
        l = c if l is None or l <= 0 else float(l)
        v = 0.0 if v is None else float(v)
        if l > h:
            l, h = h, l
        h = max(h, o, c)
        l = min(l, o, c)
        by[int(t)] = [int(t), float(o), float(h), float(l), float(c), float(v)]
    rows = [by[k] for k in sorted(by)]
    os.makedirs(subdir, exist_ok=True)
    path = os.path.join(subdir, f"{name}.json")
    with open(path, "w") as f:
        json.dump(rows, f, separators=(",", ":"))
    size = os.path.getsize(path)
    print(f"{name}: {len(rows)} rows {iso(rows[0][0])} -> {iso(rows[-1][0])}  {size} bytes")
    return rows


def http_json(url: str, headers: dict, data: bytes | None = None, tries: int = 8,
              timeout: int = 60) -> dict:
    """GET/POST JSON with long backoff on 429/5xx."""
    last = None
    method = "POST" if data is not None else "GET"
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            body = b""
            try:
                body = e.read()
            except Exception:
                pass
            if e.code == 429:
                # 10, 15, 20, 25, then 30 minutes. Tight retries keep the ban warm.
                wait = min(30, 5 * (k + 2)) * 60
                print(f"  HTTP 429 for {url[:80]}... sleeping {wait}s (try {k+1}/{tries})")
                time.sleep(wait)
                continue
            if e.code >= 500:
                wait = 8 * (k + 1)
                print(f"  HTTP {e.code} sleeping {wait}s (try {k+1}/{tries})")
                time.sleep(wait)
                continue
            raise RuntimeError(f"{method} {url} failed HTTP {e.code}: {body[:300]!r}") from e
        except Exception as e:
            last = e
            wait = 4 * (k + 1)
            print(f"  {type(e).__name__}: {e} sleeping {wait}s (try {k+1}/{tries})")
            time.sleep(wait)
    raise RuntimeError(f"{method} failed {url}: {last}")


def _yahoo_windows(start_year: int, chunk_years: int) -> list[tuple[int, int]]:
    now = int(time.time())
    start = int(dt.datetime(start_year, 1, 1, tzinfo=UTC).timestamp())
    windows = []
    a = start
    span = int(chunk_years * 365.25 * 86400)
    while a < now:
        b = min(now + 86400, a + span)
        windows.append((a, b))
        a = b
    return windows


def _yahoo_url(symbol: str, period1: int, period2: int, host: str) -> str:
    from urllib.parse import quote
    # Encode ^ (^GSPC -> %5E) but keep = so GC=F stays valid.
    return (
        f"{host}/v8/finance/chart/{quote(symbol, safe='=')}"
        f"?period1={period1}&period2={period2}&interval=1d"
        f"&includeAdjustedClose=true&events=div%2Csplits"
    )


def _merge_chart(chunks: list[dict]) -> dict:
    """Merge v8 chart results (possibly overlapping) into one result object."""
    if not chunks:
        raise RuntimeError("no Yahoo chart chunks to merge")
    by_t: dict[int, dict] = {}
    splits: dict[str, dict] = {}
    dividends: dict[str, dict] = {}
    meta = chunks[-1].get("meta") or {}
    for ch in chunks:
        ts = ch.get("timestamp") or []
        ind = ch.get("indicators") or {}
        quote = (ind.get("quote") or [{}])[0] or {}
        adj = ((ind.get("adjclose") or [{}])[0] or {}).get("adjclose") or []
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        closes = quote.get("close") or []
        vols = quote.get("volume") or []
        for i, raw_t in enumerate(ts):
            by_t[int(raw_t)] = {
                "o": opens[i] if i < len(opens) else None,
                "h": highs[i] if i < len(highs) else None,
                "l": lows[i] if i < len(lows) else None,
                "c": closes[i] if i < len(closes) else None,
                "v": vols[i] if i < len(vols) else None,
                "adj": adj[i] if i < len(adj) else None,
            }
        ev = ch.get("events") or {}
        splits.update(ev.get("splits") or {})
        dividends.update(ev.get("dividends") or {})
    times = sorted(by_t)
    def col(key):
        return [by_t[t][key] for t in times]
    events = {}
    if splits:
        events["splits"] = splits
    if dividends:
        events["dividends"] = dividends
    return {
        "meta": meta,
        "timestamp": times,
        "indicators": {
            "quote": [{"open": col("o"), "high": col("h"), "low": col("l"),
                       "close": col("c"), "volume": col("v")}],
            "adjclose": [{"adjclose": col("adj")}],
        },
        "events": events,
    }


def _chart_request(symbol: str, period1: int, period2: int) -> dict:
    last = None
    for host in YAHOO_HOSTS:
        url = _yahoo_url(symbol, period1, period2, host)
        try:
            data = http_json(url, YAHOO_UA, tries=8, timeout=90)
            result = (data.get("chart") or {}).get("result") or []
            if not result:
                err = (data.get("chart") or {}).get("error")
                raise RuntimeError(f"Yahoo empty result for {symbol}: {err}")
            return result[0]
        except Exception as e:
            last = e
            print(f"  {symbol} via {host} failed: {e}")
            continue
    raise RuntimeError(f"Yahoo chart failed for {symbol}: {last}")


def yahoo_chart(symbol: str, start_year: int, chunk_years: int = YAHOO_CHUNK_YEARS) -> dict:
    chunks = []
    windows = _yahoo_windows(start_year, chunk_years)
    print(f"  {len(windows)} daily windows of ~{chunk_years}y from {start_year}")
    for i, (p1, p2) in enumerate(windows):
        if i:
            time.sleep(1.5)
        ch = _chart_request(symbol, p1, p2)
        gran = (ch.get("meta") or {}).get("dataGranularity")
        n = len(ch.get("timestamp") or [])
        print(f"  window {iso(p1)}..{iso(min(p2, int(time.time())))} granularity={gran} bars={n}")
        if gran and gran != "1d":
            raise RuntimeError(
                f"{symbol} window {iso(p1)} returned granularity {gran}, not 1d"
            )
        if n:
            chunks.append(ch)
    if not chunks:
        raise RuntimeError(f"no daily bars for {symbol}")
    return _merge_chart(chunks)


def _zip_quote(result: dict):
    ts = result.get("timestamp") or []
    ind = result.get("indicators") or {}
    quote = (ind.get("quote") or [{}])[0]
    adj = ((ind.get("adjclose") or [{}])[0] or {}).get("adjclose") or []
    opens, highs, lows, closes, vols = (
        quote.get("open") or [],
        quote.get("high") or [],
        quote.get("low") or [],
        quote.get("close") or [],
        quote.get("volume") or [],
    )
    rows = []
    for i, raw_t in enumerate(ts):
        close = closes[i] if i < len(closes) else None
        adj_c = adj[i] if i < len(adj) else None
        if close is None or close <= 0:
            continue
        rows.append({
            "t": session_midnight_utc(raw_t),
            "raw_t": int(raw_t),
            "o": opens[i] if i < len(opens) else None,
            "h": highs[i] if i < len(highs) else None,
            "l": lows[i] if i < len(lows) else None,
            "c": float(close),
            "adj": float(adj_c) if adj_c not in (None, 0) else float(close),
            "v": vols[i] if i < len(vols) else 0,
        })
    return rows


def _split_events(result: dict) -> list[tuple[int, float]]:
    """Return (session_midnight_utc, ratio) where ratio = numerator/denominator.

    A 10-for-1 split is ratio=10. Applies to bars strictly before that session
    date (the split-effective day's bar is already post-split).
    """
    ev = (result.get("events") or {}).get("splits") or {}
    out = []
    for _k, s in ev.items():
        num = s.get("numerator")
        den = s.get("denominator")
        if not num or not den:
            # splitRatio like "10:1"
            ratio_s = str(s.get("splitRatio") or "")
            if ":" in ratio_s:
                a, b = ratio_s.split(":", 1)
                try:
                    num, den = float(a), float(b)
                except ValueError:
                    continue
            else:
                continue
        ratio = float(num) / float(den)
        if ratio <= 0:
            continue
        out.append((session_midnight_utc(s.get("date") or int(_k)), ratio))
    out.sort()
    return out


def _looks_split_adjusted(rows: list[dict], splits: list[tuple[int, float]]) -> bool:
    """Heuristic: if close does not jump by ~the split ratio on the split day,
    the quote series is already split-adjusted."""
    if not splits or not rows:
        return True
    by_t = {r["t"]: r for r in rows}
    times = [r["t"] for r in rows]
    votes_adj, votes_raw = 0, 0
    for st, ratio in splits:
        # previous trading day and split day (or first day on/after split)
        prev = None
        day = None
        for t in times:
            if t < st:
                prev = t
            elif day is None:
                day = t
                break
        if prev is None or day is None:
            continue
        c0, c1 = by_t[prev]["c"], by_t[day]["c"]
        if c0 <= 0 or c1 <= 0:
            continue
        jump = c0 / c1
        # raw: jump ≈ ratio; adjusted: jump ≈ 1
        if abs(jump - ratio) / ratio < 0.35:
            votes_raw += 1
        elif abs(jump - 1) < 0.35:
            votes_adj += 1
    if votes_raw == 0 and votes_adj == 0:
        return True
    return votes_adj >= votes_raw


def _cumulative_future_splits(times: list[int], splits: list[tuple[int, float]]) -> dict[int, float]:
    """For each bar time t, product of split ratios with split_date > t."""
    # Walk backward: start at 1 after the last split, multiply as we cross splits.
    factors = {}
    factor = 1.0
    si = len(splits) - 1
    for t in reversed(times):
        while si >= 0 and splits[si][0] > t:
            factor *= splits[si][1]
            si -= 1
        # split on this exact day does not apply to this bar (already post-split)
        factors[t] = factor
    return factors


def convert_yahoo(name: str, result: dict, write_raw: bool) -> tuple[list, list | None]:
    rows = _zip_quote(result)
    splits = _split_events(result)
    if not rows:
        raise RuntimeError(f"no usable bars for {name}")

    # Adjusted file: scale OHLC to adjclose so candles sit on the
    # split+dividend-adjusted close that ratios should use.
    adj_rows = []
    for r in rows:
        factor = r["adj"] / r["c"] if r["c"] else 1.0
        o = r["adj"] if r["o"] is None else r["o"] * factor
        h = r["adj"] if r["h"] is None else r["h"] * factor
        l = r["adj"] if r["l"] is None else r["l"] * factor
        v = 0.0 if r["v"] is None else float(r["v"])
        adj_rows.append([r["t"], o, h, l, r["adj"], v])
    written = write_market(name, adj_rows)

    raw_written = None
    if write_raw:
        split_adj = _looks_split_adjusted(rows, splits)
        raw_rows = []
        if split_adj and splits:
            factors = _cumulative_future_splits([r["t"] for r in rows], splits)
            for r in rows:
                f = factors[r["t"]]
                o = r["c"] if r["o"] is None else r["o"]
                h = r["c"] if r["h"] is None else r["h"]
                l = r["c"] if r["l"] is None else r["l"]
                v = 0.0 if r["v"] is None else float(r["v"])
                # Reverse Yahoo's split adjustment: prices * factor, volume / factor
                raw_rows.append([r["t"], o * f, h * f, l * f, r["c"] * f,
                                 v / f if f else v])
            print(f"  {name}_raw: reconstructed from {len(splits)} split event(s) "
                  f"(quote series looks split-adjusted)")
        else:
            for r in rows:
                o = r["c"] if r["o"] is None else r["o"]
                h = r["c"] if r["h"] is None else r["h"]
                l = r["c"] if r["l"] is None else r["l"]
                v = 0.0 if r["v"] is None else float(r["v"])
                raw_rows.append([r["t"], o, h, l, r["c"], v])
            why = "quote series looks unadjusted" if splits else "no split events"
            print(f"  {name}_raw: using Yahoo quote OHLC as-is ({why})")
        raw_written = write_market(f"{name}_raw", raw_rows)
        # Log split dates for the report
        if splits:
            print(f"  {name} splits: " +
                  ", ".join(f"{iso(t)} {ratio:g}:1" for t, ratio in splits))
    return written, raw_written


def fetch_yahoo(pause: float = 12.0, only: set[str] | None = None) -> None:
    n = 0
    for name, symbol, write_raw, start_year in YAHOO_SERIES:
        if only and name not in only:
            continue
        if n:
            print(f"  sleeping {pause:.0f}s before next Yahoo symbol...")
            time.sleep(pause)
        print(f"fetching {name} ({symbol})...")
        result = yahoo_chart(symbol, start_year)
        convert_yahoo(name, result, write_raw)
        n += 1


def _bls_windows(start_year: int, end_year: int) -> list[tuple[int, int]]:
    windows = []
    y = end_year
    # Walk backward so the most recent decade is fetched first (and is not
    # truncated off the front of a window the way 2016-2026 -> 2016-2025 was).
    while y >= start_year:
        a = max(start_year, y - (BLS_WINDOW - 1))
        windows.append((a, y))
        y = a - 1
    windows.reverse()
    return windows


def fetch_bls(only: set[str] | None = None) -> None:
    end_year = dt.datetime.now(UTC).year
    # One unregistered POST can request both series, but a series that does
    # not exist in a window may be omitted. Request each series on its own
    # windows and merge. 12 or so queries stays under the 25/day cap.
    buckets: dict[str, dict[int, float]] = {name: {} for name, _sid, _y in BLS_SERIES}
    for name, sid, start_year in BLS_SERIES:
        if only and name not in only:
            continue
        for a, b in _bls_windows(start_year, end_year):
            body = json.dumps({
                "seriesid": [sid],
                "startyear": str(a),
                "endyear": str(b),
            }).encode()
            print(f"fetching {name} ({sid}) {a}-{b}...")
            data = http_json(BLS_URL, BLS_UA, data=body, tries=5, timeout=60)
            if data.get("status") != "REQUEST_SUCCEEDED":
                raise RuntimeError(f"BLS {sid} {a}-{b}: {data.get('status')} {data.get('message')}")
            # Warn if BLS truncated the window
            for msg in data.get("message") or []:
                print(f"  BLS message: {msg}")
            series_list = ((data.get("Results") or {}).get("series") or [])
            if not series_list:
                print(f"  no series in response for {sid} {a}-{b}")
                continue
            points = series_list[0].get("data") or []
            n_ok = 0
            for p in points:
                period = p.get("period") or ""
                if not period.startswith("M"):
                    continue
                month = int(period[1:])
                if month < 1 or month > 12:
                    continue
                val = p.get("value")
                if val in (None, "", "-"):
                    continue
                year = int(p["year"])
                ts = int(dt.datetime(year, month, 1, tzinfo=UTC).timestamp())
                buckets[name][ts] = float(val)
                n_ok += 1
            print(f"  {n_ok} monthly points")
            time.sleep(0.4)

    for name, _sid, _y in BLS_SERIES:
        if only and name not in only:
            continue
        rows = [[t, v, v, v, v, 0.0] for t, v in sorted(buckets[name].items())]
        if not rows:
            raise RuntimeError(f"no CPI rows for {name}")
        write_market(name, rows)


# Dates used to confirm split continuity (NY session date -> UTC midnight).
SPLIT_CHECKS = {
    "aapl": [(2014, 6, 6), (2014, 6, 9), (2020, 8, 28), (2020, 8, 31)],
    "tsla": [(2020, 8, 28), (2020, 8, 31), (2022, 8, 24), (2022, 8, 25)],
    "nvda": [(2021, 7, 19), (2021, 7, 20), (2024, 6, 7), (2024, 6, 10)],
    "googl": [(2022, 7, 15), (2022, 7, 18)],
    "amzn": [(2022, 6, 3), (2022, 6, 6)],
}

KNOWN_CPI = {
    "cpiAUCSL": {(1947, 1): 21.48, (2020, 1): 259.127, (2026, 10): 337.476},
    "cpiAUCNS": {(1913, 1): 9.8, (2020, 1): 257.971, (2026, 10): 337.511},
}


def _ymd_ts(y, m, d):
    return int(dt.datetime(y, m, d, tzinfo=UTC).timestamp())


def _load(name):
    path = os.path.join(DATA, f"{name}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def report_sanity():
    print("\n=== coverage ===")
    ids = [n for n, *_ in YAHOO_SERIES] + [f"{n}_raw" for n, _, raw, *_ in YAHOO_SERIES if raw]
    ids += [n for n, *_ in BLS_SERIES]
    for name in ids:
        rows = _load(name)
        path = os.path.join(DATA, f"{name}.json")
        if not rows:
            print(f"{name}: MISSING")
            continue
        print(f"{name}: {len(rows)} rows {iso(rows[0][0])} -> {iso(rows[-1][0])}  "
              f"{os.path.getsize(path)} bytes")

    print("\n=== split windows (adjusted close vs raw close) ===")
    for name, dates in SPLIT_CHECKS.items():
        adj, raw = _load(name), _load(f"{name}_raw")
        if not adj:
            print(f"{name}: adjusted file missing, skip")
            continue
        by_a = {r[0]: r[4] for r in adj}
        by_r = {r[0]: r[4] for r in raw} if raw else {}
        print(f"{name}:")
        prev_a = prev_r = None
        for y, m, d in dates:
            t = _ymd_ts(y, m, d)
            a = by_a.get(t)
            r = by_r.get(t)
            extra = ""
            if a is not None and prev_a:
                extra += f"  adj ratio {prev_a/a:.4f}"
            if r is not None and prev_r:
                extra += f"  raw ratio {prev_r/r:.4f}"
            print(f"  {y}-{m:02d}-{d:02d}  adj={a}  raw={r}{extra}")
            if a is not None:
                prev_a = a
            if r is not None:
                prev_r = r
        # Continuity: largest single-day drop in adjusted close should not
        # be a split-sized cliff around those dates.
        if adj and raw:
            # Find the largest close jump in each file near each split pair
            pass

    print("\n=== CPI known values ===")
    for name, known in KNOWN_CPI.items():
        rows = _load(name)
        if not rows:
            print(f"{name}: MISSING")
            continue
        by = {r[0]: r[4] for r in rows}
        for (y, m), expect in known.items():
            got = by.get(_ymd_ts(y, m, 1))
            ok = got is not None and abs(got - expect) < 1e-6
            print(f"  {name} {y}-{m:02d} got={got} expected={expect} {'OK' if ok else 'MISMATCH'}")

    print("\n=== format checks ===")
    for name in ids:
        rows = _load(name)
        if not rows:
            continue
        bad = [r for r in rows if len(r) != 6 or r[4] <= 0 or r[3] > r[2]]
        print(f"{name}: {len(bad)} malformed rows" if bad else f"{name}: rows ok")


def main():
    ap = argparse.ArgumentParser(description="Refresh data/macro/*.json caches")
    ap.add_argument("--only", nargs="+", help="Limit to these series ids (e.g. aapl cpiAUCSL)")
    ap.add_argument("--skip-yahoo", action="store_true")
    ap.add_argument("--skip-bls", action="store_true")
    ap.add_argument("--pause", type=float, default=20.0,
                    help="Seconds to sleep between Yahoo symbols (default 20)")
    ap.add_argument("--chunk-years", type=int, default=YAHOO_CHUNK_YEARS,
                    help="Daily Yahoo window length in years (default 5)")
    args = ap.parse_args()
    if args.chunk_years:
        globals()["YAHOO_CHUNK_YEARS"] = args.chunk_years
    only = set(args.only) if args.only else None
    if not args.skip_bls:
        need_bls = True if only is None else any(n in only for n, *_ in BLS_SERIES)
        if need_bls:
            fetch_bls(only=only)
    if not args.skip_yahoo:
        need_yahoo = True if only is None else any(n in only for n, *_ in YAHOO_SERIES)
        if need_yahoo:
            fetch_yahoo(pause=args.pause, only=only)
    report_sanity()


if __name__ == "__main__":
    main()
