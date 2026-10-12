'use client';

import { ReactNode, useState } from 'react';
import { EllipsisVertical, Heart, ListEnd, ListPlus, ListStart, Plus, Share2 } from 'lucide-react';
import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import BottomSheet from './BottomSheet';
import Artwork from './ui/Artwork';
import { EqBars } from './ui/bits';

export interface RowAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

// A song in a list: tap to play, "…" for everything else. `extraActions`
// adds screen-specific entries (remove from playlist, rename, delete).
export default function TrackRow({
  track,
  context,
  extraActions = [],
  onPlay,
}: {
  track: Track;
  context?: Track[];
  extraActions?: RowAction[];
  onPlay?: () => void;
}) {
  const [sheet, setSheet] = useState<'closed' | 'actions' | 'playlists'>('closed');
  const [newName, setNewName] = useState('');

  const playlists = useVybeStore((s) => s.playlists);
  const addToPlaylist = useVybeStore((s) => s.addToPlaylist);
  const createPlaylist = useVybeStore((s) => s.createPlaylist);
  const playTrack = useVybeStore((s) => s.playTrack);
  const queueNext = useVybeStore((s) => s.queueNext);
  const queueLater = useVybeStore((s) => s.queueLater);
  const toggleLike = useVybeStore((s) => s.toggleLike);
  const isLiked = useVybeStore((s) => s.likedTracks.some((t) => t.id === track.id));
  const isCurrent = useVybeStore((s) => s.queue[s.currentIndex]?.id === track.id);
  const isPlaying = useVybeStore((s) => s.isPlaying);
  const showToast = useToast((s) => s.show);

  const close = () => setSheet('closed');
  const run = (fn: () => void, message?: string) => () => {
    fn();
    close();
    if (message) showToast(message);
  };

  const share = async () => {
    const url = `https://youtu.be/${track.id}`;
    try {
      if (navigator.share) await navigator.share({ title: track.title, text: `${track.title} — ${track.artist}`, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast('Link copied');
      }
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  };

  const actions: RowAction[] = [
    { icon: <ListStart size={20} />, label: 'Play next', onClick: run(() => queueNext(track), 'Playing next') },
    { icon: <ListEnd size={20} />, label: 'Add to queue', onClick: run(() => queueLater(track), 'Added to queue') },
    {
      icon: <Heart size={20} className={isLiked ? 'fill-magenta text-magenta' : ''} />,
      label: isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs',
      onClick: run(() => toggleLike(track), isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs'),
    },
    { icon: <ListPlus size={20} />, label: 'Add to playlist', onClick: () => setSheet('playlists') },
    ...(track.source === 'youtube' ? [{ icon: <Share2 size={20} />, label: 'Share', onClick: run(share) }] : []),
    ...extraActions.map((a) => ({ ...a, onClick: run(a.onClick) })),
  ];

  return (
    <>
      <div className="-mx-2 flex items-center gap-1 rounded-2xl px-2 py-1.5 transition-colors active:bg-white/[0.04]">
        <button
          onClick={() => {
            playTrack(track, context);
            onPlay?.();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            <Artwork src={track.thumbnail} seed={track.id} kind={track.source === 'radio' ? 'radio' : 'music'} className="h-full w-full" />
            {isCurrent && (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/55">
                <EqBars playing={isPlaying} />
              </span>
            )}
          </div>
          <span className="min-w-0">
            <span className={`block truncate text-[15px] font-semibold ${isCurrent ? 'text-marigold' : 'text-paper'}`}>
              {track.title}
            </span>
            <span className="block truncate text-[13px] text-haze">{track.artist}</span>
          </span>
        </button>
        <button
          onClick={() => setSheet('actions')}
          aria-label={`More options for ${track.title}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-haze transition-colors active:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
        >
          <EllipsisVertical size={20} />
        </button>
      </div>

      <BottomSheet open={sheet === 'actions'} onClose={close} title={track.title}>
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5">
          <Artwork src={track.thumbnail} seed={track.id} className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-paper">{track.title}</p>
            <p className="truncate text-xs text-haze">{track.artist}</p>
          </div>
        </div>
        <div className="flex flex-col pb-1">
          {actions.map((a) => (
            <SheetAction key={a.label} {...a} />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'playlists'} onClose={close} title="Add to playlist">
        <div className="mb-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name"
            className="min-w-0 flex-1 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm text-paper ring-1 ring-white/10 placeholder:text-haze focus:outline-none focus:ring-2 focus:ring-marigold/70"
          />
          <button
            onClick={() => {
              if (!newName.trim()) return;
              const p = createPlaylist(newName.trim());
              addToPlaylist(p.id, track);
              setNewName('');
              close();
              showToast(`Added to ${p.name}`);
            }}
            aria-label="Create playlist and add"
            className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink shadow-glow"
          >
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </div>
        <div className="flex flex-col gap-1 pb-1">
          {playlists.length === 0 && <p className="py-2 text-sm text-haze">No playlists yet — name one above.</p>}
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                addToPlaylist(p.id, track);
                close();
                showToast(`Added to ${p.name}`);
              }}
              className="flex items-center gap-3 rounded-2xl p-2 text-left transition-colors active:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
            >
              <Artwork src={p.tracks[0]?.thumbnail} seed={p.id} kind="playlist" className="h-11 w-11 shrink-0 rounded-xl" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-paper">{p.name}</span>
                <span className="block text-xs text-haze">{p.tracks.length} songs</span>
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

export function SheetAction({ icon, label, onClick, danger }: RowAction) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl px-2 py-3.5 text-left text-[15px] font-medium transition-colors active:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
        danger ? 'text-magenta' : 'text-paper'
      }`}
    >
      <span className={danger ? 'text-magenta' : 'text-haze'}>{icon}</span>
      {label}
    </button>
  );
}
