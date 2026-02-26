/**
 * TikTok Scraper — Uses Apify clockworks/tiktok-scraper
 * Scrapes profile videos and returns play/like counts.
 */

import { TRACKED_CHANNELS, ACTORS } from '../../config.js';

/**
 * @param {import('apify-client').ApifyClient} apifyClient
 * @returns {Promise<Array<{platform: string, url: string, title: string, views: number, likes: number, date: string, id: string}>>}
 */
export async function scrapeTikTok(apifyClient) {
    const config = TRACKED_CHANNELS.tiktok;
    console.log(`🎵 [TikTok] Scraping profile: ${config.profileUrl}`);

    const input = {
        profiles: [config.profileUrl],
        resultsPerPage: config.resultsPerPage || 50,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
    };

    const run = await apifyClient.actor(ACTORS.tiktok).call(input, {
        waitSecs: 300,
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
