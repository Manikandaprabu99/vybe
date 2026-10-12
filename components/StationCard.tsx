'use client';

import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';
import Artwork from './ui/Artwork';
import { EqBars, LiveBadge } from './ui/bits';

function useNowPlaying(station: Track) {
  const isCurrent = useVybeStore((s) => s.queue[s.currentIndex]?.id === station.id);
  const isPlaying = useVybeStore((s) => s.isPlaying);
  return { isCurrent, isPlaying };
}

// Square card for the Home shelf.
export function StationCard({ station, context }: { station: Track; context: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);
  const { isCurrent, isPlaying } = useNowPlaying(station);
  return (
    <button
      onClick={() => playTrack(station, context)}
      className="press w-[132px] shrink-0 snap-start rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
    >
      <div className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-2xl shadow-float ring-1 ring-white/[0.06]">
        <Artwork src={station.thumbnail} seed={station.id} kind="radio" className="h-full w-full" iconSize={28} />
        <span className="absolute left-2 top-2">
          <LiveBadge className="bg-ink/75 backdrop-blur" />
        </span>
        {isCurrent && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-1.5 backdrop-blur">
            <EqBars playing={isPlaying} />
          </span>
        )}
      </div>
      <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-marigold' : 'text-paper'}`}>{station.title}</p>
      <p className="truncate text-xs text-haze">{station.artist}</p>
    </button>
  );
}

// List row for the Radio page.
export function StationRow({ station, context }: { station: Track; context: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);
  const { isCurrent, isPlaying } = useNowPlaying(station);
  return (
    <button
      onClick={() => playTrack(station, context)}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors active:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <Artwork src={station.thumbnail} seed={station.id} kind="radio" className="h-full w-full" />
      </div>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-semibold ${isCurrent ? 'text-marigold' : 'text-paper'}`}>
          {station.title}
        </span>
        <span className="block truncate text-[13px] text-haze">{station.artist}</span>
      </span>
      {isCurrent ? <EqBars playing={isPlaying} className="mr-2" /> : <LiveBadge />}
    </button>
  );
}
