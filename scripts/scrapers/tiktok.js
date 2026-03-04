/**
 * TikTok Scraper — Uses Apify clockworks/tiktok-scraper
 * 
 * @param {import('apify-client').ApifyClient} apifyClient
 * @param {object} options
 * @param {number|null} options.maxItems - null = ALL videos, number = limit
 */

import { TRACKED_CHANNELS, ACTORS } from '../../config.js';

export async function scrapeTikTok(apifyClient, { maxItems = null } = {}) {
    const config = TRACKED_CHANNELS.tiktok;
    const label = maxItems ? `last ${maxItems}` : 'ALL';
    console.log(`🎵 [TikTok] Scraping ${label} videos from: ${config.profileUrl}`);

    const input = {
        profiles: [config.profileUrl],
        resultsPerPage: maxItems || 9999,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
    };

    const run = await apifyClient.actor(ACTORS.tiktok).call(input, {
        waitSecs: 600,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    console.log(`🎵 [TikTok] Got ${items.length} results`);

    return items.map(item => ({
        platform: 'TikTok',
        url: item.webVideoUrl || '',
        title: (item.text || '').substring(0, 200),
        views: item.playCount || 0,
        likes: item.diggCount || 0,
        date: item.createTimeISO || '',
        id: item.id || '',
        shares: item.shareCount || 0,
        comments: item.commentCount || 0,
    }));
}
