#!/usr/bin/env python3
"""
Calculate the AHR999 index and per-threshold DCA backtest data.

Canonical formula (https://ahr999.com):
    AHR999 = (BTC price / 200-day DCA cost) x (BTC price / index growth valuation)

- 200-day DCA cost: average cost of buying $1 worth of BTC every day for the
  last 200 days = 200 / sum(1/p_i).  (Not the simple moving average!)
- Index growth valuation: 10 ** (5.84 * log10(coin_age_days) - 17.01),
  coin age counted from 2009-01-03 with genesis day being day 1.

Output: ahr999_data.json consumed by the frontend (index.html).
"""

import csv
import json
import math
from collections import Counter
from datetime import datetime, timezone

GENESIS_DATE = datetime(2009, 1, 3)
START_DATE = datetime(2025, 10, 6)   # strategy tracking start
THRESHOLDS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
INVESTMENT_AMOUNT = 100              # USD per buy signal
CSV_FILE = 'btc-price all.csv'
OUT_FILE = 'ahr999_data.json'


def read_btc_data():
    """Read BTC price data from CSV, sorted ascending, deduplicated."""
    data = {}
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            date_str = (row.get('date') or '').strip()
            price_str = (row.get('btc price') or '').strip()
            if not date_str or not price_str:
                continue
            try:
                date = datetime.strptime(date_str, '%Y-%m-%d')
                price = float(price_str)
            except ValueError:
                print(f"  ! skipping malformed row: {row}")
                continue
            if price <= 0:
                print(f"  ! skipping non-positive price on {date_str}")
                continue
            data[date] = price  # last occurrence wins on duplicates

    duplicates = Counter()
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row.get('date'):
                duplicates[row['date'].strip()] += 1
    dup = [d for d, c in duplicates.items() if c > 1]
    if dup:
        print(f"  ! duplicate dates found (kept last occurrence): {sorted(dup)}")

    return [{'date': d, 'price': p} for d, p in sorted(data.items())]


def check_gaps(data):
    """Report missing calendar days (the pipeline only warns; it never invents prices)."""
    gaps = []
    for a, b in zip(data, data[1:]):
        delta = (b['date'] - a['date']).days
        if delta > 1:
            gaps.append((a['date'].strftime('%Y-%m-%d'), b['date'].strftime('%Y-%m-%d'), delta - 1))
    if gaps:
        sample = ', '.join(f"{s}..{e}({n}d)" for s, e, n in gaps[:5])
        print(f"  ! {len(gaps)} date gaps in CSV (moving windows skip missing days): {sample}")


def growth_valuation(date):
    """Exponential growth valuation (200-week MA fit), canonical coefficients."""
    age = (date - GENESIS_DATE).days + 1   # genesis day counts as day 1
    return 10 ** (5.84 * math.log10(age) - 17.01)


def build_history(data):
    """Compute rolling 200-day DCA cost, valuation and AHR999 for every day.

    Sliding-window over reciprocals keeps this O(n).
    Returns list of rows: {date, price, cost200, fit, ahr999}.
    """
    WINDOW = 200
    rows = []
    recip_sum = 0.0
    for i, item in enumerate(data):
        recip_sum += 1.0 / item['price']
        if i >= WINDOW:
            recip_sum -= 1.0 / data[i - WINDOW]['price']
        if i < WINDOW - 1:
            continue
        cost200 = WINDOW / recip_sum
        fit = growth_valuation(item['date'])
        rows.append({
            'date': item['date'],
            'price': item['price'],
            'cost200': cost200,
            'fit': fit,
            'ahr999': (item['price'] / cost200) * (item['price'] / fit),
        })
    return rows


def backtest_strategy(history):
    """$100 buy on every day where AHR999 <= threshold, from START_DATE on."""
    strategies = {t: {'purchases': [], 'total_invested': 0.0, 'total_btc': 0.0}
                  for t in THRESHOLDS}
    for row in history:
        if row['date'] < START_DATE:
            continue
        for t in THRESHOLDS:
            if row['ahr999'] <= t:
                btc = INVESTMENT_AMOUNT / row['price']
                s = strategies[t]
                s['purchases'].append({
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'price': round(row['price'], 2),
                    'btc_bought': round(btc, 10),
                    'usd_invested': INVESTMENT_AMOUNT,
                    'ahr999': round(row['ahr999'], 4),
                })
                s['total_invested'] += INVESTMENT_AMOUNT
                s['total_btc'] += btc
    return strategies


def build_summary(strategies, current_price):
    summary = {}
    for t in THRESHOLDS:
        s = strategies[t]
        invested, btc = s['total_invested'], s['total_btc']
        current_value = btc * current_price
        profit = current_value - invested
        purchases = s['purchases']
        summary[str(t)] = {
            'threshold': t,
            'purchase_count': len(purchases),
            'total_invested': round(invested, 2),
            'total_btc': round(btc, 8),
            'avg_cost': round(invested / btc, 2) if btc > 0 else None,
            'current_value': round(current_value, 2),
            'profit': round(profit, 2),
            'roi': round(profit / invested * 100, 2) if invested > 0 else 0.0,
            'first_purchase': purchases[0]['date'] if purchases else None,
            'last_purchase': purchases[-1]['date'] if purchases else None,
            'purchases': purchases,
        }
    return summary


def main():
    print("Reading Bitcoin price data...")
    data = read_btc_data()
    if len(data) < 200:
        print("Need at least 200 days of data, aborting.")
        return
    check_gaps(data)
    print(f"Data range: {data[0]['date']:%Y-%m-%d} -> {data[-1]['date']:%Y-%m-%d} ({len(data)} days)")

    print("Calculating AHR999 index (200-day DCA cost method)...")
    history = build_history(data)
    last = history[-1]
    current_date, current_price = last['date'], last['price']

    print("Backtesting threshold strategies...")
    strategies = backtest_strategy(history)
    summary = build_summary(strategies, current_price)

    output = {
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'last_updated': current_date.strftime('%Y-%m-%d'),
        'current_price': round(current_price, 2),
        'current_ahr999': round(last['ahr999'], 4),
        'current_cost200': round(last['cost200'], 2),
        'current_fit': round(last['fit'], 2),
        'investment_start_date': START_DATE.strftime('%Y-%m-%d'),
        'investment_amount': INVESTMENT_AMOUNT,
        'thresholds': THRESHOLDS,
        'summary': summary,
        # Full history, columnar (from the first day the 200-day cost exists).
        'history': {
            'date': [r['date'].strftime('%Y-%m-%d') for r in history],
            'price': [round(r['price'], 2) for r in history],
            'cost200': [round(r['cost200'], 2) for r in history],
            'fit': [round(r['fit'], 2) for r in history],
            'ahr999': [round(r['ahr999'], 4) for r in history],
        },
    }

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, separators=(',', ':'), ensure_ascii=False)

    print(f"\nCurrent date: {current_date:%Y-%m-%d}")
    print(f"Current BTC price: ${current_price:,.2f}")
    print(f"200-day DCA cost: ${last['cost200']:,.2f}")
    print(f"Growth valuation: ${last['fit']:,.2f}")
    print(f"Current AHR999: {last['ahr999']:.4f}")

    print("\n" + "=" * 60)
    print("INVESTMENT SUMMARY (each buy = $100)")
    print("=" * 60)
    for t in sorted(THRESHOLDS, reverse=True):
        s = summary[str(t)]
        print(f"\nAHR999 <= {t}")
        print(f"  Purchases: {s['purchase_count']}  ({s['first_purchase']} -> {s['last_purchase']})")
        print(f"  Total Invested: ${s['total_invested']:,.0f}   BTC: {s['total_btc']:.8f}")
        print(f"  Avg cost: ${s['avg_cost']:,.2f}   Current value: ${s['current_value']:,.2f}")
        print(f"  Profit: ${s['profit']:,.2f}   ROI: {s['roi']:.2f}%")

    print(f"\nData saved to {OUT_FILE}")


if __name__ == '__main__':
    main()
