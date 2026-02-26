/**
 * YouTube Scraper — Uses Apify streamers/youtube-scraper
 * Scrapes the channel for all videos/shorts and returns view counts.
 */

import { TRACKED_CHANNELS, ACTORS } from '../../config.js';

/**
 * @param {import('apify-client').ApifyClient} apifyClient
 * @returns {Promise<Array<{platform: string, url: string, title: string, views: number, likes: number, date: string, id: string}>>}
 */
export async function scrapeYouTube(apifyClient) {
    const config = TRACKED_CHANNELS.youtube;
    console.log(`🎬 [YouTube] Scraping channel: ${config.channelUrl}`);

    const input = {
        startUrls: [{ url: config.channelUrl }],
        maxResults: config.maxResults || 50,
        maxResultsShorts: config.maxResultsShorts || 50,
        maxResultStreams: 0,
    };

    const run = await apifyClient.actor(ACTORS.youtube).call(input, {
        waitSecs: 300,
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
