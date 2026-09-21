'use client';

import Link from 'next/link';
import { ChevronLeft, Play, Trash2 } from 'lucide-react';
import { useVybeStore } from '@/lib/store';
import TrackRow from '@/components/TrackRow';

export default function PlaylistPage({ params }: { params: { id: string } }) {
  const playlist = useVybeStore((s) => s.playlists.find((p) => p.id === params.id));
  const deletePlaylist = useVybeStore((s) => s.deletePlaylist);
  const playTrack = useVybeStore((s) => s.playTrack);

  if (!playlist) {
    return (
      <div className="px-4 pt-6">
        <p className="text-sm text-haze mb-2">Playlist not found.</p>
        <Link href="/library" className="text-marigold text-sm">
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <Link href="/library" className="inline-flex items-center gap-1 text-haze text-sm mb-4">
        <ChevronLeft size={18} /> Library
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold text-paper">{playlist.name}</h1>
          <p className="text-sm text-haze">{playlist.tracks.length} songs</p>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete "${playlist.name}"?`)) deletePlaylist(playlist.id);
          }}
          aria-label="Delete playlist"
          className="p-2 text-haze focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {playlist.tracks.length > 0 && (
        <button
          onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
          className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-marigold text-ink text-sm font-medium"
        >
          <Play size={16} /> Play all
        </button>
      )}

      <div className="flex flex-col">
        {playlist.tracks.map((t) => (
          <TrackRow key={t.id} track={t} context={playlist.tracks} />
        ))}
      </div>
    </div>
  );
}
