'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useStoreHydrated, useVybeStore } from '@/lib/store';
import TrackRow from '@/components/TrackRow';
import CollectionHeader from '@/components/CollectionHeader';
import { EmptyState } from '@/components/ui/bits';

export default function LikedSongsPage() {
  const hydrated = useStoreHydrated();
  const likedTracks = useVybeStore((s) => s.likedTracks);

  return (
    <div>
      <CollectionHeader
        backHref="/library"
        backLabel="Back to Library"
        seed="liked-songs"
        kind="liked"
        title="Liked Songs"
        subtitle={hydrated ? `${likedTracks.length} ${likedTracks.length === 1 ? 'song' : 'songs'}` : ' '}
        tracks={likedTracks}
      />
      <div className="px-4">
        {hydrated && likedTracks.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} fill="currentColor" />}
            title="Songs you like will appear here"
            body="Tap the heart on the now-playing screen, or use “…” on any song."
            action={
              <Link href="/search" className="press inline-flex rounded-full bg-paper px-5 py-2.5 text-sm font-bold text-ink">
                Find songs
              </Link>
            }
          />
        ) : (
          likedTracks.map((t) => <TrackRow key={t.id} track={t} context={likedTracks} />)
        )}
      </div>
    </div>
  );
}
