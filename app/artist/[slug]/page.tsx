import { notFound } from 'next/navigation';
import { yt } from '@/lib/youtube/server';
import { FEATURED_ARTISTS } from '@/lib/youtube/core';
import { Track } from '@/lib/types';
import ArtistView from '@/components/ArtistView';

// One page per featured artist, built ahead of time (a static site can't
// search on demand from the server). The search is shared with the artist's
// tile on Home and reused for a day from the build cache.
export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURED_ARTISTS.map((a) => ({ slug: a.slug }));
}

export default async function ArtistPage({ params }: { params: { slug: string } }) {
  const artist = FEATURED_ARTISTS.find((a) => a.slug === params.slug);
  if (!artist) notFound();

  let tracks: Track[] = [];
  let failed = false;
  try {
    tracks = await yt.getArtistSongs(artist.name);
  } catch {
    failed = true;
  }

  return <ArtistView slug={artist.slug} name={artist.name} tracks={tracks} failed={failed} />;
}
