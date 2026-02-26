/**
 * app.js — Dashboard client-side logic
 * 
 * Fetches data from /api/views and /api/summary, renders the UI.
 * Auto-refreshes every 60 seconds.
 */

// ─── State ─────────────────────────────────────────────
let allData = [];
let currentPlatform = 'all';

// ─── Elements ──────────────────────────────────────────
const totalVideosEl = document.getElementById('totalVideos');
const totalViewsEl = document.getElementById('totalViews');
const totalLikesEl = document.getElementById('totalLikes');
const totalPlatformsEl = document.getElementById('totalPlatforms');
const lastUpdateEl = document.getElementById('lastUpdate');
const tableBody = document.getElementById('tableBody');
const filterTabs = document.getElementById('filterTabs');
const searchInput = document.getElementById('searchInput');
const platformBreakdown = document.getElementById('platformBreakdown');
const emptyState = document.getElementById('emptyState');
const tableSection = document.querySelector('.table-section');

// ─── Format numbers ───────────────────────────────────
function formatNumber(num) {
    const n = parseInt(num) || 0;
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// ─── Platform badge ────────────────────────────────────
function platformBadge(platform) {
    const emojis = { YouTube: '▶️', Instagram: '📸', TikTok: '🎵' };
    const classes = {
        YouTube: 'badge-youtube',
        Instagram: 'badge-instagram',
        TikTok: 'badge-tiktok',
    };
    return `<span class="platform-badge ${classes[platform] || ''}">${emojis[platform] || '🌐'} ${platform}</span>`;
}

// ─── Render summary ───────────────────────────────────
async function fetchSummary() {
    try {
        const res = await fetch('/api/summary');
        const json = await res.json();
        if (!json.success) return;

        totalVideosEl.textContent = formatNumber(json.totalVideos);
        totalViewsEl.textContent = formatNumber(json.totalViews);
        totalLikesEl.textContent = formatNumber(json.totalLikes);
        totalPlatformsEl.textContent = Object.keys(json.platforms).length;

        if (json.lastUpdate) {
            lastUpdateEl.innerHTML = `<span class="pulse"></span> Last update: ${formatDate(json.lastUpdate)}`;
        }

        // Platform breakdown cards
        renderPlatformBreakdown(json.platforms);
    } catch (e) {
        console.error('Failed to fetch summary:', e);
    }
}

function renderPlatformBreakdown(platforms) {
    const configs = {
        YouTube: { emoji: '▶️', cssClass: 'youtube' },
        Instagram: { emoji: '📸', cssClass: 'instagram' },
        TikTok: { emoji: '🎵', cssClass: 'tiktok' },
    };

    let html = '';
    for (const [name, stats] of Object.entries(platforms)) {
        const cfg = configs[name] || { emoji: '🌐', cssClass: '' };
        html += `
            <div class="platform-card ${cfg.cssClass}">
                <div class="platform-card-header">
                    <span class="platform-card-name">${name}</span>
                    <span class="platform-card-emoji">${cfg.emoji}</span>
                </div>
                <div class="platform-card-stats">
                    <div class="pstat">
                        <span class="pstat-value">${formatNumber(stats.videos)}</span>
                        <span class="pstat-label">Videos</span>
                    </div>
                    <div class="pstat">
                        <span class="pstat-value">${formatNumber(stats.views)}</span>
                        <span class="pstat-label">Views</span>
                    </div>
                    <div class="pstat">
                        <span class="pstat-value">${formatNumber(stats.likes)}</span>
                        <span class="pstat-label">Likes</span>
                    </div>
                </div>
            </div>
        `;
    }
    platformBreakdown.innerHTML = html;
}

// ─── Render table ──────────────────────────────────────
async function fetchData() {
    try {
        const res = await fetch('/api/views');
        const json = await res.json();
        if (!json.success) return;

        allData = json.data;
        renderTable();
    } catch (e) {
        console.error('Failed to fetch data:', e);
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">❌ Failed to load data</td></tr>';
    }
}

function renderTable() {
    const search = searchInput.value.toLowerCase();

    const filtered = allData.filter(row => {
        const matchPlatform = currentPlatform === 'all' || row['Platform'] === currentPlatform;
        const matchSearch = !search ||
            (row['Title'] || '').toLowerCase().includes(search) ||
            (row['URL'] || '').toLowerCase().includes(search) ||
            (row['Platform'] || '').toLowerCase().includes(search);
        return matchPlatform && matchSearch;
    });

    if (filtered.length === 0) {
        tableSection.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    tableSection.style.display = 'block';
    emptyState.style.display = 'none';

    // Sort by views descending
    filtered.sort((a, b) => (parseInt(b['Views']) || 0) - (parseInt(a['Views']) || 0));

    let html = '';
    for (const row of filtered) {
        const url = row['URL'] || '#';
        html += `
            <tr>
                <td>${platformBadge(row['Platform'])}</td>
                <td class="title-cell" title="${(row['Title'] || '').replace(/"/g, '&quot;')}">${row['Title'] || '—'}</td>
                <td class="num">${formatNumber(row['Views'])}</td>
                <td class="num">${formatNumber(row['Likes'])}</td>
                <td>${formatDate(row['Post Date'])}</td>
                <td>${formatDate(row['Scrape Date'])}</td>
                <td><a href="${url}" target="_blank" rel="noopener" class="link-btn" title="Open">↗</a></td>
            </tr>
        `;
    }

    tableBody.innerHTML = html;
}

// ─── Event Listeners ───────────────────────────────────
filterTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;

    filterTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentPlatform = btn.dataset.platform;
    renderTable();
});

searchInput.addEventListener('input', () => {
    renderTable();
});

// ─── Init & Auto-refresh ───────────────────────────────
async function init() {
    await Promise.all([fetchSummary(), fetchData()]);
}

init();

// Auto-refresh every 60 seconds
setInterval(() => {
    fetchSummary();
    fetchData();
}, 60_000);
