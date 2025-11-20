# Setup Guide for Bitcoin AHR999 Dashboard

## Quick Start

Follow these steps to get your Bitcoin AHR999 Dashboard up and running:

### 1. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click on **Settings** → **Actions** → **General**
3. Under "Workflow permissions", select:
   - ✅ **Read and write permissions**
4. Click **Save**

### 2. Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Under "Build and deployment":
   - **Source**: Select **GitHub Actions**
3. Click **Save**

### 3. Run the Workflow

#### Option A: Automatic (Recommended)
The workflow will automatically run daily at **1:00 AM Beijing Time** (17:00 UTC).

#### Option B: Manual Trigger
1. Go to **Actions** tab
2. Select "Update BTC Price and AHR999 Dashboard"
3. Click **Run workflow**
4. Select branch: `feat/github-action-update-btc-price-ahr999-dashboard` (or your main branch after merging)
5. Click **Run workflow**

### 4. Access Your Dashboard

After the first successful run (takes about 1-2 minutes):

**Your Dashboard URL:**
```
https://[YOUR-USERNAME].github.io/[YOUR-REPO-NAME]/
```

Replace `[YOUR-USERNAME]` and `[YOUR-REPO-NAME]` with your actual GitHub username and repository name.

## What the Dashboard Shows

### Current Statistics
- **Current BTC Price**: Latest Bitcoin price in USD
- **AHR999 Index**: Current investment indicator value with color-coded signal
- **Strategy Start Date**: October 6, 2025 (when tracking began)

### Investment Strategies (7 Thresholds)
The dashboard tracks 7 different investment strategies, each buying $100 USD when AHR999 falls below specific thresholds:

| Threshold | Strategy Type | When to Buy |
|-----------|---------------|-------------|
| ≤ 1.0 | Conservative | AHR999 ≤ 1.0 |
| ≤ 0.9 | Moderate | AHR999 ≤ 0.9 |
| ≤ 0.8 | Aggressive | AHR999 ≤ 0.8 |
| ≤ 0.7 | Very Aggressive | AHR999 ≤ 0.7 |
| ≤ 0.6 | Extreme | AHR999 ≤ 0.6 |
| ≤ 0.5 | Ultra Aggressive | AHR999 ≤ 0.5 |
| ≤ 0.4 | Maximum Risk | AHR999 ≤ 0.4 |

### For Each Strategy, You'll See:
- **Total Purchases**: Number of times the threshold was triggered
- **Total Invested**: Cumulative USD invested
- **Total BTC**: Total Bitcoin accumulated
- **Current Value**: Current worth of BTC holdings
- **Profit/Loss**: Net gain or loss in USD
- **ROI**: Return on investment percentage
- **Purchase History**: Last 10 purchases with details

## Understanding AHR999

**AHR999 Formula:**
```
AHR999 = (BTC Price / 200-day MA) × (BTC Price / 200-week MA fit)
```

**Investment Signals:**
- 🟢 **≤ 0.45**: Excellent buy zone
- 🟢 **0.45 - 0.7**: Good buy zone
- 🟡 **0.7 - 1.0**: Moderate buy
- 🟠 **1.0 - 1.5**: Hold
- 🔴 **> 1.5**: Overvalued

## Customization

### Change Update Time
Edit `.github/workflows/update-btc-price.yml`:
```yaml
schedule:
  # Current: 1:00 AM Beijing Time (17:00 UTC)
  - cron: '0 17 * * *'
```

To change the time, modify the cron expression. Use [crontab.guru](https://crontab.guru) for help.

### Change Investment Amount
Edit `calculate_ahr999.py`, line 35:
```python
investment_amount = 100  # Change to your preferred amount
```

### Change Start Date
Edit `calculate_ahr999.py`, line 12:
```python
START_DATE = datetime(2025, 10, 6)  # Change to your preferred date
```

### Add/Remove Thresholds
Edit `calculate_ahr999.py`, line 34:
```python
thresholds = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]  # Modify this list
```

## Testing Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Update Bitcoin price
python update_btc_price.py

# Calculate AHR999 and generate investment data
python calculate_ahr999.py

# Generate HTML dashboard
python generate_dashboard.py

# Open index.html in your browser
```

## Troubleshooting

### GitHub Actions Not Running
- Check that Actions are enabled in Settings → Actions
- Verify "Read and write permissions" are enabled
- Check the Actions tab for error messages

### GitHub Pages Not Deploying
- Ensure GitHub Pages source is set to "GitHub Actions"
- Wait 2-3 minutes after the workflow completes
- Check the Actions tab for deployment status
- Verify the repository is public (or you have GitHub Pro for private repos)

### Dashboard Shows Old Data
- Check when the last workflow ran in the Actions tab
- Manually trigger the workflow to force an update
- Clear your browser cache and refresh

### Price Update Fails
The script uses two APIs with automatic fallback:
1. Primary: CoinGecko API
2. Fallback: CoinCap API

If both fail, check:
- API rate limits (usually reset after 1 minute)
- Internet connectivity in GitHub Actions
- API status pages

## Support

If you encounter issues:
1. Check the [Actions log](../../actions) for detailed error messages
2. Review the workflow YAML syntax
3. Ensure all Python scripts have execution permissions
4. Verify CSV file format hasn't been corrupted

## Security Notes

- ✅ No API keys required - using public endpoints
- ✅ No sensitive data stored
- ✅ All commits signed by github-actions bot
- ✅ Read-only API calls only

## Next Steps

1. ⭐ Star the repository
2. 🔔 Watch for updates
3. 📊 Monitor your dashboard daily
4. 📈 Compare different threshold strategies
5. 🤝 Share with friends interested in Bitcoin investing

---

**Happy Investing! 🚀₿**
