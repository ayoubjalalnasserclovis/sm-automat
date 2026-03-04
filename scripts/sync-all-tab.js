/**
 * sync-all-tab.js — Creates/updates the "All" tab with data from all platform tabs
 * 
 * Usage: node scripts/sync-all-tab.js
 * Also called automatically after each scrape.
 */
import 'dotenv/config';
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
const ALL_TAB = 'All';
const HEADERS = ['Scrape Date', 'Platform', 'Video ID', 'Title', 'URL', 'Views', 'Likes', 'Post Date'];

async function getAuth() {
    if (process.env.GOOGLE_CREDENTIALS) {
        const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES }).getClient();
    }
    return new google.auth.GoogleAuth({ keyFile: CREDENTIALS_PATH, scopes: SCOPES }).getClient();
}

export async function syncAllTab() {
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Read all data from platform tabs
    const allRows = [];
    for (const [platform, tabName] of Object.entries(SHEET_TABS)) {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tabName}!A:H`,
            });
            const rows = res.data.values || [];
            if (rows.length > 1) {
                allRows.push(...rows.slice(1)); // skip header
            }
        } catch (e) {
            console.warn(`⚠️ Could not read "${tabName}":`, e.message);
        }
    }

    console.log(`📊 [All] Merging ${allRows.length} total rows from all platforms`);

    // 2. Ensure "All" tab exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    let tab = spreadsheet.data.sheets.find(s => s.properties.title === ALL_TAB);

    if (!tab) {
        console.log(`📄 [All] Creating "${ALL_TAB}" tab...`);
        const addRes = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{ addSheet: { properties: { title: ALL_TAB } } }]
            }
        });
        // Re-fetch to get the tab info
        const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        tab = refreshed.data.sheets.find(s => s.properties.title === ALL_TAB);
    }

    const sheetId = tab.properties.sheetId;

    // 3. Clear and rewrite
    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${ALL_TAB}!A:H`,
        });
    } catch (e) { /* empty tab */ }

    const writeData = [HEADERS, ...allRows];
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${ALL_TAB}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: writeData },
    });

    // 4. Apply auto-filter
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
                                endRowIndex: writeData.length,
                                startColumnIndex: 0,
                                endColumnIndex: HEADERS.length,
                            }
                        }
                    }
                }
            ]
        }
    });

    console.log(`✅ [All] Tab updated with ${allRows.length} rows + auto-filter`);
}

// Run directly
if (process.argv[1].includes('sync-all-tab')) {
    syncAllTab().catch(e => {
        console.error('💀 Fatal:', e);
        process.exit(1);
    });
}
