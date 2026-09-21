'use client';

import Link from 'next/link';
import { ChevronLeft, Play } from 'lucide-react';
import { useVybeStore } from '@/lib/store';
import TrackRow from '@/components/TrackRow';

export default function LikedSongsPage() {
  const likedTracks = useVybeStore((s) => s.likedTracks);
  const playTrack = useVybeStore((s) => s.playTrack);

  return (
    <div className="px-4 pt-6">
      <Link href="/library" className="inline-flex items-center gap-1 text-haze text-sm mb-4">
        <ChevronLeft size={18} /> Library
      </Link>

      <h1 className="text-2xl font-display font-semibold text-paper mb-1">Liked Songs</h1>
      <p className="text-sm text-haze mb-4">{likedTracks.length} songs</p>

      {likedTracks.length === 0 ? (
        <p className="text-sm text-haze">
          Tap the heart on a song's now-playing screen to save it here.
        </p>
      ) : (
        <>
          <button
            onClick={() => playTrack(likedTracks[0], likedTracks)}
            className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-marigold text-ink text-sm font-medium"
          >
            <Play size={16} /> Play all
          </button>
          <div className="flex flex-col">
            {likedTracks.map((t) => (
              <TrackRow key={t.id} track={t} context={likedTracks} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
