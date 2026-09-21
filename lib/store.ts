'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track, Playlist } from './types';

export type RepeatMode = 'off' | 'all' | 'one';

interface VybeState {
  playlists: Playlist[];
  likedTracks: Track[];
  localTracks: Track[]; // imported from the person's own phone — see lib/localAudioDb.ts

  queue: Track[];
  originalQueue: Track[]; // pre-shuffle order, so turning shuffle off can restore it
  currentIndex: number;
  isPlaying: boolean;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;

  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  toggleLike: (track: Track) => void;
  addLocalTrack: (track: Track) => void;
  removeLocalTrack: (id: string) => void;
  renameLocalTrack: (id: string, title: string) => void;

  playTrack: (track: Track, context?: Track[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const useVybeStore = create<VybeState>()(
  persist(
    (set, get) => ({
      playlists: [],
      likedTracks: [],
      localTracks: [],

      queue: [],
      originalQueue: [],
      currentIndex: -1,
      isPlaying: false,
      shuffleEnabled: false,
      repeatMode: 'off',

      createPlaylist: (name) => {
        const playlist: Playlist = { id: crypto.randomUUID(), name, tracks: [] };
        set((s) => ({ playlists: [...s.playlists, playlist] }));
        return playlist;
      },

      deletePlaylist: (id) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),

      addToPlaylist: (playlistId, track) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId && !p.tracks.some((t) => t.id === track.id)
              ? { ...p, tracks: [...p.tracks, track] }
              : p
          ),
        })),

      removeFromPlaylist: (playlistId, trackId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
              : p
          ),
        })),

      toggleLike: (track) =>
        set((s) => {
          const liked = s.likedTracks.some((t) => t.id === track.id);
          return {
            likedTracks: liked
              ? s.likedTracks.filter((t) => t.id !== track.id)
              : [...s.likedTracks, track],
          };
        }),

      addLocalTrack: (track) => set((s) => ({ localTracks: [...s.localTracks, track] })),

      // Also clears the track out of playlists/liked songs so nothing is left
      // pointing at a file that no longer exists in local storage.
      removeLocalTrack: (id) =>
        set((s) => ({
          localTracks: s.localTracks.filter((t) => t.id !== id),
          likedTracks: s.likedTracks.filter((t) => t.id !== id),
          playlists: s.playlists.map((p) => ({
            ...p,
            tracks: p.tracks.filter((t) => t.id !== id),
          })),
        })),

      renameLocalTrack: (id, title) =>
        set((s) => {
          const rename = (t: Track): Track => (t.id === id ? { ...t, title } : t);
          return {
            localTracks: s.localTracks.map(rename),
            likedTracks: s.likedTracks.map(rename),
            playlists: s.playlists.map((p) => ({ ...p, tracks: p.tracks.map(rename) })),
          };
        }),

      playTrack: (track, context) => {
        const base = context && context.length > 0 ? context : [track];
        const { shuffleEnabled } = get();

        if (shuffleEnabled) {
          const rest = shuffled(base.filter((t) => t.id !== track.id));
          set({ originalQueue: base, queue: [track, ...rest], currentIndex: 0, isPlaying: true });
        } else {
          const currentIndex = base.findIndex((t) => t.id === track.id);
          set({
            queue: base,
            originalQueue: [],
            currentIndex: currentIndex === -1 ? 0 : currentIndex,
            isPlaying: true,
          });
        }
      },

      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

      playNext: () => {
        const { queue, currentIndex, repeatMode } = get();
        if (currentIndex < queue.length - 1) {
          set({ currentIndex: currentIndex + 1, isPlaying: true });
        } else if (repeatMode === 'all' && queue.length > 0) {
          set({ currentIndex: 0, isPlaying: true });
        } else {
          set({ isPlaying: false });
        }
      },

      playPrev: () => {
        const { queue, currentIndex } = get();
        if (currentIndex > 0) set({ currentIndex: currentIndex - 1, isPlaying: true });
      },

      toggleShuffle: () => {
        const { queue, originalQueue, currentIndex, shuffleEnabled } = get();
        const current = queue[currentIndex];
        if (!current) {
          set({ shuffleEnabled: !shuffleEnabled });
          return;
        }

        if (!shuffleEnabled) {
          const rest = shuffled(queue.filter((_, i) => i !== currentIndex));
          set({ originalQueue: queue, queue: [current, ...rest], currentIndex: 0, shuffleEnabled: true });
        } else {
          const restored = originalQueue.length > 0 ? originalQueue : queue;
          const idx = restored.findIndex((t) => t.id === current.id);
          set({
            queue: restored,
            currentIndex: idx === -1 ? 0 : idx,
            shuffleEnabled: false,
            originalQueue: [],
          });
        }
      },

      cycleRepeat: () =>
        set((s) => ({
          repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
        })),
    }),
    {
      name: 'vybe-storage',
      // Playlists, liked songs and local-track metadata need to survive a
      // refresh — queue, shuffle and repeat are session state. The actual
      // bytes for local tracks live in IndexedDB (lib/localAudioDb.ts), not
      // here — localStorage isn't built for files that size.
      partialize: (s) => ({
        playlists: s.playlists,
        likedTracks: s.likedTracks,
        localTracks: s.localTracks,
      }),
    }
  )
);
