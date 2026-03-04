/**
 * YouTube Scraper — Uses Apify streamers/youtube-scraper
 * 
 * @param {import('apify-client').ApifyClient} apifyClient
 * @param {object} options
 * @param {number|null} options.maxItems - null = ALL videos, number = limit
 */

import { TRACKED_CHANNELS, ACTORS } from '../../config.js';

export async function scrapeYouTube(apifyClient, { maxItems = null } = {}) {
    const config = TRACKED_CHANNELS.youtube;
    const label = maxItems ? `last ${maxItems}` : 'ALL';
    console.log(`🎬 [YouTube] Scraping ${label} videos from: ${config.channelUrl}`);

    const input = {
        startUrls: [{ url: config.channelUrl }],
        maxResults: maxItems || 9999,
        maxResultsShorts: maxItems || 9999,
        maxResultStreams: 0,
    };

    const run = await apifyClient.actor(ACTORS.youtube).call(input, {
        waitSecs: 600,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    console.log(`🎬 [YouTube] Got ${items.length} results`);

    return items.map(item => ({
        platform: 'YouTube',
        url: item.url || '',
        title: (item.title || '').substring(0, 200),
        views: item.viewCount || 0,
        likes: item.likes || 0,
        date: item.date || '',
        id: item.id || '',
        duration: item.duration || '',
    }));
}
