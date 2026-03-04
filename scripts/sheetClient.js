/**
 * sheetClient.js — Google Sheets read/write client
 * 
 * Handles auth (env var or local file), reading and writing to the Views sheet.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SHEET_NAME } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Auth ──────────────────────────────────────────────────────────
async function getAuthClient() {
    // 1. Try GOOGLE_CREDENTIALS env var (for Render / cloud)
    if (process.env.GOOGLE_CREDENTIALS) {
        try {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
            return await auth.getClient();
        } catch (e) {
            console.error('❌ [Sheets] Failed to parse GOOGLE_CREDENTIALS env:', e.message);
        }
    }

    // 2. Try local credentials.json
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
 * Ensures the 'Views' tab exists in the spreadsheet.
 * Returns the numeric sheetId for use with batchUpdate requests.
 */
async function ensureSheetTab(sheets) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const tab = spreadsheet.data.sheets.find(
            s => s.properties.title === SHEET_NAME
        );
        if (!tab) {
            console.log(`📄 [Sheets] Creating tab "${SHEET_NAME}"...`);
            const addRes = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: { properties: { title: SHEET_NAME } }
                    }]
                }
            });
            return addRes.data.replies[0].addSheet.properties.sheetId;
        }
        return tab.properties.sheetId;
    } catch (e) {
        console.warn('⚠️ [Sheets] Could not check/create tab:', e.message);
        return 0;
    }
}

/**
 * Enables Google Sheets' built-in auto-filter on all columns.
 * Users can then click column headers to filter by Platform, Views range, etc.
 */
async function ensureBasicFilter(sheets, sheetId, rowCount) {
    try {
        // Clear any existing filter first, then set a new one
        const requests = [
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
        ];

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests },
        });
        console.log('🔽 [Sheets] Auto-filter enabled on all columns');
    } catch (e) {
        console.warn('⚠️ [Sheets] Could not set filter:', e.message);
    }
}

export async function ensureHeaders() {
    const client = await getAuthClient();
    const sheets = getSheetsApi(client);

    const sheetId = await ensureSheetTab(sheets);

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:H1`,
    });

    const existing = res.data.values ? res.data.values[0] : [];

    if (existing.length === 0) {
        console.log('📝 [Sheets] Writing headers...');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:H1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [HEADERS] },
        });
    }

    // Enable auto-filter on the sheet
    await ensureBasicFilter(sheets, sheetId);
}

// ─── Read all data ─────────────────────────────────────────────────
export async function getAllData() {
    const client = await getAuthClient();
    const sheets = getSheetsApi(client);

    await ensureSheetTab(sheets);

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:H`,
        });

        const rows = res.data.values || [];
        if (rows.length <= 1) return []; // only headers or empty

        const headers = rows[0];
        return rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = row[i] || '';
            });
            return obj;
        });
    } catch (e) {
        // If the tab still fails to read, return empty
        console.warn('⚠️ [Sheets] Could not read data:', e.message);
        return [];
    }
}

// ─── Write scraped results ────────────────────────────────────────
/**
 * Strategy: For each video, find existing row with same Video ID.
 * If found, update the Views/Likes and Scrape Date.
 * If not found, append a new row.
 */
export async function upsertResults(results) {
    const client = await getAuthClient();
    const sheets = getSheetsApi(client);

    // 1. Read existing data
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:H`,
    });

    const rows = res.data.values || [];
    const today = new Date().toISOString().split('T')[0];

    // Build index: videoId → row number (1-indexed, skip header)
    const idIndex = {};
    for (let i = 1; i < rows.length; i++) {
        const videoId = rows[i][2]; // Column C = Video ID
        if (videoId) idIndex[videoId] = i + 1; // sheet rows are 1-indexed
    }

    const toAppend = [];
    const updates = [];

    for (const r of results) {
        const row = [
            today,
            r.platform,
            r.id,
            r.title,
            r.url,
            r.views,
            r.likes,
            r.date,
        ];

        const existingRow = idIndex[r.id];
        if (existingRow) {
            // Update: only Scrape Date (A), Views (F), Likes (G)
            updates.push({
                range: `${SHEET_NAME}!A${existingRow}`,
                values: [[today]],
            });
            updates.push({
                range: `${SHEET_NAME}!F${existingRow}:G${existingRow}`,
                values: [[r.views, r.likes]],
            });
        } else {
            toAppend.push(row);
        }
    }

    // Batch updates
    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updates,
            },
        });
        console.log(`✏️  [Sheets] Updated ${updates.length / 2} existing rows`);
    }

    // Append new rows
    if (toAppend.length > 0) {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:H`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: toAppend },
        });
        console.log(`➕ [Sheets] Appended ${toAppend.length} new rows`);
    }

    // Re-apply auto-filter to cover new rows
    const sheetId = await ensureSheetTab(sheets);
    await ensureBasicFilter(sheets, sheetId);

    return { updated: updates.length / 2, appended: toAppend.length };
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
            console.log(`✅ Connected! Found ${data.length} data rows.`);
            console.log('Sample:', data.slice(0, 2));
        } catch (e) {
            console.error('❌ Test failed:', e.message);
        }
    })();
}
