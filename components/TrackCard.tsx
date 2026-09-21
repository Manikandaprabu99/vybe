'use client';

import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';

export default function TrackCard({ track, context }: { track: Track; context?: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);

  return (
    <button
      onClick={() => playTrack(track, context)}
      className="w-32 shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-lg"
    >
      <div className="w-32 h-32 rounded-lg overflow-hidden bg-dusk mb-2">
        {track.thumbnail && (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <p className="text-sm font-medium text-paper truncate">{track.title}</p>
      <p className="text-xs text-haze truncate">{track.artist}</p>
    </button>
  );
}
