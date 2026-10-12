'use client';

import { create } from 'zustand';

// Fast-changing playback state — position, buffering, errors — kept apart
// from the main store so ticking the seek bar several times a second doesn't
// re-render every component that reads playlists or the queue, and so none
// of it ends up in localStorage. Written by lib/audioEngine.ts (My Files,
// radio) and by components/Player.tsx (polling the YouTube embed).
interface PlaybackClock {
  currentTime: number;
  duration: number; // Infinity for live radio — there's no end to seek to
  buffering: boolean;
  error: string | null;
}

export const usePlaybackClock = create<PlaybackClock>(() => ({
  currentTime: 0,
  duration: 0,
  buffering: false,
  error: null,
}));
