#!/usr/bin/env python3
"""Build data/macro/etf_yearend.json from Yahoo daily adjusted closes.

For each ETF, stores the last New York session adjclose of each calendar
year (2010 onward) plus the latest session, so calendar-year total returns,
YTD, cumulative, and annualized figures can be computed on the site.

Refresh:
  python3 fetch_etf_yearend.py
  python3 fetch_etf_yearend.py --from-dir /tmp/etf-raw
  node tools_fetch_etf_yearend.js   (Chrome path if Yahoo 429s urllib)

Symbols: DBC, IWD, VNQ, IWM, MDY, BIL, SPY, EFA, TIP, BND, HYG, QQQ,
CWB, LQD, EMB, TLT, VWO, PFF, IWF, GLD.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data", "macro")
OUT = os.path.join(DATA, "etf_yearend.json")
UTC = dt.timezone.utc
NY = ZoneInfo("America/New_York")
SYMBOLS = [
    "DBC", "IWD", "VNQ", "IWM", "MDY", "BIL", "SPY", "EFA", "TIP", "BND",
    "HYG", "QQQ", "CWB", "LQD", "EMB", "TLT", "VWO", "PFF", "IWF", "GLD",
]
START = int(dt.datetime(2009, 12, 1, tzinfo=UTC).timestamp())
UA = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
}


def iso(d: dt.date) -> str:
    return d.isoformat()


def session_date(ts: int) -> dt.date:
    return dt.datetime.fromtimestamp(int(ts), NY).date()


def chart_to_daily(result: dict) -> list[tuple[dt.date, int, float]]:
    ts = result.get("timestamp") or []
    ind = result.get("indicators") or {}
    adj = ((ind.get("adjclose") or [{}])[0] or {}).get("adjclose") or []
    by: dict[dt.date, tuple[int, float]] = {}
    for i, raw_t in enumerate(ts):
        a = adj[i] if i < len(adj) else None
        if a is None or a <= 0:
            continue
        d = session_date(raw_t)
        by[d] = (int(raw_t), float(a))
    return [(d, by[d][0], by[d][1]) for d in sorted(by)]


def year_ends(daily: list[tuple[dt.date, int, float]]) -> dict[int, tuple[dt.date, int, float]]:
    ends: dict[int, tuple[dt.date, int, float]] = {}
    for d, ts, a in daily:
        y = d.year
        prev = ends.get(y)
        if prev is None or d >= prev[0]:
            ends[y] = (d, ts, a)
    return ends


def load_chart_file(path: str) -> dict:
    with open(path) as f:
        data = json.load(f)
    if "chart" in data:
        result = (data.get("chart") or {}).get("result") or []
        if not result:
            raise RuntimeError(f"no chart result in {path}")
        return result[0]
    if "timestamp" in data and "indicators" in data:
        return data
    raise RuntimeError(f"unrecognized Yahoo JSON in {path}")


def fetch_yahoo_chart(symbol: str) -> dict:
    now = int(time.time())
    last = None
    for host in ("https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"):
        url = (
            f"{host}/v8/finance/chart/{symbol}"
            f"?period1={START}&period2={now}&interval=1d"
            f"&includeAdjustedClose=true&events=div%2Csplits"
        )
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.load(r)
            result = (data.get("chart") or {}).get("result") or []
            if not result:
                raise RuntimeError(f"empty result: {(data.get('chart') or {}).get('error')}")
            gran = (result[0].get("meta") or {}).get("dataGranularity")
            n = len(result[0].get("timestamp") or [])
            print(f"  {symbol} via {host} granularity={gran} bars={n}")
            if gran and gran != "1d":
                raise RuntimeError(f"{symbol} returned {gran}, not 1d")
            return result[0]
        except Exception as e:
            last = e
            print(f"  {symbol} via {host} failed: {e}")
    raise RuntimeError(f"Yahoo chart failed for {symbol}: {last}")


def build(series_charts: dict[str, dict]) -> dict:
    out = {
        "source": "Yahoo Finance v8 chart API (query1.finance.yahoo.com)",
        "license": "Yahoo market data; redistributed as a static research cache for this site. See data/macro/SOURCES.md.",
        "field": "adjclose",
        "convention": "Year-end value is the dividend- and split-adjusted close of the last New York session in that calendar year (total return). 'last' is the latest session in the cache.",
        "asOf": None,
        "series": {},
    }
    asof = None
    missing = []
    for sym in SYMBOLS:
        if sym not in series_charts:
            missing.append(sym)
            continue
        daily = chart_to_daily(series_charts[sym])
        if not daily:
            missing.append(sym)
            continue
        ends = year_ends(daily)
        last_d, last_ts, last_a = daily[-1]
        years = {
            str(y): {"date": iso(ends[y][0]), "time": ends[y][1], "adjclose": round(ends[y][2], 6)}
            for y in sorted(ends)
        }
        out["series"][sym] = {
            "symbol": sym,
            "first": iso(daily[0][0]),
            "last": iso(last_d),
            "lastAdjclose": round(last_a, 6),
            "lastTime": last_ts,
            "years": years,
        }
        asof = last_d if asof is None else max(asof, last_d)
        print(f"  {sym}: {daily[0][0]}..{last_d}  {len(years)} year-ends  last {round(last_a, 4)}")
    if missing:
        out["missing"] = missing
        print("missing:", ", ".join(missing))
    out["asOf"] = iso(asof) if asof else None
    return out


def write_out(payload: dict) -> None:
    os.makedirs(DATA, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"wrote {OUT}  {os.path.getsize(OUT)} bytes  asOf {payload['asOf']}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Refresh data/macro/etf_yearend.json")
    ap.add_argument("--from-dir", help="Directory of Yahoo v8 chart JSON (SYM.txt / SYM.json)")
    args = ap.parse_args()
    charts = {}
    if args.from_dir:
        folder = args.from_dir
        for sym in SYMBOLS:
            cands = [
                os.path.join(folder, f"{sym}.txt"),
                os.path.join(folder, f"{sym}.json"),
                os.path.join(folder, f"yahoo_chart_{sym}.json"),
            ]
            path = next((p for p in cands if os.path.exists(p)), None)
            if not path:
                print(f"missing {sym} chart JSON in {folder}")
                continue
            print(f"reading {path}")
            charts[sym] = load_chart_file(path)
    else:
        print("fetching Yahoo daily adj closes (may 429; use tools_fetch_etf_yearend.js if so)")
        for i, sym in enumerate(SYMBOLS):
            if i:
                time.sleep(2.5)
            print(f"fetching {sym}...")
            try:
                charts[sym] = fetch_yahoo_chart(sym)
            except Exception as e:
                print(f"  SKIP {sym}: {e}")
    if not charts:
        raise SystemExit("no ETF charts loaded")
    write_out(build(charts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
