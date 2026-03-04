/**
 * fix-sheet.js — Delete junk tabs + force auto-filter on all platform tabs
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
const HEADERS_COUNT = 8;

// Tabs to delete
const TABS_TO_DELETE = ['Feuille 1', 'Views', 'Tableau2'];

async function main() {
    let auth;
    if (process.env.GOOGLE_CREDENTIALS) {
        const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        auth = await new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES }).getClient();
    } else {
        auth = await new google.auth.GoogleAuth({ keyFile: CREDENTIALS_PATH, scopes: SCOPES }).getClient();
    }
    const sheets = google.sheets({ version: 'v4', auth });

    // Get all tabs
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const allSheets = spreadsheet.data.sheets;

    console.log('📋 Current tabs:');
    for (const s of allSheets) {
        console.log(`   - "${s.properties.title}" (sheetId: ${s.properties.sheetId}, rows: ${s.properties.gridProperties.rowCount})`);
    }

    // 1. Delete junk tabs
    const requests = [];
    for (const tabName of TABS_TO_DELETE) {
        const tab = allSheets.find(s => s.properties.title === tabName);
        if (tab) {
            console.log(`\n🗑️  Deleting tab "${tabName}"...`);
            requests.push({ deleteSheet: { sheetId: tab.properties.sheetId } });
        }
    }

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests },
        });
        console.log(`   ✅ Deleted ${requests.length} tab(s)`);
    }

    // 2. Apply auto-filter on each platform tab
    // Re-fetch to get updated sheet info
    const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

    for (const [platform, tabName] of Object.entries(SHEET_TABS)) {
        const tab = refreshed.data.sheets.find(s => s.properties.title === tabName);
        if (!tab) {
            console.log(`\n⚠️ Tab "${tabName}" not found, skipping`);
            continue;
        }

        const sheetId = tab.properties.sheetId;
        const rowCount = tab.properties.gridProperties.rowCount;

        console.log(`\n🔽 Setting filter on "${tabName}" (sheetId: ${sheetId}, rows: ${rowCount})...`);

        try {
            // Clear then set filter with explicit endRowIndex
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
                                        endRowIndex: rowCount,
                                        startColumnIndex: 0,
                                        endColumnIndex: HEADERS_COUNT,
                                    }
                                }
                            }
                        }
                    ]
                }
            });
            console.log(`   ✅ Filter applied on "${tabName}" (rows 1-${rowCount})`);
        } catch (e) {
            console.error(`   ❌ Failed on "${tabName}":`, e.message);
        }
    }

    console.log('\n✅ Done! Check your Google Sheet — filters should now work on all tabs.');
}

main().catch(e => {
    console.error('💀 Fatal:', e);
    process.exit(1);
});
