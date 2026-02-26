/**
 * server.js — Express server
 * 
 * Serves the dashboard (public/) and provides an API to read data from Google Sheets.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllData } from './scripts/sheetClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API: Get all views data ──────────────────────────────────────
app.get('/api/views', async (req, res) => {
    try {
        const data = await getAllData();
        res.json({ success: true, data, count: data.length });
    } catch (e) {
        console.error('❌ [API] Error fetching views:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─── API: Summary stats ──────────────────────────────────────────
app.get('/api/summary', async (req, res) => {
    try {
        const data = await getAllData();

        const platforms = {};
        let totalViews = 0;
        let totalLikes = 0;

        for (const row of data) {
            const platform = row['Platform'] || 'Unknown';
            const views = parseInt(row['Views']) || 0;
            const likes = parseInt(row['Likes']) || 0;

            if (!platforms[platform]) {
                platforms[platform] = { videos: 0, views: 0, likes: 0 };
            }
            platforms[platform].videos++;
            platforms[platform].views += views;
            platforms[platform].likes += likes;

            totalViews += views;
            totalLikes += likes;
        }

        res.json({
            success: true,
            totalVideos: data.length,
            totalViews,
            totalLikes,
            platforms,
            lastUpdate: data.length > 0 ? data[0]['Scrape Date'] : null,
        });
    } catch (e) {
        console.error('❌ [API] Error computing summary:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─── Fallback to index.html ──────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 SM Automat Dashboard running on http://localhost:${PORT}`);
});
