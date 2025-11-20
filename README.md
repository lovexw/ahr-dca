# Bitcoin AHR999 Investment Dashboard

[![Update BTC Price and AHR999 Dashboard](https://github.com/[YOUR-USERNAME]/[YOUR-REPO]/actions/workflows/update-btc-price.yml/badge.svg)](https://github.com/[YOUR-USERNAME]/[YOUR-REPO]/actions/workflows/update-btc-price.yml)

A comprehensive Bitcoin investment tracking dashboard based on the AHR999 index, featuring automated daily price updates and multi-threshold investment strategy analysis.

## 🎯 Features

- **Automated Daily Updates**: GitHub Actions automatically fetches and updates Bitcoin prices daily at 1:00 AM Beijing Time (UTC+8)
- **AHR999 Index Calculation**: Real-time calculation of the AHR999 investment indicator
- **Multi-Threshold Strategy**: Tracks investment performance across 7 different AHR999 thresholds (≤1.0, ≤0.9, ≤0.8, ≤0.7, ≤0.6, ≤0.5, ≤0.4)
- **Detailed Analytics**: Comprehensive tracking of investments, returns, and performance metrics
- **Beautiful Dashboard**: Elegant Bitcoin-themed UI with real-time data visualization
- **Historical Data**: Complete Bitcoin price history from 2013-04-28 to present

## 📊 What is AHR999?

AHR999 is a popular Bitcoin investment indicator that combines:
- 200-day moving average
- 200-week moving average exponential fit

**Formula**: `AHR999 = (BTC Price / 200-day MA) × (BTC Price / 200-week MA fit)`

**Investment Signals**:
- **≤ 0.45**: 🟢 Excellent buy zone
- **0.45 - 0.7**: 🟢 Good buy zone
- **0.7 - 1.0**: 🟡 Moderate buy
- **1.0 - 1.5**: 🟠 Hold
- **> 1.5**: 🔴 Overvalued

## 🚀 Investment Strategy

Starting from **October 6, 2025**, the system automatically tracks hypothetical $100 USD investments when AHR999 falls below various thresholds. This allows comparison of different entry strategies:

| Threshold | Strategy | Risk Level |
|-----------|----------|------------|
| ≤ 1.0 | Conservative | Low |
| ≤ 0.9 | Moderate | Medium |
| ≤ 0.8 | Aggressive | Medium-High |
| ≤ 0.7 | Very Aggressive | High |
| ≤ 0.6 | Extreme | Very High |
| ≤ 0.5 | Ultra Aggressive | Extreme |
| ≤ 0.4 | Maximum Risk | Maximum |

## 📁 Project Structure

```
.
├── btc-price all.csv           # Historical Bitcoin price data (2013-present)
├── update_btc_price.py         # Script to fetch and update BTC price
├── calculate_ahr999.py         # AHR999 calculation and investment tracking
├── generate_dashboard.py       # HTML dashboard generator
├── ahr999_data.json           # Generated investment data (auto-updated)
├── index.html                 # Dashboard webpage (auto-updated)
├── .github/
│   └── workflows/
│       └── update-btc-price.yml  # GitHub Actions workflow
└── README.md
```

## 🔧 How It Works

### 1. Daily Price Update
Every day at 1:00 AM Beijing Time, the GitHub Actions workflow:
1. Fetches current Bitcoin price from CoinGecko API (with CoinCap fallback)
2. Updates `btc-price all.csv` with the new price
3. Commits changes to the repository

### 2. AHR999 Calculation
The system calculates:
- 200-day moving average from historical prices
- 200-week MA exponential fit: `10^(5.84 × log10(days_since_genesis) - 17.01)`
- AHR999 index for each day

### 3. Investment Tracking
For each threshold, the system tracks:
- Number of purchases made
- Total USD invested
- Total BTC accumulated
- Current portfolio value
- Profit/loss and ROI percentage
- Detailed purchase history

### 4. Dashboard Generation
Creates a beautiful, responsive HTML dashboard showing:
- Current Bitcoin price
- Current AHR999 index with color-coded signals
- Investment performance for all thresholds
- Recent purchase history
- Real-time ROI calculations

## 🌐 View the Dashboard

The dashboard is automatically deployed to GitHub Pages after each update.

**Live Dashboard**: `https://[YOUR-USERNAME].github.io/[YOUR-REPO]/`

## 🛠️ Setup Instructions

### Prerequisites
- Python 3.11+
- Git
- GitHub account

### Installation

1. **Fork or clone this repository**

2. **Enable GitHub Actions**
   - Go to repository Settings → Actions → General
   - Enable "Read and write permissions" for workflows

3. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Source: GitHub Actions
   - Save

4. **Manual trigger (optional)**
   - Go to Actions → Update BTC Price and AHR999 Dashboard
   - Click "Run workflow"

### Local Testing

```bash
# Install dependencies
pip install requests

# Update Bitcoin price
python update_btc_price.py

# Calculate AHR999 and investment data
python calculate_ahr999.py

# Generate dashboard
python generate_dashboard.py

# Open index.html in browser
```

## 📈 Data Sources

- **Bitcoin Prices**: 
  - Primary: [CoinGecko API](https://www.coingecko.com/en/api)
  - Fallback: [CoinCap API](https://coincap.io/)
- **Historical Data**: Pre-loaded from 2013-04-28 to 2025-11-20
- **AHR999 Formula**: Based on Bitcoin community standard

## 🔄 Update Schedule

- **Automated Updates**: Daily at 1:00 AM Beijing Time (17:00 UTC)
- **Manual Updates**: Can be triggered anytime via GitHub Actions
- **Data Persistence**: All updates are committed to the repository

## 📊 Dashboard Features

### Current Statistics
- Real-time Bitcoin price
- Current AHR999 index with color-coded signals
- Investment strategy start date

### Investment Cards (per threshold)
- Total purchases made
- Total amount invested (USD)
- Total Bitcoin accumulated
- Current portfolio value
- Profit/Loss amount
- Return on Investment (ROI %)
- Recent purchase history (last 10 transactions)

### Visual Design
- Bitcoin-themed orange and black color scheme
- Responsive layout for mobile and desktop
- Hover effects and smooth animations
- Color-coded AHR999 signals
- Professional financial dashboard aesthetic

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📝 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This dashboard is for educational and informational purposes only. It does not constitute financial advice. Past performance does not guarantee future results. Always do your own research before making investment decisions.

## 🙏 Credits

- AHR999 indicator concept by the Bitcoin community
- Historical price data aggregated from multiple sources
- Built with Python, GitHub Actions, and pure HTML/CSS

---

**Last Updated**: Auto-updated daily by GitHub Actions

**Star ⭐ this repository if you find it useful!**
