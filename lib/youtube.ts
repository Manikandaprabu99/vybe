import { Track } from './types';
import { cleanTitle, cleanArtist, looksLikeLabelChannel, extractArtistFromTitle } from './format';

// Shared by both endpoints below: prefer the channel as the artist, but if
// the channel is actually a record label's own channel, try to pull the real
// artist out of the title instead — falling back to the label name if the
// title doesn't give an unambiguous answer.
function resolveArtist(rawTitle: string, cleanedTitle: string, channelTitle: string): string {
  const artist = cleanArtist(channelTitle);
  if (!looksLikeLabelChannel(artist)) return artist;
  return extractArtistFromTitle(cleanedTitle) ?? extractArtistFromTitle(rawTitle) ?? artist;
}

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

  // Cached for an hour (matches app/page.tsx's `revalidate = 3600`) instead of
  // `no-store` — the free YouTube API quota is only 100 search requests/day,
  // and Home alone fires up to 8 of these per page load. Without caching,
  // that's roughly a dozen page loads to exhaust the entire day's quota,
  // after which every search-based shelf silently renders empty.
  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data: YouTubeSearchResponse = await res.json();
  return (data.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const title = cleanTitle(item.snippet.title);
      return {
        id: item.id!.videoId!,
        title,
        artist: resolveArtist(item.snippet.title, title, item.snippet.channelTitle),
        thumbnail:
          item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
        source: 'youtube' as const,
      };
    });
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

  const res = await fetch(`${VIDEOS_URL}?${params.toString()}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data: YouTubeVideosResponse = await res.json();
  return (data.items ?? []).map((item) => {
    const title = cleanTitle(item.snippet.title);
    return {
      id: item.id,
      title,
      artist: resolveArtist(item.snippet.title, title, item.snippet.channelTitle),
      thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
      source: 'youtube' as const,
    };
  });
}

// A small, easily-edited starter list for the "Popular artists" shelf — swap
// these for whoever your friend group actually listens to.
export const FEATURED_ARTISTS = ['Anirudh Ravichander', 'A.R. Rahman', 'Ed Sheeran', 'Taylor Swift'];

export async function getArtistHighlight(name: string): Promise<Track | null> {
  const results = await searchYouTube(`${name} songs`, { order: 'relevance', maxResults: 1 });
  return results[0] ?? null;
}

// Spotify-style "autoplay radio": once the queue runs out, keep the music
// going with more songs by the same artist instead of just stopping. YouTube
// Data API v3 dropped its relatedToVideoId param years ago, so there's no
// official "related videos" endpoint any more — same-artist search is the
// closest legitimate substitute. Falls back to a title-based query when the
// artist we have is actually a label channel (see resolveArtist above),
// since "Zee Music Company songs" is a much weaker signal than an artist name.
export async function getRelatedTracks(
  track: Track,
  excludeIds: Set<string>,
  maxResults = 10
): Promise<Track[]> {
  const query = !looksLikeLabelChannel(track.artist)
    ? `${track.artist} songs`
    : `${track.title} songs`;

  const results = await searchYouTube(query, { order: 'relevance', maxResults: 20 });
  return results.filter((t) => !excludeIds.has(t.id)).slice(0, maxResults);
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
