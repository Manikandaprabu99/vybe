import Link from 'next/link';

export default function ArtistTile({ name, thumbnail }: { name: string; thumbnail: string }) {
  return (
    <Link
      href={`/artist/${encodeURIComponent(name)}`}
      className="group flex flex-col items-center gap-2 w-24 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full"
    >
      <div className="w-24 h-24 rounded-full overflow-hidden bg-dusk shadow-lg shadow-black/20 ring-1 ring-white/10 transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95">
        {thumbnail && <img src={thumbnail} alt="" className="w-full h-full object-cover" />}
      </div>
      <span className="text-xs text-paper text-center truncate w-full">{name}</span>
    </Link>
  );
}
