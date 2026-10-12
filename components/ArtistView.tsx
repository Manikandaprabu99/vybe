'use client';

import { Mic2 } from 'lucide-react';
import { Track } from '@/lib/types';
import TrackRow from './TrackRow';
import CollectionHeader from './CollectionHeader';
import { EmptyState } from './ui/bits';

export default function ArtistView({
  slug,
  name,
  tracks,
  failed,
}: {
  slug: string;
  name: string;
  tracks: Track[];
  failed: boolean;
}) {
  return (
    <div>
      <CollectionHeader
        backHref="/"
        backLabel="Back to Home"
        cover={tracks[0]?.thumbnail}
        seed={slug}
        kind="music"
        round
        title={name}
        subtitle={`Artist · ${tracks.length} songs`}
        tracks={tracks}
      />
      <div className="px-4">
        {tracks.length === 0 ? (
          <EmptyState
            icon={<Mic2 size={28} />}
            title={failed ? "Couldn't load songs" : 'No songs yet'}
            body="They'll appear after the next site update."
          />
        ) : (
          tracks.map((t) => <TrackRow key={t.id} track={t} context={tracks} />)
        )}
      </div>
    </div>
  );
}
