import Link from 'next/link';
import Artwork from './ui/Artwork';

export default function ArtistTile({ slug, name, thumbnail }: { slug: string; name: string; thumbnail: string }) {
  return (
    <Link
      href={`/artist/${slug}`}
      className="press flex w-[104px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
    >
      {/* A thin accent ring, like a "story" avatar. */}
      <span className="rounded-full bg-accent p-[2px] shadow-float">
        <span className="block rounded-full bg-ink p-[2px]">
          <Artwork src={thumbnail} seed={slug} className="h-[92px] w-[92px] rounded-full" iconSize={26} />
        </span>
      </span>
      <span className="w-full truncate text-center text-xs font-semibold text-paper">{name}</span>
    </Link>
  );
}
