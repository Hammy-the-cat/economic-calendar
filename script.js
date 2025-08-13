// 経済指標カレンダーのサンプルデータと機能

// サンプルの経済指標データ
const sampleData = [
    {
        date: "2025-08-13 08:30",
        currency: "USD",
        importance: "高",
        indicator: "消費者物価指数 (CPI)"
    },
    {
        date: "2025-08-13 10:00",
        currency: "EUR",
        importance: "中",
        indicator: "失業率"
    },
    {
        date: "2025-08-13 15:30",
        currency: "GBP",
        importance: "低",
        indicator: "小売売上高"
    },
    {
        date: "2025-08-14 08:30",
        currency: "USD",
        importance: "高",
        indicator: "非農業部門雇用者数"
    },
    {
        date: "2025-08-14 10:00",
        currency: "JPY",
        importance: "中",
        indicator: "GDP成長率"
    },
    {
        date: "2025-08-14 14:00",
        currency: "EUR",
        importance: "高",
        indicator: "欧州中央銀行金利発表"
    },
    {
        date: "2025-08-15 09:00",
        currency: "USD",
        importance: "中",
        indicator: "工業生産指数"
    },
    {
        date: "2025-08-15 11:30",
        currency: "GBP",
        importance: "低",
        indicator: "住宅価格指数"
    }
];

// 重要度に応じたCSSクラスの設定
function getImportanceClass(importance) {
    switch(importance) {
        case "高":
            return "importance-high";
        case "中":
            return "importance-medium";
        case "低":
            return "importance-low";
        default:
            return "";
    }
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
            <td>${item.date}</td>
            <td>${item.currency}</td>
            <td class="${getImportanceClass(item.importance)}">${item.importance}</td>
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
    { id: 'CPIAUCSL', name: '消費者物価指数 (CPI)', importance: '高' },
    { id: 'UNRATE', name: '失業率', importance: '高' },
    { id: 'GDPC1', name: '実質GDP', importance: '高' },
    { id: 'FEDFUNDS', name: 'フェデラルファンド金利', importance: '高' },
    { id: 'PAYEMS', name: '非農業部門雇用者数', importance: '高' },
    { id: 'INDPRO', name: '工業生産指数', importance: '中' },
    { id: 'HOUST', name: '住宅着工件数', importance: '中' },
    { id: 'DEXUSEU', name: 'USD/EUR為替レート', importance: '中' }
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
                        date: formatDate(observation.date),
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
            document.getElementById('tableBody').innerHTML = 
                '<tr><td colspan="4" class="loading">データの取得に失敗しました。<br><small>プロキシサーバーとAPIキーを確認してください。</small></td></tr>';
        }
        
    } catch (error) {
        console.error('FRED API呼び出しエラー:', error);
        if (error.message.includes('fetch')) {
            document.getElementById('tableBody').innerHTML = 
                '<tr><td colspan="4" class="loading">プロキシサーバーに接続できませんでした。<br><small>node proxy-server.js を実行してください。</small></td></tr>';
        } else {
            document.getElementById('tableBody').innerHTML = 
                '<tr><td colspan="4" class="loading">API接続エラーが発生しました。</td></tr>';
        }
    }
}

// 日付をフォーマット
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP') + ' (最新データ)';
}

// ページ読み込み時に自動でデータを読み込み
document.addEventListener('DOMContentLoaded', function() {
    // 少し遅延してから自動読み込み（プロキシサーバーの起動を待つ）
    setTimeout(() => {
        loadData();
    }, 1000);
});

// APIキー入力フィールドは削除されたため、この処理は不要
// document.getElementById('apiKey').addEventListener('keypress', function(event) {
//     if (event.key === 'Enter') {
//         loadData();
//     }
// });