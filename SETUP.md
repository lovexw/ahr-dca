# Setup Guide · AHR999 定投仪表盘

## 快速开始

### 1. 启用 GitHub Actions

1. 进入仓库 **Settings → Actions → General**
2. 在 "Workflow permissions" 下选择 **Read and write permissions**
3. 保存

### 2. 启用 GitHub Pages

1. 进入 **Settings → Pages**
2. **Build and deployment → Source** 选择 **GitHub Actions**
3. 保存

### 3. 运行工作流

- **自动**：每日北京时间 01:00（17:00 UTC）自动运行
- **手动**：Actions → "Update BTC Price and AHR999 Dashboard" → Run workflow

### 4. 访问仪表盘

首次运行成功后（约 1–2 分钟）：

- GitHub Pages 地址：`https://<你的用户名>.github.io/ahr-dca/`
- 本项目线上地址：<https://dca.btchao.com>（自定义域名托管）

## 页面内容

- **实时指数**：BTC 价格、AHR999 指数与区间、200 日定投成本、指数增长估值、今日信号
- **阈值策略回测**：7 档阈值（≤1.0 ~ ≤0.4），每次 $100，各自独立记账，支持排序与明细查看
- **定投模拟器**：自定义金额 / 区间 / 模式（AHR999 阈值、每月固定日、均线条件、每日定投），实时回测

## 自定义

### 修改更新时间
编辑 `.github/workflows/update-btc-price.yml` 中的 cron（当前 `0 17 * * *` = 北京时间 01:00）。

### 修改定投金额
`calculate_ahr999.py`：
```python
INVESTMENT_AMOUNT = 100
```

### 修改策略起始日期
`calculate_ahr999.py`：
```python
START_DATE = datetime(2025, 10, 6)
```

### 修改阈值列表
`calculate_ahr999.py`（前端展示列表会保持 7 档默认值，需同步修改 `assets/app.js` 中的 `THRESHOLDS`）：
```python
THRESHOLDS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
```

## 本地测试

```bash
pip install -r requirements.txt

python update_btc_price.py     # 抓价格 + 回填缺口
python calculate_ahr999.py     # 计算 AHR999 + 回测 → ahr999_data.json

python3 -m http.server 8000    # 前端需要 HTTP 服务
# 打开 http://localhost:8000/
```

## 排错

| 现象 | 处理 |
|------|------|
| Actions 没有运行 | 检查 Settings → Actions 已启用且具有写权限 |
| Pages 没有部署 | 确认 Pages Source 为 "GitHub Actions"，查看 Actions 日志 |
| 页面显示旧数据 | 手动触发工作流；浏览器强刷（数据文件带 no-cache） |
| 价格抓取失败 | 脚本会依次尝试 CoinGecko / Coinbase / Bitstamp；三源同时失败时退出非零，下次运行会通过缺口回填补齐 |
| 图表空白 | ECharts 走 jsdelivr → unpkg → cdnjs 三路兜底；全部失败时表格与指标仍正常 |

## 安全说明

- 无需任何 API Key，全部使用公开接口
- 只读 API 调用，不存储敏感信息
- 提交均由 github-actions bot 完成
