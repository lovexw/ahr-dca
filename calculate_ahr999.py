#!/usr/bin/env python3
"""
Calculate AHR999 index and generate investment tracking data
AHR999 = (BTC Price / 200-day MA) * (BTC Price / 200-week MA fit)
"""

import csv
import json
import math
from datetime import datetime, timedelta
from collections import defaultdict

# Bitcoin genesis date
GENESIS_DATE = datetime(2009, 1, 3)
START_DATE = datetime(2025, 10, 6)

def read_btc_data():
    """Read BTC price data from CSV"""
    data = []
    with open('btc-price all.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['date'] and row['btc price']:
                date = datetime.strptime(row['date'], '%Y-%m-%d')
                price = float(row['btc price'])
                data.append({'date': date, 'price': price})
    # Sort by date ascending
    data.sort(key=lambda x: x['date'])
    return data

def calculate_200d_ma(data, index):
    """Calculate 200-day moving average"""
    if index < 199:
        return None
    prices = [data[i]['price'] for i in range(index - 199, index + 1)]
    return sum(prices) / len(prices)

def calculate_200w_ma_fit(date):
    """Calculate 200-week MA exponential fit"""
    days_since_genesis = (date - GENESIS_DATE).days
    if days_since_genesis <= 0:
        return None
    # AHR999 formula: 10^(5.84*log10(days) - 17.01)
    return 10 ** (5.84 * math.log10(days_since_genesis) - 17.01)

def calculate_ahr999(price, ma_200d, ma_200w_fit):
    """Calculate AHR999 index"""
    if ma_200d is None or ma_200d == 0 or ma_200w_fit is None or ma_200w_fit == 0:
        return None
    return (price / ma_200d) * (price / ma_200w_fit)

def generate_investment_data(data):
    """Generate investment tracking data for different AHR999 thresholds"""
    thresholds = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
    investment_amount = 100  # USD per purchase
    
    # Initialize tracking for each threshold
    investments = {}
    for threshold in thresholds:
        investments[threshold] = {
            'purchases': [],
            'total_invested': 0,
            'total_btc': 0
        }
    
    # Calculate AHR999 for each day and track investments
    results = []
    for i, item in enumerate(data):
        date = item['date']
        price = item['price']
        
        # Only calculate if we have enough data
        ma_200d = calculate_200d_ma(data, i)
        ma_200w_fit = calculate_200w_ma_fit(date)
        ahr999 = calculate_ahr999(price, ma_200d, ma_200w_fit)
        
        # Track investments from START_DATE onwards
        if date >= START_DATE and ahr999 is not None:
            for threshold in thresholds:
                if ahr999 <= threshold:
                    btc_bought = investment_amount / price
                    investments[threshold]['purchases'].append({
                        'date': date.strftime('%Y-%m-%d'),
                        'price': price,
                        'btc_bought': btc_bought,
                        'usd_invested': investment_amount,
                        'ahr999': ahr999
                    })
                    investments[threshold]['total_invested'] += investment_amount
                    investments[threshold]['total_btc'] += btc_bought
        
        if ahr999 is not None:
            results.append({
                'date': date.strftime('%Y-%m-%d'),
                'price': price,
                'ma_200d': ma_200d,
                'ma_200w_fit': ma_200w_fit,
                'ahr999': ahr999
            })
    
    return results, investments

def calculate_current_value(investments, current_price):
    """Calculate current value and returns for each threshold"""
    summary = {}
    for threshold, data in investments.items():
        total_btc = data['total_btc']
        total_invested = data['total_invested']
        current_value = total_btc * current_price
        profit = current_value - total_invested
        roi = (profit / total_invested * 100) if total_invested > 0 else 0
        
        summary[threshold] = {
            'threshold': threshold,
            'purchase_count': len(data['purchases']),
            'total_invested': total_invested,
            'total_btc': total_btc,
            'current_value': current_value,
            'profit': profit,
            'roi': roi,
            'purchases': data['purchases']
        }
    
    return summary

def main():
    print("Reading Bitcoin price data...")
    data = read_btc_data()
    
    if not data:
        print("No data available")
        return
    
    print(f"Data range: {data[0]['date'].strftime('%Y-%m-%d')} to {data[-1]['date'].strftime('%Y-%m-%d')}")
    print(f"Total days: {len(data)}")
    
    print("\nCalculating AHR999 index...")
    results, investments = generate_investment_data(data)
    
    # Get current price
    current_price = data[-1]['price']
    current_date = data[-1]['date']
    current_ahr999 = results[-1]['ahr999'] if results else None
    
    print(f"\nCurrent date: {current_date.strftime('%Y-%m-%d')}")
    print(f"Current BTC price: ${current_price:,.2f}")
    if current_ahr999:
        print(f"Current AHR999: {current_ahr999:.4f}")
    
    # Calculate summary
    summary = calculate_current_value(investments, current_price)
    
    # Save results
    output = {
        'last_updated': current_date.strftime('%Y-%m-%d %H:%M:%S'),
        'current_price': current_price,
        'current_ahr999': current_ahr999,
        'investment_start_date': START_DATE.strftime('%Y-%m-%d'),
        'summary': summary,
        'ahr999_history': results[-365:] if len(results) > 365 else results  # Last year of data
    }
    
    with open('ahr999_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("INVESTMENT SUMMARY")
    print("="*60)
    for threshold in sorted(summary.keys(), reverse=True):
        s = summary[threshold]
        print(f"\nAHR999 ≤ {threshold}")
        print(f"  Purchases: {s['purchase_count']}")
        print(f"  Total Invested: ${s['total_invested']:,.2f}")
        print(f"  Total BTC: {s['total_btc']:.8f}")
        print(f"  Current Value: ${s['current_value']:,.2f}")
        print(f"  Profit/Loss: ${s['profit']:,.2f}")
        print(f"  ROI: {s['roi']:.2f}%")
    
    print(f"\nData saved to ahr999_data.json")

if __name__ == '__main__':
    main()
