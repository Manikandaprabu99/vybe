'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track, Playlist } from './types';

export type RepeatMode = 'off' | 'all' | 'one';

// 'at': stop at that time (ms since epoch). 'end': stop when the current song
// finishes. Checked by lib/audioEngine.ts.
export type SleepTimer = { mode: 'off' } | { mode: 'at'; at: number } | { mode: 'end' };

interface VybeState {
  playlists: Playlist[];
  likedTracks: Track[];
  localTracks: Track[]; // imported from the person's own phone — see lib/localAudioDb.ts
  recentTracks: Track[]; // newest first, for the "Recently played" shelf
  sleepTimer: SleepTimer;

  queue: Track[];
  originalQueue: Track[]; // pre-shuffle order, so turning shuffle off can restore it
  currentIndex: number;
  isPlaying: boolean;
  // Bumped every time a track is explicitly (re)started — tapping a song,
  // next/previous, repeat-all wrapping round. It lets the player tell "start
  // this again" apart from "same track, nothing to do", which currentIndex
  // alone can't: repeat-all on a one-song queue stays at index 0 forever.
  playId: number;
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
  setPlaying: (playing: boolean) => void;
  jumpTo: (index: number) => void;
  playNext: () => void;
  playPrev: () => void;
  appendToQueue: (tracks: Track[]) => void;
  queueNext: (track: Track) => void;
  queueLater: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueued: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  recordRecent: (track: Track) => void;
  setSleepTimer: (timer: SleepTimer) => void;
}

const RECENT_LIMIT = 30;

// A queue entry's "queued" marker belongs to the queue only — strip it
// before a track is stored anywhere else.
function plain(track: Track): Track {
  if (!track.queued) return track;
  const { queued: _queued, ...rest } = track;
  return rest;
}

// Songs added with "Play next" / "Add to queue" that haven't played yet.
function upcomingQueued(queue: Track[], currentIndex: number): Track[] {
  return queue.slice(currentIndex + 1).filter((t) => t.queued);
}

// Where "Add to queue" goes: after the songs already queued, before the rest
// of what you were playing — the same order Spotify uses.
function endOfQueuedBlock(queue: Track[], currentIndex: number): number {
  let i = currentIndex + 1;
  while (i < queue.length && queue[i].queued) i++;
  return i;
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// What comes after `current`, or -1 once the queue is done. Shared by the
// store and lib/audioEngine.ts so "next" means the same thing everywhere —
// the engine needs to know it *before* asking the store, to have the next
// file ready the moment the current one ends.
export function nextIndex(length: number, current: number, repeat: RepeatMode): number {
  if (current < length - 1) return current + 1;
  if (repeat === 'all' && length > 0) return 0;
  return -1;
}

export const useVybeStore = create<VybeState>()(
  persist(
    (set, get) => ({
      playlists: [],
      likedTracks: [],
      localTracks: [],
      recentTracks: [],
      sleepTimer: { mode: 'off' },

      queue: [],
      originalQueue: [],
      currentIndex: -1,
      isPlaying: false,
      playId: 0,
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
              ? { ...p, tracks: [...p.tracks, plain(track)] }
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
              : [...s.likedTracks, plain(track)],
          };
        }),

      addLocalTrack: (track) => set((s) => ({ localTracks: [...s.localTracks, track] })),

      // Also clears the track out of playlists, liked songs and the queue so
      // nothing is left pointing at a file that no longer exists in local
      // storage.
      removeLocalTrack: (id) =>
        set((s) => {
          const removedIndex = s.queue.findIndex((t) => t.id === id);
          const queue = s.queue.filter((t) => t.id !== id);
          let { currentIndex, isPlaying } = s;
          if (removedIndex !== -1 && removedIndex < currentIndex) {
            currentIndex -= 1;
          } else if (removedIndex !== -1 && removedIndex === currentIndex) {
            // The song that was playing is gone — stop, rather than suddenly
            // playing whatever slid into its place.
            isPlaying = false;
            currentIndex = queue.length === 0 ? -1 : Math.min(currentIndex, queue.length - 1);
          }
          return {
            localTracks: s.localTracks.filter((t) => t.id !== id),
            likedTracks: s.likedTracks.filter((t) => t.id !== id),
            recentTracks: s.recentTracks.filter((t) => t.id !== id),
            playlists: s.playlists.map((p) => ({
              ...p,
              tracks: p.tracks.filter((t) => t.id !== id),
            })),
            queue,
            originalQueue: s.originalQueue.filter((t) => t.id !== id),
            currentIndex,
            isPlaying,
          };
        }),

      renameLocalTrack: (id, title) =>
        set((s) => {
          const rename = (t: Track): Track => (t.id === id ? { ...t, title } : t);
          return {
            localTracks: s.localTracks.map(rename),
            likedTracks: s.likedTracks.map(rename),
            recentTracks: s.recentTracks.map(rename),
            playlists: s.playlists.map((p) => ({ ...p, tracks: p.tracks.map(rename) })),
            queue: s.queue.map(rename),
            originalQueue: s.originalQueue.map(rename),
          };
        }),

      // Songs you've queued survive starting something else — they still play
      // next, then the new list continues, like Spotify's "Next in queue".
      playTrack: (track, context) => {
        const base = (context && context.length > 0 ? context : [track]).map(plain);
        const { shuffleEnabled, playId, queue, currentIndex } = get();
        const pending = upcomingQueued(queue, currentIndex);

        if (shuffleEnabled) {
          const rest = shuffled(base.filter((t) => t.id !== track.id));
          set({
            originalQueue: base,
            queue: [plain(track), ...pending, ...rest],
            currentIndex: 0,
            isPlaying: true,
            playId: playId + 1,
          });
        } else {
          const found = base.findIndex((t) => t.id === track.id);
          const index = found === -1 ? 0 : found;
          set({
            queue: [...base.slice(0, index + 1), ...pending, ...base.slice(index + 1)],
            originalQueue: [],
            currentIndex: index,
            isPlaying: true,
            playId: playId + 1,
          });
        }
      },

      togglePlay: () => set((s) => (s.currentIndex < 0 ? s : { isPlaying: !s.isPlaying })),

      // Used when playback stops or starts on its own — a phone call, the
      // browser blocking autoplay, YouTube pausing when the app goes to the
      // background — so the play/pause button always shows what's really
      // happening.
      setPlaying: (playing) =>
        set((s) => (s.isPlaying === playing || (playing && s.currentIndex < 0) ? s : { isPlaying: playing })),

      jumpTo: (index) => {
        const { queue, playId } = get();
        if (index < 0 || index >= queue.length) return;
        set({ currentIndex: index, isPlaying: true, playId: playId + 1 });
      },

      playNext: () => {
        const { queue, currentIndex, repeatMode, playId } = get();
        const next = nextIndex(queue.length, currentIndex, repeatMode);
        if (next === -1) {
          set({ isPlaying: false });
        } else {
          set({ currentIndex: next, isPlaying: true, playId: playId + 1 });
        }
      },

      // Going back from the first song restarts it instead of doing nothing.
      // ("Restart the current song if it's more than a few seconds in" lives
      // in lib/audioEngine.ts, since it needs the playback position.)
      playPrev: () => {
        const { queue, currentIndex, playId } = get();
        if (currentIndex < 0 || queue.length === 0) return;
        set({ currentIndex: Math.max(currentIndex - 1, 0), isPlaying: true, playId: playId + 1 });
      },

      // Used by autoplay ("keep playing similar songs") — appends without
      // duplicating anything already queued.
      appendToQueue: (tracks) =>
        set((s) => ({
          queue: [...s.queue, ...tracks.map(plain).filter((t) => !s.queue.some((q) => q.id === t.id))],
        })),

      // "Play next": straight after the current song, ahead of anything
      // queued earlier. With nothing playing yet it simply starts the song.
      queueNext: (track) => {
        const { queue, currentIndex } = get();
        if (currentIndex < 0 || queue.length === 0) {
          get().playTrack(track);
          return;
        }
        const entry: Track = { ...plain(track), queued: true };
        set({ queue: [...queue.slice(0, currentIndex + 1), entry, ...queue.slice(currentIndex + 1)] });
      },

      // "Add to queue": after the songs already queued.
      queueLater: (track) => {
        const { queue, currentIndex } = get();
        if (currentIndex < 0 || queue.length === 0) {
          get().playTrack(track);
          return;
        }
        const at = endOfQueuedBlock(queue, currentIndex);
        const entry: Track = { ...plain(track), queued: true };
        set({ queue: [...queue.slice(0, at), entry, ...queue.slice(at)] });
      },

      removeFromQueue: (index) =>
        set((s) => {
          if (index === s.currentIndex || index < 0 || index >= s.queue.length) return s;
          const removed = s.queue[index];
          let originalQueue = s.originalQueue;
          // Keep the pre-shuffle order in step, so turning shuffle off
          // doesn't bring a removed song back.
          if (!removed.queued && originalQueue.length > 0) {
            const at = originalQueue.findIndex((t) => t.id === removed.id);
            if (at !== -1) originalQueue = originalQueue.filter((_, i) => i !== at);
          }
          return {
            queue: s.queue.filter((_, i) => i !== index),
            originalQueue,
            currentIndex: index < s.currentIndex ? s.currentIndex - 1 : s.currentIndex,
          };
        }),

      clearQueued: () =>
        set((s) => ({ queue: s.queue.filter((t, i) => i <= s.currentIndex || !t.queued) })),

      // Shuffle only reorders what you were playing; songs you queued stay
      // right after the current one, in the order you queued them.
      toggleShuffle: () => {
        const { queue, originalQueue, currentIndex, shuffleEnabled } = get();
        const current = queue[currentIndex];
        if (!current) {
          set({ shuffleEnabled: !shuffleEnabled });
          return;
        }
        const pending = upcomingQueued(queue, currentIndex);

        if (!shuffleEnabled) {
          const context = queue.filter((t, i) => !(i > currentIndex && t.queued));
          const rest = shuffled(context.filter((t) => t !== current));
          set({
            originalQueue: context,
            queue: [current, ...pending, ...rest],
            currentIndex: 0,
            shuffleEnabled: true,
          });
        } else {
          const restored =
            originalQueue.length > 0 ? originalQueue : queue.filter((t, i) => !(i > currentIndex && t.queued));
          const idx = restored.findIndex((t) => t.id === current.id);
          set({
            queue:
              idx === -1
                ? [current, ...pending, ...restored]
                : [...restored.slice(0, idx), current, ...pending, ...restored.slice(idx + 1)],
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

      // Called by lib/audioEngine.ts once a song actually starts playing (not
      // when a session is merely restored), most recent first, no repeats.
      recordRecent: (track) =>
        set((s) => ({
          recentTracks: [plain(track), ...s.recentTracks.filter((t) => t.id !== track.id)].slice(0, RECENT_LIMIT),
        })),

      setSleepTimer: (timer) => set({ sleepTimer: timer }),
    }),
    {
      name: 'vybe-storage',
      // Restored by <StoreHydrator /> after the first render instead of while
      // this module loads — see components/StoreHydrator.tsx for why.
      skipHydration: true,
      // Playlists, liked songs and local-track metadata, plus the last
      // session (queue, position in it, shuffle/repeat) so reopening the app
      // — or the phone killing it in the background — brings back what you
      // were listening to, paused. isPlaying is deliberately left out: the
      // app should never start making noise by itself on launch (and a sleep
      // timer from yesterday means nothing today). The actual bytes for local
      // tracks live in IndexedDB (lib/localAudioDb.ts), not here —
      // localStorage isn't built for files that size.
      partialize: (s) => ({
        playlists: s.playlists,
        likedTracks: s.likedTracks,
        localTracks: s.localTracks,
        recentTracks: s.recentTracks,
        queue: s.queue,
        originalQueue: s.originalQueue,
        currentIndex: s.currentIndex,
        shuffleEnabled: s.shuffleEnabled,
        repeatMode: s.repeatMode,
      }),
    }
  )
);

// False until the saved library has been restored (see StoreHydrator). For
// screens where "nothing saved" and "not loaded yet" look different — a
// playlist opened by its URL shouldn't flash "not found" first.
export function useStoreHydrated(): boolean {
  // Starts false on the server and on the first client render alike, so the
  // markup matches; already true when navigating within the app. (On the
  // server there's no localStorage, so zustand doesn't attach `persist` at
  // all — hence the optional chaining.)
  const [hydrated, setHydrated] = useState(() => useVybeStore.persist?.hasHydrated() ?? false);
  useEffect(() => {
    const persistApi = useVybeStore.persist;
    if (!persistApi) return;
    const unsubscribe = persistApi.onFinishHydration(() => setHydrated(true));
    setHydrated(persistApi.hasHydrated());
    return unsubscribe;
  }, []);
  return hydrated;
}
