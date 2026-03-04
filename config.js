/**
 * config.js — Central configuration for tracked channels/profiles
 * 
 * Two scrape modes:
 *   - FULL:  scrape ALL videos (monthly)
 *   - DAILY: scrape last 5 videos only (daily)
 */

export const TRACKED_CHANNELS = {
    youtube: {
        channelUrl: 'https://www.youtube.com/@Othmane_dot',
    },
    tiktok: {
        profileUrl: 'https://www.tiktok.com/@othmane.elz',
    },
    instagram: {
        profileUrl: 'https://www.instagram.com/othmane.elz/',
    },
};

// How many videos to fetch in daily mode (last N)
export const DAILY_LIMIT = 5;

// Google Sheet tab name
export const SHEET_NAME = 'Views';

// Apify actor IDs
export const ACTORS = {
    youtube: 'streamers/youtube-scraper',
    instagram: 'apify/instagram-scraper',
    tiktok: 'clockworks/tiktok-scraper',
};
