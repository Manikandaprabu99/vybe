'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Mic2, Music2, Play, Radio, Search as SearchIcon, SearchX, Sparkles, X } from 'lucide-react';
import { Track } from '@/lib/types';
import { DAY } from '@/lib/youtube/core';
import { describeYouTubeError, ytClient } from '@/lib/youtube/client';
import { useVybeStore } from '@/lib/store';
import TrackRow from '@/components/TrackRow';
import Artwork from '@/components/ui/Artwork';
import { EmptyState } from '@/components/ui/bits';

// Starting points when the search box is empty. Each runs a normal search,
// remembered on this phone for a day, so tapping it again is free.
const BROWSE = [
  { label: 'Tamil hits', q: 'Tamil hit songs', bg: 'linear-gradient(135deg,#F5A623,#E4457A)' },
  { label: 'Kuthu', q: 'Tamil kuthu songs', bg: 'linear-gradient(135deg,#FF7A45,#BE185D)' },
  { label: 'Melody', q: 'Tamil melody songs', bg: 'linear-gradient(135deg,#A855F7,#EC4899)' },
  { label: '90s Tamil', q: '90s Tamil hit songs', bg: 'linear-gradient(135deg,#14B8A6,#2563EB)' },
  { label: 'Anirudh', q: 'Anirudh Ravichander songs', bg: 'linear-gradient(135deg,#F59E0B,#DC2626)' },
  { label: 'A.R. Rahman', q: 'A.R. Rahman songs', bg: 'linear-gradient(135deg,#22C55E,#0EA5E9)' },
  { label: 'English pop', q: 'English pop hits', bg: 'linear-gradient(135deg,#EC4899,#7C3AED)' },
  { label: 'Chill', q: 'chill English songs', bg: 'linear-gradient(135deg,#0EA5E9,#6366F1)' },
];

const RECENT_KEY = 'vybe-recent-searches';

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const playTrack = useVybeStore((s) => s.playTrack);

  useEffect(() => setRecent(loadRecent()), []);

  const remember = (q: string) => {
    const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — recent searches are a nicety.
    }
  };

  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    // Debounced so typing doesn't fire (and pay for) a search per keystroke.
    const timeout = setTimeout(async () => {
      try {
        const found = await ytClient.searchYouTube(q, { maxResults: 25, cacheSeconds: DAY });
        if (cancelled) return;
        setResults(found);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setError(describeYouTubeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const q = query.trim();
  const [top, ...rest] = results;

  return (
    <div>
      <header className="glass sticky top-0 z-20 border-b border-white/[0.05] pt-[env(safe-area-inset-top)]">
        <div className="px-4 pb-3 pt-4">
          <h1 className="mb-3 text-[28px] font-extrabold tracking-tight text-paper">Search</h1>
          <label className="flex items-center gap-2.5 rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/10 transition focus-within:bg-white/[0.11] focus-within:ring-2 focus-within:ring-marigold/70">
            <SearchIcon size={19} className="shrink-0 text-haze" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q) {
                  remember(q);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              enterKeyHint="search"
              placeholder="Songs, artists, movies"
              aria-label="Search songs"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-paper outline-none placeholder:text-haze"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="-mr-1 rounded-full p-1 text-haze">
                <X size={18} />
              </button>
            )}
          </label>
        </div>
      </header>

      <div className="px-4 pt-4">
        {!q && (
          <div className="animate-rise-in">
            {recent.length > 0 && (
              <section className="mb-7">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-paper">Recent searches</h2>
                  <button onClick={clearRecent} className="text-xs font-bold text-haze">
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setQuery(r)}
                      className="press flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 py-2 text-sm font-semibold text-paper ring-1 ring-white/10"
                    >
                      <History size={14} className="text-haze" />
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <h2 className="mb-3 text-base font-extrabold text-paper">Browse</h2>
            <div className="grid grid-cols-2 gap-3">
              {BROWSE.map((b, i) => (
                <button
                  key={b.label}
                  onClick={() => setQuery(b.q)}
                  style={{ background: b.bg }}
                  className="press relative h-24 overflow-hidden rounded-2xl p-3.5 text-left shadow-float"
                >
                  <span className="relative z-10 text-[17px] font-extrabold leading-tight text-white drop-shadow">{b.label}</span>
                  {i % 2 === 0 ? (
                    <Music2 size={64} className="absolute -bottom-3 -right-2 rotate-[20deg] text-white/25" />
                  ) : (
                    <Mic2 size={60} className="absolute -bottom-3 -right-2 rotate-[20deg] text-white/25" />
                  )}
                </button>
              ))}
              <Link
                href="/radio"
                className="press relative col-span-2 flex h-20 items-center gap-3 overflow-hidden rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-ink">
                  <Radio size={22} />
                </span>
                <span>
                  <span className="block text-[15px] font-extrabold text-paper">Live radio</span>
                  <span className="block text-xs text-haze">Plays with your screen locked</span>
                </span>
              </Link>
            </div>
          </div>
        )}

        {q && loading && (
          <div aria-label="Searching" className="flex flex-col gap-3">
            <div className="skeleton h-28 rounded-3xl" />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-3/4 rounded-full" />
                  <div className="skeleton h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {q && !loading && error && <EmptyState icon={<SearchX size={28} />} title="Search didn't work" body={error} />}

        {q && !loading && !error && results.length === 0 && (
          <EmptyState icon={<SearchX size={28} />} title={`No songs for “${q}”`} body="Try another spelling, or the movie name." />
        )}

        {q && !loading && top && (
          <div className="animate-rise-in">
            <h2 className="mb-2 text-base font-extrabold text-paper">Top result</h2>
            <button
              onClick={() => {
                playTrack(top, [top]);
                remember(q);
              }}
              className="press relative mb-6 flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-white/[0.07] p-4 text-left ring-1 ring-white/10"
            >
              <Artwork src={top.thumbnail} seed={top.id} className="h-24 w-24 shrink-0 rounded-2xl shadow-float" iconSize={30} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-lg font-extrabold leading-snug text-paper">{top.title}</span>
                <span className="mt-0.5 block truncate text-sm text-haze">{top.artist}</span>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-paper">
                  <Sparkles size={11} /> Song radio
                </span>
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-glow">
                <Play size={20} fill="currentColor" className="ml-0.5" />
              </span>
            </button>
            {rest.length > 0 && <h2 className="mb-1 text-base font-extrabold text-paper">Songs</h2>}
            {/* Tapping a result plays just that song; when it ends, autoplay
                keeps going with similar songs (same movie, singer, language)
                instead of working through the rest of the results — like
                Spotify's song radio. */}
            {rest.map((t) => (
              <TrackRow key={t.id} track={t} context={[t]} onPlay={() => remember(q)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
