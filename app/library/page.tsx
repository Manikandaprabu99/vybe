'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, Music, Pencil, Trash2 } from 'lucide-react';
import { useVybeStore } from '@/lib/store';
import { Track } from '@/lib/types';
import { saveLocalFile, deleteLocalFile } from '@/lib/localAudioDb';
import PlaylistCard from '@/components/PlaylistCard';
import BottomSheet from '@/components/BottomSheet';

export default function LibraryPage() {
  const playlists = useVybeStore((s) => s.playlists);
  const likedTracks = useVybeStore((s) => s.likedTracks);
  const localTracks = useVybeStore((s) => s.localTracks);
  const createPlaylist = useVybeStore((s) => s.createPlaylist);
  const addLocalTrack = useVybeStore((s) => s.addLocalTrack);
  const removeLocalTrack = useVybeStore((s) => s.removeLocalTrack);
  const renameLocalTrack = useVybeStore((s) => s.renameLocalTrack);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      for (const file of Array.from(fileList)) {
        const id = crypto.randomUUID();
        await saveLocalFile(id, file);
        const title =
          file.name.replace(/\.[^./]+$/, '').replace(/[_-]+/g, ' ').trim() || file.name;
        addLocalTrack({ id, title, artist: 'My Files', thumbnail: '', source: 'local' });
      }
    } catch {
      setImportError('Could not save one of those files — it might be too large, or storage is full.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteLocal(id: string) {
    await deleteLocalFile(id);
    removeLocalTrack(id);
  }

  function handleRenameLocal(id: string, currentTitle: string) {
    const next = window.prompt('Rename track', currentTitle);
    if (next && next.trim()) renameLocalTrack(id, next.trim());
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-semibold text-paper">Your Library</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded-lg bg-marigold text-ink text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-paper/60"
        >
          + New
        </button>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-display font-semibold text-paper">My Files</h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-3 py-1.5 rounded-lg bg-marigold text-ink text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-paper/60"
          >
            {importing ? 'Adding…' : '+ Add files'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>

        {importError && <p className="text-sm text-magenta mb-2">{importError}</p>}

        {localTracks.length === 0 ? (
          <p className="text-sm text-haze">
            Add songs from your phone to get real background and lock-screen playback —
            YouTube tracks pause when the screen locks, these won&apos;t.
          </p>
        ) : (
          <div className="flex flex-col">
            {localTracks.map((t) => (
              <LocalFileRow
                key={t.id}
                track={t}
                context={localTracks}
                onDelete={() => handleDeleteLocal(t.id)}
                onRename={() => handleRenameLocal(t.id, t.title)}
              />
            ))}
          </div>
        )}
      </section>

      {playlists.length === 0 && likedTracks.length === 0 ? (
        <p className="text-sm text-haze">
          No playlists yet. Find a song you like and tap the + icon to start one.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {likedTracks.length > 0 && <LikedSongsCard count={likedTracks.length} />}
          {playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}

      <BottomSheet open={showCreate} onClose={() => setShowCreate(false)} title="New playlist">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            className="flex-1 bg-dusk-hover rounded-lg px-3 py-2 text-sm text-paper placeholder:text-haze outline-none focus-visible:ring-2 focus-visible:ring-marigold/60"
          />
          <button
            onClick={() => {
              if (!name.trim()) return;
              createPlaylist(name.trim());
              setName('');
              setShowCreate(false);
            }}
            className="px-4 rounded-lg bg-marigold text-ink font-medium text-sm"
          >
            Create
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function LikedSongsCard({ count }: { count: number }) {
  return (
    <Link
      href="/liked"
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-xl"
    >
      <div
        className="aspect-square rounded-xl overflow-hidden mb-2 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #E4457A, #F5A623)' }}
      >
        <Heart size={32} className="fill-paper text-paper" />
      </div>
      <p className="text-sm font-medium text-paper truncate">Liked Songs</p>
      <p className="text-xs text-haze">{count} songs</p>
    </Link>
  );
}

function LocalFileRow({
  track,
  context,
  onDelete,
  onRename,
}: {
  track: Track;
  context: Track[];
  onDelete: () => void;
  onRename: () => void;
}) {
  const playTrack = useVybeStore((s) => s.playTrack);
  return (
    <div className="flex items-center gap-3 py-2">
      <button
        onClick={() => playTrack(track, context)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
      >
        <div className="w-12 h-12 rounded-md bg-dusk-hover shrink-0 flex items-center justify-center">
          <Music size={16} className="text-haze" />
        </div>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-paper">{track.title}</span>
          <span className="block truncate text-xs text-haze">{track.artist}</span>
        </span>
      </button>
      <button
        onClick={onRename}
        aria-label="Rename"
        className="p-2 text-haze hover:text-paper shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
      >
        <Pencil size={16} />
      </button>
      <button
        onClick={onDelete}
        aria-label="Remove"
        className="p-2 text-haze hover:text-magenta shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
