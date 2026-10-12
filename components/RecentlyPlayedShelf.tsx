'use client';

import { useStoreHydrated, useVybeStore } from '@/lib/store';
import Artwork from './ui/Artwork';
import { EqBars } from './ui/bits';

// Home's "Recently played": a compact two-column grid, like the top of
// Spotify's home. Home itself is built ahead of time and can't know this
// phone's history, so this fills in on the device once the saved library has
// loaded (and stays hidden until there's something to show).
export default function RecentlyPlayedShelf() {
  const hydrated = useStoreHydrated();
  const recent = useVybeStore((s) => s.recentTracks);
  const playTrack = useVybeStore((s) => s.playTrack);
  const currentId = useVybeStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = useVybeStore((s) => s.isPlaying);

  if (!hydrated || recent.length === 0) return null;
  const tiles = recent.slice(0, 6);

  return (
    <section className="mb-9 px-4 animate-rise-in" aria-label="Recently played">
      <h2 className="mb-3 text-xl font-extrabold tracking-tight text-paper">Recently played</h2>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <button
            key={t.id}
            onClick={() => playTrack(t, recent)}
            className="press flex h-14 items-center gap-2.5 overflow-hidden rounded-xl bg-white/[0.07] pr-2 text-left ring-1 ring-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
          >
            <Artwork
              src={t.thumbnail}
              seed={t.id}
              kind={t.source === 'radio' ? 'radio' : 'music'}
              className="h-14 w-14 shrink-0"
              iconSize={18}
            />
            <span
              className={`line-clamp-2 min-w-0 flex-1 text-[13px] font-bold leading-tight ${
                t.id === currentId ? 'text-marigold' : 'text-paper'
              }`}
            >
              {t.title}
            </span>
            {t.id === currentId && <EqBars playing={isPlaying} className="shrink-0" />}
          </button>
        ))}
      </div>
    </section>
  );
}
