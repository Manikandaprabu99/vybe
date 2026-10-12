import { Track } from '../types';
import {
  cleanTitle,
  cleanArtist,
  looksLikeLabelChannel,
  extractArtistFromTitle,
  extractAlbum,
  looksLikeNonSong,
  isOtherLanguageVersion,
  parseIsoDuration,
  songKey,
} from '../format';

// Everything VYBE asks the YouTube Data API, written once and used from two
// places that fetch differently:
//   - lib/youtube/server.ts — at build time on GitHub Actions, with the
//     secret key, for Home, Radio and the artist pages (shared by everyone);
//   - lib/youtube/client.ts — in the browser/app, with the restricted
//     browser key, for Search and autoplay (cached on the device).
// The whole app shares the free quota of 10,000 units a day. A search costs
// 100 units; a chart, a channel's uploads or a batch of video details costs
// 1. So everything here avoids searches where a 1-unit call can do the job,
// and every call says how long its answer may be reused.

export const HOUR = 3600;
export const DAY = 24 * HOUR;

// Fetches one API endpoint; `cacheSeconds` is how long the answer may be
// reused before asking YouTube again.
export type YouTubeGet = (endpoint: string, params: Record<string, string>, cacheSeconds: number) => Promise<unknown>;

// Official YouTube channels of the big Tamil film-music labels — where new
// Tamil songs appear first. Each id was checked against the channel's own
// page (its id and canonical link agree) on 2026-10-12.
export const TAMIL_LABEL_CHANNELS: { name: string; channelId: string }[] = [
  { name: 'Sony Music South', channelId: 'UCn4rEMqKtwBQ6-oEwbd4PcA' },
  { name: 'Think Music India', channelId: 'UCLbdVvreihwZRL6kwuEUYsA' },
  { name: 'Saregama Tamil', channelId: 'UCzee67JnEcuvjErRyWP3GpQ' },
  { name: 'T-Series Tamil', channelId: 'UCAEv0ANkT221wXsTnxFnBsQ' },
  { name: 'U1 Records', channelId: 'UCf0KybguYN3FqbRoxCbR6kw' },
  { name: 'Tips Tamil', channelId: 'UC48pE7QE4NZFTCsHT-IRxJw' },
];

// The "Popular artists" shelf — swap these for whoever your friends actually
// listen to. Each gets a page at /artist/<slug>/, built ahead of time.
export const FEATURED_ARTISTS: { slug: string; name: string; lang: 'ta' | 'en' }[] = [
  { slug: 'anirudh', name: 'Anirudh Ravichander', lang: 'ta' },
  { slug: 'ar-rahman', name: 'A.R. Rahman', lang: 'ta' },
  { slug: 'ed-sheeran', name: 'Ed Sheeran', lang: 'en' },
  { slug: 'taylor-swift', name: 'Taylor Swift', lang: 'en' },
];

interface Thumbnail {
  url: string;
}
interface Snippet {
  title: string;
  channelTitle: string;
  channelId?: string;
  publishedAt?: string;
  thumbnails?: { medium?: Thumbnail; high?: Thumbnail; default?: Thumbnail };
}
interface SearchResponse {
  items?: { id?: { videoId?: string }; snippet: Snippet }[];
}
interface VideosResponse {
  items?: {
    id: string;
    snippet: Snippet;
    contentDetails?: { duration?: string };
    status?: { embeddable?: boolean };
  }[];
}
interface ChannelsResponse {
  items?: { id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
}
interface PlaylistItemsResponse {
  items?: { contentDetails?: { videoId?: string } }[];
}

// Prefer the channel as the artist, but if the channel is actually a record
// label's own channel, try to pull the real artist out of the title instead.
function resolveArtist(rawTitle: string, cleanedTitle: string, channelTitle: string): string {
  const artist = cleanArtist(channelTitle);
  if (!looksLikeLabelChannel(artist)) return artist;
  return extractArtistFromTitle(cleanedTitle) ?? extractArtistFromTitle(rawTitle) ?? artist;
}

export function toTrack(id: string, snippet: Snippet): Track {
  const album = extractAlbum(snippet.title);
  // Label uploads pack the whole credits into the title ("Hukum - Lyric |
  // Jailer | Rajinikanth | Sun Pictures | Anirudh"). Once the movie is known,
  // show just the song part, and the movie instead of the label's name.
  const segments = snippet.title.split(/\s*\|\s*/).filter(Boolean);
  const title = album && segments.length >= 3 ? cleanTitle(segments[0]) : cleanTitle(snippet.title);
  const artist = resolveArtist(snippet.title, title, snippet.channelTitle);
  return {
    id,
    title,
    artist: album && looksLikeLabelChannel(artist) ? album : artist,
    thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
    source: 'youtube',
    ...(album ? { album } : {}),
    ...(snippet.channelId ? { channelId: snippet.channelId } : {}),
  };
}

// Rounded down to midnight UTC: this ends up in the request URL, which is the
// cache key — with the exact time in it, every request looked new and the
// evergreen searches were re-run (and re-paid) each time.
export function yearsAgoIso(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function createYouTube(get: YouTubeGet) {
  async function searchYouTube(
    query: string,
    opts: { order?: 'relevance' | 'date' | 'viewCount'; maxResults?: number; publishedBefore?: string; cacheSeconds?: number } = {}
  ): Promise<Track[]> {
    const params: Record<string, string> = {
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '10', // Music
      // Only videos allowed to play outside youtube.com — otherwise the
      // embed just shows "unavailable" and the song gets skipped.
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      order: opts.order ?? 'relevance',
      maxResults: String(opts.maxResults ?? 20),
    };
    if (opts.publishedBefore) params.publishedBefore = opts.publishedBefore;
    const data = (await get('search', params, opts.cacheSeconds ?? 6 * HOUR)) as SearchResponse;
    return (data.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => toTrack(item.id!.videoId!, item.snippet));
  }

  // YouTube's actual "most popular right now" music chart for a country —
  // 1 unit instead of a 100-unit search. 'IN' mixes Tamil, Hindi and English
  // by what's genuinely popular; 'US' makes a good "English hits" shelf.
  async function getTrendingMusic(maxResults = 12, regionCode = 'IN'): Promise<Track[]> {
    const data = (await get(
      'videos',
      { part: 'snippet,status', chart: 'mostPopular', videoCategoryId: '10', regionCode, maxResults: String(maxResults) },
      HOUR
    )) as VideosResponse;
    return (data.items ?? []).filter((v) => v.status?.embeddable !== false).map((v) => toTrack(v.id, v.snippet));
  }

  async function getUploadsPlaylists(channelIds: string[]): Promise<string[]> {
    try {
      // Uploads playlists never change — reuse for a month (1 unit).
      const data = (await get(
        'channels',
        { part: 'contentDetails', id: channelIds.join(','), maxResults: '50' },
        30 * DAY
      )) as ChannelsResponse;
      const byId = new Map((data.items ?? []).map((c) => [c.id, c.contentDetails?.relatedPlaylists?.uploads]));
      return channelIds.map((id) => byId.get(id) ?? `UU${id.slice(2)}`);
    } catch {
      // YouTube's long-standing convention for a channel's uploads playlist.
      return channelIds.map((id) => `UU${id.slice(2)}`);
    }
  }

  // Recent songs from specific channels, cheaply: 1 unit per channel to list
  // its latest uploads, plus 1 unit per 50 videos to check each one is a
  // playable, song-length music video (not a trailer, a jukebox or a Short).
  async function getLatestFromChannels(
    channelIds: string[],
    opts: { perChannel?: number; max?: number; maxAgeDays?: number } = {}
  ): Promise<Track[]> {
    const { perChannel = 8, max = 16, maxAgeDays = 120 } = opts;
    if (channelIds.length === 0) return [];
    const playlists = await getUploadsPlaylists(channelIds);
    const lists = await Promise.all(
      playlists.map((playlistId) =>
        (get('playlistItems', { part: 'contentDetails', playlistId, maxResults: String(perChannel) }, HOUR) as Promise<PlaylistItemsResponse>).catch(
          () => ({ items: [] }) as PlaylistItemsResponse
        )
      )
    );
    const ids = Array.from(
      new Set(lists.flatMap((l) => (l.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean) as string[]))
    );

    const details: NonNullable<VideosResponse['items']> = [];
    for (let i = 0; i < ids.length; i += 50) {
      const data = (await get(
        'videos',
        { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(',') },
        HOUR
      )) as VideosResponse;
      details.push(...(data.items ?? []));
    }

    const oldest = Date.now() - maxAgeDays * DAY * 1000;
    const seen = new Set<string>();
    return details
      .filter((v) => {
        const seconds = parseIsoDuration(v.contentDetails?.duration ?? '');
        const published = Date.parse(v.snippet.publishedAt ?? '') || 0;
        return (
          v.status?.embeddable !== false &&
          seconds >= 90 && // Shorts and snippets
          seconds <= 9 * 60 && // jukeboxes and full albums
          published >= oldest &&
          !looksLikeNonSong(v.snippet.title)
        );
      })
      .sort((a, b) => Date.parse(b.snippet.publishedAt ?? '') - Date.parse(a.snippet.publishedAt ?? ''))
      .map((v) => toTrack(v.id, v.snippet))
      .filter((t) => {
        const key = songKey(t.title, !!t.album);
        if (seen.has(key)) return false; // the lyric video and the video song of one track
        seen.add(key);
        return true;
      })
      .slice(0, max);
  }

  // New Tamil songs straight from the labels' channels: ~8 units, where a
  // search for the same shelf cost 100.
  function getLatestTamilSongs(max = 16): Promise<Track[]> {
    return getLatestFromChannels(
      TAMIL_LABEL_CHANNELS.map((c) => c.channelId),
      { perChannel: 8, max }
    );
  }

  // An artist's page and their tile on Home share this one search, kept for
  // a day.
  function getArtistSongs(name: string): Promise<Track[]> {
    return searchYouTube(`${name} songs`, { order: 'relevance', maxResults: 20, cacheSeconds: DAY });
  }

  // "Song radio": songs similar to `seed`, for autoplay. YouTube's API no
  // longer has a related-videos lookup, so similarity comes from what we know
  // about the seed, best signal first:
  //   1. the same movie/album (Tamil film songs name it in the title),
  //   2. the same singer/composer (or the song title, if the "artist" is a label),
  //   3. the newest songs from the same channel (1-2 units; for label
  //      channels that's other current songs in the same language).
  // Each search is reused for a day, so a second autoplay from the same
  // album or artist costs nothing; a fresh one costs 100-200 units.
  async function getRelatedTracks(seed: Track, excludeIds: Set<string>, maxResults = 10): Promise<Track[]> {
    const lists: Track[][] = [];

    const albumSongs = seed.album
      ? await searchYouTube(`${seed.album} songs`, { maxResults: 25, cacheSeconds: DAY }).catch(() => [])
      : [];
    if (albumSongs.length > 0) lists.push(albumSongs);

    if (albumSongs.length < 6) {
      const query = !looksLikeLabelChannel(seed.artist) ? `${seed.artist} songs` : `${seed.title} songs`;
      lists.push(await searchYouTube(query, { maxResults: 25, cacheSeconds: DAY }).catch(() => []));
    }

    if (seed.channelId) {
      lists.push(
        await getLatestFromChannels([seed.channelId], { perChannel: 15, max: 10, maxAgeDays: 5 * 365 }).catch(() => [])
      );
    }

    const seen = new Set([songKey(seed.title, !!seed.album)]);
    const accept = (t: Track) => {
      const key = songKey(t.title, !!t.album);
      if (
        excludeIds.has(t.id) ||
        seen.has(key) ||
        looksLikeNonSong(t.title) ||
        isOtherLanguageVersion(t.title, seed.title)
      ) {
        return false;
      }
      seen.add(key);
      return true;
    };

    // Up to four from the best list first (the album, when there is one),
    // then take turns between the lists so the queue doesn't turn into one
    // artist's entire catalogue.
    const result: Track[] = [];
    const queues = lists.map((l) => [...l]);
    const head = queues[0] ?? [];
    while (head.length > 0 && result.length < Math.min(4, maxResults)) {
      const t = head.shift()!;
      if (accept(t)) result.push(t);
    }
    while (result.length < maxResults && queues.some((q) => q.length > 0)) {
      for (const q of queues) {
        while (q.length > 0) {
          const t = q.shift()!;
          if (accept(t)) {
            result.push(t);
            break;
          }
        }
        if (result.length >= maxResults) break;
      }
    }
    return result;
  }

  return {
    searchYouTube,
    getTrendingMusic,
    getLatestFromChannels,
    getLatestTamilSongs,
    getArtistSongs,
    getRelatedTracks,
  };
}
