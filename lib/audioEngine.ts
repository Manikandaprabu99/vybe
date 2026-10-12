'use client';

// VYBE's playback engine for everything that isn't YouTube: songs from My
// Files and live radio. Both play through one long-lived <audio> element
// that lives outside React, and that's what makes background playback work:
//
// - When a song ends with the screen locked, the next one has to start
//   *inside* that same 'ended' event. If the page goes quiet while it waits
//   on an async step (a React re-render, an IndexedDB read), iOS — and
//   Android under battery pressure — treat it as finished making sound and
//   suspend it, and the queue stalls until you unlock the phone. So the next
//   song's file is resolved ahead of time (preloadNeighbours), and moving on
//   is synchronous: store.jumpTo() -> onStoreChange() -> el.src = url ->
//   el.play(), all before the event handler returns.
// - The element is never re-created or unmounted, so the browser keeps
//   treating VYBE as the app that's playing, and lock-screen controls stay
//   attached to it.
// - Whatever pauses or resumes playback from outside (a phone call, unplugged
//   headphones, the lock screen, the browser blocking autoplay) is written
//   back to the store, so the play button never lies.
//
// YouTube tracks are played by the embed in components/Player.tsx. This
// module only keeps the queue logic and lock-screen metadata in step for
// them.

import { useVybeStore, nextIndex } from './store';
import { usePlaybackClock } from './playbackClock';
import { getLocalFile } from './localAudioDb';
import { getMediaControls, isNativeApp, MediaArtwork, MediaActionHandler } from './mediaControls';
import { songKey } from './format';
import { ytClient } from './youtube/client';
import { withBase } from './paths';
import { Track, isDirectAudio } from './types';

export interface YouTubeControls {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
}

type StoreState = ReturnType<typeof useVybeStore.getState>;
type ClockState = ReturnType<typeof usePlaybackClock.getState>;

const POSITION_KEY = 'vybe-position';
const RADIO_CLICK_URL = 'https://all.api.radio-browser.info/json/url/';

let audio: HTMLAudioElement | null = null;
let initialized = false;
// Which track the <audio> element currently holds (null = nothing loaded).
// Events from the element are ignored unless this matches the current track.
let loadedTrackId: string | null = null;
// Bumped on every track change, so a slow IndexedDB read for a song the
// person has already skipped past can't start playing over the new one.
let loadSeq = 0;
// True while we're starting playback ourselves, so a 'pause' fired as part of
// swapping the source isn't mistaken for the OS pausing us.
let switching = false;
let youtube: YouTubeControls | null = null;
let consecutiveErrors = 0;
let radioRetries = 0;
// Where you were in the last song before the app closed, applied once when
// that song loads again.
let resumeAt: { id: string; t: number } | null = null;
let lastPositionSave = 0;
// blob: URLs for local files — only for the current song and its neighbours,
// so they're ready instantly without holding onto every file you've played.
const objectUrls = new Map<string, string>();
const countedStations = new Set<string>();
// The playId whose song was last added to "Recently played", so a song is
// recorded once per play rather than on every resume.
let recordedPlayId = -1;
// The similar-songs fetch for the current last song in the queue, started
// as soon as that song begins so the next one is ready when it ends.
let relatedFetch: { playId: number; promise: Promise<boolean> } | null = null;

const state = (): StoreState => useVybeStore.getState();
const setClock = (partial: Partial<ClockState>) => usePlaybackClock.setState(partial);

function currentTrack(): Track | null {
  const s = state();
  return s.queue[s.currentIndex] ?? null;
}

function ownsCurrentTrack(): boolean {
  const track = currentTrack();
  return !!track && isDirectAudio(track) && loadedTrackId === track.id;
}

// The songs either side of the current one — the only ones worth having
// ready, since next/previous (including from the lock screen) are the only
// ways to reach a different song without touching the screen.
function neighbours(): Track[] {
  const { queue, currentIndex, repeatMode } = state();
  const result: Track[] = [];
  const next = nextIndex(queue.length, currentIndex, repeatMode);
  if (next !== -1) result.push(queue[next]);
  if (currentIndex > 0) result.push(queue[currentIndex - 1]);
  return result;
}

// Synchronous: only returns a URL that's already known, so callers that must
// not wait (the 'ended' handler) can tell whether they can start right away.
function readyUrl(track: Track): string | null {
  if (track.source === 'radio') return track.streamUrl ?? null;
  if (track.source === 'local') return objectUrls.get(track.id) ?? null;
  return null;
}

async function resolveUrl(track: Track): Promise<string | null> {
  const ready = readyUrl(track);
  if (ready || track.source !== 'local') return ready;
  const blob = await getLocalFile(track.id).catch(() => null);
  if (!blob) return null;
  const existing = objectUrls.get(track.id); // resolved by another call meanwhile
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  objectUrls.set(track.id, url);
  return url;
}

function preloadNeighbours() {
  for (const t of neighbours()) {
    if (t.source === 'local' && !objectUrls.has(t.id)) void resolveUrl(t);
  }
}

function pruneObjectUrls() {
  const keep = new Set(neighbours().map((t) => t.id));
  const current = currentTrack();
  if (current) keep.add(current.id);
  if (loadedTrackId) keep.add(loadedTrackId);
  for (const [id, url] of Array.from(objectUrls)) {
    if (keep.has(id)) continue;
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

function startElement(track: Track, url: string, play: boolean) {
  const el = audio;
  if (!el) return;
  loadedTrackId = track.id;
  // A live stream shouldn't start downloading until someone presses play.
  el.preload = track.source === 'radio' ? 'none' : 'auto';
  // Assigning src always restarts loading, even with the same URL — which is
  // exactly what repeat-all on a one-song queue needs.
  el.src = url;
  const restored = resumeAt?.id === track.id ? resumeAt.t : 0;
  setClock({
    currentTime: restored,
    duration: track.source === 'radio' ? Infinity : 0,
    buffering: play,
    error: null,
  });
  if (play) {
    playElement();
    countRadioClick(track);
  }
}

function playElement() {
  const el = audio;
  if (!el) return;
  switching = true;
  el.play()
    .then(() => {
      switching = false;
    })
    .catch((err: unknown) => {
      switching = false;
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError') {
        // The browser wants a tap first (iOS, or a freshly reopened app).
        // Show a play button instead of a spinner that never resolves.
        setClock({ buffering: false });
        state().setPlaying(false);
      }
      // AbortError just means a newer load replaced this one, and real media
      // failures also fire the element's 'error' event, handled there — so
      // nothing else to do here.
    });
}

function unload() {
  const el = audio;
  loadedTrackId = null;
  if (!el || !el.getAttribute('src')) return;
  el.pause();
  // Dropping the source (not just pausing) stops a radio stream downloading
  // and releases the file — and guarantees nothing keeps playing underneath
  // a YouTube video.
  el.removeAttribute('src');
  el.load();
}

function onTrackChanged(track: Track | null, play: boolean) {
  const seq = ++loadSeq;
  radioRetries = 0;
  if (resumeAt && resumeAt.id !== track?.id) resumeAt = null;
  updateMetadata(track);

  if (!track || !isDirectAudio(track)) {
    // YouTube (or nothing) takes over — Player.tsx drives the embed.
    unload();
    setClock({
      currentTime: track && resumeAt?.id === track.id ? resumeAt.t : 0,
      duration: 0,
      buffering: !!track && play,
      error: null,
    });
    if (play) prefetchRelatedIfLast();
    return;
  }

  if (track.source === 'radio' && !play) {
    // Don't open a live stream nobody has asked to hear yet (e.g. a restored
    // session) — it's connected on play.
    unload();
    setClock({ currentTime: 0, duration: Infinity, buffering: false, error: null });
    return;
  }

  const ready = readyUrl(track);
  if (ready) {
    startElement(track, ready, play);
    preloadNeighbours();
    pruneObjectUrls();
    return;
  }

  unload();
  setClock({ currentTime: resumeAt?.id === track.id ? resumeAt.t : 0, duration: 0, buffering: play, error: null });
  void resolveUrl(track).then((url) => {
    if (seq !== loadSeq) return; // they've moved on meanwhile
    if (!url) {
      setClock({ buffering: false, error: 'This file is no longer on this device.' });
      skipAfterError();
      return;
    }
    startElement(track, url, state().isPlaying);
    preloadNeighbours();
    pruneObjectUrls();
  });
}

function onPlayingChanged(track: Track | null, playing: boolean) {
  if (!track || !isDirectAudio(track) || !audio) return;
  if (!playing) {
    if (!audio.paused) audio.pause();
    return;
  }
  // Radio reconnects on resume, so it picks up live instead of replaying a
  // stale buffer; a restored session has nothing loaded until now.
  if (track.source === 'radio' || loadedTrackId !== track.id) {
    onTrackChanged(track, true);
    return;
  }
  playElement();
}

function advance(reason: 'ended' | 'skip' | 'error') {
  const s = state();
  const track = s.queue[s.currentIndex];
  if (!track) return;
  if (reason === 'ended' && s.sleepTimer.mode === 'end') {
    // Sleep timer set to "end of song": stop here instead of moving on.
    s.setSleepTimer({ mode: 'off' });
    s.setPlaying(false);
    return;
  }
  if (reason === 'ended' && s.repeatMode === 'one') {
    restartCurrent();
    return;
  }
  const next = nextIndex(s.queue.length, s.currentIndex, s.repeatMode);
  if (next !== -1) {
    // onStoreChange runs synchronously inside this call and starts the next
    // song straight away when its URL is ready.
    s.jumpTo(next);
    return;
  }
  if (track.source === 'youtube') {
    void continueWithRelated(track);
    return;
  }
  s.setPlaying(false);
}

function restartCurrent() {
  const track = currentTrack();
  if (!track) return;
  if (track.source === 'youtube') {
    youtube?.seek(0);
    youtube?.play();
  } else if (audio && loadedTrackId === track.id) {
    audio.currentTime = 0;
    playElement();
  } else {
    state().jumpTo(state().currentIndex);
  }
}

function skipAfterError() {
  consecutiveErrors += 1;
  const s = state();
  // Skip past a broken file the way any music app would — but stop once
  // every song in the queue has failed, instead of looping forever.
  if (s.isPlaying && consecutiveErrors < s.queue.length) advance('error');
  else s.setPlaying(false);
}

function handleMediaError() {
  const track = currentTrack();
  if (!track || !isDirectAudio(track)) return;
  if (track.source === 'radio') {
    if (radioRetries < 3 && state().isPlaying) {
      radioRetries += 1;
      setClock({ buffering: true });
      const seq = loadSeq;
      // Live streams drop when the network changes (Wi-Fi to mobile data, a
      // tunnel); reconnecting after a moment usually brings them back.
      setTimeout(() => {
        if (seq === loadSeq && state().isPlaying && track.streamUrl) startElement(track, track.streamUrl, true);
      }, 1000 * radioRetries);
      return;
    }
    setClock({ buffering: false, error: "This station isn't reachable right now." });
    state().setPlaying(false);
    return;
  }
  setClock({ buffering: false, error: "This file couldn't be played." });
  skipAfterError();
}

// "Autoplay" (song radio): when a YouTube song is the last one in the queue,
// fetch similar songs — same movie, same singer, same label; see
// getRelatedTracks in lib/youtube.ts — and append them, so playback carries
// on instead of stopping. It starts as soon as that last song begins rather
// than when it ends, so the next song is already there (and visible in Up
// Next). Returns whether anything was added.
function fetchRelated(seed: Track, playId: number): Promise<boolean> {
  if (relatedFetch?.playId === playId) return relatedFetch.promise;
  const exclude = new Set(state().queue.filter((t) => t.source === 'youtube').map((t) => t.id));

  const promise = (async () => {
    try {
      const results = await ytClient.getRelatedTracks(seed, exclude, 10);
      if (state().playId !== playId) return false; // they picked something else meanwhile
      // Skip other uploads of songs already in the queue (the lyric video
      // of a song you just heard is still the same song).
      const known = new Set(state().queue.map((t) => songKey(t.title, !!t.album)));
      const fresh = results.filter((t) => !known.has(songKey(t.title, !!t.album)));
      if (fresh.length === 0) return false;
      state().appendToQueue(fresh);
      return true;
    } catch {
      return false; // offline or out of quota — playback just stops at the end
    }
  })();
  relatedFetch = { playId, promise };
  return promise;
}

function prefetchRelatedIfLast() {
  const s = state();
  const track = s.queue[s.currentIndex];
  if (!track || track.source !== 'youtube') return;
  if (nextIndex(s.queue.length, s.currentIndex, s.repeatMode) !== -1) return;
  void fetchRelated(track, s.playId);
}

// The queue ran out: use the prefetched songs (waiting for the fetch if it's
// still on its way), or stop if there are none.
async function continueWithRelated(seed: Track) {
  const playId = state().playId;
  await fetchRelated(seed, playId);
  const after = state();
  if (after.playId !== playId) return;
  const next = nextIndex(after.queue.length, after.currentIndex, after.repeatMode);
  if (next !== -1) after.jumpTo(next);
  else after.setPlaying(false);
}

// A song really started — add it to "Recently played" (once per play).
function recordPlay() {
  const s = state();
  const track = s.queue[s.currentIndex];
  if (!track || s.playId === recordedPlayId) return;
  recordedPlayId = s.playId;
  s.recordRecent(track);
}

// Stops playback once the sleep timer's time is up. Run on every
// 'timeupdate' (which keeps firing while audio plays with the screen off,
// unlike timers, which browsers throttle in the background) and once a
// second as a fallback.
function checkSleepTimer() {
  const s = state();
  if (s.sleepTimer.mode !== 'at' || Date.now() < s.sleepTimer.at) return;
  s.setSleepTimer({ mode: 'off' });
  s.setPlaying(false);
}

// Lock-screen artwork needs an absolute URL — including the GitHub Pages
// sub-path the app is served from.
function absolute(path: string): string {
  return new URL(withBase(path), window.location.origin).href;
}

function artworkFor(track: Track): MediaArtwork[] {
  const appIcon: MediaArtwork[] = [
    { src: absolute('/icon-512.png'), sizes: '512x512', type: 'image/png' },
    { src: absolute('/icon-192.png'), sizes: '192x192', type: 'image/png' },
  ];
  if (track.source === 'youtube') {
    return [
      { src: `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
      { src: `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
    ];
  }
  // Radio station logos come in all shapes and sizes, so no size is claimed.
  if (track.thumbnail.startsWith('https://')) return [{ src: track.thumbnail }, ...appIcon];
  return appIcon;
}

const onSeekTo: MediaActionHandler = (details) => {
  if (details.seekTime != null) seek(details.seekTime);
};

function updateMetadata(track: Track | null) {
  const controls = getMediaControls();
  if (!track) {
    controls.setMetadata(null);
    return;
  }
  controls.setMetadata({
    title: track.title,
    artist: track.artist,
    album: track.source === 'radio' ? 'VYBE Radio' : 'VYBE',
    artwork: artworkFor(track),
  });
  // Live radio has no timeline to scrub.
  controls.setActionHandler('seekto', track.source === 'radio' ? null : onSeekTo);
}

function syncPlaybackState() {
  const s = state();
  const track = s.queue[s.currentIndex];
  const controls = getMediaControls();
  if (!track) {
    controls.setPlaybackState('none');
    return;
  }
  // Inside the Android app, 'playing'/'paused' is what keeps the foreground
  // media service — and with it background playback — alive. That's kept for
  // audio VYBE is allowed to play in the background (My Files and radio),
  // not YouTube, whose terms don't allow background play.
  if (isNativeApp() && !isDirectAudio(track)) {
    controls.setPlaybackState('none');
    return;
  }
  controls.setPlaybackState(s.isPlaying ? 'playing' : 'paused');
}

// Lets the lock screen draw a progress bar and extrapolate it on its own.
function syncPositionState() {
  const track = currentTrack();
  if (!audio || !track || track.source !== 'local' || loadedTrackId !== track.id) return;
  const duration = audio.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  getMediaControls().setPositionState({
    duration,
    position: Math.min(audio.currentTime, duration),
    playbackRate: audio.playbackRate || 1,
  });
}

function countRadioClick(track: Track) {
  if (track.source !== 'radio') return;
  const uuid = track.id.replace(/^radio:/, '');
  if (countedStations.has(uuid)) return;
  countedStations.add(uuid);
  // Radio Browser asks apps to report plays — it's what keeps its popularity
  // ranking (which the Radio page sorts by) meaningful.
  fetch(RADIO_CLICK_URL + encodeURIComponent(uuid)).catch(() => {});
}

function savePosition(force: boolean) {
  const track = currentTrack();
  if (!track || track.source === 'radio') return;
  const now = Date.now();
  if (!force && now - lastPositionSave < 5000) return;
  lastPositionSave = now;
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify({ id: track.id, t: usePlaybackClock.getState().currentTime }));
  } catch {
    // Storage full or blocked — losing the resume position is harmless.
  }
}

function readSavedPosition(): { id: string; t: number } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null');
    if (parsed && typeof parsed.id === 'string' && typeof parsed.t === 'number' && parsed.t > 0) return parsed;
  } catch {
    // Corrupt or unavailable storage — start from the top.
  }
  return null;
}

function onStoreChange(s: StoreState, prev: StoreState) {
  const track = s.queue[s.currentIndex] ?? null;
  const prevTrack = prev.queue[prev.currentIndex] ?? null;
  const trackChanged = s.playId !== prev.playId || track?.id !== prevTrack?.id;

  if (trackChanged) {
    onTrackChanged(track, s.isPlaying);
  } else {
    if (s.isPlaying !== prev.isPlaying) onPlayingChanged(track, s.isPlaying);
    if (track && track.title !== prevTrack?.title) updateMetadata(track); // renamed in My Files
    // The next song changed (shuffle, repeat, queueing, autoplay appending
    // more) — have the new one ready too, or fetch similar songs if the
    // current one is now the last.
    if (s.queue !== prev.queue || s.repeatMode !== prev.repeatMode) {
      preloadNeighbours();
      if (s.isPlaying) prefetchRelatedIfLast();
    }
  }
  if (trackChanged || s.isPlaying !== prev.isPlaying) syncPlaybackState();
}

function attachListeners(el: HTMLAudioElement) {
  el.addEventListener('timeupdate', () => {
    if (!ownsCurrentTrack()) return;
    setClock({ currentTime: el.currentTime });
    checkSleepTimer();
  });
  el.addEventListener('loadedmetadata', () => {
    if (!ownsCurrentTrack()) return;
    if (resumeAt && resumeAt.id === loadedTrackId && Number.isFinite(el.duration)) {
      el.currentTime = Math.min(resumeAt.t, Math.max(el.duration - 1, 0));
      resumeAt = null;
    }
    setClock({ duration: el.duration, currentTime: el.currentTime });
    syncPositionState();
  });
  el.addEventListener('durationchange', () => {
    if (!ownsCurrentTrack()) return;
    setClock({ duration: el.duration });
    syncPositionState();
  });
  el.addEventListener('waiting', () => {
    if (ownsCurrentTrack()) setClock({ buffering: true });
  });
  el.addEventListener('playing', () => {
    if (!ownsCurrentTrack()) return;
    consecutiveErrors = 0;
    radioRetries = 0;
    setClock({ buffering: false, error: null });
    recordPlay();
  });
  el.addEventListener('play', () => {
    if (!ownsCurrentTrack()) return;
    // Resumed from outside — a headset button, or the OS's own controls.
    if (!state().isPlaying) state().setPlaying(true);
    syncPositionState();
  });
  el.addEventListener('pause', () => {
    // A natural end also fires 'pause' first; 'ended' decides what's next.
    if (el.ended || switching || !ownsCurrentTrack()) return;
    // Paused from outside — a phone call, headphones unplugged.
    if (state().isPlaying) state().setPlaying(false);
    syncPositionState();
  });
  el.addEventListener('seeked', syncPositionState);
  el.addEventListener('ratechange', syncPositionState);
  el.addEventListener('ended', () => {
    if (!ownsCurrentTrack()) return;
    // A live stream "ending" means the connection dropped.
    if (currentTrack()?.source === 'radio') handleMediaError();
    else advance('ended');
  });
  el.addEventListener('error', () => {
    if (ownsCurrentTrack() && el.getAttribute('src')) handleMediaError();
  });
}

export function initAudioEngine(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const el = new Audio();
  el.id = 'vybe-audio';
  el.preload = 'auto';
  el.hidden = true;
  document.body.appendChild(el);
  audio = el;
  attachListeners(el);
  resumeAt = readSavedPosition();

  const controls = getMediaControls();
  controls.setActionHandler('play', () => state().setPlaying(true));
  controls.setActionHandler('pause', () => state().setPlaying(false));
  controls.setActionHandler('stop', () => state().setPlaying(false));
  controls.setActionHandler('previoustrack', () => skipPrev());
  controls.setActionHandler('nexttrack', () => skipNext());

  useVybeStore.subscribe(onStoreChange);
  usePlaybackClock.subscribe(() => savePosition(false));
  setInterval(checkSleepTimer, 1000);
  window.addEventListener('pagehide', () => savePosition(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition(true);
  });

  // Catch up with whatever the store already holds — e.g. a session restored
  // before this ran.
  const s = state();
  onTrackChanged(s.queue[s.currentIndex] ?? null, s.isPlaying);
  syncPlaybackState();
}

// Next: from the Next button, the lock screen, or a YouTube video that can't
// be embedded.
export function skipNext(): void {
  advance('skip');
}

// Previous restarts the current song if it's more than a few seconds in —
// the same as every other music app — and only otherwise goes back.
export function skipPrev(): void {
  const track = currentTrack();
  if (!track) return;
  if (track.source !== 'radio' && usePlaybackClock.getState().currentTime > 3) {
    seek(0);
    return;
  }
  state().playPrev();
}

export function seek(seconds: number): void {
  const track = currentTrack();
  if (!track || track.source === 'radio') return;
  const t = Math.max(0, seconds);
  setClock({ currentTime: t });
  if (track.source === 'youtube') youtube?.seek(t);
  else if (audio && loadedTrackId === track.id) audio.currentTime = t;
}

export function registerYouTube(controls: YouTubeControls | null): void {
  youtube = controls;
}

export function onYouTubeEnded(): void {
  advance('ended');
}

// The YouTube embed reports it's actually playing (for "Recently played").
export function onYouTubePlaying(): void {
  recordPlay();
}

// The saved position for a YouTube song restored from the last session —
// handed out once, when its embed is ready to seek.
export function takeResumePosition(trackId: string): number {
  if (!resumeAt || resumeAt.id !== trackId) return 0;
  const t = resumeAt.t;
  resumeAt = null;
  return t;
}
