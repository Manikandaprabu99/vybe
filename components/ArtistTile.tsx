import Link from 'next/link';

export default function ArtistTile({ name, thumbnail }: { name: string; thumbnail: string }) {
  return (
    <Link
      href={`/artist/${encodeURIComponent(name)}`}
      className="flex flex-col items-center gap-2 w-20 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full"
    >
      <div className="w-20 h-20 rounded-full overflow-hidden bg-dusk">
        {thumbnail && <img src={thumbnail} alt="" className="w-full h-full object-cover" />}
      </div>
      <span className="text-xs text-paper text-center truncate w-full">{name}</span>
    </Link>
  );
}
