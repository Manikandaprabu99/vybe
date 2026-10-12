'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { Track } from '@/lib/types';
import TrackCard from './TrackCard';
import ArtistTile from './ArtistTile';
import HeroCard from './HeroCard';
import RecentlyPlayedShelf from './RecentlyPlayedShelf';
import { StationCard } from './StationCard';
import { Chip, SectionHeader } from './ui/bits';

export interface HomeData {
  trending: Track[];
  newTamil: Track[];
  english: Track[];
  oldTamil: Track[];
  oldEnglish: Track[];
  artists: { slug: string; name: string; lang: 'ta' | 'en'; thumbnail: string }[];
  radio: Track[];
}

const FILTERS = ['All', 'Tamil', 'English', 'Radio'] as const;
type Filter = (typeof FILTERS)[number];

function greetingFor(hour: number): string {
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeFeed({ data, youtubeMissing }: { data: HomeData; youtubeMissing: boolean }) {
  const [filter, setFilter] = useState<Filter>('All');
  // The page is built ahead of time, so the greeting is filled in on the
  // phone, by its own clock.
  const [greeting, setGreeting] = useState('');
  useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);

  const show = (...tags: Filter[]) => filter === 'All' || tags.includes(filter);
  const hero = data.trending[0] ?? data.newTamil[0] ?? data.english[0] ?? null;
  const heroContext = data.trending[0] ? data.trending : data.newTamil[0] ? data.newTamil : data.english;
  const artists = data.artists.filter(
    (a) => filter === 'All' || (filter === 'Tamil' && a.lang === 'ta') || (filter === 'English' && a.lang === 'en')
  );

  return (
    <div>
      <header className="glass sticky top-0 z-20 border-b border-white/[0.05] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <div>
            <p className="h-4 text-xs font-medium text-haze">{greeting}</p>
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-gradient">VYBE</h1>
          </div>
          <Link
            href="/search"
            aria-label="Search"
            className="press flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-paper ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
          >
            <Search size={20} />
          </Link>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
          {FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>
      </header>

      <div className="pt-5">
        {youtubeMissing && filter !== 'Radio' && (
          <p className="mx-4 mb-6 rounded-2xl bg-magenta/10 px-4 py-3 text-sm text-magenta ring-1 ring-magenta/20">
            Songs from YouTube didn&apos;t load in this build — check the YOUTUBE_API_KEY secret (see the README). Radio and
            My Files still work.
          </p>
        )}

        {filter === 'All' && <RecentlyPlayedShelf />}
        {filter === 'All' && hero && <HeroCard track={hero} context={heroContext} />}

        {show() && <Shelf title="Trending now" tracks={data.trending} />}
        {show('Tamil', 'English') && artists.length > 0 && (
          <section className="mb-9 animate-rise-in">
            <SectionHeader title="Popular artists" />
            <Row>
              {artists.map((a) => (
                <ArtistTile key={a.slug} slug={a.slug} name={a.name} thumbnail={a.thumbnail} />
              ))}
            </Row>
          </section>
        )}
        {show('Radio', 'Tamil') && data.radio.length > 0 && (
          <section className="mb-9 animate-rise-in">
            <SectionHeader
              title="Live Tamil radio"
              action={
                <Link href="/radio" className="flex items-center gap-0.5 text-xs font-bold text-marigold">
                  See all <ChevronRight size={14} />
                </Link>
              }
            />
            <p className="-mt-2 mb-3 px-4 text-xs text-haze">Keeps playing with your screen locked.</p>
            <Row>
              {data.radio.map((s) => (
                <StationCard key={s.id} station={s} context={data.radio} />
              ))}
            </Row>
          </section>
        )}
        {show('Tamil') && <Shelf title="New Tamil songs" tracks={data.newTamil} />}
        {show('English') && <Shelf title="English hits right now" tracks={data.english} />}
        {show('Tamil') && <Shelf title="Tamil evergreens" tracks={data.oldTamil} />}
        {show('English') && <Shelf title="English classics" tracks={data.oldEnglish} />}
      </div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-1">{children}</div>;
}

function Shelf({ title, tracks }: { title: string; tracks: Track[] }) {
  if (tracks.length === 0) return null;
  return (
    <section className="mb-9 animate-rise-in">
      <SectionHeader title={title} />
      <Row>
        {tracks.map((t) => (
          <TrackCard key={t.id} track={t} context={tracks} />
        ))}
      </Row>
    </section>
  );
}
