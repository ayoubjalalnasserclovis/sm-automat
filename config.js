/**
 * config.js — Central configuration for tracked channels/profiles
 * 
 * Add or remove URLs here to control what gets scraped daily.
 */

export const TRACKED_CHANNELS = {
    youtube: {
        channelUrl: 'https://www.youtube.com/@Othmane_dot',
        // We scrape the channel's shorts/videos and get view counts
        maxResults: 50,       // max videos to fetch per run
        maxResultsShorts: 50, // max shorts to fetch
    },
    tiktok: {
        profileUrl: 'https://www.tiktok.com/@othmane.elz',
        resultsPerPage: 50, // max videos to fetch per run
    },
    instagram: {
        profileUrl: 'https://www.instagram.com/othmane.elz/',
        resultsLimit: 50,   // max posts to fetch per run
    },
};

// Google Sheet tab name
export const SHEET_NAME = 'Views';

// Apify actor IDs
export const ACTORS = {
    youtube: 'streamers/youtube-scraper',
    instagram: 'apify/instagram-scraper',
    tiktok: 'clockworks/tiktok-scraper',
};
