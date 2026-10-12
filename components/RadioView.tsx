'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
import { Track } from '@/lib/types';
import { StationRow } from './StationCard';
import { EmptyState } from './ui/bits';

const TABS = [
  { key: 'tamil', label: 'Tamil' },
  { key: 'english', label: 'English hits' },
] as const;

export default function RadioView({ tamil, english }: { tamil: Track[]; english: Track[] }) {
  const [tab, setTab] = useState<'tamil' | 'english'>('tamil');
  const stations = tab === 'tamil' ? tamil : english;

  return (
    <div>
      <header className="glass sticky top-0 z-20 border-b border-white/[0.05] pt-[env(safe-area-inset-top)]">
        <div className="px-4 pb-3 pt-4">
          <h1 className="text-[28px] font-extrabold tracking-tight text-paper">Radio</h1>
          <p className="text-sm text-haze">Live stations — they keep playing with your screen locked.</p>
        </div>
        {/* Segmented control */}
        <div className="px-4 pb-3">
          <div role="tablist" className="grid grid-cols-2 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/[0.08]">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-xl py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
                  tab === t.key ? 'bg-paper text-ink shadow-float' : 'text-haze'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 pt-3">
        {stations.length === 0 ? (
          <EmptyState icon={<Radio size={28} />} title="Couldn't load stations" body="They'll appear after the next site update." />
        ) : (
          <div key={tab} className="animate-rise-in">
            {stations.map((s) => (
              <StationRow key={s.id} station={s} context={stations} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
