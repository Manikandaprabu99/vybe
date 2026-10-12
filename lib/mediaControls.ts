'use client';

// Lock-screen / notification controls, behind one small interface with two
// implementations:
//
// - In a browser or installed PWA: the standard Media Session API. Chrome on
//   Android and Safari on iOS turn it into lock-screen and notification
//   controls on their own.
// - Inside the Android app (android/, built by Capacitor): Android's WebView
//   doesn't implement Media Session, so @capgo/capacitor-media-session does it
//   natively instead. While something is playing, it also runs a foreground
//   media service — the thing that stops Android from killing the app a few
//   minutes after the screen goes off.

export type MediaAction = 'play' | 'pause' | 'stop' | 'previoustrack' | 'nexttrack' | 'seekto';
export type MediaActionHandler = (details: { seekTime?: number | null }) => void;

export interface MediaArtwork {
  src: string;
  sizes?: string;
  type?: string;
}

export interface MediaMeta {
  title: string;
  artist: string;
  album?: string;
  artwork: MediaArtwork[];
}

export interface MediaControls {
  setMetadata: (meta: MediaMeta | null) => void;
  setPlaybackState: (state: 'playing' | 'paused' | 'none') => void;
  setPositionState: (state: { duration: number; position: number; playbackRate: number } | null) => void;
  setActionHandler: (action: MediaAction, handler: MediaActionHandler | null) => void;
}

// Capacitor's native bridge injects window.Capacitor into the page when it
// runs inside the app. Checking for it directly (instead of importing
// @capacitor/core) keeps the plugin code out of the website's bundle
// entirely — it's only loaded, lazily, inside the app.
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

const webControls: MediaControls = {
  setMetadata(meta) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = meta ? new MediaMetadata(meta) : null;
  },
  setPlaybackState(state) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  },
  setPositionState(state) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      navigator.mediaSession.setPositionState(state ?? undefined);
    } catch {
      // Throws on out-of-range values (e.g. position briefly past duration) — skipping one update is harmless.
    }
  },
  setActionHandler(action, handler) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler(
        action,
        handler ? (details) => handler({ seekTime: details.seekTime }) : null
      );
    } catch {
      // Older browsers throw for actions they don't know (often 'seekto') — harmless.
    }
  },
};

function createNativeControls(): MediaControls {
  // Every call chains off the same promise, so they reach the plugin in the
  // order they were made even though it loads asynchronously.
  const plugin = import('@capgo/capacitor-media-session').then((m) => m.MediaSession);
  const run = (fn: (p: Awaited<typeof plugin>) => Promise<unknown>) => {
    plugin.then(fn).catch(() => {
      // A failed lock-screen update must never break playback itself.
    });
  };
  return {
    setMetadata(meta) {
      run((p) => p.setMetadata(meta ?? { title: '', artist: '', album: '', artwork: [] }));
    },
    setPlaybackState(state) {
      run((p) => p.setPlaybackState({ playbackState: state }));
    },
    setPositionState(state) {
      if (state) run((p) => p.setPositionState(state));
    },
    setActionHandler(action, handler) {
      run((p) =>
        p.setActionHandler({ action }, handler ? (details) => handler({ seekTime: details.seekTime }) : null)
      );
    },
  };
}

let controls: MediaControls | null = null;

export function getMediaControls(): MediaControls {
  if (!controls) controls = isNativeApp() ? createNativeControls() : webControls;
  return controls;
}
