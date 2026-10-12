'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderUp, Heart, ListMusic, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useStoreHydrated, useVybeStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { saveLocalFile, deleteLocalFile } from '@/lib/localAudioDb';
import BottomSheet from '@/components/BottomSheet';
import TrackRow from '@/components/TrackRow';
import Artwork from '@/components/ui/Artwork';
import { Chip } from '@/components/ui/bits';

type Filter = 'All' | 'Playlists' | 'My Files';

export default function LibraryPage() {
  const hydrated = useStoreHydrated();
  const playlists = useVybeStore((s) => s.playlists);
  const likedTracks = useVybeStore((s) => s.likedTracks);
  const localTracks = useVybeStore((s) => s.localTracks);
  const createPlaylist = useVybeStore((s) => s.createPlaylist);
  const addLocalTrack = useVybeStore((s) => s.addLocalTrack);
  const removeLocalTrack = useVybeStore((s) => s.removeLocalTrack);
  const renameLocalTrack = useVybeStore((s) => s.renameLocalTrack);
  const showToast = useToast((s) => s.show);

  const [filter, setFilter] = useState<Filter>('All');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ used: number; quota: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshStorage = useCallback(async () => {
    try {
      const estimate = await navigator.storage?.estimate?.();
      setStorage(estimate?.usage && estimate.quota ? { used: estimate.usage, quota: estimate.quota } : null);
    } catch {
      setStorage(null);
    }
  }, []);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage, localTracks.length]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setImporting(true);
    setImportError(null);
    let added = 0;
    try {
      for (const file of Array.from(fileList)) {
        const id = crypto.randomUUID();
        await saveLocalFile(id, file);
        addLocalTrack({ id, ...trackNameFromFile(file.name), thumbnail: '', source: 'local' });
        added += 1;
      }
      // Ask the browser not to clear these files when the phone runs low on
      // space. Chrome grants it to installed apps; elsewhere it's a no-op.
      await navigator.storage?.persist?.().catch(() => false);
      showToast(`Added ${added} ${added === 1 ? 'song' : 'songs'}`);
    } catch {
      setImportError('Could not save one of those files — it might be too large, or storage is full.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteLocal(id: string, title: string) {
    if (!confirm(`Remove "${title}" from this phone?`)) return;
    await deleteLocalFile(id);
    removeLocalTrack(id);
    showToast('Removed');
  }

  function handleRenameLocal(id: string, currentTitle: string) {
    const next = window.prompt('Rename song', currentTitle);
    if (next && next.trim()) renameLocalTrack(id, next.trim());
  }

  const showPlaylists = filter !== 'My Files';
  const showFiles = filter !== 'Playlists';

  return (
    <div>
      <header className="glass sticky top-0 z-20 border-b border-white/[0.05] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <h1 className="text-[28px] font-extrabold tracking-tight text-paper">Your Library</h1>
          <div className="flex gap-2">
            <IconButton label="Add songs from this phone" onClick={() => fileInputRef.current?.click()}>
              <Upload size={19} />
            </IconButton>
            <IconButton label="New playlist" onClick={() => setShowCreate(true)}>
              <Plus size={21} />
            </IconButton>
          </div>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
          {(['All', 'Playlists', 'My Files'] as Filter[]).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <div className="px-4 pt-4">
        {showPlaylists && (
          <section className="mb-8 animate-rise-in">
            <Link
              href="/liked"
              className="press -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent text-ink shadow-glow">
                <Heart size={24} fill="currentColor" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-paper">Liked Songs</span>
                <span className="block text-[13px] text-haze">
                  Playlist · {hydrated ? likedTracks.length : '–'} songs
                </span>
              </span>
              <ChevronRight size={18} className="text-haze" />
            </Link>

            {playlists.map((p) => (
              <Link
                key={p.id}
                href={`/playlist?id=${encodeURIComponent(p.id)}`}
                className="press -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <Artwork src={p.tracks[0]?.thumbnail} seed={p.id} kind="playlist" className="h-14 w-14 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-paper">{p.name}</span>
                  <span className="block text-[13px] text-haze">Playlist · {p.tracks.length} songs</span>
                </span>
                <ChevronRight size={18} className="text-haze" />
              </Link>
            ))}

            {hydrated && playlists.length === 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="press -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/[0.07] text-paper ring-1 ring-white/10">
                  <Plus size={22} />
                </span>
                <span className="text-[15px] font-bold text-paper">Create a playlist</span>
              </button>
            )}
          </section>
        )}

        {showFiles && (
          <section className="mb-8 animate-rise-in" aria-label="My Files">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-paper">My Files</h2>
                <p className="text-xs text-haze">Plays in the background, even offline</p>
              </div>
              {localTracks.length > 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="press flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-2 text-xs font-bold text-paper ring-1 ring-white/10 disabled:opacity-50"
                >
                  <FolderUp size={15} /> {importing ? 'Adding…' : 'Add'}
                </button>
              )}
            </div>

            {importError && <p className="mb-2 text-sm text-magenta">{importError}</p>}

            {hydrated && localTracks.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="press mt-2 flex w-full flex-col items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.04] px-6 py-8 text-center"
              >
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-ink shadow-glow">
                  <Upload size={24} />
                </span>
                <span className="text-[15px] font-bold text-paper">{importing ? 'Adding…' : 'Add songs from your phone'}</span>
                <span className="mt-1 text-xs leading-relaxed text-haze">
                  They keep playing with the screen locked. Name files “Artist - Title” and both show up.
                </span>
              </button>
            ) : (
              <>
                {storage && (
                  <div className="mb-3 mt-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(2, Math.min(100, (storage.used / storage.quota) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-haze">
                      {formatBytes(storage.used)} used of {formatBytes(storage.quota)} available
                    </p>
                  </div>
                )}
                {localTracks.map((t) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    context={localTracks}
                    extraActions={[
                      { icon: <Pencil size={20} />, label: 'Rename', onClick: () => handleRenameLocal(t.id, t.title) },
                      {
                        icon: <Trash2 size={20} />,
                        label: 'Remove from this phone',
                        danger: true,
                        onClick: () => void handleDeleteLocal(t.id, t.title),
                      },
                    ]}
                  />
                ))}
              </>
            )}
          </section>
        )}
      </div>

      <BottomSheet open={showCreate} onClose={() => setShowCreate(false)} title="New playlist">
        <form
          className="flex gap-2 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createPlaylist(name.trim());
            showToast(`Created ${name.trim()}`);
            setName('');
            setShowCreate(false);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            autoFocus
            className="min-w-0 flex-1 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm text-paper ring-1 ring-white/10 placeholder:text-haze focus:outline-none focus:ring-2 focus:ring-marigold/70"
          />
          <button type="submit" className="press rounded-2xl bg-accent px-5 text-sm font-bold text-ink shadow-glow">
            Create
          </button>
        </form>
        <p className="pb-2 text-xs text-haze">
          <ListMusic size={12} className="mr-1 inline" />
          Add songs with “…” → Add to playlist.
        </p>
      </BottomSheet>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="press flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-paper ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
    >
      {children}
    </button>
  );
}

// "Anirudh - Hukum.mp3" becomes artist "Anirudh", title "Hukum". Anything
// else keeps the whole name as the title, under "My Files".
function trackNameFromFile(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^./]+$/, '').replace(/_+/g, ' ').trim();
  const parts = base.split(/\s+-\s+/);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return { artist: parts[0].trim(), title: parts[1].trim() };
  }
  return { title: base.replace(/-+/g, ' ').trim() || fileName, artist: 'My Files' };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}
