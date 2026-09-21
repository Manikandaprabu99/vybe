'use client';

import { useState } from 'react';
import { Plus, Music } from 'lucide-react';
import { Track } from '@/lib/types';
import { useVybeStore } from '@/lib/store';
import BottomSheet from './BottomSheet';

export default function TrackRow({ track, context }: { track: Track; context?: Track[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const playlists = useVybeStore((s) => s.playlists);
  const addToPlaylist = useVybeStore((s) => s.addToPlaylist);
  const createPlaylist = useVybeStore((s) => s.createPlaylist);
  const playTrack = useVybeStore((s) => s.playTrack);

  return (
    <>
      <div className="flex items-center gap-3 py-2">
        <button
          onClick={() => playTrack(track, context)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
        >
          {track.thumbnail ? (
            <img src={track.thumbnail} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-md bg-dusk-hover shrink-0 flex items-center justify-center">
              <Music size={16} className="text-haze" />
            </div>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-paper">{track.title}</span>
            <span className="block truncate text-xs text-haze">{track.artist}</span>
          </span>
        </button>
        <button
          onClick={() => setShowAdd(true)}
          aria-label="Add to playlist"
          className="p-2 text-haze hover:text-paper shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
        >
          <Plus size={18} />
        </button>
      </div>

      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)} title="Add to playlist">
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto mb-3">
          {playlists.length === 0 && (
            <p className="text-sm text-haze py-1">No playlists yet — make one below.</p>
          )}
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                addToPlaylist(p.id, track);
                setShowAdd(false);
              }}
              className="text-left py-2 px-2 rounded-lg hover:bg-dusk-hover text-sm text-paper"
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name"
            className="flex-1 bg-dusk-hover rounded-lg px-3 py-2 text-sm text-paper placeholder:text-haze outline-none focus-visible:ring-2 focus-visible:ring-marigold/60"
          />
          <button
            onClick={() => {
              if (!newName.trim()) return;
              const p = createPlaylist(newName.trim());
              addToPlaylist(p.id, track);
              setNewName('');
              setShowAdd(false);
            }}
            className="px-4 rounded-lg bg-marigold text-ink font-medium text-sm"
          >
            Add
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
