import {
  searchYouTube,
  getTrendingMusic,
  getArtistHighlight,
  yearsAgoIso,
  FEATURED_ARTISTS,
} from '@/lib/youtube';
import { Track } from '@/lib/types';
import TrackCard from '@/components/TrackCard';
import ArtistTile from '@/components/ArtistTile';
import HeroCard from '@/components/HeroCard';

// Refreshed hourly rather than on every visit. Songs don't get released
// every minute, and this keeps the free YouTube API quota (10,000 units/day)
// sustainable no matter how many friends open the app during that hour —
// the earlier "always live" setting paid the full query cost per visitor.
export const revalidate = 3600;

interface ArtistHighlight {
  name: string;
  track: Track;
}

// Isolates one shelf's query so a single failed/empty query can't take the
// rest of Home down with it — it just quietly renders as an empty shelf.
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

  const [trending, newTamil, newEnglish, oldTamil, oldEnglish, artists] = await Promise.all([
    safe(getTrendingMusic(12)),
    safe(searchYouTube('Tamil movie audio song', { order: 'date', maxResults: 12 })),
    safe(searchYouTube('English official audio', { order: 'date', maxResults: 12 })),
    safe(
      searchYouTube('Tamil melody hits', {
        order: 'viewCount',
        maxResults: 12,
        publishedBefore: tenYearsAgo,
      })
    ),
    safe(
      searchYouTube('English classic hits', {
        order: 'viewCount',
        maxResults: 12,
        publishedBefore: tenYearsAgo,
      })
    ),
    safe(
      Promise.all(
        FEATURED_ARTISTS.map(async (name): Promise<ArtistHighlight | null> => {
          const track = await getArtistHighlight(name);
          return track ? { name, track } : null;
        })
      ).then((results): ArtistHighlight[] =>
        results.filter((r): r is ArtistHighlight => r !== null)
      )
    ),
  ]);

  const totalTracks =
    trending.length + newTamil.length + newEnglish.length + oldTamil.length + oldEnglish.length + artists.length;
  const heroTrack = trending[0] ?? newTamil[0] ?? newEnglish[0] ?? null;
  const heroContext = trending[0] ? trending : newTamil[0] ? newTamil : newEnglish;

  return (
    <div className="pt-6">
      <div className="mb-6 px-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">VYBE</h1>
        <p className="mt-1 text-sm text-haze">Tamil & English, picked fresh every hour.</p>
      </div>

      {totalTracks === 0 && (
        <p className="text-sm text-magenta px-4 mb-4">
          Nothing loaded — check that YOUTUBE_API_KEY is set correctly.
        </p>
      )}

      {heroTrack && <HeroCard track={heroTrack} context={heroContext} />}

      <Shelf title="Trending now" tracks={trending} />
      <ArtistShelf artists={artists} />
      <Shelf title="New movie songs — Tamil" tracks={newTamil} />
      <Shelf title="New releases — English" tracks={newEnglish} />
      <Shelf title="Tamil evergreens" tracks={oldTamil} />
      <Shelf title="English classics" tracks={oldEnglish} />
    </div>
  );
}

function Shelf({ title, tracks }: { title: string; tracks: Track[] }) {
  if (tracks.length === 0) return null;
  return (
    <section className="mb-9">
      <h2 className="mb-3 px-4 font-display text-lg font-semibold tracking-tight text-paper sm:text-xl">
        {title}
      </h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-1">
        {tracks.map((t) => (
          <TrackCard key={t.id} track={t} context={tracks} />
        ))}
      </div>
    </section>
  );
}

function ArtistShelf({ artists }: { artists: ArtistHighlight[] }) {
  if (artists.length === 0) return null;
  return (
    <section className="mb-9">
      <h2 className="mb-3 px-4 font-display text-lg font-semibold tracking-tight text-paper sm:text-xl">
        Popular artists
      </h2>
      <div className="flex gap-5 overflow-x-auto no-scrollbar px-4 pb-1">
        {artists.map((a) => (
          <ArtistTile key={a.name} name={a.name} thumbnail={a.track.thumbnail} />
        ))}
      </div>
    </section>
  );
}
