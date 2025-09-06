"use strict";

// サンプルデータ（フォールバック用）
const sampleData = [
  { date: "2025-08-13", time: "21:30", timeZone: "EST", currency: "USD", importance: 5, indicator: "消費者物価指数 (CPI)" },
  { date: "2025-08-13", time: "18:00", timeZone: "CET", currency: "EUR", importance: 3, indicator: "失業率" },
  { date: "2025-08-14", time: "00:30", timeZone: "GMT", currency: "GBP", importance: 2, indicator: "小売売上高" },
  { date: "2025-08-14", time: "21:30", timeZone: "EST", currency: "USD", importance: 5, indicator: "非農業部門雇用者数" },
  { date: "2025-08-14", time: "10:00", timeZone: "JST", currency: "JPY", importance: 4, indicator: "GDP成長率" },
  { date: "2025-08-14", time: "22:00", timeZone: "CET", currency: "EUR", importance: 5, indicator: "欧州中央銀行金利発表" },
  { date: "2025-08-15", time: "22:00", timeZone: "EST", currency: "USD", importance: 3, indicator: "工業生産指数" },
  { date: "2025-08-15", time: "20:30", timeZone: "GMT", currency: "GBP", importance: 1, indicator: "住宅価格指数" },
];

// 星の表示
function getStarRating(importance) {
  const stars = "★".repeat(importance) + "☆".repeat(5 - importance);
  return `<span class="stars stars-${importance}">${stars}</span>`;
}

// 日時の表示（JST表記ラベル）
function formatDateTime(date, time, timeZone = "JST") {
  const dateObj = new Date(`${date}T${time}`);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let dayLabel = "";
  const isoToday = today.toISOString().split("T")[0];
  const isoTomorrow = tomorrow.toISOString().split("T")[0];
  const isoYesterday = yesterday.toISOString().split("T")[0];
  if (date === isoToday) dayLabel = "今日";
  else if (date === isoTomorrow) dayLabel = "明日";
  else if (date === isoYesterday) dayLabel = "昨日";
  else {
    dayLabel = dateObj.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  }

  return `
    <div class="datetime">
      <div class="date-part">${dayLabel}</div>
      <div class="time-part">🕐 ${time} <span class="timezone">JST</span></div>
    </div>
  `;
}

// 日付のみ表示
function formatDateOnly(date) {
  const dateObj = new Date(`${date}T00:00`);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isoToday = today.toISOString().split("T")[0];
  const isoTomorrow = tomorrow.toISOString().split("T")[0];
  const isoYesterday = yesterday.toISOString().split("T")[0];
  let dayLabel;
  if (date === isoToday) dayLabel = "今日";
  else if (date === isoTomorrow) dayLabel = "明日";
  else if (date === isoYesterday) dayLabel = "昨日";
  else dayLabel = dateObj.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  return `<div class="date-part">${dayLabel}</div>`;
}

// テーブル描画
function displayData(data) {
  const tableBody = document.getElementById("tableBody");
  if (!Array.isArray(data) || data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="loading">データが見つかりませんでした</td></tr>';
    return;
  }
  tableBody.innerHTML = "";
  for (const item of data) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDateOnly(item.date)}</td>
      <td>${item.currency}</td>
      <td>${getStarRating(item.importance)}</td>
      <td>${item.indicator}</td>
    `;
    tableBody.appendChild(row);
  }
}

// UIローディング/エラー表示
function showLoading(text = "データを読み込み中...") {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = `<tr><td colspan=\"4\" class=\"loading\">${text}</td></tr>`;
}
function showError(text) {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = `<tr><td colspan=\"4\" class=\"loading\">⚠ ${text}</td></tr>`;
}

// APIキー
const FRED_API_KEY = "df11443fd1635483e4ae5bcf3923d5af";

// FREDシリーズ定義（“観測値の最新”一覧）
const fredSeries = [
  { id: "CPIAUCSL", name: "消費者物価指数 (CPI)", importance: 5, currency: "USD" },
  { id: "UNRATE", name: "失業率", importance: 5, currency: "USD" },
  { id: "GDPC1", name: "実質GDP", importance: 5, currency: "USD" },
  { id: "FEDFUNDS", name: "フェデラルファンド金利", importance: 5, currency: "USD" },
  { id: "PAYEMS", name: "非農業部門雇用者数", importance: 5, currency: "USD" },
  { id: "INDPRO", name: "工業生産指数", importance: 3, currency: "USD" },
  { id: "HOUST", name: "住宅着工件数", importance: 3, currency: "USD" },
  { id: "DEXUSEU", name: "USD/EUR為替レート", importance: 4, currency: "USD" },
];

// 指標名の日本語化
function translateIndicatorName(name) {
  if (!name) return name;
  const n = name.toLowerCase();
  const map = [
    [/consumer price index|\bcpi\b/, '消費者物価指数（CPI）'],
    [/producer price index|\bppi\b/, '生産者物価指数（PPI）'],
    [/employment situation|nonfarm|payroll/, '雇用統計（非農業部門雇用者数）'],
    [/unemployment rate/, '失業率'],
    [/gross domestic product|\bgdp\b/, '国内総生産（GDP）'],
    [/personal consumption expenditures|\bpce\b/, '個人消費支出（PCE）'],
    [/retail sales/, '小売売上高'],
    [/housing starts/, '住宅着工件数'],
    [/building permits/, '建築許可件数'],
    [/industrial production/, '鉱工業生産'],
    [/(ism|institute for supply management).*manufacturing|pmi.*manufacturing/, 'ISM製造業景況指数（PMI）'],
    [/(ism|institute for supply management).*services|pmi.*services/, 'ISM非製造業景況指数（PMI）'],
    [/durable goods orders|durable goods/, '耐久財受注'],
    [/consumer confidence|conference board/, '消費者信頼感指数'],
    [/university of michigan|michigan sentiment|consumer sentiment/, 'ミシガン大学消費者態度指数'],
    [/federal open market committee|\bfomc\b|fed funds|interest rate decision/, 'FOMC／政策金利関連'],
    [/jobless claims|initial claims/, '新規失業保険申請件数'],
  ];
  for (const [re, jp] of map) {
    if (re.test(n)) return jp;
  }
  return name; // 既知以外は原文
}

// US DST (New York) 判定（第2日曜:3月開始 / 第1日曜:11月終了）
function isUSDST(date) {
  const y = date.getFullYear();
  // 2nd Sunday in March
  const march1 = new Date(Date.UTC(y, 2, 1));
  const march1Dow = march1.getUTCDay();
  const firstSundayInMar = 1 + ((7 - march1Dow) % 7);
  const secondSundayInMar = firstSundayInMar + 7;
  const dstStart = new Date(Date.UTC(y, 2, secondSundayInMar));
  // 1st Sunday in November
  const nov1 = new Date(Date.UTC(y, 10, 1));
  const nov1Dow = nov1.getUTCDay();
  const firstSundayInNov = 1 + ((7 - nov1Dow) % 7);
  const dstEnd = new Date(Date.UTC(y, 10, firstSundayInNov));
  return date >= dstStart && date < dstEnd;
}

function etToJST(dateStr, timeET) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeET.split(':').map(Number);
  // Determine if this ET date is in DST period
  const refUTC = new Date(Date.UTC(y, m - 1, d));
  const dst = isUSDST(refUTC);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) + (dst ? 4 : 5) * 3600000; // ET->UTC
  const jstMs = utcMs + 9 * 3600000; // UTC->JST
  const jd = new Date(jstMs);
  const yy = jd.getUTCFullYear();
  const mm2 = String(jd.getUTCMonth() + 1).padStart(2, '0');
  const dd2 = String(jd.getUTCDate()).padStart(2, '0');
  const HH = String(jd.getUTCHours()).padStart(2, '0');
  const MM = String(jd.getUTCMinutes()).padStart(2, '0');
  return { date: `${yy}-${mm2}-${dd2}`, time: `${HH}:${MM}` };
}

// 代表的なリリースの時刻（ET）
const timeRules = [
  { re: /(consumer price index|\bCPI\b)/i, et: '08:30' },
  { re: /(nonfarm|payroll|employment situation)/i, et: '08:30' },
  { re: /(gross domestic product|\bGDP\b)/i, et: '08:30' },
  { re: /(pce|personal consumption expenditures)/i, et: '08:30' },
  { re: /(retail sales)/i, et: '08:30' },
  { re: /(unemployment rate)/i, et: '08:30' },
  { re: /(housing starts|building permits)/i, et: '08:30' },
  { re: /(industrial production)/i, et: '09:15' },
  { re: /(ism|pmi|purchasing managers|manufacturing|services)/i, et: '10:00' },
  { re: /(fomc|federal open market|interest rate decision|fed funds rate)/i, et: '14:00' },
];

function inferJSTTimeFromName(dateStr, name) {
  if (!name) return null;
  for (const rule of timeRules) {
    if (rule.re.test(name)) {
      const { date, time } = etToJST(dateStr, rule.et);
      return { date, time, timeZone: 'JST' };
    }
  }
  return null;
}

// 汎用: プロキシ経由でJSON取得
async function fetchJSONViaProxies(url) {
  const endpoints = [
    (u) => `http://localhost:3001?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  let lastErr;
  for (const build of endpoints) {
    const proxied = build(url);
    try {
      const resp = await fetch(proxied, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && ('error_code' in parsed || ('status' in parsed && parsed.status && parsed.status.http_code && parsed.status.http_code >= 400))) {
          throw new Error(`API error: ${parsed.error_message || parsed.status?.http_code}`);
        }
        if (parsed && parsed.contents) {
          return JSON.parse(parsed.contents);
        }
        return parsed;
      } catch {
        return JSON.parse(text);
      }
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error("All proxies failed");
}

// FREDの最新観測値を取得（“発表日”ではない点に注意）
async function fetchFREDData(apiKey) {
  const results = await Promise.all(
    fredSeries.map(async (series) => {
      try {
        const apiUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc`;
        const data = await fetchJSONViaProxies(apiUrl);
        if (!data || !Array.isArray(data.observations)) throw new Error("Invalid FRED payload");
        const obs = data.observations[0];
        if (!obs) throw new Error("No observations");
        return {
          date: obs.date,
          rawDate: obs.date,
          time: "21:30",
          timeZone: "EST",
          currency: series.currency,
          importance: series.importance,
          indicator: `${series.name}: ${obs.value}`,
        };
      } catch (e) {
        console.error(`Error fetching ${series.id}:`, e);
        return null;
      }
    })
  );
  return results.filter(Boolean).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
}

// 簡易重要度: リリース名のキーワードからスコア
function inferImportanceFromName(name) {
  const n = (name || "").toLowerCase();
  const high = ["consumer price index", "cpi", "nonfarm payroll", "payroll", "gdp", "gross domestic product", "federal funds", "fed funds", "unemployment rate", "core"];
  const mid = ["industrial production", "housing starts", "retail", "pmi", "ism", "confidence", "sentiment", "durable"];
  if (high.some(k => n.includes(k))) return 5;
  if (mid.some(k => n.includes(k))) return 3;
  return 2;
}

// 発表カレンダー（FRED releases/dates）を取得
async function fetchCalendarData(apiKey, daysBefore = 2, daysAfter = 14) {
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - daysBefore);
  const end = new Date(today); end.setDate(today.getDate() + daysAfter);
  const fmt = (d) => d.toISOString().split("T")[0];

  // 1) リリース日一覧
  const datesUrl = `https://api.stlouisfed.org/fred/releases/dates?realtime_start=${fmt(start)}&realtime_end=${fmt(end)}&include_release_dates_with_no_data=true&order_by=release_date&sort_order=desc&file_type=json&api_key=${apiKey}&limit=1000`;
  const datesPayload = await fetchJSONViaProxies(datesUrl);
  let releaseDates = Array.isArray(datesPayload?.release_dates) ? datesPayload.release_dates : [];
  // ローカルで日付範囲に絞る
  releaseDates = releaseDates.filter(r => {
    const d = new Date(r.date);
    return d >= start && d <= end;
  });
  const uniqueIds = [...new Set(releaseDates.map(r => r.release_id))];

  if (uniqueIds.length === 0) return [];

  // 2) リリースID→名称のマップ（まとめ取得）
  // 1000件上限に収まる想定だが、超える場合は簡易に分割
  const releasesUrl = `https://api.stlouisfed.org/fred/releases?file_type=json&api_key=${apiKey}&limit=1000`;
  const releasesPayload = await fetchJSONViaProxies(releasesUrl);
  const releases = Array.isArray(releasesPayload?.releases) ? releasesPayload.releases : [];
  const releaseMap = new Map(releases.map(r => [r.id, r.name]));

  // 3) 表示用データへ整形（時間はFRED未提供のためダミー）
  const items = releaseDates.map(r => {
    const name = releaseMap.get(r.release_id) || `Release ${r.release_id}`;
    const base = {
      date: r.date,
      rawDate: r.date,
      time: "",
      timeZone: "JST",
      currency: "USD",
      importance: inferImportanceFromName(name),
      indicator: translateIndicatorName(name),
    };
    const inferred = inferJSTTimeFromName(r.date, name);
    if (inferred) {
      base.date = inferred.date; // JST換算で日付が跨いだ場合に合わせる
      base.time = inferred.time;
      base.rawDate = inferred.date;
    }
    return base;
  });

  // 日付昇順（カレンダーらしく）
  items.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
  return items;
}

function computeRangeFromPreset(preset) {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun..6=Sat
  // Monday-based index
  const sinceMon = (dow + 6) % 7; // 0=Mon,6=Sun
  switch ((preset || "").toLowerCase()) {
    case "week":
    case "thisweek": {
      const before = sinceMon;
      const after = 6 - sinceMon;
      return { before, after };
    }
    case "nextweek": {
      const before = 0;
      const after = (7 - sinceMon) + 6; // to next Sunday
      return { before, after };
    }
    case "next30":
    case "30d":
    case "30days":
      return { before: 0, after: 30 };
    case "month":
    case "thismonth": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const before = Math.max(0, Math.floor((today - first) / 86400000));
      const after = Math.max(0, Math.floor((last - today) / 86400000));
      return { before, after };
    }
    default:
      return null;
  }
}

// ロード操作
async function loadData(options = {}) {
  try {
    showLoading();
    // 期間解決
    let { before, after, range } = options;
    if (range && (before == null || after == null)) {
      const ra = computeRangeFromPreset(range);
      if (ra) { before = ra.before; after = ra.after; }
    }
    if (before == null) before = 2;
    if (after == null) after = 14;

    // 範囲ラベル更新
    const fmt = (d) => d.toISOString().split("T")[0];
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - before);
    const end = new Date(today); end.setDate(today.getDate() + after);
    const labelEl = document.getElementById("rangeLabel");
    if (labelEl) labelEl.textContent = `表示範囲: ${fmt(start)} 〜 ${fmt(end)}`;

    // プリセットのアクティブ表示更新
    const buttons = document.querySelectorAll('.api-config .buttons .preset-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });
    let activeBtn = null;
    if (range) {
      activeBtn = document.querySelector(`.api-config .buttons .preset-btn[data-range="${String(range).toLowerCase()}"]`);
    } else {
      activeBtn = document.querySelector(`.api-config .buttons .preset-btn[data-before="${before}"][data-after="${after}"]`);
    }
    if (!activeBtn) {
      activeBtn = document.querySelector('.api-config .buttons .preset-btn[data-default="true"]');
    }
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-pressed', 'true');
    }

    // カレンダーモード（発表日）
    const items = await fetchCalendarData(FRED_API_KEY, before, after);
    if (items.length === 0) {
      displayData(sampleData);
      showError("オンライン取得に失敗したためサンプルを表示しています");
      return;
    }
    displayData(items);
  } catch (e) {
    console.error("Load error:", e);
    displayData(sampleData);
    showError("データ取得エラー。後ほど再試行してください");
  }
}

// 起動
document.addEventListener("DOMContentLoaded", () => {
  // 先にサンプルを即描画してから取得
  displayData(sampleData);
  const params = new URLSearchParams(location.search);
  const before = params.has("before") ? Number(params.get("before")) : undefined;
  const after = params.has("after") ? Number(params.get("after")) : undefined;
  const range = params.get("range") || undefined; // week,nextweek,month,next30,etc
  setTimeout(() => { void loadData({ before, after, range }); }, 600);
});
