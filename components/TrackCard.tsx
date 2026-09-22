'use client';

import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';

export default function TrackCard({ track, context }: { track: Track; context?: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);

  return (
    <button
      onClick={() => playTrack(track, context)}
      className="group w-36 shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-2xl"
    >
      <div className="w-36 h-36 rounded-2xl overflow-hidden bg-dusk mb-2 shadow-lg shadow-black/20 ring-1 ring-white/5 transition-transform duration-200 ease-out group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-marigold/10 group-active:scale-95">
        {track.thumbnail && (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <p className="text-sm font-medium text-paper truncate">{track.title}</p>
      <p className="text-xs text-haze truncate">{track.artist}</p>
    </button>
  );
}
