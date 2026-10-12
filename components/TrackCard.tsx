'use client';

import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';
import Artwork from './ui/Artwork';
import { EqBars } from './ui/bits';

export default function TrackCard({ track, context }: { track: Track; context?: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);
  const isCurrent = useVybeStore((s) => s.queue[s.currentIndex]?.id === track.id);
  const isPlaying = useVybeStore((s) => s.isPlaying);

  return (
    <button
      onClick={() => playTrack(track, context)}
      className="press w-[148px] shrink-0 snap-start rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
    >
      <div className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-2xl shadow-float ring-1 ring-white/[0.06]">
        <Artwork src={track.thumbnail} seed={track.id} className="h-full w-full" iconSize={30} />
        {isCurrent && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-1.5 backdrop-blur">
            <EqBars playing={isPlaying} />
          </span>
        )}
      </div>
      <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-marigold' : 'text-paper'}`}>{track.title}</p>
      <p className="truncate text-xs text-haze">{track.artist}</p>
    </button>
  );
}
