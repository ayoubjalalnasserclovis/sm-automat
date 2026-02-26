/**
 * dailyUpdate.js — Main orchestrator
 * 
 * Runs all scrapers, collects results, writes to Google Sheets.
 * Usage:
 *   node scripts/dailyUpdate.js            # full run
 *   node scripts/dailyUpdate.js --dry-run   # print to console only
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { scrapeYouTube } from './scrapers/youtube.js';
import { scrapeInstagram } from './scrapers/instagram.js';
import { scrapeTikTok } from './scrapers/tiktok.js';
import { ensureHeaders, upsertResults } from './sheetClient.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log(`📊 SM Automat — Daily Update`);
    console.log(`📅 ${new Date().toISOString().split('T')[0]}`);
    console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN (no sheet write)' : 'LIVE'}`);
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
        const ytResults = await scrapeYouTube(apifyClient);
        allResults.push(...ytResults);
        console.log(`   ✅ YouTube: ${ytResults.length} videos\n`);
    } catch (e) {
        console.error(`   ❌ YouTube failed: ${e.message}\n`);
    }

    // ─── Instagram ─────────────────────────────────────────────
    try {
        const igResults = await scrapeInstagram(apifyClient);
        allResults.push(...igResults);
        console.log(`   ✅ Instagram: ${igResults.length} posts\n`);
    } catch (e) {
        console.error(`   ❌ Instagram failed: ${e.message}\n`);
    }

    // ─── TikTok ────────────────────────────────────────────────
    try {
        const ttResults = await scrapeTikTok(apifyClient);
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
    } else {
        console.log('\n⚠️  No results to write.');
    }
}

main().catch(e => {
    console.error('💀 Fatal error:', e);
    process.exit(1);
});
