'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, Play, Shuffle } from 'lucide-react';
import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';
import Artwork from './ui/Artwork';
import { PlayFab } from './ui/bits';

// The top of Liked Songs, a playlist or an artist: big cover over a soft
// glow of itself, title, and Shuffle / Play.
export default function CollectionHeader({
  backHref,
  backLabel,
  cover,
  seed,
  kind = 'playlist',
  round = false,
  title,
  subtitle,
  tracks,
  trailing,
}: {
  backHref: string;
  backLabel: string;
  cover?: string;
  seed: string;
  kind?: 'playlist' | 'liked' | 'music';
  round?: boolean;
  title: string;
  subtitle: string;
  tracks: Track[];
  trailing?: ReactNode;
}) {
  const playTrack = useVybeStore((s) => s.playTrack);
  const shuffleEnabled = useVybeStore((s) => s.shuffleEnabled);
  const toggleShuffle = useVybeStore((s) => s.toggleShuffle);

  const playAll = () => {
    if (tracks.length > 0) playTrack(tracks[0], tracks);
  };
  const shufflePlay = () => {
    if (tracks.length === 0) return;
    if (!shuffleEnabled) toggleShuffle();
    playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks);
  };

  return (
    <div className="relative overflow-hidden pb-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
        <Artwork src={cover} seed={seed} kind={kind} className="h-full w-full scale-125 opacity-50 blur-3xl" iconSize={1} />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/70 to-ink" />
      </div>

      <div className="relative px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="press flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-paper backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
        >
          <ChevronLeft size={22} />
        </Link>

        <div className="mt-2 flex flex-col items-center text-center animate-rise-in">
          <Artwork
            src={cover}
            seed={seed}
            kind={kind}
            className={`h-48 w-48 shadow-art ${round ? 'rounded-full' : 'rounded-[28px]'}`}
            iconSize={56}
          />
          <h1 className="mt-5 max-w-full truncate text-[26px] font-extrabold tracking-tight text-paper">{title}</h1>
          <p className="mt-1 text-sm text-haze">{subtitle}</p>
        </div>

        {tracks.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-4">
            <button
              onClick={shufflePlay}
              className="press flex h-12 items-center gap-2 rounded-full bg-white/[0.08] px-5 text-sm font-bold text-paper ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
            >
              <Shuffle size={17} /> Shuffle
            </button>
            <PlayFab onClick={playAll} label="Play all" size={60}>
              <Play size={24} fill="currentColor" className="ml-0.5" />
            </PlayFab>
            {trailing}
          </div>
        )}
      </div>
    </div>
  );
}
