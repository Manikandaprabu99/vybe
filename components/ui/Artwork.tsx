'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart, ListMusic, Music, Radio } from 'lucide-react';

// Warm two-colour gradients for things that have no artwork (songs from My
// Files, new playlists) or whose artwork fails to load (station logos come
// from every corner of the web). Picked from the seed, so the same song or
// playlist always gets the same cover.
const PALETTES: [string, string][] = [
  ['#F5A623', '#E4457A'],
  ['#FF7A45', '#7C3AED'],
  ['#E4457A', '#4F46E5'],
  ['#14B8A6', '#2563EB'],
  ['#F59E0B', '#DC2626'],
  ['#A855F7', '#EC4899'],
  ['#22C55E', '#0EA5E9'],
  ['#F97316', '#BE185D'],
];

export function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTES[h % PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

type Kind = 'music' | 'radio' | 'liked' | 'playlist';
const ICONS = { music: Music, radio: Radio, liked: Heart, playlist: ListMusic };

export default function Artwork({
  src,
  seed,
  kind = 'music',
  className = '',
  iconSize = 20,
}: {
  src?: string;
  seed: string;
  kind?: Kind;
  className?: string;
  iconSize?: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    // An image that failed before React hydrated never fires onError for
    // us (that's how broken station logos slipped through) — so check once
    // mounted too.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    const Icon = ICONS[kind];
    return (
      <div
        aria-hidden
        className={`${className} flex items-center justify-center overflow-hidden`}
        // Liked Songs always wears VYBE's own accent, like its Library tile.
        style={{ background: kind === 'liked' ? 'linear-gradient(135deg, #F5A623 0%, #FF7A45 45%, #E4457A 100%)' : coverGradient(seed) }}
      >
        <Icon size={iconSize} className="text-white/90 drop-shadow" fill={kind === 'liked' ? 'currentColor' : 'none'} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-dusk`}
    />
  );
}
