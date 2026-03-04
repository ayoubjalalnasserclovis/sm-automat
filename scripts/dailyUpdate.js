/**
 * dailyUpdate.js — Main orchestrator
 * 
 * Two modes:
 *   --full       Scrape ALL videos from every channel (monthly)
 *   (default)    Scrape last 5 videos only (daily)
 *   --dry-run    Print results without writing to sheet
 * 
 * Usage:
 *   node scripts/dailyUpdate.js               # daily (last 5)
 *   node scripts/dailyUpdate.js --full         # monthly (all videos)
 *   node scripts/dailyUpdate.js --dry-run      # preview only
 *   node scripts/dailyUpdate.js --full --dry-run
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { DAILY_LIMIT, FULL_LIMIT } from '../config.js';
import { scrapeYouTube } from './scrapers/youtube.js';
import { scrapeInstagram } from './scrapers/instagram.js';
import { scrapeTikTok } from './scrapers/tiktok.js';
import { ensureHeaders, upsertResults } from './sheetClient.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FULL_MODE = process.argv.includes('--full');
const maxItems = FULL_MODE ? FULL_LIMIT : DAILY_LIMIT;

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log(`📊 SM Automat — ${FULL_MODE ? 'FULL Scrape (all videos)' : `Daily Scrape (last ${DAILY_LIMIT})`}`);
    console.log(`📅 ${new Date().toISOString().split('T')[0]}`);
    console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${FULL_MODE ? ' | FULL' : ' | DAILY'}`);
    console.log('═══════════════════════════════════════════\n');

    if (!process.env.APIFY_API_TOKEN) {
        console.error('❌ APIFY_API_TOKEN not set in .env');
        process.exit(1);
    }

    const apifyClient = new ApifyClient({
        token: process.env.APIFY_API_TOKEN,
    });

    const allResults = [];

    // ─── YouTube ───────────────────────────────────────────────
    try {
        const ytResults = await scrapeYouTube(apifyClient, { maxItems });
        allResults.push(...ytResults);
        console.log(`   ✅ YouTube: ${ytResults.length} videos\n`);
    } catch (e) {
        console.error(`   ❌ YouTube failed: ${e.message}\n`);
    }

    // ─── Instagram ─────────────────────────────────────────────
    try {
        const igResults = await scrapeInstagram(apifyClient, { maxItems });
        allResults.push(...igResults);
        console.log(`   ✅ Instagram: ${igResults.length} posts\n`);
    } catch (e) {
        console.error(`   ❌ Instagram failed: ${e.message}\n`);
    }

    // ─── TikTok ────────────────────────────────────────────────
    try {
        const ttResults = await scrapeTikTok(apifyClient, { maxItems });
        allResults.push(...ttResults);
        console.log(`   ✅ TikTok: ${ttResults.length} videos\n`);
    } catch (e) {
        console.error(`   ❌ TikTok failed: ${e.message}\n`);
    }

    console.log(`\n📦 Total results: ${allResults.length}`);

    if (DRY_RUN) {
        console.log('\n🏜️ DRY RUN — Printing results:\n');
        for (const r of allResults) {
            console.log(`  [${r.platform}] ${r.title.substring(0, 60)}... → ${r.views} views`);
        }
        return;
    }

    // ─── Write to Google Sheets ────────────────────────────────
    if (allResults.length > 0) {
        console.log('\n📝 Writing to Google Sheets...');
        await ensureHeaders();
        const stats = await upsertResults(allResults);
        console.log(`\n✅ Done! Updated: ${stats.updated}, Appended: ${stats.appended}`);

        // Sync the "All" tab
        const { syncAllTab } = await import('./sync-all-tab.js');
        await syncAllTab();
    } else {
        console.log('\n⚠️  No results to write.');
    }
}

main().catch(e => {
    console.error('💀 Fatal error:', e);
    process.exit(1);
});
