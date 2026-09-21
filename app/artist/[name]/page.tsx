import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { searchYouTube } from '@/lib/youtube';
import { Track } from '@/lib/types';
import TrackRow from '@/components/TrackRow';

export const revalidate = 3600;

export default async function ArtistPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  let tracks: Track[] = [];
  let error: string | null = null;

  try {
    tracks = await searchYouTube(`${name} songs`, { order: 'relevance', maxResults: 20 });
  } catch {
    error = 'Could not load songs for this artist.';
  }

  return (
    <div className="px-4 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-haze text-sm mb-4">
        <ChevronLeft size={18} /> Home
      </Link>
      <h1 className="text-2xl font-display font-semibold text-paper mb-4">{name}</h1>
      {error && <p className="text-sm text-magenta mb-4">{error}</p>}
      <div className="flex flex-col">
        {tracks.map((t) => (
          <TrackRow key={t.id} track={t} context={tracks} />
        ))}
      </div>
    </div>
  );
}
