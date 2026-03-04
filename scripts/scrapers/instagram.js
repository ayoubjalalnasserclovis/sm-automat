/**
 * Instagram Scraper — Uses Apify apify/instagram-scraper
 * 
 * @param {import('apify-client').ApifyClient} apifyClient
 * @param {object} options
 * @param {number|null} options.maxItems - null = ALL posts, number = limit
 */

import { TRACKED_CHANNELS, ACTORS } from '../../config.js';

export async function scrapeInstagram(apifyClient, { maxItems = null } = {}) {
    const config = TRACKED_CHANNELS.instagram;
    const label = maxItems ? `last ${maxItems}` : 'ALL';
    console.log(`📸 [Instagram] Scraping ${label} posts from: ${config.profileUrl}`);

    const input = {
        directUrls: [config.profileUrl],
        resultsType: 'posts',
        resultsLimit: maxItems || 9999,
    };

    const run = await apifyClient.actor(ACTORS.instagram).call(input, {
        waitSecs: 600,
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
