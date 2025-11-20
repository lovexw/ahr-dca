#!/usr/bin/env python3
"""
Generate HTML dashboard for AHR999 Bitcoin investment tracking
"""

import json
from datetime import datetime

def format_number(num):
    """Format number with commas"""
    return f"{num:,.2f}"

def format_btc(num):
    """Format BTC with 8 decimals"""
    return f"{num:.8f}"

def get_ahr999_color(ahr999):
    """Get color based on AHR999 value"""
    if ahr999 is None:
        return '#666'
    elif ahr999 <= 0.45:
        return '#00ff00'  # Bright green - excellent buy
    elif ahr999 <= 0.7:
        return '#7cfc00'  # Green - good buy
    elif ahr999 <= 1.0:
        return '#ffd700'  # Gold - moderate buy
    elif ahr999 <= 1.5:
        return '#ffa500'  # Orange - hold
    else:
        return '#ff4500'  # Red - expensive

def get_ahr999_signal(ahr999):
    """Get investment signal based on AHR999 value"""
    if ahr999 is None:
        return 'N/A'
    elif ahr999 <= 0.45:
        return '🟢 Excellent Buy Zone'
    elif ahr999 <= 0.7:
        return '🟢 Good Buy Zone'
    elif ahr999 <= 1.0:
        return '🟡 Moderate Buy'
    elif ahr999 <= 1.5:
        return '🟠 Hold'
    else:
        return '🔴 Overvalued'

def generate_html(data):
    """Generate HTML dashboard"""
    
    current_price = data['current_price']
    current_ahr999 = data.get('current_ahr999')
    last_updated = data['last_updated']
    summary = data['summary']
    
    ahr999_color = get_ahr999_color(current_ahr999)
    ahr999_signal = get_ahr999_signal(current_ahr999)
    
    # Generate investment cards
    investment_cards = []
    for threshold in sorted([float(k) for k in summary.keys()], reverse=True):
        s = summary[str(threshold)]
        roi_color = '#00ff00' if s['roi'] > 0 else '#ff4500'
        
        # Generate purchase history table
        purchases_html = ''
        if s['purchases']:
            purchases_rows = []
            for p in reversed(s['purchases'][-10:]):  # Show last 10 purchases
                purchases_rows.append(f"""
                <tr>
                    <td>{p['date']}</td>
                    <td>${format_number(p['price'])}</td>
                    <td>{format_btc(p['btc_bought'])} BTC</td>
                    <td>${format_number(p['usd_invested'])}</td>
                    <td>{p['ahr999']:.4f}</td>
                </tr>
                """)
            
            purchases_html = f"""
            <div class="purchases-section">
                <h4>Recent Purchases (Last 10)</h4>
                <div class="table-wrapper">
                    <table class="purchases-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>BTC Price</th>
                                <th>BTC Bought</th>
                                <th>USD Invested</th>
                                <th>AHR999</th>
                            </tr>
                        </thead>
                        <tbody>
                            {''.join(purchases_rows)}
                        </tbody>
                    </table>
                </div>
            </div>
            """ if purchases_rows else '<p class="no-purchases">No purchases yet at this threshold.</p>'
        else:
            purchases_html = '<p class="no-purchases">No purchases yet at this threshold.</p>'
        
        card = f"""
        <div class="investment-card">
            <div class="card-header">
                <h3>AHR999 ≤ {threshold}</h3>
                <span class="threshold-badge" style="background: linear-gradient(135deg, {get_ahr999_color(threshold)}, {get_ahr999_color(threshold)}88);">
                    Threshold: {threshold}
                </span>
            </div>
            <div class="card-stats">
                <div class="stat-row">
                    <div class="stat">
                        <span class="stat-label">Total Purchases</span>
                        <span class="stat-value">{s['purchase_count']}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Total Invested</span>
                        <span class="stat-value">${format_number(s['total_invested'])}</span>
                    </div>
                </div>
                <div class="stat-row">
                    <div class="stat">
                        <span class="stat-label">Total BTC</span>
                        <span class="stat-value">{format_btc(s['total_btc'])}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Current Value</span>
                        <span class="stat-value">${format_number(s['current_value'])}</span>
                    </div>
                </div>
                <div class="stat-row">
                    <div class="stat">
                        <span class="stat-label">Profit/Loss</span>
                        <span class="stat-value" style="color: {roi_color}">${format_number(s['profit'])}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">ROI</span>
                        <span class="stat-value" style="color: {roi_color}; font-size: 1.5rem; font-weight: bold;">{format_number(s['roi'])}%</span>
                    </div>
                </div>
            </div>
            {purchases_html}
        </div>
        """
        investment_cards.append(card)
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bitcoin AHR999 Investment Dashboard</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #0f0f0f 100%);
            color: #f0f0f0;
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        header {{
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, #f7931a 0%, #ff6b00 100%);
            border-radius: 20px;
            margin-bottom: 40px;
            box-shadow: 0 10px 40px rgba(247, 147, 26, 0.3);
        }}
        
        h1 {{
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }}
        
        .subtitle {{
            font-size: 1.2rem;
            opacity: 0.9;
        }}
        
        .current-stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        
        .stat-card {{
            background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(247, 147, 26, 0.2);
        }}
        
        .stat-card h2 {{
            font-size: 1rem;
            color: #f7931a;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }}
        
        .stat-card .value {{
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 10px;
        }}
        
        .stat-card .signal {{
            font-size: 1.1rem;
            padding: 10px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            margin-top: 10px;
        }}
        
        .investment-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }}
        
        .investment-card {{
            background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(247, 147, 26, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }}
        
        .investment-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(247, 147, 26, 0.4);
        }}
        
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid rgba(247, 147, 26, 0.3);
        }}
        
        .card-header h3 {{
            font-size: 1.5rem;
            color: #f7931a;
        }}
        
        .threshold-badge {{
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
        }}
        
        .card-stats {{
            margin-bottom: 25px;
        }}
        
        .stat-row {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
        }}
        
        .stat {{
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 10px;
        }}
        
        .stat-label {{
            display: block;
            font-size: 0.85rem;
            color: #999;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .stat-value {{
            display: block;
            font-size: 1.3rem;
            font-weight: bold;
            color: #f0f0f0;
        }}
        
        .purchases-section {{
            margin-top: 20px;
        }}
        
        .purchases-section h4 {{
            color: #f7931a;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }}
        
        .table-wrapper {{
            overflow-x: auto;
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.3);
        }}
        
        .purchases-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        .purchases-table th,
        .purchases-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid rgba(247, 147, 26, 0.1);
        }}
        
        .purchases-table th {{
            background: rgba(247, 147, 26, 0.2);
            color: #f7931a;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 1px;
        }}
        
        .purchases-table tr:hover {{
            background: rgba(247, 147, 26, 0.1);
        }}
        
        .no-purchases {{
            text-align: center;
            padding: 20px;
            color: #999;
            font-style: italic;
        }}
        
        footer {{
            text-align: center;
            padding: 30px;
            color: #999;
            border-top: 1px solid rgba(247, 147, 26, 0.2);
            margin-top: 40px;
        }}
        
        .last-updated {{
            font-size: 0.9rem;
            color: #f7931a;
        }}
        
        @media (max-width: 768px) {{
            h1 {{
                font-size: 2rem;
            }}
            
            .investment-grid {{
                grid-template-columns: 1fr;
            }}
            
            .stat-row {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>₿ Bitcoin AHR999 Dashboard</h1>
            <p class="subtitle">Systematic Investment Strategy Based on AHR999 Index</p>
        </header>
        
        <div class="current-stats">
            <div class="stat-card">
                <h2>Current BTC Price</h2>
                <div class="value">${format_number(current_price)}</div>
            </div>
            
            <div class="stat-card">
                <h2>AHR999 Index</h2>
                <div class="value" style="color: {ahr999_color}">
                    {format_number(current_ahr999) if current_ahr999 else 'N/A'}
                </div>
                <div class="signal">{ahr999_signal}</div>
            </div>
            
            <div class="stat-card">
                <h2>Strategy Start Date</h2>
                <div class="value" style="font-size: 2rem;">{data['investment_start_date']}</div>
                <div class="signal">$100 USD per buy signal</div>
            </div>
        </div>
        
        <h2 style="text-align: center; margin-bottom: 30px; font-size: 2rem; color: #f7931a;">
            Investment Performance by Threshold
        </h2>
        
        <div class="investment-grid">
            {''.join(investment_cards)}
        </div>
        
        <footer>
            <p class="last-updated">Last Updated: {last_updated}</p>
            <p style="margin-top: 10px;">
                Data updates daily at 1:00 AM Beijing Time (UTC+8)
            </p>
            <p style="margin-top: 20px; font-size: 0.85rem;">
                AHR999 is an investment indicator for Bitcoin. Values ≤ 0.45 indicate excellent buying opportunities,
                while values > 1.5 suggest the price may be overvalued.
            </p>
        </footer>
    </div>
</body>
</html>"""
    
    return html

def main():
    print("Loading AHR999 data...")
    with open('ahr999_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("Generating HTML dashboard...")
    html = generate_html(data)
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print("Dashboard generated: index.html")

if __name__ == '__main__':
    main()
