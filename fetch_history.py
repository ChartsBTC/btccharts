#!/usr/bin/env python3
"""Build daily OHLCV caches for coinbaseUSD, bitstampUSD, mtgoxUSD, and combinedUSD.

Sources (all free, no signup):
  coinbaseUSD  – Coinbase Exchange public candles API
  bitstampUSD  – Bitstamp public OHLC API (step=86400)
  mtgoxUSD     – Bitcoinity.org daily price (avg/max/min) + volume export
                 (bitcoincharts.com/v1/csv/ is down; Wayback is blocking this host)
                 2011-06-20..2011-11-28 holes filled with Coinmetrics community PriceUSD
  combinedUSD  – Mt. Gox through 2013-12-31, Bitstamp 2014-01-01..2016-12-31,
                 Coinbase from 2017-01-01
"""
from __future__ import annotations
import csv, json, time, datetime as dt, os, urllib.request, urllib.parse, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
UA = {"User-Agent": "btccharts-clone/1.0 (research; local history cache)"}
UTC = dt.timezone.utc
# Splice dates (UTC midnight)
GOX_END = int(dt.datetime(2014, 2, 25, tzinfo=UTC).timestamp())       # last Mt. Gox trade day (standalone series)
COINBASE_START = int(dt.datetime(2015, 7, 20, tzinfo=UTC).timestamp())  # first Coinbase candle (standalone series)
BITSTAMP_START = int(dt.datetime(2011, 8, 18, tzinfo=UTC).timestamp())
# Combined history splice (calendar-year boundaries)
COMBINED_GOX_END = int(dt.datetime(2013, 12, 31, tzinfo=UTC).timestamp())
COMBINED_COINBASE_START = int(dt.datetime(2017, 1, 1, tzinfo=UTC).timestamp())


def get_json(url, tries=6):
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(1.2 * (k + 1))
    raise RuntimeError(f"GET failed {url}: {last}")


def get_text(url, tries=6):
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep(1.2 * (k + 1))
    raise RuntimeError(f"GET failed {url}: {last}")


def iso(ts):
    return dt.datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%d")


def clean_ticks(rows):
    """Drop non-positive prices; clamp isolated extreme wicks that wreck log scale."""
    out = []
    for r in rows:
        t, o, h, l, c, v = r
        if min(o, h, l, c) <= 0:
            continue
        if l > h:
            l, h = h, l
        body_lo, body_hi = min(o, c), max(o, c)
        h = max(h, body_hi)
        l = min(l, body_lo)
        out.append([int(t), float(o), float(h), float(l), float(c), float(v)])
    for i, r in enumerate(out):
        t, o, h, l, c, v = r
        prev_h = out[i - 1][2] if i else h
        next_h = out[i + 1][2] if i + 1 < len(out) else h
        prev_l = out[i - 1][3] if i else l
        next_l = out[i + 1][3] if i + 1 < len(out) else l
        body_hi, body_lo = max(o, c), min(o, c)
        # isolated spike wick, e.g. Bitstamp 2011-11-25 high $15 vs ~$2.5 body
        if h > 3 * body_hi and h > 3 * max(prev_h, next_h):
            r[2] = max(body_hi, prev_h, next_h)
        # isolated dump wick, e.g. Coinbase 2017-04-15 low $0.06
        if l < body_lo / 3 and l < min(prev_l, next_l) / 3:
            r[3] = min(body_lo, prev_l, next_l)
    return out


def write_market(name, rows):
    rows = clean_ticks(rows)
    rows.sort(key=lambda r: r[0])
    # de-dupe by day
    by = {r[0]: r for r in rows}
    rows = [by[k] for k in sorted(by)]
    path = os.path.join(DATA, f"{name}.json")
    with open(path, "w") as f:
        json.dump(rows, f, separators=(",", ":"))
    print(f"{name}: {len(rows)} days {iso(rows[0][0])} -> {iso(rows[-1][0])}")
    return rows


# ----- Coinbase -----
def fetch_coinbase():
    path = os.path.join(DATA, "coinbaseUSD.json")
    rows = {}
    start = COINBASE_START
    if os.path.exists(path):
        for r in json.load(open(path)):
            rows[r[0]] = r
        start = max(rows)
    elif os.path.exists(os.path.join(DATA, "daily.json")):
        for r in json.load(open(os.path.join(DATA, "daily.json"))):
            rows[r[0]] = r
        start = max(rows)
    now = int(time.time())
    G = 86400
    while start < now:
        end = min(start + 299 * G, now)
        s = dt.datetime.fromtimestamp(start, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        e = dt.datetime.fromtimestamp(end, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        u = f"https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity={G}&start={s}&end={e}"
        data = get_json(u)
        for t, lo, hi, o, c, v in data:
            rows[int(t)] = [int(t), float(o), float(hi), float(lo), float(c), float(v)]
        start = end
        time.sleep(0.3)
    rows = write_market("coinbaseUSD", rows.values())
    shutil.copy(os.path.join(DATA, "coinbaseUSD.json"), os.path.join(DATA, "daily.json"))
    return rows


# ----- Bitstamp -----
def fetch_bitstamp():
    rows = {}
    start = int(dt.datetime(2011, 8, 1, tzinfo=UTC).timestamp())
    now = int(time.time())
    while start < now:
        u = f"https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1000&start={start}"
        ohlc = get_json(u)["data"]["ohlc"]
        if not ohlc:
            break
        for x in ohlc:
            t = int(x["timestamp"])
            rows[t] = [t, float(x["open"]), float(x["high"]), float(x["low"]),
                       float(x["close"]), float(x["volume"])]
        nxt = int(ohlc[-1]["timestamp"]) + 86400
        if nxt <= start:
            break
        start = nxt
        time.sleep(0.35)
    return write_market("bitstampUSD", rows.values())


# ----- Mt. Gox via Bitcoinity + Coinmetrics fill -----
def fetch_mtgox():
    price_csv = get_text(
        "https://data.bitcoinity.org/export_data.csv?currency=USD&exchange=mtgox&data_type=price&timespan=all&r=day&t=l"
    )
    vol_csv = get_text(
        "https://data.bitcoinity.org/export_data.csv?currency=USD&exchange=mtgox&data_type=volume&timespan=all&r=day&t=l"
    )
    raw = os.path.join(DATA, "raw")
    os.makedirs(raw, exist_ok=True)
    open(os.path.join(raw, "bitcoinity_mtgox_price.csv"), "w").write(price_csv)
    open(os.path.join(raw, "bitcoinity_mtgox_volume.csv"), "w").write(vol_csv)

    def parse_time(s):
        return int(dt.datetime.strptime(s.replace(" UTC", ""), "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC).timestamp())

    vols = {}
    for row in csv.DictReader(vol_csv.splitlines()):
        key = next(k for k in row if k != "Time")
        try:
            vols[parse_time(row["Time"])] = float(row[key] or 0)
        except ValueError:
            pass

    by = {}
    prev_close = None
    for row in csv.DictReader(price_csv.splitlines()):
        t = parse_time(row["Time"])
        avg, mx, mn = float(row["avg"] or 0), float(row["max"] or 0), float(row["min"] or 0)
        if avg <= 0 or mx <= 0 or mn <= 0:
            continue
        close = avg  # Bitcoinity daily average ~ VWAP
        open_ = prev_close if prev_close else avg
        high, low = max(mx, open_, close), min(mn, open_, close)
        by[t] = [t, open_, high, low, close, vols.get(t, 0.0)]
        prev_close = close

    # Fill 2011 mid-year holes (Bitcoinity has ~monthly points only between 2011-06-20 and 2011-11-28)
    fill_start = int(dt.datetime(2011, 6, 20, tzinfo=UTC).timestamp())
    fill_end = int(dt.datetime(2011, 11, 28, tzinfo=UTC).timestamp())
    cm_url = (
        "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
        "?assets=btc&metrics=PriceUSD&frequency=1d&paging_from=start&page_size=10000"
        f"&start_time=2011-06-20&end_time=2011-11-29"
    )
    cm = {int(dt.datetime.fromisoformat(r["time"].replace("Z", "+00:00")).timestamp()): float(r["PriceUSD"])
          for r in get_json(cm_url)["data"] if r.get("PriceUSD")}
    t = fill_start
    last_px = by.get(fill_start - 86400, [0, 0, 0, 0, 17.5, 0])[4]
    filled = 0
    while t <= fill_end:
        if t not in by:
            px = cm.get(t)
            if px and px > 0:
                by[t] = [t, last_px, max(last_px, px), min(last_px, px), px, 0.0]
                last_px = px
                filled += 1
        else:
            last_px = by[t][4]
        t += 86400
    print(f"mtgox: filled {filled} missing 2011 days from Coinmetrics PriceUSD")

    # Cut after last real gox day
    rows = [r for r in by.values() if r[0] <= GOX_END]
    return write_market("mtgoxUSD", rows)


def stitch(gox, stamp, coin):
    """Mt. Gox through 2013-12-31, Bitstamp 2014-01-01..2016-12-31, Coinbase from 2017-01-01."""
    rows = [r for r in gox if r[0] <= COMBINED_GOX_END]
    rows += [r for r in stamp if COMBINED_GOX_END < r[0] < COMBINED_COINBASE_START]
    rows += [r for r in coin if r[0] >= COMBINED_COINBASE_START]
    return write_market("combinedUSD", rows)


def main():
    print("Fetching Coinbase…")
    coin = fetch_coinbase()
    print("Fetching Bitstamp…")
    stamp = fetch_bitstamp()
    print("Fetching Mt. Gox…")
    gox = fetch_mtgox()
    print("Stitching combined…")
    comb = stitch(gox, stamp, coin)
    # gap report
    def gaps(name, rows):
        miss = []
        prev = None
        for r in rows:
            if prev and r[0] - prev > 86400:
                miss.append((iso(prev), iso(r[0]), (r[0] - prev) // 86400 - 1))
            prev = r[0]
        print(f"gaps {name}: {len(miss)} " + (", ".join(f"{a}->{b} ({n}d)" for a,b,n in miss[:8]) if miss else "(none)"))
    gaps("mtgoxUSD", gox)
    gaps("bitstampUSD", stamp)
    gaps("coinbaseUSD", coin)
    gaps("combinedUSD", comb)


if __name__ == "__main__":
    main()
