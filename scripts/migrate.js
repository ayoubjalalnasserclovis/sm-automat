/**
 * migrate.js — One-time migration script
 * 
 * Reads all data from the old "Views" tab, splits by platform,
 * and writes to the new per-platform tabs (YouTube, Instagram, TikTok).
 * 
 * Usage: node scripts/migrate.js
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
const OLD_TAB = 'Views';
const HEADERS = ['Scrape Date', 'Platform', 'Video ID', 'Title', 'URL', 'Views', 'Likes', 'Post Date'];

async function getAuth() {
    if (process.env.GOOGLE_CREDENTIALS) {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
        return auth.getClient();
    }
    const auth = new google.auth.GoogleAuth({ keyFile: CREDENTIALS_PATH, scopes: SCOPES });
    return auth.getClient();
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('📦 Migration: Views → YouTube/Instagram/TikTok tabs');
    console.log('═══════════════════════════════════════════\n');

    const client = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // 1. Read all data from old "Views" tab
    console.log(`📖 Reading data from "${OLD_TAB}" tab...`);
    let rows;
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${OLD_TAB}!A:H`,
        });
        rows = res.data.values || [];
    } catch (e) {
        console.error(`❌ Could not read "${OLD_TAB}" tab:`, e.message);
        console.log('Nothing to migrate.');
        return;
    }

    if (rows.length <= 1) {
        console.log('⚠️ No data rows found in Views tab.');
        return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    console.log(`   Found ${dataRows.length} data rows\n`);

    // 2. Group by platform
    const grouped = { YouTube: [], Instagram: [], TikTok: [] };
    for (const row of dataRows) {
        const platform = row[1] || 'Unknown'; // Column B = Platform
        if (grouped[platform]) {
            grouped[platform].push(row);
        } else {
            console.warn(`   ⚠️ Unknown platform "${platform}", skipping row`);
        }
    }

    for (const [p, rows] of Object.entries(grouped)) {
        console.log(`   ${p}: ${rows.length} rows`);
    }

    // 3. Ensure each tab exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);

    for (const tabName of Object.values(SHEET_TABS)) {
        if (!existingTabs.includes(tabName)) {
            console.log(`\n📄 Creating tab "${tabName}"...`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{ addSheet: { properties: { title: tabName } } }]
                }
            });
        }
    }

    // 4. Write headers + data to each platform tab
    for (const [platform, tabName] of Object.entries(SHEET_TABS)) {
        const platformRows = grouped[platform] || [];
        console.log(`\n📝 Writing to "${tabName}" tab (${platformRows.length} rows)...`);

        // Clear existing data first
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tabName}!A:H`,
            });
        } catch (e) { /* tab might be empty */ }

        // Write headers + data
        const allRows = [HEADERS, ...platformRows];
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tabName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: allRows },
        });

        console.log(`   ✅ Wrote ${platformRows.length} rows to "${tabName}"`);

        // Enable auto-filter
        const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const tab = refreshed.data.sheets.find(s => s.properties.title === tabName);
        if (tab) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [
                        { clearBasicFilter: { sheetId: tab.properties.sheetId } },
                        {
                            setBasicFilter: {
                                filter: {
                                    range: {
                                        sheetId: tab.properties.sheetId,
                                        startRowIndex: 0,
                                        startColumnIndex: 0,
                                        endColumnIndex: HEADERS.length,
                                    }
                                }
                            }
                        }
                    ]
                }
            });
            console.log(`   🔽 Auto-filter enabled on "${tabName}"`);
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ Migration complete!');
    console.log('   You can now delete the old "Views" tab manually if needed.');
    console.log('═══════════════════════════════════════════');
}

main().catch(e => {
    console.error('💀 Fatal:', e);
    process.exit(1);
});
