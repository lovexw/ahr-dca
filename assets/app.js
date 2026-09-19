/* ============================================================
   AHR999 定投仪表盘 · app.js
   数据加载（JSON 优先 / CSV 兜底，客户端计算与 Python 管线公式一致）
   ============================================================ */
'use strict';

/* ---------------- 小工具 ---------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfPct = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtUsd = (n) => '$' + nf0.format(n);
const fmtUsd2 = (n) => '$' + nf2.format(n);
const fmtPct = (n) => nfPct.format(n) + '%';
const fmtBtc = (n) => n.toFixed(8);
const fmtAhr = (n) => n.toFixed(4);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}

function countUp(el, value, fmtFn) {
  const from = parseFloat(el.dataset.v || '0');
  el.dataset.v = value;
  if (REDUCED || isNaN(value)) { el.textContent = fmtFn(value); return; }
  const dur = 650, t0 = performance.now();
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtFn(from + (value - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------------- 常量 ---------------- */
const GENESIS_MS = Date.UTC(2009, 0, 3);
const STRATEGY_START = '2025-10-06';
const THRESHOLDS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
const INVEST_AMOUNT = 100;
const DAY_MS = 86400000;

function zoneOf(ahr) {
  if (ahr == null) return { cls: 'z2', name: '—' };
  if (ahr <= 0.45) return { cls: 'z1', name: '抄底区' };
  if (ahr <= 1.2) return { cls: 'z2', name: '定投区' };
  return { cls: 'z3', name: '等待区' };
}

/* ============================================================
   数据层
   ============================================================ */
let D = null;          // 全局数据集
let dataReady = false; // 数据是否就绪
const charts = {};     // echarts 实例

/* echarts 加载器：无论 CDN 脚本何时就绪（甚至早于本脚本执行），都只会经过这条 Promise */
const echartsLoaded = new Promise((resolve) => {
  if (window.echarts) { resolve(true); return; }
  window.addEventListener('echarts-ready', () => resolve(true), { once: true });
  window.addEventListener('echarts-failed', () => resolve(false), { once: true });
});

/* --- 与 Python 管线一致的公式 --- */
function growthValuation(dateStr) {
  const days = Math.floor((Date.parse(dateStr + 'T00:00:00Z') - GENESIS_MS) / DAY_MS) + 1;
  return Math.pow(10, 5.84 * Math.log10(days) - 17.01);
}

function computeAhrSeries(dates, prices) {
  const n = dates.length, W = 200;
  const cost = new Array(n).fill(null), ahr = new Array(n).fill(null), fit = new Array(n).fill(null);
  let recip = 0;
  for (let i = 0; i < n; i++) {
    recip += 1 / prices[i];
    if (i >= W) recip -= 1 / prices[i - W];
    if (i < W - 1) continue;
    fit[i] = growthValuation(dates[i]);
    cost[i] = W / recip;
    ahr[i] = (prices[i] / cost[i]) * (prices[i] / fit[i]);
  }
  return { cost, fit, ahr };
}

function backtest(dates, prices, ahr, start = STRATEGY_START, amount = INVEST_AMOUNT, thresholds = THRESHOLDS) {
  const strategies = thresholds.map((t) => ({
    threshold: t, purchases: [], invested: 0, btc: 0,
  }));
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] < start || ahr[i] == null) continue;
    for (const s of strategies) {
      if (ahr[i] <= s.threshold) {
        s.purchases.push({ date: dates[i], price: prices[i], btc: amount / prices[i], ahr: ahr[i] });
        s.invested += amount;
        s.btc += amount / prices[i];
      }
    }
  }
  const lastPrice = prices[prices.length - 1];
  return strategies.map((s) => {
    const value = s.btc * lastPrice;
    return {
      threshold: s.threshold,
      count: s.purchases.length,
      invested: s.invested,
      btc: s.btc,
      avgCost: s.btc > 0 ? s.invested / s.btc : null,
      value,
      profit: value - s.invested,
      roi: s.invested > 0 ? (value - s.invested) / s.invested * 100 : 0,
      first: s.purchases.length ? s.purchases[0].date : null,
      last: s.purchases.length ? s.purchases[s.purchases.length - 1].date : null,
      purchases: s.purchases,
    };
  });
}

function buildDataset(dates, prices, cost, fit, ahr, meta) {
  const priceMap = new Map(), ahrMap = new Map(), idx = new Map();
  dates.forEach((d, i) => { priceMap.set(d, prices[i]); idx.set(d, i); if (ahr[i] != null) ahrMap.set(d, ahr[i]); });
  const lastIdx = dates.length - 1;
  return Object.assign({
    dates, prices, cost, fit, ahr,
    firstDate: dates[0], lastDate: dates[lastIdx],
    priceMap, ahrMap, idx,
    current: {
      price: prices[lastIdx],
      ahr: ahr[lastIdx],
      cost: cost[lastIdx],
      fit: fit[lastIdx],
      prevPrice: lastIdx > 0 ? prices[lastIdx - 1] : null,
    },
  }, meta);
}

/* JSON 汇总里的键是 '1.0' 这种一位小数字符串，toFixed(1) 保证对上（String(1.0) === '1' 是个坑） */
function summaryKey(j, t) {
  return j.summary[t.toFixed(1)] !== undefined ? j.summary[t.toFixed(1)] : j.summary[String(t)];
}

function datasetFromJson(j) {
  const h = j.history;
  const dates = h.date.slice(), prices = h.price;
  let strategies;
  if (j.summary) {
    strategies = THRESHOLDS.slice().sort((a, b) => b - a).map((t) => {
      const s = summaryKey(j, t) || {};
      return {
        threshold: t,
        count: s.purchase_count || 0,
        invested: s.total_invested || 0,
        btc: s.total_btc || 0,
        avgCost: s.avg_cost || (s.total_btc ? s.total_invested / s.total_btc : null),
        value: s.current_value || 0,
        profit: s.profit || 0,
        roi: s.roi || 0,
        first: s.first_purchase || null,
        last: s.last_purchase || null,
        purchases: (s.purchases || []).map((p) => ({ date: p.date, price: p.price, btc: p.btc_bought, ahr: p.ahr999 })),
      };
    });
  } else {
    const { ahr } = computeAhrSeries(dates, prices);
    strategies = backtest(dates, prices, ahr);
  }
  const meta = {
    lastUpdated: j.last_updated,
    generatedAt: j.generated_at || null,
    investment: {
      startDate: j.investment_start_date || STRATEGY_START,
      amount: j.investment_amount || INVEST_AMOUNT,
      thresholds: THRESHOLDS.slice().sort((a, b) => b - a),
      strategies,
    },
  };
  return buildDataset(dates, prices, h.cost200, h.fit, h.ahr999, meta);
}

function datasetFromCsv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const ds = (c[0] || '').trim(), ps = (c[1] || '').trim();
    if (!ds || !ps) continue;
    const p = parseFloat(ps);
    if (!isFinite(p) || p <= 0) continue;
    map.set(ds, p); // 重复日期保留最后一条
  }
  const dates = [...map.keys()].sort();
  const prices = dates.map((d) => map.get(d));
  const { cost, fit, ahr } = computeAhrSeries(dates, prices);
  const strategies = backtest(dates, prices, ahr);
  return buildDataset(dates, prices, cost, fit, ahr, {
    lastUpdated: dates[dates.length - 1],
    generatedAt: null,
    investment: {
      startDate: STRATEGY_START,
      amount: INVEST_AMOUNT,
      thresholds: THRESHOLDS.slice().sort((a, b) => b - a),
      strategies,
    },
  });
}

async function loadData() {
  try {
    const res = await fetch('ahr999_data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('json http ' + res.status);
    const j = await res.json();
    if (!j.history || !j.history.date || j.history.date.length < 100) throw new Error('json stale');
    return datasetFromJson(j);
  } catch (err) {
    console.warn('[ahr-dca] ahr999_data.json 不可用，回退到 CSV 本地计算：', err.message);
    const res = await fetch(encodeURIComponent('btc-price all.csv') + '?v=' + Date.now());
    if (!res.ok) throw new Error('csv http ' + res.status);
    return datasetFromCsv(await res.text());
  }
}

/* ============================================================
   主题 & 通用 UI
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('ahr-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  const syncMeta = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = document.documentElement.dataset.theme === 'light' ? '#f5f6f9' : '#0a0c11';
  };
  syncMeta();
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ahr-theme', next);
    syncMeta();
    if (dataReady && window.echarts) rebuildAllCharts();
  });
}

function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); } });
  }, { threshold: 0.06 });
  $$('.section .card, .sim-metrics .card, .kpi-grid .card').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = Math.min(i % 6, 4) * 40 + 'ms';
    obs.observe(el);
  });
}

function initNavSpy() {
  const links = $$('.nav a');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && map.has(e.target.id)) {
        links.forEach((a) => a.classList.remove('active'));
        map.get(e.target.id).classList.add('active');
      }
    });
  }, { rootMargin: '-35% 0px -55% 0px' });
  ['overview', 'trend', 'strategy', 'simulator'].forEach((id) => { const s = document.getElementById(id); if (s) obs.observe(s); });
}

/* ============================================================
   概览区
   ============================================================ */
function renderOverview() {
  const c = D.current;
  $('#data-meta').textContent = `快照日期 ${D.lastUpdated} · 200 日定投成本法 · 每日自动更新`;

  // 价格
  countUp($('#kpi-price'), c.price, fmtUsd);
  const sub = $('#kpi-price-sub');
  if (c.prevPrice) {
    const chg = (c.price - c.prevPrice) / c.prevPrice * 100;
    sub.innerHTML = `<span class="${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(chg))}</span> 较前一日`;
  } else { sub.textContent = ''; }

  // AHR999
  const zone = zoneOf(c.ahr);
  const ahrEl = $('#kpi-ahr');
  ahrEl.style.color = { z1: 'var(--green)', z2: 'var(--accent-2)', z3: 'var(--red)' }[zone.cls];
  countUp(ahrEl, c.ahr, fmtAhr);
  const chip = $('#kpi-zone');
  chip.textContent = zone.name;
  chip.className = 'zone-chip ' + zone.cls;

  // 定投成本
  countUp($('#kpi-cost'), c.cost, fmtUsd2);
  const costPct = (c.price - c.cost) / c.cost * 100;
  $('#kpi-cost-sub').innerHTML =
    `现价${costPct >= 0 ? '高' : '低'}于成本 <span class="${costPct >= 0 ? 'down' : 'up'}">${fmtPct(Math.abs(costPct))}</span>`;

  // 指数估值
  countUp($('#kpi-fit'), c.fit, fmtUsd);
  const fitPct = c.price / c.fit * 100;
  $('#kpi-fit-sub').textContent = `现价 / 估值 = ${fmtPct(fitPct)}`;

  // 今日信号
  const triggered = (D.investment.thresholds || THRESHOLDS).filter((t) => c.ahr <= t);
  const chipsBox = $('#signal-chips');
  chipsBox.innerHTML = (D.investment.thresholds || THRESHOLDS).map((t) =>
    `<span class="sig-chip ${c.ahr <= t ? 'on' : ''}" role="listitem">≤ ${t.toFixed(1)}</span>`).join('');
  const strictest = triggered.length ? Math.min(...triggered) : null;
  $('#signal-caption').innerHTML = triggered.length
    ? `<b style="color:var(--green)">${triggered.length}/${THRESHOLDS.length} 个策略今日触发买入</b>` +
      `（最严阈值 ≤ ${strictest.toFixed(1)}，每次 $${D.investment.amount}）`
    : '今日无策略触发，等待 AHR999 回落';
  if (c.ahr <= 0.45) $('#signal-caption').innerHTML += ' · <b style="color:var(--green)">已进入抄底区</b>';

  // 区间标尺
  const pos = Math.max(0, Math.min(2, c.ahr)) / 2 * 100;
  const marker = $('#zone-marker');
  requestAnimationFrame(() => { marker.style.left = pos + '%'; });
  $('#zone-marker-val').textContent = fmtAhr(c.ahr);
}

/* ============================================================
   ECharts 通用
   ============================================================ */
function pal() {
  const light = document.documentElement.dataset.theme === 'light';
  return {
    text: light ? '#3c4351' : '#c7cdd8',
    muted: light ? '#6b7382' : '#8a93a3',
    axis: light ? 'rgba(16,24,40,.14)' : 'rgba(255,255,255,.10)',
    split: light ? 'rgba(16,24,40,.07)' : 'rgba(255,255,255,.06)',
    tooltipBg: light ? '#ffffff' : '#161b26',
    price: '#f7931a',
    cost: light ? '#8a93a3' : '#98a2b3',
    fit: '#5b8def',
    invested: light ? '#6b7382' : '#9aa3b2',
    green: '#16c784',
    red: '#ea3943',
  };
}

const BASE_AXIS = {
  axisLine: { lineStyle: { color: 'rgba(128,138,155,.35)' } },
  axisLabel: { color: '#8a93a3', hideOverlap: true },
  splitLine: { lineStyle: { color: 'rgba(128,138,155,.13)' } },
};

function tooltipStyle() {
  const p = pal();
  return {
    backgroundColor: p.tooltipBg,
    borderColor: 'rgba(128,138,155,.3)',
    borderWidth: 1,
    textStyle: { color: p.text, fontSize: 12.5 },
    extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.25);border-radius:10px;',
  };
}

function markChartsFailed() {
  $$('.chart-box .chart-fallback').forEach((el) => {
    el.textContent = '图表库加载失败（CDN 不可达）。\n表格与指标数据不受影响。';
  });
}

function initChart(elId) {
  const el = document.getElementById(elId);
  const fallback = el.querySelector('.chart-fallback');
  if (fallback) fallback.remove();
  return echarts.init(el, null, { renderer: 'canvas' });
}

/* ============================================================
   主图（价格 / 成本 / 估值 + AHR999）
   ============================================================ */
const mainState = { range: '3y', log: true, series: { price: true, cost: true, fit: true, ahr: true } };

function rangeStart(range) {
  if (range === 'all') return D.dates[0];
  const years = { '1y': 1, '3y': 3, '5y': 5 }[range] || 3;
  const d = new Date(Date.parse(D.lastDate + 'T00:00:00Z') - years * 365 * DAY_MS);
  return d.toISOString().slice(0, 10);
}

function buildMainChartOption() {
  const p = pal();
  const pairs = (arr) => D.dates.map((d, i) => [d, arr[i]]);
  const vis = mainState.series;

  // 重建（主题/开关）时保留用户当前的缩放位置（首次渲染时图表还没有 option，跳过）
  let zoom = { startValue: rangeStart(mainState.range), endValue: D.lastDate };
  if (charts.main) {
    try {
      const cur = charts.main.getOption();
      const dz = cur && (cur.dataZoom || [])[0];
      if (dz && dz.startValue != null && dz.endValue != null) {
        zoom = { startValue: dz.startValue, endValue: dz.endValue };
      }
    } catch (_) { /* 首次渲染前 getOption 不可用 */ }
  }

  const series = [
    {
      name: '价格', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
      data: pairs(D.prices), showSymbol: false, symbolSize: 5,
      lineStyle: { width: 1.8, color: p.price }, itemStyle: { color: p.price },
      emphasis: { focus: 'series' }, z: 5,
    },
    {
      name: '200日定投成本', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
      data: pairs(D.cost), showSymbol: false,
      lineStyle: { width: 1.3, color: p.cost, type: 'dashed' }, itemStyle: { color: p.cost },
      z: 4,
    },
    {
      name: '指数增长估值', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
      data: pairs(D.fit), showSymbol: false,
      lineStyle: { width: 1.3, color: p.fit, type: [6, 5] }, itemStyle: { color: p.fit },
      z: 3,
    },
    {
      name: 'AHR999', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
      data: pairs(D.ahr), showSymbol: false,
      lineStyle: { width: 1.6 }, itemStyle: { color: p.price },
      areaStyle: { opacity: 0.14, color: p.price },
      z: 5,
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: 'rgba(128,138,155,.5)', type: 'dashed', width: 1 },
        label: {
          color: p.muted, fontSize: 10.5, position: 'insideEndTop',
          formatter: (v) => v.name + ' ' + v.value,
        },
        data: [
          { name: '抄底线', yAxis: 0.45 },
          { name: '定投上界', yAxis: 1.2 },
        ],
      },
      markArea: {
        silent: true,
        label: { show: false },
        data: [
          [{ yAxis: 0, itemStyle: { color: 'rgba(22,199,132,.07)' } }, { yAxis: 0.45 }],
          [{ yAxis: 0.45, itemStyle: { color: 'rgba(247,147,26,.06)' } }, { yAxis: 1.2 }],
          [{ yAxis: 1.2, itemStyle: { color: 'rgba(234,57,67,.06)' } }, { yAxis: 3 }],
        ],
      },
    },
  ];

  // 序列开关状态通过 legend.selected 保留（不重建 data，缩放与状态由 ECharts 维护）
  const names = ['价格', '200日定投成本', '指数增长估值', 'AHR999'];
  const legendSelected = { 价格: vis.price, '200日定投成本': vis.cost, 指数增长估值: vis.fit, AHR999: vis.ahr };

  return {
    animationDuration: 600,
    animationDurationUpdate: 450,
    backgroundColor: 'transparent',
    axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: 'rgba(128,138,155,.5)' } },
    visualMap: {
      show: false, seriesIndex: 3, dimension: 1,
      pieces: [
        { lte: 0.45, color: p.green },
        { gt: 0.45, lte: 1.2, color: p.price },
        { gt: 1.2, color: p.red },
      ],
    },
    tooltip: Object.assign({
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#3a4152' } },
      formatter(params) {
        if (!params || !params.length) return '';
        const date = params[0].value[0];
        const rows = [`<b>${date}</b>`];
        for (const it of params) {
          if (!it.value || it.value[1] == null) continue;
          const v = it.value[1];
          rows.push(`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${it.color};margin-right:6px"></span>${it.seriesName}　<b>${it.seriesName === 'AHR999' ? fmtAhr(v) : fmtUsd2(v)}</b>`);
        }
        const i = D.idx.get(date);
        if (i != null && D.ahr[i] != null) {
          const z = zoneOf(D.ahr[i]);
          rows.push(`<span style="color:${p.muted}">区间：</span>${z.name}`);
        }
        return rows.join('<br>');
      },
    }, tooltipStyle()),
    legend: { show: false, data: names, selected: legendSelected },
    grid: [
      { left: 62, right: 22, top: 16, height: '58%' },
      { left: 62, right: 22, top: '74%', height: '15%' },
    ],
    xAxis: [
      Object.assign({ type: 'time', gridIndex: 0, boundaryLine: false }, BASE_AXIS, { axisLabel: { show: false } }),
      Object.assign({ type: 'time', gridIndex: 1 }, BASE_AXIS),
    ],
    yAxis: [
      Object.assign({
        type: mainState.log ? 'log' : 'value', gridIndex: 0, scale: !mainState.log,
        min: mainState.log ? (v) => Math.max(1, v.min * 0.9) : null,
        axisLabel: { color: '#8a93a3', formatter: (v) => '$' + nf0.format(v) },
      }, {}),
      Object.assign({
        type: 'value', gridIndex: 1, scale: true,
        axisLabel: { color: '#8a93a3', formatter: (v) => v.toFixed(1) },
      }, {}),
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], startValue: zoom.startValue, endValue: zoom.endValue },
      {
        type: 'slider', xAxisIndex: [0, 1], height: 18, bottom: 4,
        borderColor: 'transparent', backgroundColor: 'rgba(128,138,155,.08)',
        fillerColor: 'rgba(247,147,26,.16)', handleStyle: { color: '#f7931a' },
        textStyle: { color: '#8a93a3', fontSize: 10.5 },
        startValue: zoom.startValue, endValue: zoom.endValue,
      },
    ],
    series,
  };
}

function setupMainChart() {
  charts.main = initChart('main-chart');
  charts.main.setOption(buildMainChartOption());

  $$('#range-group .pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#range-group .pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      mainState.range = btn.dataset.range;
      charts.main.setOption({
        dataZoom: [
          { startValue: rangeStart(mainState.range), endValue: D.lastDate },
          { startValue: rangeStart(mainState.range), endValue: D.lastDate },
        ],
      });
    });
  });

  $$('.toolbar-right .chip.toggle[data-series]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.series;
      mainState.series[key] = !mainState.series[key];
      chip.classList.toggle('active', mainState.series[key]);
      const name = { price: '价格', cost: '200日定投成本', fit: '指数增长估值', ahr: 'AHR999' }[key];
      charts.main.dispatchAction({ type: 'legendToggleSelect', name });
    });
  });

  $('#log-toggle').addEventListener('click', () => {
    mainState.log = !mainState.log;
    $('#log-toggle').classList.toggle('active', mainState.log);
    charts.main.setOption(buildMainChartOption());
  });
}

/* ============================================================
   阈值策略区
   ============================================================ */
const sortState = { key: 'threshold', dir: -1 };

function renderRoiChart() {
  const p = pal();
  const list = D.investment.strategies.slice().sort((a, b) => a.roi - b.roi);
  charts.roi = initChart('roi-chart');
  charts.roi.setOption({
    animationDuration: 700,
    backgroundColor: 'transparent',
    tooltip: Object.assign({
      trigger: 'item',
      formatter: (it) => `AHR999 ${esc(it.name)}<br>回报率 <b>${fmtPct(it.value)}</b>`,
    }, tooltipStyle()),
    grid: { left: 10, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: list.map((s) => '≤ ' + s.threshold.toFixed(1)),
      ...BASE_AXIS,
      splitLine: { show: false },
      axisLabel: { color: p.text, fontSize: 12.5, fontWeight: 600 },
    },
    series: [{
      type: 'bar',
      data: list.map((s) => ({
        value: +s.roi.toFixed(2),
        itemStyle: { color: s.roi >= 0 ? p.green : p.red, borderRadius: [0, 5, 5, 0], opacity: 0.9 },
      })),
      barWidth: '62%',
      label: {
        show: true, position: 'right',
        color: p.text, fontSize: 12, fontWeight: 600,
        formatter: (it) => fmtPct(it.value),
      },
    }],
  });
}

function sortStrategies(list) {
  const { key, dir } = sortState;
  return list.slice().sort((a, b) => {
    const va = a[key], vb = b[key];
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
  });
}

function renderStrategyTable() {
  const list = sortStrategies(D.investment.strategies);
  const maxRoi = Math.max(...list.map((s) => Math.abs(s.roi)), 1);
  $('#strategy-tbody').innerHTML = list.map((s) => {
    const roiCls = s.roi >= 0 ? 'pos' : 'neg';
    const barW = Math.max(4, Math.abs(s.roi) / maxRoi * 46);
    return `<tr class="clickable" data-th="${s.threshold}" tabindex="0" role="button"
      aria-label="查看 AHR999 小于等于 ${s.threshold} 的买入记录">
      <td><b>≤ ${s.threshold.toFixed(1)}</b></td>
      <td class="num">${s.count}</td>
      <td class="num">${fmtUsd(s.invested)}</td>
      <td class="num">${fmtBtc(s.btc)}</td>
      <td class="num">${s.avgCost != null ? fmtUsd2(s.avgCost) : '—'}</td>
      <td class="num">${fmtUsd(s.value)}</td>
      <td class="num ${roiCls}">${s.profit >= 0 ? '+' : '−'}${fmtUsd(Math.abs(s.profit))}</td>
      <td class="num"><span class="roi-bar-wrap"><span class="roi-bar ${s.roi >= 0 ? '' : 'neg'}" style="width:${barW}px"></span>
        <span class="${roiCls}">${fmtPct(s.roi)}</span></span></td>
    </tr>`;
  }).join('');

  $$('#strategy-tbody tr').forEach((tr) => {
    const open = () => openDrawer(parseFloat(tr.dataset.th));
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  $('#strategy-meta').textContent =
    `每次买入 $${D.investment.amount} · 统计自 ${D.investment.startDate} · 截至 ${D.lastUpdated} · 点击表头排序`;
}

/* 表头排序只绑定一次，避免 render 时重复叠加监听 */
function initStrategySort() {
  $$('#strategy-table th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortState.key === key) sortState.dir *= -1;
      else { sortState.key = key; sortState.dir = -1; }
      $$('#strategy-table th .arrow').forEach((a) => a.remove());
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = sortState.dir === 1 ? '▲' : '▼';
      th.appendChild(arrow);
      renderStrategyTable();
    });
  });
}

/* ---------------- 策略详情抽屉 ---------------- */
function openDrawer(threshold) {
  const s = D.investment.strategies.find((x) => x.threshold === threshold);
  if (!s) return;
  $('#drawer-title').innerHTML = `策略 <span style="color:var(--accent)">AHR999 ≤ ${threshold.toFixed(1)}</span>`;
  $('#drawer-sub').textContent =
    s.count ? `${s.first} → ${s.last}，共 ${s.count} 次买入` : '该阈值下暂无买入记录';

  const stats = [
    ['累计投入', fmtUsd(s.invested)],
    ['累计持币', s.count ? fmtBtc(s.btc) + ' BTC' : '—'],
    ['平均成本', s.avgCost != null ? fmtUsd2(s.avgCost) : '—'],
    ['当前市值', fmtUsd(s.value)],
    ['盈亏', `<span class="${s.profit >= 0 ? 'pos' : 'neg'}">${s.profit >= 0 ? '+' : '−'}${fmtUsd(Math.abs(s.profit))}</span>`],
    ['回报率', `<span class="${s.roi >= 0 ? 'pos' : 'neg'}">${fmtPct(s.roi)}</span>`],
  ];
  $('#drawer-stats').innerHTML = stats.map(([k, v]) =>
    `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');

  $('#drawer-count').textContent = s.count ? `（${s.count} 条，按日期倒序）` : '';
  $('#drawer-tbody').innerHTML = s.count
    ? s.purchases.slice().reverse().map((p) =>
        `<tr><td>${p.date}</td><td class="num">${fmtUsd2(p.price)}</td><td class="num">$${p.usd != null ? nf0.format(p.usd) : nf0.format(D.investment.amount)}</td><td class="num">${fmtBtc(p.btc)}</td><td class="num">${fmtAhr(p.ahr)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="empty-row">暂无记录</td></tr>';

  const overlay = $('#drawer-overlay'), drawer = $('#drawer');
  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
  document.body.classList.add('drawer-open');

  // 资产曲线：从首次买入到最新（echarts 何时就绪都能画出来）
  echartsLoaded.then((ok) => renderDrawerChart(s));
}

function renderDrawerChart(s) {
  const p = pal();
  if (!s.count) { const el = document.getElementById('drawer-chart'); el.innerHTML = '<div class="chart-fallback">暂无买入记录，无法绘制资产曲线</div>'; return; }
  if (!window.echarts) { const el = document.getElementById('drawer-chart'); if (!el.querySelector('.chart-fallback')) el.innerHTML = '<div class="chart-fallback">图表库加载失败（CDN 不可达）。\n表格数据不受影响。</div>'; return; }
  if (charts.drawer) { charts.drawer.dispose(); charts.drawer = null; }
  charts.drawer = initChart('drawer-chart');

  const buyMap = new Map(s.purchases.map((p) => [p.date, p]));
  const startI = D.idx.get(s.purchases[0].date);
  const labels = [], invested = [], value = [];
  let cumI = 0, btc = 0;
  for (let i = startI; i < D.dates.length; i++) {
    const d = D.dates[i];
    const b = buyMap.get(d);
    if (b) { cumI += D.investment.amount; btc += b.btc; }
    labels.push(d);
    invested.push(+cumI.toFixed(2));
    value.push(+(btc * D.prices[i]).toFixed(2));
  }

  charts.drawer.setOption({
    animationDuration: 500,
    backgroundColor: 'transparent',
    tooltip: Object.assign({ trigger: 'axis',
      valueFormatter: (v) => fmtUsd2(v),
    }, tooltipStyle()),
    legend: { show: true, top: 0, right: 0, textStyle: { color: p.muted, fontSize: 11.5 }, itemWidth: 14, itemHeight: 8 },
    grid: { left: 56, right: 16, top: 30, bottom: 24 },
    xAxis: Object.assign({ type: 'time' }, BASE_AXIS),
    yAxis: Object.assign({ type: 'value', scale: true, axisLabel: { color: '#8a93a3', formatter: (v) => '$' + nf0.format(v) } }, {}),
    dataZoom: [{ type: 'inside' }],
    series: [
      {
        name: '资产价值', type: 'line', data: labels.map((d, i) => [d, value[i]]), showSymbol: false,
        lineStyle: { width: 1.8, color: p.price }, itemStyle: { color: p.price },
        areaStyle: { opacity: 0.12, color: p.price }, z: 3,
      },
      {
        name: '累计投入', type: 'line', data: labels.map((d, i) => [d, invested[i]]), showSymbol: false,
        lineStyle: { width: 1.4, color: p.invested, type: 'dashed' }, itemStyle: { color: p.invested }, z: 2,
      },
    ],
  });
}

function closeDrawer() {
  $('#drawer-overlay').classList.add('hidden');
  $('#drawer').classList.add('hidden');
  document.body.classList.remove('drawer-open');
  if (charts.drawer) { charts.drawer.dispose(); charts.drawer = null; }
}

/* ============================================================
   定投模拟器
   ============================================================ */
const sim = {
  amount: 100, start: null, end: null, mode: 'ahr',
  threshold: 1.0, ahrFreq: 'daily', dom: 1, maWin: 200, maOp: 'lte', maFreq: 'daily',
};

function smaMap(win) {
  sim._sma = sim._sma || {};
  if (sim._sma[win]) return sim._sma[win];
  const m = new Map();
  let sum = 0;
  const { dates, prices } = D;
  for (let i = 0; i < dates.length; i++) {
    sum += prices[i];
    if (i >= win) sum -= prices[i - win];
    if (i >= win - 1) m.set(dates[i], sum / win);
  }
  sim._sma[win] = m;
  return m;
}

function lastDayOfMonthUTC(y, m) { return new Date(Date.UTC(y, m + 1, 0)); }

function eachMonth(s, e, cb) {
  let y = s.getUTCFullYear(), m = s.getUTCMonth();
  while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) {
    cb(y, m);
    m++; if (m > 11) { m = 0; y++; }
  }
}

function getBuyDates(sStr, eStr) {
  const { dates, prices, priceMap, ahrMap, idx } = D;
  const lo = idx.get(sStr) ?? dates.findIndex((d) => d >= sStr);
  const hiRaw = dates.findIndex((d) => d > eStr);
  const hi = (hiRaw === -1 ? dates.length : hiRaw) - 1;
  if (lo < 0 || hi < 0 || lo > hi) return [];

  const rows = [];
  for (let i = lo; i <= hi; i++) rows.push({ date: dates[i], price: prices[i], i });
  const s = new Date(sStr + 'T00:00:00Z'), e = new Date(eStr + 'T00:00:00Z');

  const pickMonthly = (match) => {
    const out = [];
    eachMonth(s, e, (y, m) => {
      const mStart = new Date(Date.UTC(y, m, 1)) < s ? s : new Date(Date.UTC(y, m, 1));
      const mEnd = lastDayOfMonthUTC(y, m) > e ? e : lastDayOfMonthUTC(y, m);
      const ms = mStart.toISOString().slice(0, 10), me = mEnd.toISOString().slice(0, 10);
      let picked = null;
      for (const r of rows) {
        if (r.date < ms || r.date > me) continue;
        if (match(r)) { picked = r; break; }
      }
      if (!picked) for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r.date >= ms && r.date <= me) { picked = r; break; }
      }
      if (picked) out.push(picked);
    });
    return out;
  };

  switch (sim.mode) {
    case 'daily':
      return rows;
    case 'monthly': {
      const out = [];
      eachMonth(s, e, (y, m) => {
        const ld = lastDayOfMonthUTC(y, m);
        const day = Math.min(sim.dom, ld.getUTCDate());
        let dt = new Date(Date.UTC(y, m, day));
        if (dt < s) dt = s;
        let k = dt.toISOString().slice(0, 10);
        if (!priceMap.has(k)) { // 顺延至当月最后有价格的日期
          for (let d = ld; d >= s; d = new Date(d.getTime() - DAY_MS)) {
            const dk = d.toISOString().slice(0, 10);
            if (d < mStartGuard(y, m, s)) break;
            if (priceMap.has(dk) && dk <= eStr && dk >= sStr) { k = dk; break; }
          }
        }
        if (priceMap.has(k)) out.push({ date: k, price: priceMap.get(k), i: idx.get(k) });
      });
      return out;
    }
    case 'ahr': {
      const match = (r) => ahrMap.get(r.date) != null && ahrMap.get(r.date) <= sim.threshold;
      return sim.ahrFreq === 'monthly' ? pickMonthly(match) : rows.filter(match);
    }
    case 'ma': {
      const ma = smaMap(sim.maWin);
      const match = (r) => {
        const v = ma.get(r.date);
        if (v == null) return false;
        return sim.maOp === 'lte' ? r.price <= v : r.price >= v;
      };
      return sim.maFreq === 'monthly' ? pickMonthly(match) : rows.filter(match);
    }
  }
  return [];
}

function mStartGuard(y, m, s) {
  const first = new Date(Date.UTC(y, m, 1));
  return first < s ? s : first;
}

function computeSim(rowsInRange, buyDates) {
  const amount = sim.amount;
  const buySet = new Set(buyDates.map((b) => b.date));
  const labels = [], invested = [], value = [], prices = [], cumBtc = [], markers = [], buyRows = [];
  let cumI = 0, btc = 0, peak = 0, mdd = 0;
  for (const r of rowsInRange) {
    if (buySet.has(r.date)) {
      const got = amount / r.price;
      btc += got;
      cumI += amount;
      markers.push([r.date, +(btc * r.price).toFixed(2)]);
      buyRows.push({ date: r.date, price: r.price, got, btc, cumI });
    }
    const v = btc * r.price;
    labels.push(r.date);
    invested.push(+cumI.toFixed(2));
    value.push(+v.toFixed(2));
    prices.push(r.price);
    cumBtc.push(btc);
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.max(mdd, (peak - v) / peak);
  }
  const lastPrice = rowsInRange.length ? rowsInRange[rowsInRange.length - 1].price : 0;
  const finalValue = btc * lastPrice;
  const roi = cumI > 0 ? (finalValue - cumI) / cumI * 100 : 0;

  // 基准：同期每日定投（每天有价格记录就买一次）
  let baseBtc = 0;
  for (const r of rowsInRange) baseBtc += amount / r.price;
  const baseInvested = rowsInRange.length * amount;
  const baseRoi = baseInvested > 0 ? (baseBtc * lastPrice - baseInvested) / baseInvested * 100 : 0;

  return {
    labels, invested, value, prices, cumBtc, markers, buyRows,
    investedTotal: cumI, btc, count: buyDates.length,
    avgCost: btc > 0 ? cumI / btc : null,
    finalValue, profit: finalValue - cumI, roi,
    mdd: mdd * 100, baseRoi, baseCount: rowsInRange.length,
  };
}

function renderSim(res) {
  countUp($('#m-invested'), res.investedTotal, fmtUsd);
  countUp($('#m-value'), res.finalValue, fmtUsd);
  const profitEl = $('#m-profit');
  profitEl.style.color = res.profit >= 0 ? 'var(--green)' : 'var(--red)';
  countUp(profitEl, res.profit, (v) => (v >= 0 ? '+' : '−') + fmtUsd(Math.abs(v)) + ` (${fmtPct(res.roi)})`);
  const alpha = res.roi - res.baseRoi;
  $('#m-alpha').innerHTML = `vs 每日定投 <span class="${alpha >= 0 ? 'up' : 'down'}">${alpha >= 0 ? '+' : '−'}${fmtPct(Math.abs(alpha))}</span>`;
  countUp($('#m-btc'), res.btc, fmtBtc);
  $('#m-avg-cost').textContent = res.avgCost != null ? `平均成本 ${fmtUsd2(res.avgCost)}` : '';
  countUp($('#m-count'), res.count, (v) => nf0.format(Math.round(v)) + ' 次');
  $('#m-mdd').textContent = `区间最大回撤 −${fmtPct(res.mdd)}`;

  $('#sim-range-note').textContent = `${sim.start} → ${sim.end} · ${res.count} 次买入`;
  $('#sim-table-note').textContent = `共 ${res.count} 条 · 基准为同期每日定投（${res.baseCount} 次）`;

  renderSimChart(res);
  renderSimTable(res);
}

function renderSimChart(res) {
  if (!window.echarts) return; // 图表库未就绪：ready 事件后会重跑
  const p = pal();
  if (charts.sim) charts.sim.dispose();
  charts.sim = initChart('sim-chart');
  const empty = res.count === 0;
  charts.sim.setOption({
    animationDuration: 500,
    backgroundColor: 'transparent',
    tooltip: Object.assign({
      trigger: 'axis',
      formatter(params) {
        if (!params || !params.length) return '';
        const date = params[0].value[0];
        const i = res.labels.indexOf(date);
        const rows = [`<b>${date}</b>`];
        for (const it of params) {
          if (it.seriesName === '买入点' || it.value == null) continue;
          const v = Array.isArray(it.value) ? it.value[1] : it.value;
          rows.push(`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${it.color};margin-right:6px"></span>${it.seriesName}　<b>${fmtUsd2(v)}</b>`);
        }
        if (i >= 0) rows.push(`<span style="color:${p.muted}">累计 BTC：</span>${fmtBtc(res.cumBtc[i])}`);
        return rows.join('<br>');
      },
    }, tooltipStyle()),
    legend: { show: true, top: 0, right: 4, textStyle: { color: p.muted, fontSize: 11.5 }, itemWidth: 14, itemHeight: 8 },
    grid: { left: 62, right: 62, top: 32, bottom: 42 },
    xAxis: Object.assign({ type: 'time' }, BASE_AXIS),
    yAxis: [
      Object.assign({ type: 'value', scale: true, axisLabel: { color: '#8a93a3', formatter: (v) => '$' + nf0.format(v) } }, {}),
      Object.assign({ type: 'value', scale: true, axisLabel: { color: '#8a93a3', formatter: (v) => '$' + nf0.format(v) }, splitLine: { show: false } }, {}),
    ],
    dataZoom: [{ type: 'inside' }],
    series: [
      {
        name: '资产价值', type: 'line', data: res.labels.map((d, i) => [d, res.value[i]]),
        showSymbol: false, lineStyle: { width: 2, color: p.price }, itemStyle: { color: p.price },
        areaStyle: { opacity: 0.12, color: p.price }, z: 4,
      },
      {
        name: '累计投入', type: 'line', data: res.labels.map((d, i) => [d, res.invested[i]]),
        showSymbol: false, lineStyle: { width: 1.4, color: p.invested, type: 'dashed' },
        itemStyle: { color: p.invested }, z: 3,
      },
      {
        name: 'BTC 价格', type: 'line', yAxisIndex: 1, data: res.labels.map((d, i) => [d, res.prices[i]]),
        showSymbol: false, lineStyle: { width: 1.2, color: p.fit, opacity: 0.75 }, itemStyle: { color: p.fit }, z: 2,
      },
      {
        name: '买入点', type: 'scatter', data: res.markers, symbolSize: 7,
        itemStyle: { color: 'transparent', borderColor: p.price, borderWidth: 2 }, z: 6,
        silent: true,
      },
    ],
  });
  if (empty) {
    charts.sim.clear();
    const el = document.getElementById('sim-chart');
    if (!el.querySelector('.chart-fallback')) {
      const div = document.createElement('div');
      div.className = 'chart-fallback';
      div.textContent = '当前条件下区间内没有买入记录，请调整参数。';
      el.appendChild(div);
    }
  }
}

function renderSimTable(res) {
  if (!res.count) {
    $('#sim-tbody').innerHTML = '<tr><td colspan="6" class="empty-row">当前条件下没有买入记录</td></tr>';
    return;
  }
  const amount = sim.amount;
  $('#sim-tbody').innerHTML = res.buyRows.slice().reverse().map((r) =>
    `<tr><td>${r.date}</td><td class="num">${fmtUsd2(r.price)}</td><td class="num">${fmtUsd(amount)}</td><td class="num">${fmtBtc(r.got)}</td><td class="num">${fmtBtc(r.btc)}</td><td class="num">${fmtUsd(r.cumI)}</td></tr>`).join('');
}

function sliceRange(sStr, eStr) {
  const { dates, prices } = D;
  let lo = D.idx.get(sStr);
  if (lo == null) { lo = dates.findIndex((d) => d >= sStr); }
  let hiRaw = dates.findIndex((d) => d > eStr);
  const hi = (hiRaw === -1 ? dates.length : hiRaw) - 1;
  if (lo == null || lo < 0 || hi < 0 || lo > hi) return [];
  const rows = [];
  for (let i = lo; i <= hi; i++) rows.push({ date: dates[i], price: prices[i], i });
  return rows;
}

function runSimulator() {
  if (!dataReady) return;
  let s = $('#sim-start').value || sim.start;
  let e = $('#sim-end').value || sim.end;
  if (s > e) { [s, e] = [e, s]; $('#sim-start').value = s; $('#sim-end').value = e; toast('开始日期晚于结束日期，已自动交换'); }
  sim.start = s; sim.end = e;
  const amount = parseFloat($('#sim-amount').value);
  sim.amount = isFinite(amount) && amount > 0 ? amount : 100;

  const rowsInRange = sliceRange(s, e);
  if (!rowsInRange.length) {
    toast('所选区间没有价格数据');
    $('#m-invested').textContent = '—';
    $('#m-value').textContent = '—';
    $('#m-profit').textContent = '—';
    $('#m-btc').textContent = '—';
    $('#m-count').textContent = '—';
    $('#m-alpha').textContent = '';
    $('#m-avg-cost').textContent = '';
    $('#m-mdd').textContent = '';
    return;
  }
  const buyDates = getBuyDates(s, e);
  const res = computeSim(rowsInRange, buyDates);
  renderSim(res);
}

function initSimulator() {
  // 默认区间：近 3 年
  const end = D.lastDate;
  const startD = new Date(Date.parse(end + 'T00:00:00Z') - 3 * 365 * DAY_MS);
  sim.start = startD.toISOString().slice(0, 10);
  sim.end = end;
  const si = $('#sim-start'), ei = $('#sim-end');
  si.min = ei.min = D.firstDate; si.max = ei.max = D.lastDate;
  si.value = sim.start; ei.value = sim.end;

  const rerun = debounce(runSimulator, 180);
  $('#sim-amount').addEventListener('input', () => {
    $$('#amount-presets .preset').forEach((b) => b.classList.remove('active'));
    rerun();
  });
  $$('#amount-presets .preset').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#amount-presets .preset').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      $('#sim-amount').value = b.dataset.v;
      runSimulator();
    });
  });
  $$('#range-presets .preset').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#range-presets .preset').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const y = parseInt(b.dataset.y, 10);
      ei.value = D.lastDate;
      si.value = y === 0 ? D.firstDate : new Date(Date.parse(D.lastDate + 'T00:00:00Z') - y * 365 * DAY_MS).toISOString().slice(0, 10);
      runSimulator();
    });
  });
  si.addEventListener('change', rerun);
  ei.addEventListener('change', rerun);

  // 模式切换（滑动指示器）
  const modesEl = $('#sim-modes');
  const indicator = $('.mode-indicator');
  function moveIndicator() {
    const active = $('.mode-tab.active');
    if (!active) return;
    indicator.style.left = active.offsetLeft + 'px';
    indicator.style.width = active.offsetWidth + 'px';
  }
  $$('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.mode-tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      moveIndicator();
      sim.mode = tab.dataset.mode;
      $('#panel-ahr').classList.toggle('hidden', sim.mode !== 'ahr');
      $('#panel-monthly').classList.toggle('hidden', sim.mode !== 'monthly');
      $('#panel-ma').classList.toggle('hidden', sim.mode !== 'ma');
      $('#panel-daily').classList.toggle('hidden', sim.mode !== 'daily');
      runSimulator();
    });
  });
  requestAnimationFrame(moveIndicator);
  window.addEventListener('resize', debounce(moveIndicator, 120));

  $('#sim-threshold').addEventListener('change', (e) => { sim.threshold = parseFloat(e.target.value); rerun(); });
  $('#sim-ahr-freq').addEventListener('change', (e) => { sim.ahrFreq = e.target.value; rerun(); });
  $('#sim-dom').addEventListener('input', (e) => { sim.dom = parseInt(e.target.value, 10); $('#sim-dom-val').textContent = sim.dom; rerun(); });
  $('#sim-ma-window').addEventListener('change', (e) => { sim.maWin = parseInt(e.target.value, 10); rerun(); });
  $('#sim-ma-op').addEventListener('change', (e) => { sim.maOp = e.target.value; rerun(); });
  $('#sim-ma-freq').addEventListener('change', (e) => { sim.maFreq = e.target.value; rerun(); });

  runSimulator();
}

/* ============================================================
   页脚 & 启动
   ============================================================ */
function renderFooterMeta() {
  const gen = D.generatedAt ? ` · 生成于 ${D.generatedAt.replace('T', ' ').replace('Z', ' UTC')}` : '';
  $('#footer-updated').textContent = `数据截至 ${D.lastUpdated}${gen}`;
}

function rebuildAllCharts() {
  if (charts.main) charts.main.setOption(buildMainChartOption(), true);
  if (charts.roi) { charts.roi.dispose(); charts.roi = null; renderRoiChart(); }
  // 模拟器与抽屉图表随下次计算/打开时重建
  if (dataReady) runSimulator();
}

async function boot() {
  initTheme();
  initReveal();
  initNavSpy();

  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  try {
    D = await loadData();
    dataReady = true;
  } catch (err) {
    console.error(err);
    $$('.skel').forEach((el) => el.remove());
    $('#data-meta').textContent = '数据加载失败：请通过本地 HTTP 服务访问（python3 -m http.server），或检查 ahr999_data.json 是否存在。';
    return;
  }

  renderOverview();
  renderStrategyTable();
  initStrategySort();
  renderFooterMeta();
  initSimulator();

  const ok = await echartsLoaded;
  if (ok) {
    setupMainChart();
    renderRoiChart();
    runSimulator(); // 补画首跑时还没就绪的模拟器图表
    window.addEventListener('resize', debounce(() => {
      Object.values(charts).forEach((c) => c && c.resize && c.resize());
    }, 150));
  } else {
    markChartsFailed();
  }
}

document.addEventListener('DOMContentLoaded', boot);
