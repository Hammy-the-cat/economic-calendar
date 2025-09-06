"use strict";

// Fallback sample data (not used when online fetch succeeds)
const sampleData = [
  { date: "2025-08-13", currency: "USD", importance: 5, indicator: "消費者物価指数（CPI）" },
  { date: "2025-08-14", currency: "USD", importance: 5, indicator: "雇用統計（非農業部門雇用者数）" },
  { date: "2025-08-15", currency: "USD", importance: 3, indicator: "小売売上高" },
];

function getStarRating(importance) {
  const stars = "★".repeat(importance) + "☆".repeat(5 - importance);
  return `<span class="stars stars-${importance}">${stars}</span>`;
}

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

function showLoading(text = "データを読み込み中...") {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = `<tr><td colspan="4" class="loading">${text}</td></tr>`;
}
function showError(text) {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = `<tr><td colspan="4" class="loading">⚠ ${text}</td></tr>`;
}

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
      <td>${item.currency || '-'}</td>
      <td>${getStarRating(item.importance || 0)}</td>
      <td>${item.indicator || '-'}</td>
    `;
    tableBody.appendChild(row);
  }
}

const FRED_API_KEY = "df11443fd1635483e4ae5bcf3923d5af";

// Proxy helper
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
        if (parsed && (parsed.error_code || (parsed.status && parsed.status.http_code >= 400))) {
          throw new Error(`API error: ${parsed.error_message || parsed.status.http_code}`);
        }
        if (parsed && parsed.contents) return JSON.parse(parsed.contents);
        return parsed;
      } catch {
        return JSON.parse(text);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("All proxies failed");
}

// US DST helpers
function isUSDST(date) {
  const y = date.getFullYear();
  const march1 = new Date(Date.UTC(y, 2, 1));
  const march1Dow = march1.getUTCDay();
  const firstSundayInMar = 1 + ((7 - march1Dow) % 7);
  const secondSundayInMar = firstSundayInMar + 7;
  const dstStart = new Date(Date.UTC(y, 2, secondSundayInMar));
  const nov1 = new Date(Date.UTC(y, 10, 1));
  const nov1Dow = nov1.getUTCDay();
  const firstSundayInNov = 1 + ((7 - nov1Dow) % 7);
  const dstEnd = new Date(Date.UTC(y, 10, firstSundayInNov));
  return date >= dstStart && date < dstEnd;
}
function etToJST(dateStr, timeET) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeET.split(':').map(Number);
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

const timeRules = [
  { re: /(consumer price index|\bcpi\b)/i, et: '08:30' },
  { re: /(nonfarm|payroll|employment situation)/i, et: '08:30' },
  { re: /(gross domestic product|\bgdp\b)/i, et: '08:30' },
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
    if (rule.re.test(name)) return etToJST(dateStr, rule.et);
  }
  return null;
}

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
  for (const [re, jp] of map) if (re.test(n)) return jp;
  return name;
}

function inferImportanceFromName(name) {
  const n = (name || "").toLowerCase();
  const high = ["consumer price index", "cpi", "nonfarm payroll", "payroll", "gdp", "gross domestic product", "federal funds", "fed funds", "unemployment rate", "core"];
  const mid = ["industrial production", "housing starts", "retail", "pmi", "ism", "confidence", "sentiment", "durable"];
  if (high.some(k => n.includes(k))) return 5;
  if (mid.some(k => n.includes(k))) return 3;
  return 2;
}

// ホワイトリスト（日本語名でマッチ）主要指標のみ表示に使用
const MAJOR_WHITELIST = [
  /消費者物価指数|CPI/i,
  /雇用統計|非農業部門雇用者数|NFP/i,
  /国内総生産|GDP/i,
  /政策金利|FOMC|金利決定|フェデラルファンド/i,
  /個人消費支出|PCE/i,
  /小売売上高/i,
  /失業率/i,
  /鉱工業生産|工業生産/i,
  /ISM|PMI|景況指数/i,
  /耐久財受注/i,
  /住宅着工|建築許可/i,
  /消費者信頼感|ミシガン大学|消費者態度指数/i,
];

async function fetchCalendarData(apiKey, daysBefore = 2, daysAfter = 14) {
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - daysBefore);
  const end = new Date(today); end.setDate(today.getDate() + daysAfter);
  const fmt = (d) => d.toISOString().split("T")[0];

  const datesUrl = `https://api.stlouisfed.org/fred/releases/dates?realtime_start=${fmt(start)}&realtime_end=${fmt(end)}&include_release_dates_with_no_data=true&order_by=release_date&sort_order=desc&file_type=json&api_key=${apiKey}&limit=1000`;
  const datesPayload = await fetchJSONViaProxies(datesUrl);
  let releaseDates = Array.isArray(datesPayload?.release_dates) ? datesPayload.release_dates : [];
  releaseDates = releaseDates.filter(r => {
    const d = new Date(r.date);
    return d >= start && d <= end;
  });
  const releasesUrl = `https://api.stlouisfed.org/fred/releases?file_type=json&api_key=${apiKey}&limit=1000`;
  const releasesPayload = await fetchJSONViaProxies(releasesUrl);
  const releases = Array.isArray(releasesPayload?.releases) ? releasesPayload.releases : [];
  const releaseMap = new Map(releases.map(r => [r.id, r.name]));

  const items = releaseDates.map(r => {
    const name = releaseMap.get(r.release_id) || `Release ${r.release_id}`;
    const base = {
      date: r.date,
      rawDate: r.date,
      currency: "USD",
      importance: inferImportanceFromName(name),
      indicator: translateIndicatorName(name),
    };
    const inferred = inferJSTTimeFromName(r.date, name);
    if (inferred) {
      base.date = inferred.date;
      base.rawDate = inferred.date;
    }
    return base;
  });
  items.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
  return items;
}

function computeRangeFromPreset(preset) {
  const today = new Date();
  const dow = today.getDay();
  const sinceMon = (dow + 6) % 7;
  switch ((preset || "").toLowerCase()) {
    case "week":
    case "thisweek": {
      const before = sinceMon;
      const after = 6 - sinceMon;
      return { before, after };
    }
    case "nextweek": {
      const before = 0;
      const after = (7 - sinceMon) + 6;
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

async function loadData(options = {}) {
  try {
    showLoading();
    let { before, after, range, majorOnly } = options;
    if (range && (before == null || after == null)) {
      const ra = computeRangeFromPreset(range);
      if (ra) { before = ra.before; after = ra.after; }
    }
    if (before == null) before = 2;
    if (after == null) after = 14;
    if (majorOnly == null) {
      const sel = sessionStorage.getItem('majorOnly');
      if (sel !== null) majorOnly = sel === 'true';
    }

    const fmt = (d) => d.toISOString().split("T")[0];
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - before);
    const end = new Date(today); end.setDate(today.getDate() + after);
    const labelEl = document.getElementById("rangeLabel");
    if (labelEl) labelEl.textContent = `表示範囲: ${fmt(start)} 〜 ${fmt(end)}${majorOnly ? '（主要のみ）' : ''}`;

    let items = await fetchCalendarData(FRED_API_KEY, before, after);
    if (majorOnly) items = items.filter(it => MAJOR_WHITELIST.some(re => re.test(it.indicator || "")));
    if (items.length === 0) {
      displayData(sampleData);
      showError("オンライン取得に失敗したためサンプルを表示しています");
      return;
    }
    displayData(items);

    // Preset active state
    const buttons = document.querySelectorAll('.api-config .buttons .preset-btn');
    buttons.forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); });
    let activeBtn = null;
    if (range) activeBtn = document.querySelector(`.api-config .buttons .preset-btn[data-range="${String(range).toLowerCase()}"]`);
    else activeBtn = document.querySelector(`.api-config .buttons .preset-btn[data-before="${before}"][data-after="${after}"]`);
    if (!activeBtn) activeBtn = document.querySelector('.api-config .buttons .preset-btn[data-default="true"]');
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.setAttribute('aria-pressed','true'); }

    // Filter active state
    const fbtns = document.querySelectorAll('.api-config .filter-btn');
    fbtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
    const fsel = document.querySelector(`.api-config .filter-btn[data-major="${majorOnly ? 'true':'false'}"]`);
    if (fsel) { fsel.classList.add('active'); fsel.setAttribute('aria-pressed','true'); }
    sessionStorage.setItem('majorOnly', String(!!majorOnly));
  } catch (e) {
    console.error("Load error:", e);
    displayData(sampleData);
    showError("データ取得エラー。後ほど再試行してください");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  displayData(sampleData);
  const params = new URLSearchParams(location.search);
  const before = params.has("before") ? Number(params.get("before")) : undefined;
  const after = params.has("after") ? Number(params.get("after")) : undefined;
  const range = params.get("range") || undefined;
  const majorOnly = params.get("major") === '1' || params.get("majorOnly") === 'true' ? true : undefined;
  setTimeout(() => { void loadData({ before, after, range, majorOnly }); }, 600);
});
