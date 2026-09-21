import Link from 'next/link';
import { Playlist } from '@/lib/types';

export default function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const cover = playlist.tracks[0]?.thumbnail;

  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-xl"
    >
      <div className="aspect-square rounded-xl bg-dusk overflow-hidden mb-2 flex items-center justify-center">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">♪</span>
        )}
      </div>
      <p className="text-sm font-medium text-paper truncate">{playlist.name}</p>
      <p className="text-xs text-haze">{playlist.tracks.length} songs</p>
    </Link>
  );
}
