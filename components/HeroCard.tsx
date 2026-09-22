'use client';

import { Play } from 'lucide-react';
import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';

// The big featured banner at the top of Home — the "hero" a flat list of
// shelves was missing. Reuses the same playTrack() flow as TrackCard.
export default function HeroCard({ track, context }: { track: Track; context?: Track[] }) {
  const playTrack = useVybeStore((s) => s.playTrack);

  return (
    <button
      onClick={() => playTrack(track, context)}
      className="group relative block w-[calc(100%-2rem)] mx-4 mb-8 overflow-hidden rounded-3xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60"
    >
      <div className="aspect-[16/10] sm:aspect-[21/9] w-full bg-dusk">
        {track.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.thumbnail}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, #1B1023 8%, rgba(27,16,35,0.45) 45%, rgba(27,16,35,0.05) 75%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-marigold">
            Now trending
          </p>
          <p className="truncate font-display text-xl font-semibold text-paper sm:text-2xl">
            {track.title}
          </p>
          <p className="truncate text-sm text-haze">{track.artist}</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marigold text-ink shadow-lg shadow-marigold/30 transition-transform duration-200 group-hover:scale-110 group-active:scale-95 sm:h-14 sm:w-14">
          <Play size={20} fill="currentColor" className="ml-0.5" />
        </span>
      </div>
    </button>
  );
}
