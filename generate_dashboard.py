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
        return '不适用'
    elif ahr999 <= 0.45:
        return '🟢 极佳买入区'
    elif ahr999 <= 0.7:
        return '🟢 良好买入区'
    elif ahr999 <= 1.0:
        return '🟡 适度买入'
    elif ahr999 <= 1.5:
        return '🟠 持有观望'
    else:
        return '🔴 价格偏高'

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
                <h4>近期买入记录（最近10次）</h4>
                <div class="table-wrapper">
                    <table class="purchases-table">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>比特币价格</th>
                                <th>买入数量</th>
                                <th>投资金额</th>
                                <th>AHR999</th>
                            </tr>
                        </thead>
                        <tbody>
                            {''.join(purchases_rows)}
                        </tbody>
                    </table>
                </div>
            </div>
            """ if purchases_rows else '<p class="no-purchases">该阈值下暂无买入记录</p>'
        else:
            purchases_html = '<p class="no-purchases">该阈值下暂无买入记录</p>'
        
        card = f"""
        <div class="investment-card">
            <div class="card-header">
                <h3>AHR999 ≤ {threshold}</h3>
                <span class="threshold-badge" style="background: linear-gradient(135deg, {get_ahr999_color(threshold)}, {get_ahr999_color(threshold)}88); color: white;">
                    阈值：{threshold}
                </span>
            </div>
            <div class="card-stats">
                <div class="stat-row">
                    <div class="stat">
                        <span class="stat-label">买入次数</span>
                        <span class="stat-value">{s['purchase_count']}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">累计投资</span>
                        <span class="stat-value">${format_number(s['total_invested'])}</span>
                    </div>
                </div>
                <div class="stat-row">
                    <div class="stat">
                        <span class="stat-label">比特币总量</span>
                        <span class="stat-value">{format_btc(s['total_btc'])}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">当前市值</span>
                        <span class="stat-value">${format_number(s['current_value'])}</span>
                    </div>
                </div>
                <div class="stat-row">
                    <div class="stat">
                        <span class="stat-label">盈亏</span>
                        <span class="stat-value" style="color: {roi_color}">${format_number(s['profit'])}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">投资回报率</span>
                        <span class="stat-value" style="color: {roi_color}; font-size: 1.5rem; font-weight: bold;">{format_number(s['roi'])}%</span>
                    </div>
                </div>
            </div>
            {purchases_html}
        </div>
        """
        investment_cards.append(card)
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>比特币 AHR999 投资仪表板</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            background-color: #FAFAFA;
            color: #222222;
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
            background: #FFFFFF;
            border-radius: 20px;
            margin-bottom: 40px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 2px solid #FF9900;
        }}
        
        h1 {{
            font-size: 3rem;
            margin-bottom: 10px;
            color: #1A1A1A;
        }}
        
        .subtitle {{
            font-size: 1.2rem;
            color: #555555;
        }}
        
        .current-stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        
        .stat-card {{
            background: #FFFFFF;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            border: 1px solid #E0E0E0;
        }}
        
        .stat-card h2 {{
            font-size: 1rem;
            color: #FF9900;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 600;
        }}
        
        .stat-card .value {{
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1A1A1A;
        }}
        
        .stat-card .signal {{
            font-size: 1.1rem;
            padding: 10px;
            background: #FFF6E5;
            border-radius: 8px;
            margin-top: 10px;
            color: #222222;
        }}
        
        .investment-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }}
        
        .investment-card {{
            background: #FFFFFF;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            border: 1px solid #E0E0E0;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }}
        
        .investment-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 4px 16px rgba(255, 153, 0, 0.15);
        }}
        
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #FF9900;
        }}
        
        .card-header h3 {{
            font-size: 1.5rem;
            color: #FF9900;
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
            background: #FAFAFA;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #E0E0E0;
        }}
        
        .stat-label {{
            display: block;
            font-size: 0.85rem;
            color: #666666;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .stat-value {{
            display: block;
            font-size: 1.3rem;
            font-weight: bold;
            color: #1A1A1A;
        }}
        
        .purchases-section {{
            margin-top: 20px;
        }}
        
        .purchases-section h4 {{
            color: #FF9900;
            margin-bottom: 15px;
            font-size: 1.1rem;
            font-weight: 600;
        }}
        
        .table-wrapper {{
            overflow-x: auto;
            border-radius: 10px;
            background: #FAFAFA;
            border: 1px solid #E0E0E0;
        }}
        
        .purchases-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        .purchases-table th,
        .purchases-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #E0E0E0;
        }}
        
        .purchases-table th {{
            background: #FFF6E5;
            color: #FF9900;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 1px;
        }}
        
        .purchases-table td {{
            color: #222222;
        }}
        
        .purchases-table tr:hover {{
            background: #FFF6E5;
        }}
        
        .no-purchases {{
            text-align: center;
            padding: 20px;
            color: #666666;
            font-style: italic;
        }}
        
        footer {{
            text-align: center;
            padding: 30px;
            color: #666666;
            border-top: 1px solid #E0E0E0;
            margin-top: 40px;
        }}
        
        .last-updated {{
            font-size: 0.9rem;
            color: #FF9900;
            font-weight: 600;
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
            <h1>₿ 比特币 AHR999 投资仪表板</h1>
            <p class="subtitle">基于 AHR999 指标的系统化投资策略</p>
        </header>
        
        <div class="current-stats">
            <div class="stat-card">
                <h2>当前比特币价格</h2>
                <div class="value">${format_number(current_price)}</div>
            </div>
            
            <div class="stat-card">
                <h2>AHR999 指数</h2>
                <div class="value" style="color: {ahr999_color}">
                    {format_number(current_ahr999) if current_ahr999 else '不适用'}
                </div>
                <div class="signal">{ahr999_signal}</div>
            </div>
            
            <div class="stat-card">
                <h2>策略开始日期</h2>
                <div class="value" style="font-size: 2rem;">{data['investment_start_date']}</div>
                <div class="signal">每次买入信号 $100 美元</div>
            </div>
        </div>
        
        <h2 style="text-align: center; margin-bottom: 30px; font-size: 2rem; color: #FF9900;">
            各阈值投资表现
        </h2>
        
        <div class="investment-grid">
            {''.join(investment_cards)}
        </div>
        
        <footer>
            <p class="last-updated">最后更新时间：{last_updated}</p>
            <p style="margin-top: 10px; color: #555555;">
                数据每天北京时间凌晨 1:00 自动更新（UTC+8）
            </p>
            <p style="margin-top: 20px; font-size: 0.85rem; color: #666666;">
                AHR999 是比特币投资指标。数值 ≤ 0.45 表示极佳买入机会，
                数值 > 1.5 表示价格可能偏高。
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
