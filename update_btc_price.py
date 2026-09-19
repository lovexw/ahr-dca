#!/usr/bin/env python3
"""
Update Bitcoin prices in 'btc-price all.csv'.

1. Fetch today's BTC/USD spot price from the first working free API
   (CoinGecko -> Coinbase -> Bitstamp).
2. Backfill missing calendar days inside the last 365 days using the
   CoinGecko market range API (best effort; skipped on failure).
3. Rewrite the CSV newest-first (the existing file convention).

Dates are recorded by UTC calendar date, matching the daily 17:00 UTC run.
"""

import csv
import sys
import time
from datetime import date, datetime, timedelta, timezone

import requests

CSV_FILE = 'btc-price all.csv'
HEADERS = ['date', 'btc price']
UA = {'User-Agent': 'ahr-dca-updater/2.0 (+https://github.com/lovexw/ahr-dca)'}


def get_json(url, params=None, tries=3, timeout=15):
    last_err = None
    for attempt in range(tries):
        try:
            resp = requests.get(url, params=params, timeout=timeout, headers=UA)
            resp.raise_for_status()
            return resp.json()
        except Exception as err:  # noqa: BLE001 - report and retry
            last_err = err
            time.sleep(2 * (attempt + 1))
    raise last_err


def fetch_price():
    """Return today's BTC/USD price from the first working source."""
    sources = [
        ('CoinGecko',
         'https://api.coingecko.com/api/v3/simple/price',
         {'ids': 'bitcoin', 'vs_currencies': 'usd'},
         lambda d: float(d['bitcoin']['usd'])),
        ('Coinbase',
         'https://api.coinbase.com/v2/prices/BTC-USD/spot',
         None,
         lambda d: float(d['data']['amount'])),
        ('Bitstamp',
         'https://www.bitstamp.net/api/v2/ticker/btcusd/',
         None,
         lambda d: float(d['last'])),
    ]
    for name, url, params, extract in sources:
        try:
            price = extract(get_json(url, params))
            if price > 0:
                return price, name
        except Exception as err:  # noqa: BLE001 - try next source
            print(f"{name} failed: {err}")
    print("All price sources failed.")
    sys.exit(1)


def load_rows():
    """Read CSV -> (rows newest-first as [date_str, price_str], set of dates)."""
    with open(CSV_FILE, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        next(reader, None)  # header
        rows = [[r[0].strip(), r[1].strip()] for r in reader if r and r[0].strip()]
    return rows, {r[0] for r in rows}


def save_rows(rows):
    """Write rows newest-first."""
    rows = sorted(rows, key=lambda r: r[0], reverse=True)
    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(HEADERS)
        writer.writerows(rows)


def fetch_history_range(start, end):
    """Fetch daily BTC/USD prices for [start, end] from CoinGecko -> {date: price}."""
    url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range'
    params = {
        'vs_currency': 'usd',
        'from': int(datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc).timestamp()),
        'to': int(datetime.combine(end, datetime.min.time(), tzinfo=timezone.utc).timestamp()),
    }
    data = get_json(url, params)
    daily = {}
    for ts, price in data.get('prices', []):
        day = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).date()
        daily[day] = price  # keep the last tick of each UTC day
    return daily


def backfill_gaps(rows, known_dates):
    """Fill missing days within the last 365 days. Returns updated (rows, dates)."""
    today = datetime.now(timezone.utc).date()
    year_ago = today - timedelta(days=365)
    dates = sorted(datetime.strptime(d, '%Y-%m-%d').date() for d in known_dates)

    missing = []
    for prev, nxt in zip(dates, dates[1:]):
        d = prev + timedelta(days=1)
        while d < nxt:
            if d >= year_ago:
                missing.append(d)
            d += timedelta(days=1)

    if not missing:
        print("No backfillable gaps in the last 365 days.")
        return rows, known_dates

    print(f"Found {len(missing)} missing day(s) in the last year: "
          f"{missing[0]} .. {missing[-1]}")
    try:
        daily = fetch_history_range(missing[0], missing[-1])
    except Exception as err:  # noqa: BLE001 - backfill is best effort
        print(f"Backfill skipped (history API unavailable): {err}")
        return rows, known_dates

    added = []
    for day in missing:
        if day in daily:
            rows.append([day.strftime('%Y-%m-%d'), f"{daily[day]:.2f}"])
            known_dates.add(day.strftime('%Y-%m-%d'))
            added.append(day)
    print(f"Backfilled {len(added)} day(s).")
    return rows, known_dates


def main():
    print("Fetching current Bitcoin price...")
    price, source = fetch_price()
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    print(f"BTC/USD ${price:,.2f} (via {source}, date {today})")

    rows, known_dates = load_rows()

    if today in known_dates:
        print(f"Updating existing entry for {today}")
        for row in rows:
            if row[0] == today:
                row[1] = f"{price:.2f}"
    else:
        print(f"Adding new entry for {today}")
        rows.append([today, f"{price:.2f}"])
        known_dates.add(today)

    rows, known_dates = backfill_gaps(rows, known_dates)
    save_rows(rows)
    print(f"Successfully updated {CSV_FILE} ({len(rows)} rows, newest first).")


if __name__ == '__main__':
    main()
