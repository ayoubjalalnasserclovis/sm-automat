/**
 * config.js — Central configuration for tracked channels/profiles
 * 
 * Two scrape modes:
 *   - FULL:  scrape up to FULL_LIMIT videos (monthly)
 *   - DAILY: scrape last DAILY_LIMIT videos only (daily)
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

// How many videos to fetch per mode
export const DAILY_LIMIT = 5;      // daily: last 5 videos
export const FULL_LIMIT = 500;     // monthly: cap at 500 per platform

// Google Sheet tab names — one per platform
export const SHEET_TABS = {
    YouTube: 'YouTube',
    Instagram: 'Instagram',
    TikTok: 'TikTok',
};

// Apify actor IDs
export const ACTORS = {
    youtube: 'streamers/youtube-scraper',
    instagram: 'apify/instagram-scraper',
    tiktok: 'clockworks/tiktok-scraper',
};
