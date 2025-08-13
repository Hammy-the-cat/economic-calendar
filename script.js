// 経済指標カレンダーのサンプルデータと機能

// サンプルの経済指標データ（日本時間 JST）
const sampleData = [
    {
        date: "2025-08-13",
        time: "21:30", // USD 8:30 EST → JST (夏時間 +13h, 冬時間 +14h)
        timeZone: "EST",
        currency: "USD",
        importance: 5,
        indicator: "消費者物価指数 (CPI)"
    },
    {
        date: "2025-08-13",
        time: "18:00", // EUR 10:00 CET → JST (+8h)
        timeZone: "CET", 
        currency: "EUR",
        importance: 3,
        indicator: "失業率"
    },
    {
        date: "2025-08-14",
        time: "00:30", // GBP 15:30 GMT → JST (+9h)
        timeZone: "GMT",
        currency: "GBP",
        importance: 2,
        indicator: "小売売上高"
    },
    {
        date: "2025-08-14",
        time: "21:30", // USD 8:30 EST → JST
        timeZone: "EST",
        currency: "USD",
        importance: 5,
        indicator: "非農業部門雇用者数"
    },
    {
        date: "2025-08-14",
        time: "10:00", // JPY - 既に日本時間
        timeZone: "JST",
        currency: "JPY",
        importance: 4,
        indicator: "GDP成長率"
    },
    {
        date: "2025-08-14",
        time: "22:00", // EUR 14:00 CET → JST
        timeZone: "CET",
        currency: "EUR",
        importance: 5,
        indicator: "欧州中央銀行金利発表"
    },
    {
        date: "2025-08-15",
        time: "22:00", // USD 9:00 EST → JST
        timeZone: "EST",
        currency: "USD",
        importance: 3,
        indicator: "工業生産指数"
    },
    {
        date: "2025-08-15",
        time: "20:30", // GBP 11:30 GMT → JST
        timeZone: "GMT",
        currency: "GBP",
        importance: 1,
        indicator: "住宅価格指数"
    }
];

// 重要度に応じた星の表示
function getStarRating(importance) {
    const stars = '★'.repeat(importance) + '☆'.repeat(5 - importance);
    return `<span class="stars stars-${importance}">${stars}</span>`;
}

// 日時を美しくフォーマット（日本時間表示）
function formatDateTime(date, time, timeZone = 'JST') {
    const dateObj = new Date(date + 'T' + time);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let dayLabel = '';
    if (date === today.toISOString().split('T')[0]) {
        dayLabel = '今日';
    } else if (date === tomorrow.toISOString().split('T')[0]) {
        dayLabel = '明日';
    } else if (date === yesterday.toISOString().split('T')[0]) {
        dayLabel = '昨日';
    } else {
        dayLabel = dateObj.toLocaleDateString('ja-JP', { 
            month: 'numeric', 
            day: 'numeric',
            weekday: 'short'
        });
    }

    return `
        <div class="datetime">
            <div class="date-part">${dayLabel}</div>
            <div class="time-part">🕐 ${time} <span class="timezone">JST</span></div>
        </div>
    `;
}

// テーブルにデータを表示する関数
function displayData(data) {
    const tableBody = document.getElementById('tableBody');
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="loading">データが見つかりませんでした</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateTime(item.date, item.time, item.timeZone)}</td>
            <td>${item.currency}</td>
            <td>${getStarRating(item.importance)}</td>
            <td>${item.indicator}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 固定APIキー
const FRED_API_KEY = 'df11443fd1635483e4ae5bcf3923d5af';

// データ読み込み関数
function loadData() {
    const tableBody = document.getElementById('tableBody');
    
    // ローディング表示
    tableBody.innerHTML = '<tr><td colspan="4" class="loading">データを読み込み中...</td></tr>';
    
    // 固定APIキーを使用してデータを取得
    fetchFREDData(FRED_API_KEY);
}

// FRED APIの主要経済指標シリーズID
const fredSeries = [
    { id: 'CPIAUCSL', name: '消費者物価指数 (CPI)', importance: 5 },
    { id: 'UNRATE', name: '失業率', importance: 5 },
    { id: 'GDPC1', name: '実質GDP', importance: 5 },
    { id: 'FEDFUNDS', name: 'フェデラルファンド金利', importance: 5 },
    { id: 'PAYEMS', name: '非農業部門雇用者数', importance: 5 },
    { id: 'INDPRO', name: '工業生産指数', importance: 3 },
    { id: 'HOUST', name: '住宅着工件数', importance: 3 },
    { id: 'DEXUSEU', name: 'USD/EUR為替レート', importance: 4 }
];

// FRED APIからデータを取得（ローカルプロキシサーバー使用）
async function fetchFREDData(apiKey) {
    try {
        const fredData = [];
        
        // 複数の経済指標を並行取得
        const promises = fredSeries.map(async (series) => {
            try {
                // オンラインCORSプロキシ経由でAPIアクセス（スマホ対応）
                const fredApiUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc`;
                
                // 複数のプロキシサービスを試行
                const proxyServices = [
                    `https://api.allorigins.win/get?url=${encodeURIComponent(fredApiUrl)}`,
                    `https://corsproxy.io/?${encodeURIComponent(fredApiUrl)}`,
                    `http://localhost:3001?url=${encodeURIComponent(fredApiUrl)}` // ローカル開発用
                ];
                
                let response;
                let lastError;
                
                for (const proxyUrl of proxyServices) {
                    try {
                        response = await fetch(proxyUrl);
                        if (response.ok) break;
                    } catch (error) {
                        lastError = error;
                        continue;
                    }
                }
                
                if (!response || !response.ok) {
                    throw lastError || new Error('All proxy services failed');
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // allorigins.winの場合、contentsプロパティに実際のデータが入っている
                const fredData = data.contents ? JSON.parse(data.contents) : data;
                
                if (fredData.observations && fredData.observations.length > 0) {
                    const observation = fredData.observations[0];
                    return {
                        date: observation.date,
                        time: '21:30', // USD 8:30 EST → JST (日本時間)
                        timeZone: 'EST',
                        rawDate: observation.date,
                        currency: 'USD',
                        importance: series.importance,
                        indicator: `${series.name}: ${observation.value}`
                    };
                }
                return null;
            } catch (error) {
                console.error(`Error fetching ${series.name}:`, error);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const validResults = results.filter(result => result !== null);
        
        if (validResults.length > 0) {
            // 日付順にソート
            validResults.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
            displayData(validResults);
        } else {
            // API取得失敗時はサンプルデータを表示
            displayData(sampleData);
        }
        
    } catch (error) {
        console.error('FRED API呼び出しエラー:', error);
        // API接続失敗時はサンプルデータを表示
        displayData(sampleData);
    }
}

// 日付をフォーマット
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP') + ' (最新データ)';
}

// ページ読み込み時に自動でデータを読み込み
document.addEventListener('DOMContentLoaded', function() {
    // まずサンプルデータを即座に表示
    displayData(sampleData);
    
    // 少し遅延してからAPI読み込みを試行
    setTimeout(() => {
        loadData();
    }, 2000);
});

// APIキー入力フィールドは削除されたため、この処理は不要
// document.getElementById('apiKey').addEventListener('keypress', function(event) {
//     if (event.key === 'Enter') {
//         loadData();
//     }
// });