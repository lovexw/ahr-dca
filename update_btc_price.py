#!/usr/bin/env python3
"""
Update Bitcoin price in btc-price all.csv
Fetches current BTC price and adds it to the CSV file
"""

import csv
import requests
from datetime import datetime
import sys

def get_btc_price():
    """Fetch current Bitcoin price from CoinGecko API"""
    try:
        # Try CoinGecko first
        response = requests.get(
            'https://api.coingecko.com/api/v3/simple/price',
            params={'ids': 'bitcoin', 'vs_currencies': 'usd'},
            timeout=10
        )
        response.raise_for_status()
        price = response.json()['bitcoin']['usd']
        return round(price)
    except Exception as e:
        print(f"CoinGecko failed: {e}, trying backup API...")
        try:
            # Fallback to CoinCap API
            response = requests.get(
                'https://api.coincap.io/v2/assets/bitcoin',
                timeout=10
            )
            response.raise_for_status()
            price = float(response.json()['data']['priceUsd'])
            return round(price)
        except Exception as e2:
            print(f"CoinCap also failed: {e2}")
            sys.exit(1)

def update_csv(price):
    """Update the CSV file with new price data"""
    csv_file = 'btc-price all.csv'
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Read existing data
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    
    # Check if today's data already exists
    if rows and rows[0][0] == today:
        print(f"Updating existing entry for {today}")
        rows[0][1] = str(price)
    else:
        print(f"Adding new entry for {today}")
        rows.insert(0, [today, str(price)])
    
    # Write back to file
    with open(csv_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)
    
    print(f"Successfully updated {csv_file} with price ${price:,} for {today}")

def main():
    print("Fetching Bitcoin price...")
    price = get_btc_price()
    print(f"Current BTC price: ${price:,}")
    
    update_csv(price)

if __name__ == '__main__':
    main()
