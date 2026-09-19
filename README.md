# ₿ AHR999 定投仪表盘

[![Update BTC Price and AHR999 Dashboard](https://github.com/lovexw/ahr-dca/actions/workflows/update-btc-price.yml/badge.svg)](https://github.com/lovexw/ahr-dca/actions/workflows/update-btc-price.yml)

**在线访问：<https://dca.btchao.com>**

基于 AHR999 指数的比特币定投（DCA）仪表盘：实时指数与区间信号、多阈值策略回测、可交互定投模拟器，全部计算在浏览器本地完成，数据每日由 GitHub Actions 自动更新。

## ✨ 功能

- **实时指数**：BTC 价格、AHR999 指数（含区间定位）、200 日定投成本、指数增长估值、今日各阈值触发信号
- **历史走势**：价格 / 定投成本 / 指数估值（对数坐标可选）+ AHR999 区间着色子图，支持 1/3/5 年与全区间切换、自由缩放
- **阈值策略回测**：7 档阈值（≤1.0 ~ ≤0.4）各自"每日 $100"的收益对比，可排序，点击查看全部买入记录与资产曲线
- **定投模拟器**：自定义金额与时间范围，支持 4 种模式（AHR999 阈值 / 每月固定日 / 均线条件 / 每日定投），实时重算，并给出与"每日定投"基准的超额收益、平均成本、最大回撤
- **深浅色主题**、响应式布局、加载骨架与数字动画；图表库（ECharts）带三路 CDN 兜底，加载失败时表格与指标仍可用

## 📊 AHR999 是什么

AHR999 是社区广泛使用的比特币定投指标（[作者官方页面](https://ahr999.com)）：

```
AHR999 = (比特币价格 / 200日定投成本) × (比特币价格 / 指数增长估值)
```

- **200 日定投成本**：过去 200 天每天定投 $1 的平均持仓成本 `= 200 / Σ(1/pᵢ)`（注意不是 200 日均线）
- **指数增长估值**：`10^(5.84 × log₁₀(币龄) − 17.01)`，币龄自创世区块（2009-01-03）起算，创世当日为第 1 天

**区间含义**：

| 区间 | 含义 |
|------|------|
| AHR999 < 0.45 | 🟢 抄底区（历史上仅约 8.5% 的时间） |
| 0.45 ≤ AHR999 ≤ 1.2 | 🟠 定投区（约 46.3% 的时间） |
| AHR999 > 1.2 | 🔴 等待区，价格偏贵 |

## 🚀 阈值策略回测

自 **2025-10-06** 起，系统回测 7 档阈值策略：当日 AHR999 ≤ 阈值即买入 $100，各策略独立记账，用于对比不同严格程度的买点选择：

| 阈值 | 风格 |
|------|------|
| ≤ 1.0 | 宽松：整个定投区都买 |
| ≤ 0.9 ~ ≤ 0.6 | 逐步收紧，只在更深回调时买 |
| ≤ 0.5 / ≤ 0.4 | 极严格：只在深度低估时买 |

## 🏗 架构

```
.
├── index.html                        # 前端单页应用（静态，无构建步骤）
├── assets/
│   ├── styles.css                    # 设计系统（深/浅主题）
│   └── app.js                        # 数据加载、公式、图表与模拟器逻辑
├── update_btc_price.py               # 抓取当日价格 + 回填近一年缺口（多数据源容错）
├── calculate_ahr999.py               # 计算 AHR999 全量历史 + 各阈值回测 → ahr999_data.json
├── ahr999_data.json                  # 前端数据（全量历史 + 汇总，约 400KB）
├── btc-price all.csv                 # 每日价格源（2013-04-28 至今，无价格时前端可回退此文件计算）
├── .github/workflows/update-btc-price.yml
├── README.md / SETUP.md
```

数据流：**GitHub Actions（每日 17:00 UTC = 北京时间 01:00）→ 抓价格 & 回填缺口 → 计算 AHR999 与回测 → 提交 JSON/CSV → 部署静态站**。

前端优先加载 `ahr999_data.json`；若不可用（如在别的仓库部署），自动回退为解析同目录 `btc-price all.csv` 并在浏览器内用同一套公式计算，保证任何静态托管下都能工作。

## 🛠 本地运行

```bash
pip install -r requirements.txt

python update_btc_price.py    # 更新价格（含缺口回填）
python calculate_ahr999.py    # 重新计算 AHR999 与回测

# 前端需要 HTTP 服务（fetch 不支持 file:// 协议）
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

## 🌐 部署

- **GitHub Pages**：仓库已内置工作流，每日自动构建 `dist/` 并部署（Settings → Pages → Source: GitHub Actions）。
- **自定义域名（如 dca.btchao.com）**：可接入 Cloudflare Pages 等静态托管，指向仓库根目录即可；站点完全自包含（HTML + 资产 + 数据），无需构建环境。

## 📈 数据来源

- **当日价格**：CoinGecko → Coinbase → Bitstamp（三源自动容错）
- **缺口回填**：CoinGecko 历史区间 API（近 365 天内缺失日期自动补齐）
- **历史数据**：2013-04-28 起的每日价格快照（UTC 日期标记）

## 🔄 更新频率

- 每日北京时间 01:00 自动更新（可在 workflow 中修改 cron）
- 支持在 Actions 页面手动触发

## 🤝 贡献

欢迎提 Issue 与 PR：报错、建议、改进文档、优化前端交互均可。

## 📝 License

MIT

## ⚠️ 免责声明

本站仅供学习与信息参考，不构成任何投资建议。历史表现不代表未来收益，投资有风险，决策需谨慎（DYOR）。

## 🔗 相关站点

- **比特囤币主站**：<https://www.btchao.com> —— 比特币导航与工具集（链上查询、汇率、白皮书、冷钱包教程、AHR999 定投指数等）
- 小吴乐意：<https://www.xiaowuleyi.com/>
- GitHub：<https://github.com/lovexw/ahr-dca>

---

⭐ 如果这个项目对你有帮助，欢迎 Star！
