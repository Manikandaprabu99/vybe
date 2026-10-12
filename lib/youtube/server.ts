import { createYouTube, YouTubeGet } from './core';

// Build-time YouTube access — runs on GitHub Actions (or a local `next build`)
// with the secret YOUTUBE_API_KEY, never in the browser. Next.js keeps each
// answer in .next/cache for `cacheSeconds`, and the deploy workflow carries
// that cache from one scheduled build to the next, so a shelf that only
// changes daily is paid for once a day, not on every build.
//
// The key goes in a header rather than the URL: the cache stores each
// request's URL, and the cache travels between workflow runs.
const API_BASE = process.env.YOUTUBE_API_BASE ?? 'https://www.googleapis.com/youtube/v3'; // tests point this at a mock

const serverGet: YouTubeGet = async (endpoint, params, cacheSeconds) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  const res = await fetch(`${API_BASE}/${endpoint}?${new URLSearchParams(params).toString()}`, {
    headers: { 'X-Goog-Api-Key': key },
    next: { revalidate: cacheSeconds },
  });
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  return res.json();
};

export const yt = createYouTube(serverGet);
