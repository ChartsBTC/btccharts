#!/usr/bin/env python3
"""Build data/macro/etf_weekly.json from Yahoo daily adjusted closes.

Each series is the Friday (last NYSE session on or before Friday) dividend-
and split-adjusted close, keyed to that week's Sunday 00:00 UTC.

Refresh:
  python3 fetch_etf_weekly.py
  python3 fetch_etf_weekly.py --from-dir /tmp/etf-raw
      (expects SPY.txt, QQQ.txt, ... Yahoo v8 chart JSON, e.g. from
       node tools_fetch_etf_weekly.js)

Yahoo's chart API often 429s thin urllib clients. The Chrome helper in
tools_fetch_etf_weekly.js is the reliable path; this script will still try
a live fetch first unless --from-dir is set.

Symbols: SPY, QQQ, GLD, AGG, TLT. History from 2010 is enough for a 200-week
window in May 2014; all five ETFs launched before 2005.
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
OUT = os.path.join(DATA, "etf_weekly.json")
UTC = dt.timezone.utc
NY = ZoneInfo("America/New_York")
SYMBOLS = ["SPY", "QQQ", "GLD", "AGG", "TLT"]
START = int(dt.datetime(2010, 1, 1, tzinfo=UTC).timestamp())
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


def sunday_ts(d: dt.date) -> int:
    return int(dt.datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp())


def chart_to_daily(result: dict) -> list[tuple[dt.date, float]]:
    ts = result.get("timestamp") or []
    ind = result.get("indicators") or {}
    adj = ((ind.get("adjclose") or [{}])[0] or {}).get("adjclose") or []
    by: dict[dt.date, float] = {}
    for i, raw_t in enumerate(ts):
        a = adj[i] if i < len(adj) else None
        if a is None or a <= 0:
            continue
        d = session_date(raw_t)
        by[d] = float(a)
    return [(d, by[d]) for d in sorted(by)]


def friday_weeks(daily: list[tuple[dt.date, float]]) -> dict[dt.date, tuple[dt.date, float]]:
    if not daily:
        return {}
    last_session = daily[-1][0]
    weeks: dict[dt.date, tuple[dt.date, float]] = {}
    for d, a in daily:
        sunday = d + dt.timedelta(days=6 - d.weekday())
        friday = sunday - dt.timedelta(days=2)
        if friday > last_session:
            continue
        if d <= friday:
            prev = weeks.get(sunday)
            if prev is None or d >= prev[0]:
                weeks[sunday] = (d, float(a))
    return weeks


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
        "convention": "One bar per week, keyed to the week's Sunday 00:00 UTC. Value is the dividend- and split-adjusted close of the last NYSE session on or before that week's Friday (total return).",
        "asOf": None,
        "series": {},
    }
    asof = None
    for sym in SYMBOLS:
        daily = chart_to_daily(series_charts[sym])
        weeks = friday_weeks(daily)
        days = sorted(weeks)
        if not days:
            raise RuntimeError(f"no weekly closes for {sym}")
        rows = [[sunday_ts(d), round(weeks[d][1], 6)] for d in days]
        out["series"][sym] = {
            "symbol": sym,
            "first": iso(days[0]),
            "last": iso(days[-1]),
            "lastSession": iso(weeks[days[-1]][0]),
            "rows": len(rows),
            "closes": rows,
        }
        asof = days[-1] if asof is None else max(asof, days[-1])
        print(f"  {sym}: {days[0]}..{days[-1]}  {len(rows)} weeks  last session {weeks[days[-1]][0]}")
    out["asOf"] = iso(asof)
    return out


def write_out(payload: dict) -> None:
    os.makedirs(DATA, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"wrote {OUT}  {os.path.getsize(OUT)} bytes  asOf {payload['asOf']}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Refresh data/macro/etf_weekly.json")
    ap.add_argument("--from-dir", help="Directory of Yahoo v8 chart JSON (SPY.txt / SPY.json, …)")
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
                raise SystemExit(f"missing {sym} chart JSON in {folder}")
            print(f"reading {path}")
            charts[sym] = load_chart_file(path)
    else:
        print("fetching Yahoo daily adj closes (may 429; use tools_fetch_etf_weekly.js if so)")
        for i, sym in enumerate(SYMBOLS):
            if i:
                time.sleep(2.5)
            print(f"fetching {sym}...")
            charts[sym] = fetch_yahoo_chart(sym)
    write_out(build(charts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
