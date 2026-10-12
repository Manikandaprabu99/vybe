'use client';

import { Play } from 'lucide-react';
import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';
import Artwork from './ui/Artwork';

// The big featured banner at the top of Home.
export default function HeroCard({ track, context }: { track: Track; context?: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);

  return (
    <button
      onClick={() => playTrack(track, context)}
      className="press relative mx-4 mb-9 block w-[calc(100%-2rem)] overflow-hidden rounded-[28px] text-left shadow-art ring-1 ring-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
    >
      <Artwork src={track.thumbnail} seed={track.id} className="aspect-[16/11] w-full sm:aspect-[21/9]" iconSize={48} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <span className="mb-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-paper backdrop-blur">
            Trending now
          </span>
          <p className="truncate text-2xl font-extrabold tracking-tight text-paper">{track.title}</p>
          <p className="truncate text-sm text-haze">{track.artist}</p>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-glow">
          <Play size={22} fill="currentColor" className="ml-0.5" />
        </span>
      </div>
    </button>
  );
}
