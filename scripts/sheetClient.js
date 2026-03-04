/**
 * sheetClient.js — Google Sheets read/write client
 * 
 * Now supports per-platform tabs (YouTube, Instagram, TikTok).
 * Each platform has its own sheet tab with auto-filter.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SHEET_TABS } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Auth ──────────────────────────────────────────────────────────
async function getAuthClient() {
    if (process.env.GOOGLE_CREDENTIALS) {
        try {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
            return await auth.getClient();
        } catch (e) {
            console.error('❌ [Sheets] Failed to parse GOOGLE_CREDENTIALS env:', e.message);
        }
    }

    if (fs.existsSync(CREDENTIALS_PATH)) {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: SCOPES,
        });
        return await auth.getClient();
    }

    throw new Error('No Google credentials found (env or file)');
}

function getSheetsApi(authClient) {
    return google.sheets({ version: 'v4', auth: authClient });
}

// ─── Headers ───────────────────────────────────────────────────────
const HEADERS = ['Scrape Date', 'Platform', 'Video ID', 'Title', 'URL', 'Views', 'Likes', 'Post Date'];

/**
 * Ensures a tab exists. Returns its sheetId.
 */
async function ensureTab(sheets, tabName) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const tab = spreadsheet.data.sheets.find(
            s => s.properties.title === tabName
        );
        if (!tab) {
            console.log(`📄 [Sheets] Creating tab "${tabName}"...`);
            const addRes = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{ addSheet: { properties: { title: tabName } } }]
                }
            });
            return addRes.data.replies[0].addSheet.properties.sheetId;
        }
        return tab.properties.sheetId;
    } catch (e) {
        console.warn(`⚠️ [Sheets] Could not check/create tab "${tabName}":`, e.message);
        return 0;
    }
}

/**
 * Enables auto-filter on a tab.
 */
async function ensureBasicFilter(sheets, sheetId) {
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    { clearBasicFilter: { sheetId } },
                    {
                        setBasicFilter: {
                            filter: {
                                range: {
                                    sheetId,
                                    startRowIndex: 0,
                                    startColumnIndex: 0,
                                    endColumnIndex: HEADERS.length,
                                }
                            }
                        }
                    }
                ]
            },
        });
        console.log(`🔽 [Sheets] Auto-filter enabled on sheetId ${sheetId}`);
    } catch (e) {
        console.warn('⚠️ [Sheets] Could not set filter:', e.message);
    }
}

/**
 * Ensures all platform tabs exist with headers + auto-filter.
 */
export async function ensureHeaders() {
    const client = await getAuthClient();
    const sheets = getSheetsApi(client);

    for (const [platform, tabName] of Object.entries(SHEET_TABS)) {
        const sheetId = await ensureTab(sheets, tabName);

        // Check if header row exists
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tabName}!A1:H1`,
            });
            const existing = res.data.values ? res.data.values[0] : [];

            if (existing.length === 0) {
                console.log(`📝 [Sheets] Writing headers to "${tabName}"...`);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${tabName}!A1:H1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [HEADERS] },
                });
            }
        } catch (e) {
            console.warn(`⚠️ [Sheets] Could not write headers to "${tabName}":`, e.message);
        }

        await ensureBasicFilter(sheets, sheetId);
    }
}

// ─── Read all data (from all platform tabs) ─────────────────────────
export async function getAllData() {
    const client = await getAuthClient();
    const sheets = getSheetsApi(client);

    const allRows = [];

    for (const [platform, tabName] of Object.entries(SHEET_TABS)) {
        try {
            await ensureTab(sheets, tabName);

            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tabName}!A:H`,
            });

            const rows = res.data.values || [];
            if (rows.length <= 1) continue;

            const headers = rows[0];
            for (const row of rows.slice(1)) {
                const obj = {};
                headers.forEach((h, i) => {
                    obj[h] = row[i] || '';
                });
                // Ensure platform is set even if column is empty
                if (!obj['Platform']) obj['Platform'] = platform;
                allRows.push(obj);
            }
        } catch (e) {
            console.warn(`⚠️ [Sheets] Could not read "${tabName}":`, e.message);
        }
    }

    return allRows;
}

// ─── Write scraped results (per-platform tabs) ─────────────────────
/**
 * Groups results by platform, then upserts into the correct tab.
 */
export async function upsertResults(results) {
    const client = await getAuthClient();
    const sheets = getSheetsApi(client);

    // Group by platform
    const grouped = {};
    for (const r of results) {
        const platform = r.platform;
        if (!grouped[platform]) grouped[platform] = [];
        grouped[platform].push(r);
    }

    let totalUpdated = 0;
    let totalAppended = 0;

    for (const [platform, items] of Object.entries(grouped)) {
        const tabName = SHEET_TABS[platform];
        if (!tabName) {
            console.warn(`⚠️ [Sheets] No tab configured for platform "${platform}", skipping.`);
            continue;
        }

        console.log(`\n📄 [Sheets] Writing ${items.length} items to "${tabName}"...`);

        const sheetId = await ensureTab(sheets, tabName);

        // Read existing data from this tab
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tabName}!A:H`,
        });

        const rows = res.data.values || [];
        const today = new Date().toISOString().split('T')[0];

        // Build index: videoId → row number
        const idIndex = {};
        for (let i = 1; i < rows.length; i++) {
            const videoId = rows[i][2]; // Column C = Video ID
            if (videoId) idIndex[videoId] = i + 1;
        }

        const toAppend = [];
        const updates = [];

        for (const r of items) {
            const row = [today, r.platform, r.id, r.title, r.url, r.views, r.likes, r.date];

            const existingRow = idIndex[r.id];
            if (existingRow) {
                updates.push({ range: `${tabName}!A${existingRow}`, values: [[today]] });
                updates.push({ range: `${tabName}!F${existingRow}:G${existingRow}`, values: [[r.views, r.likes]] });
            } else {
                toAppend.push(row);
            }
        }

        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { valueInputOption: 'USER_ENTERED', data: updates },
            });
            const count = updates.length / 2;
            totalUpdated += count;
            console.log(`   ✏️  Updated ${count} rows in "${tabName}"`);
        }

        if (toAppend.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tabName}!A:H`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: toAppend },
            });
            totalAppended += toAppend.length;
            console.log(`   ➕ Appended ${toAppend.length} rows to "${tabName}"`);
        }

        await ensureBasicFilter(sheets, sheetId);
    }

    return { updated: totalUpdated, appended: totalAppended };
}

// ─── Self-test ──────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
    (async () => {
        const dotenv = await import('dotenv');
        dotenv.config({ path: path.join(__dirname, '..', '.env') });
        try {
            console.log('🧪 Testing Google Sheets connection...');
            await ensureHeaders();
            const data = await getAllData();
            console.log(`✅ Connected! Found ${data.length} data rows across all tabs.`);
            console.log('Sample:', data.slice(0, 2));
        } catch (e) {
            console.error('❌ Test failed:', e.message);
        }
    })();
}
