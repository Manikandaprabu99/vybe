import { yt } from '@/lib/youtube/server';
import { DAY, FEATURED_ARTISTS, yearsAgoIso } from '@/lib/youtube/core';
import { getRadioStations } from '@/lib/radio';
import { Track } from '@/lib/types';
import HomeFeed from '@/components/HomeFeed';

// Home is built ahead of time by GitHub Actions — on every push and on a
// schedule (.github/workflows/deploy.yml) — so its YouTube calls run once
// per build for everyone, not once per visitor. All cheap calls: the
// trending charts and the Tamil labels' new uploads cost about 10 units; the
// evergreen and artist searches are reused for a day from the build cache.

// One shelf's failure (quota, network) just leaves that shelf out.
async function safe<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch (err) {
    console.error('Home shelf failed to load', err);
    return [];
  }
}

export default async function HomePage() {
  const tenYearsAgo = yearsAgoIso(10);

  const [trending, newTamil, english, oldTamil, oldEnglish, artistSongs, radio] = await Promise.all([
    safe(yt.getTrendingMusic(12, 'IN')),
    // New songs straight from the Tamil labels' channels; a search only as a
    // fallback if the labels come back nearly empty.
    safe(
      yt
        .getLatestTamilSongs(16)
        .then((songs) =>
          songs.length >= 4
            ? songs
            : yt.searchYouTube('Tamil movie audio song', { order: 'date', maxResults: 12, cacheSeconds: 6 * 3600 })
        )
    ),
    safe(yt.getTrendingMusic(12, 'US')),
    safe(yt.searchYouTube('Tamil melody hits', { order: 'viewCount', maxResults: 12, publishedBefore: tenYearsAgo, cacheSeconds: DAY })),
    safe(yt.searchYouTube('English classic hits', { order: 'viewCount', maxResults: 12, publishedBefore: tenYearsAgo, cacheSeconds: DAY })),
    Promise.all(FEATURED_ARTISTS.map((a) => yt.getArtistSongs(a.name).catch((): Track[] => []))),
    // Not YouTube, so it costs no quota — and it plays in the background.
    safe(getRadioStations('tamil', 12)),
  ]);

  const artists = FEATURED_ARTISTS.map((a, i) => ({ ...a, thumbnail: artistSongs[i][0]?.thumbnail ?? '' }));
  const youtubeMissing = trending.length + newTamil.length + english.length + oldTamil.length + oldEnglish.length === 0;

  return <HomeFeed data={{ trending, newTamil, english, oldTamil, oldEnglish, artists, radio }} youtubeMissing={youtubeMissing} />;
}
