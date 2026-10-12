'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ListMusic, MinusCircle, Trash2 } from 'lucide-react';
import { useStoreHydrated, useVybeStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import TrackRow from '@/components/TrackRow';
import CollectionHeader from '@/components/CollectionHeader';
import { EmptyState } from '@/components/ui/bits';

// /playlist/?id=… — playlists live only on this phone, so the page reads the
// id from the address instead of having one pre-built page per playlist (a
// static site can't know them ahead of time).
function PlaylistView() {
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const playlist = useVybeStore((s) => s.playlists.find((p) => p.id === id));
  const deletePlaylist = useVybeStore((s) => s.deletePlaylist);
  const removeFromPlaylist = useVybeStore((s) => s.removeFromPlaylist);
  const showToast = useToast((s) => s.show);

  if (!hydrated) return null; // saved playlists not loaded yet

  if (!playlist) {
    return (
      <div className="pt-[calc(env(safe-area-inset-top)+3rem)]">
        <EmptyState
          icon={<ListMusic size={28} />}
          title="Playlist not found"
          body="It may have been deleted on this phone."
          action={
            <Link href="/library" className="press inline-flex rounded-full bg-paper px-5 py-2.5 text-sm font-bold text-ink">
              Back to Library
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <CollectionHeader
        backHref="/library"
        backLabel="Back to Library"
        cover={playlist.tracks[0]?.thumbnail}
        seed={playlist.id}
        title={playlist.name}
        subtitle={`Playlist · ${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'song' : 'songs'}`}
        tracks={playlist.tracks}
        trailing={
          <button
            onClick={() => {
              if (!confirm(`Delete "${playlist.name}"?`)) return;
              deletePlaylist(playlist.id);
              showToast('Playlist deleted');
              router.push('/library');
            }}
            aria-label="Delete playlist"
            className="press flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] text-haze ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
          >
            <Trash2 size={18} />
          </button>
        }
      />
      <div className="px-4">
        {playlist.tracks.length === 0 ? (
          <EmptyState
            icon={<ListMusic size={28} />}
            title="This playlist is empty"
            body="Use “…” on any song and choose Add to playlist."
          />
        ) : (
          playlist.tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              context={playlist.tracks}
              extraActions={[
                {
                  icon: <MinusCircle size={20} />,
                  label: 'Remove from this playlist',
                  danger: true,
                  onClick: () => {
                    removeFromPlaylist(playlist.id, t.id);
                    showToast('Removed from playlist');
                  },
                },
              ]}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <Suspense fallback={null}>
      <PlaylistView />
    </Suspense>
  );
}
