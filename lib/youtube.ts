import { Track } from './types';
import { cleanTitle, cleanArtist } from './format';

interface YouTubeThumbnail {
  url: string;
}
interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: { medium?: YouTubeThumbnail; default?: YouTubeThumbnail };
  };
}
interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

// videos.list (used for the trending chart) shapes its "id" differently
// from search.list — a plain string instead of { videoId }.
interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: { medium?: YouTubeThumbnail; default?: YouTubeThumbnail };
  };
}
interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[];
}

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export async function searchYouTube(
  query: string,
  opts: {
    order?: 'relevance' | 'date' | 'viewCount';
    maxResults?: number;
    publishedBefore?: string;
  } = {}
): Promise<Track[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10', // Music
    order: opts.order ?? 'relevance',
    maxResults: String(opts.maxResults ?? 20),
    key,
  });
  if (opts.publishedBefore) params.set('publishedBefore', opts.publishedBefore);

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data: YouTubeSearchResponse = await res.json();
  return (data.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      id: item.id!.videoId!,
      title: cleanTitle(item.snippet.title),
      artist: cleanArtist(item.snippet.channelTitle),
      thumbnail:
        item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
      source: 'youtube' as const,
    }));
}

// YouTube's actual "what's popular right now" chart, filtered to Music and
// India — a real trending signal rather than a keyword search, and it
// naturally mixes Tamil, Hindi and English by whatever's genuinely popular.
export async function getTrendingMusic(maxResults = 12): Promise<Track[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');

  const params = new URLSearchParams({
    part: 'snippet',
    chart: 'mostPopular',
    videoCategoryId: '10',
    regionCode: 'IN',
    maxResults: String(maxResults),
    key,
  });

  const res = await fetch(`${VIDEOS_URL}?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data: YouTubeVideosResponse = await res.json();
  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: cleanTitle(item.snippet.title),
    artist: cleanArtist(item.snippet.channelTitle),
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    source: 'youtube' as const,
  }));
}

// A small, easily-edited starter list for the "Popular artists" shelf — swap
// these for whoever your friend group actually listens to.
export const FEATURED_ARTISTS = ['Anirudh Ravichander', 'A.R. Rahman', 'Ed Sheeran', 'Taylor Swift'];

export async function getArtistHighlight(name: string): Promise<Track | null> {
  const results = await searchYouTube(`${name} songs`, { order: 'relevance', maxResults: 1 });
  return results[0] ?? null;
}

export function yearsAgoIso(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

// Optional: once you know specific official channel IDs you trust (Think Music,
// Sony Music South, T-Series, etc.), add them here and filter results by channelId
// in the routes below. Left empty on purpose — verifying exact channel IDs needs
// live access to YouTube, which this build doesn't have, so nothing is hardcoded
// here that might silently be wrong.
// Find a channel's ID: open the channel -> "..." menu -> "Share channel" -> "Copy channel ID".
export const PINNED_CHANNELS: { name: string; channelId: string }[] = [];
