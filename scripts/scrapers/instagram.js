/**
 * Instagram Scraper — Uses Apify apify/instagram-scraper
 * Scrapes profile posts and returns view/like counts.
 */

import { TRACKED_CHANNELS, ACTORS } from '../../config.js';

/**
 * @param {import('apify-client').ApifyClient} apifyClient
 * @returns {Promise<Array<{platform: string, url: string, title: string, views: number, likes: number, date: string, id: string}>>}
 */
export async function scrapeInstagram(apifyClient) {
    const config = TRACKED_CHANNELS.instagram;
    console.log(`📸 [Instagram] Scraping profile: ${config.profileUrl}`);

    const input = {
        directUrls: [config.profileUrl],
        resultsType: 'posts',
        resultsLimit: config.resultsLimit || 50,
    };

    const run = await apifyClient.actor(ACTORS.instagram).call(input, {
        waitSecs: 300,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    console.log(`📸 [Instagram] Got ${items.length} results`);

    return items.map(item => ({
        platform: 'Instagram',
        url: item.url || item.inputUrl || '',
        title: (item.caption || '').substring(0, 200),
        views: item.videoViewCount || item.playCount || 0,
        likes: item.likesCount || 0,
        date: item.timestamp || '',
        id: item.shortCode || item.id || '',
        type: item.type || 'Post',
    }));
}
