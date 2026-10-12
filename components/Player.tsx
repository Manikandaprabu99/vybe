'use client';

import { CSSProperties, TouchEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import {
  Check,
  ChevronDown,
  Heart,
  ListMusic,
  Loader2,
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { SleepTimer, useVybeStore } from '@/lib/store';
import { usePlaybackClock } from '@/lib/playbackClock';
import { formatTime } from '@/lib/format';
import { useToast } from '@/lib/toast';
import {
  initAudioEngine,
  onYouTubeEnded,
  onYouTubePlaying,
  registerYouTube,
  seek,
  skipNext,
  skipPrev,
  takeResumePosition,
} from '@/lib/audioEngine';
import { isNativeApp } from '@/lib/mediaControls';
import { Track } from '@/lib/types';
import BottomSheet from './BottomSheet';
import Artwork from './ui/Artwork';
import { EqBars, LiveBadge } from './ui/bits';

// Minimal shape of the bits of the YT player instance we actually call.
// Kept narrow on purpose instead of using react-youtube's own types: those
// describe youtube-player's promise-based wrapper, but the event target
// react-youtube actually hands over is the IFrame API's own player, whose
// methods are synchronous.
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

// YT.PlayerState values.
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;
const YT_CUED = 5;

const SLEEP_MINUTES = [15, 30, 45, 60];

function sleepLabel(timer: SleepTimer, now: number): string | null {
  if (timer.mode === 'end') return 'End of song';
  if (timer.mode === 'at') return `${Math.max(1, Math.ceil((timer.at - now) / 60000))} min`;
  return null;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function Player() {
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'queue' | 'sleep'>('none');
  // Re-reads the clock for the sleep timer's "23 min" label while it's set.
  const [now, setNow] = useState(() => Date.now());
  // The YouTube embed is only created once a YouTube song is actually played
  // this session. A song restored from last time just shows its details until
  // you press play — creating the embed straight away (it autoplays) would
  // start the music by itself the moment the app opened.
  const [ytArmed, setYtArmed] = useState(false);
  // Seek bar position while it's being dragged; committed on release, so a
  // drag is one seek rather than dozens.
  const [scrub, setScrub] = useState<number | null>(null);
  // Swipe gestures: the mini player sideways (skip), the now-playing screen down (close).
  const [swipeX, setSwipeX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  // Where the YouTube video sits: over the mini player's artwork slot, or
  // the big artwork slot of the now-playing screen.
  const [videoRect, setVideoRect] = useState<Rect | null>(null);
  const miniSlotRef = useRef<HTMLDivElement>(null);
  const artSlotRef = useRef<HTMLDivElement>(null);

  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytErrors = useRef(0);
  const expandedRef = useRef(expanded);
  const sheetRef = useRef(sheet);
  const lastYouTubePlay = useRef<{ playId: number; trackId: string | null }>({ playId: -1, trackId: null });

  const queue = useVybeStore((s) => s.queue);
  const currentIndex = useVybeStore((s) => s.currentIndex);
  const isPlaying = useVybeStore((s) => s.isPlaying);
  const playId = useVybeStore((s) => s.playId);
  const likedTracks = useVybeStore((s) => s.likedTracks);
  const shuffleEnabled = useVybeStore((s) => s.shuffleEnabled);
  const repeatMode = useVybeStore((s) => s.repeatMode);
  const togglePlay = useVybeStore((s) => s.togglePlay);
  const toggleLike = useVybeStore((s) => s.toggleLike);
  const toggleShuffle = useVybeStore((s) => s.toggleShuffle);
  const cycleRepeat = useVybeStore((s) => s.cycleRepeat);
  const jumpTo = useVybeStore((s) => s.jumpTo);
  const removeFromQueue = useVybeStore((s) => s.removeFromQueue);
  const clearQueued = useVybeStore((s) => s.clearQueued);
  const sleepTimer = useVybeStore((s) => s.sleepTimer);
  const setSleepTimer = useVybeStore((s) => s.setSleepTimer);
  const showToast = useToast((s) => s.show);

  const currentTime = usePlaybackClock((s) => s.currentTime);
  const duration = usePlaybackClock((s) => s.duration);
  const buffering = usePlaybackClock((s) => s.buffering);
  const error = usePlaybackClock((s) => s.error);

  const track = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const trackId = track?.id;
  const isYouTube = track?.source === 'youtube';
  const isLive = track?.source === 'radio';
  const isLiked = track ? likedTracks.some((t) => t.id === track.id) : false;
  const showVideo = isYouTube && ytArmed;

  useEffect(() => {
    initAudioEngine();
  }, []);

  useEffect(() => {
    expandedRef.current = expanded;
    sheetRef.current = sheet;
  }, [expanded, sheet]);

  useEffect(() => {
    if (sleepTimer.mode !== 'at') return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, [sleepTimer]);

  useEffect(() => {
    if (isYouTube && isPlaying) setYtArmed(true);
  }, [isYouTube, isPlaying]);

  useEffect(() => {
    setScrub(null);
  }, [trackId]);

  // Keep the YouTube video over whichever artwork slot is on screen. The
  // now-playing screen slides up, so measure again once it has landed; the
  // video glides between the two positions.
  useLayoutEffect(() => {
    if (!showVideo) return;
    const target = () => (expanded ? artSlotRef.current : miniSlotRef.current);
    const measure = () => {
      const el = target();
      if (!el) return;
      const r = el.getBoundingClientRect();
      setVideoRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const settle = setTimeout(measure, 420);
    const el = target();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (el && observer) observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(settle);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [expanded, showVideo, trackId]);

  // react-youtube destroys and rebuilds its player whenever the video
  // changes, so the old reference must not be used once the track moves on —
  // calls on a destroyed player just go nowhere (that's what made the first
  // pause after a song change get ignored). onReady fills it in again.
  useEffect(() => {
    ytPlayerRef.current = null;
    registerYouTube(null);
  }, [trackId]);

  // YouTube play/pause: compare what the store wants with what the player is
  // actually doing, rather than assuming the two are in step.
  useEffect(() => {
    if (!isYouTube) return;
    const player = ytPlayerRef.current;
    if (!player) return; // onReady applies the current state once it exists
    const state = player.getPlayerState();
    const active = state === YT_PLAYING || state === YT_BUFFERING;
    if (isPlaying && !active) player.playVideo();
    if (!isPlaying && active) player.pauseVideo();
  }, [isPlaying, isYouTube]);

  // Restarting the same YouTube song — repeat-all on a one-song queue, or
  // tapping the song that's already loaded. The videoId prop doesn't change,
  // so the embed won't do it by itself.
  useEffect(() => {
    if (!isYouTube || !trackId) return;
    const prev = lastYouTubePlay.current;
    lastYouTubePlay.current = { playId, trackId };
    if (prev.trackId === trackId && prev.playId !== playId && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(0, true);
      ytPlayerRef.current.playVideo();
    }
  }, [playId, isYouTube, trackId]);

  // YouTube: poll for position — the IFrame API doesn't push time updates.
  useEffect(() => {
    if (!isYouTube || !isPlaying) return;
    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      usePlaybackClock.setState({ currentTime: player.getCurrentTime(), duration: player.getDuration() });
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, isYouTube, trackId]);

  // Coming back to the app after YouTube was paused in the background: show
  // what the player is really doing, so one tap resumes it.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const player = ytPlayerRef.current;
      const s = useVybeStore.getState();
      if (!player || s.queue[s.currentIndex]?.source !== 'youtube') return;
      const state = player.getPlayerState();
      s.setPlaying(state === YT_PLAYING || state === YT_BUFFERING);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Android app: the system back button closes an open sheet, then the
  // now-playing screen, then navigates back, and at the top level sends VYBE
  // to the background (like Spotify) instead of closing it — closing would
  // cut the music off.
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;
    import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('backButton', ({ canGoBack }) => {
          if (sheetRef.current !== 'none') setSheet('none');
          else if (expandedRef.current) setExpanded(false);
          else if (canGoBack) window.history.back();
          else void App.minimizeApp();
        })
      )
      .then((h) => {
        if (cancelled) void h.remove();
        else handle = h;
      })
      .catch(() => {
        // Without the plugin the default back behaviour still works.
      });
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  if (!track) return null;

  const hasTimeline = !isLive && duration > 0 && Number.isFinite(duration);
  const shownTime = scrub ?? currentTime;
  const progressPct = hasTimeline ? Math.min(100, (shownTime / duration) * 100) : 0;
  const showSpinner = isPlaying && buffering;
  const subtitle = error ?? track.artist;
  const sleepText = sleepLabel(sleepTimer, now);
  const artKind = isLive ? 'radio' : 'music';
  const sourceLabel = isLive ? 'Live radio' : track.source === 'local' ? 'My Files' : 'YouTube';

  // What plays after the current song: songs you queued first, then the
  // rest of what you started (including autoplay's picks).
  const upcoming = queue.map((t, index) => ({ t, index })).filter(({ index }) => index > currentIndex);
  const queuedUpcoming = upcoming.filter(({ t }) => t.queued);
  const restUpcoming = upcoming.filter(({ t }) => !t.queued).slice(0, 50);

  const chooseSleep = (timer: SleepTimer, message: string) => {
    setNow(Date.now()); // so the label reads "15 min", not a stale "16 min"
    setSleepTimer(timer);
    setSheet('none');
    showToast(message);
  };

  const commitScrub = () => {
    if (scrub === null) return;
    seek(scrub);
    setScrub(null);
  };

  const playIcon = (size: number) =>
    showSpinner ? (
      <Loader2 size={size} className="animate-spin motion-reduce:animate-none" />
    ) : isPlaying ? (
      <Pause size={size} fill="currentColor" />
    ) : (
      <Play size={size} fill="currentColor" className="ml-0.5" />
    );

  // --- gestures ---------------------------------------------------------
  const onMiniTouchStart = (e: TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiped.current = false;
  };
  const onMiniTouchMove = (e: TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      setSwipeX(dx);
    }
  };
  const onMiniTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const dy = start ? e.changedTouches[0].clientY - start.y : 0;
    if (swipeX < -70) skipNext();
    else if (swipeX > 70) skipPrev();
    else if (!swiped.current && dy < -40) {
      swiped.current = true;
      setExpanded(true); // swipe up opens the now-playing screen
    }
    setSwipeX(0);
  };
  const onPanelTouchStart = (e: TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onPanelTouchMove = (e: TouchEvent) => {
    const start = touchStart.current;
    if (start) setDragY(Math.max(0, e.touches[0].clientY - start.y));
  };
  const onPanelTouchEnd = () => {
    touchStart.current = null;
    if (dragY > 130) setExpanded(false);
    setDragY(0);
  };

  const videoStyle: CSSProperties = videoRect
    ? {
        top: videoRect.top,
        left: videoRect.left,
        width: videoRect.width,
        height: videoRect.height,
        borderRadius: expanded ? 28 : 10,
        zIndex: expanded ? 55 : 35,
      }
    : { top: -9999, left: 0, width: 96, height: 54 };

  return (
    <>
      {!expanded && (
        <div
          data-testid="mini-player"
          className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-2 animate-rise-in"
        >
          <div
            onTouchStart={onMiniTouchStart}
            onTouchMove={onMiniTouchMove}
            onTouchEnd={onMiniTouchEnd}
            style={{
              transform: swipeX ? `translateX(${swipeX}px)` : undefined,
              transition: swipeX ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="relative mx-auto max-w-md overflow-hidden rounded-2xl bg-[#2A1D37]/90 shadow-float ring-1 ring-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 p-2 pr-1">
              <button
                onClick={() => {
                  if (!swiped.current) setExpanded(true);
                }}
                aria-label="Open now playing"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <div
                  ref={miniSlotRef}
                  className={`relative shrink-0 overflow-hidden rounded-[10px] bg-black/40 ${isYouTube && ytArmed ? 'h-[46px] w-[82px]' : 'h-[46px] w-[46px]'}`}
                >
                  {!showVideo && <Artwork src={track.thumbnail} seed={track.id} kind={artKind} className="h-full w-full" iconSize={16} />}
                </div>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-paper">{track.title}</span>
                  <span className={`flex items-center gap-1.5 truncate text-xs ${error ? 'text-magenta' : 'text-haze'}`}>
                    {isLive && !error && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-magenta animate-live-pulse" />}
                    <span className="truncate">{subtitle}</span>
                  </span>
                </span>
              </button>
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper transition-colors active:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                {playIcon(22)}
              </button>
              <button
                onClick={skipNext}
                aria-label="Next"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper transition-colors active:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <SkipForward size={21} fill="currentColor" />
              </button>
            </div>
            {!isLive && (
              <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {expanded && (
        <div
          role="dialog"
          aria-label="Now playing"
          className="fixed inset-0 z-50 overflow-hidden bg-ink animate-slide-up"
          style={{
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: touchStart.current ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* The artwork itself, blurred, tints the whole screen. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Artwork src={track.thumbnail} seed={track.id} kind={artKind} className="h-full w-full scale-150 opacity-60 blur-3xl" iconSize={1} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-ink/70 to-ink" />
          </div>

          <div className="relative mx-auto flex h-full max-w-md flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
            <div
              className="flex touch-none items-center justify-between py-2"
              onTouchStart={onPanelTouchStart}
              onTouchMove={onPanelTouchMove}
              onTouchEnd={onPanelTouchEnd}
            >
              <button
                onClick={() => setExpanded(false)}
                aria-label="Minimize"
                className="press flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <ChevronDown size={24} />
              </button>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-haze">Now playing</p>
                <p className="text-xs font-bold text-paper">{sourceLabel}</p>
              </div>
              <span className="h-11 w-11" aria-hidden />
            </div>

            <div
              className="flex min-h-0 flex-1 items-center justify-center py-4"
              onTouchStart={onPanelTouchStart}
              onTouchMove={onPanelTouchMove}
              onTouchEnd={onPanelTouchEnd}
            >
              <div
                ref={artSlotRef}
                className="relative aspect-square w-full max-w-[min(100%,46dvh)] overflow-hidden rounded-[28px] bg-black/40 shadow-art ring-1 ring-white/10"
              >
                {!showVideo && (
                  <Artwork src={track.thumbnail} seed={track.id} kind={artKind} className="h-full w-full" iconSize={72} />
                )}
                {isLive && <LiveBadge className="absolute left-4 top-4 bg-ink/70 backdrop-blur" />}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p data-testid="now-playing-title" className="truncate text-[22px] font-extrabold tracking-tight text-paper">
                  {track.title}
                </p>
                <p className={`truncate text-[15px] ${error ? 'text-magenta' : 'text-haze'}`}>{subtitle}</p>
              </div>
              <button
                onClick={() => toggleLike(track)}
                aria-label={isLiked ? 'Unlike' : 'Like'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <Heart
                  key={isLiked ? 'liked' : 'not-liked'}
                  size={26}
                  className={isLiked ? 'fill-magenta text-magenta animate-pop' : 'text-paper'}
                />
              </button>
            </div>

            <div className="mt-4 min-h-[52px]">
              {isLive ? (
                <div className="flex items-center gap-2 py-3">
                  <LiveBadge />
                  <span className="text-xs text-haze">Keeps playing with your screen locked</span>
                </div>
              ) : (
                <>
                  <input
                    type="range"
                    className="scrubber"
                    min={0}
                    max={duration > 0 && Number.isFinite(duration) ? duration : 0}
                    step="any"
                    value={Math.min(shownTime, duration > 0 && Number.isFinite(duration) ? duration : 0)}
                    style={{ '--pct': `${progressPct}%` } as CSSProperties}
                    onChange={(e) => setScrub(Number(e.target.value))}
                    onPointerUp={commitScrub}
                    onTouchEnd={commitScrub}
                    onKeyUp={commitScrub}
                    onBlur={commitScrub}
                    aria-label="Seek"
                  />
                  <div className="-mt-0.5 flex justify-between text-[11px] font-semibold tabular-nums text-haze">
                    <span>{formatTime(shownTime)}</span>
                    <span>{hasTimeline ? `-${formatTime(Math.max(0, duration - shownTime))}` : formatTime(duration)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={toggleShuffle}
                aria-label="Shuffle"
                aria-pressed={shuffleEnabled}
                disabled={isLive}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full disabled:invisible focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
                  shuffleEnabled ? 'text-marigold' : 'text-paper/70'
                }`}
              >
                <Shuffle size={21} />
                {shuffleEnabled && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-marigold" />}
              </button>
              <button
                onClick={skipPrev}
                aria-label="Previous"
                className="press flex h-14 w-14 items-center justify-center rounded-full text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <SkipBack size={30} fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="press flex h-[76px] w-[76px] items-center justify-center rounded-full bg-accent text-ink shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-paper/70"
              >
                {playIcon(32)}
              </button>
              <button
                onClick={skipNext}
                aria-label="Next"
                className="press flex h-14 w-14 items-center justify-center rounded-full text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <SkipForward size={30} fill="currentColor" />
              </button>
              <button
                onClick={cycleRepeat}
                aria-label="Repeat"
                aria-pressed={repeatMode !== 'off'}
                disabled={isLive}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full disabled:invisible focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
                  repeatMode !== 'off' ? 'text-marigold' : 'text-paper/70'
                }`}
              >
                {repeatMode === 'one' ? <Repeat1 size={21} /> : <Repeat size={21} />}
                {repeatMode !== 'off' && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-marigold" />}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={() => setSheet('sleep')}
                aria-label={sleepText ? `Sleep timer: ${sleepText}` : 'Sleep timer'}
                className={`press flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
                  sleepText ? 'bg-marigold/15 text-marigold' : 'bg-white/[0.08] text-paper/80'
                }`}
              >
                <Moon size={16} />
                {sleepText ?? 'Sleep'}
              </button>
              <p className="min-w-0 truncate text-center text-[11px] text-haze">
                {isYouTube ? 'YouTube songs pause if you leave the app' : 'Keeps playing in the background'}
              </p>
              <button
                onClick={() => setSheet('queue')}
                aria-label="Up next"
                className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-paper/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                <ListMusic size={19} />
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomSheet open={sheet === 'queue'} onClose={() => setSheet('none')} title="Up next">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-haze">Now playing</p>
        <QueueRow track={track} current playing={isPlaying} />

        {queuedUpcoming.length > 0 && (
          <>
            <div className="mb-1 mt-5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-haze">Next in queue</p>
              <button
                onClick={clearQueued}
                className="rounded-full px-2 py-1 text-xs font-bold text-marigold focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
              >
                Clear
              </button>
            </div>
            {queuedUpcoming.map(({ t, index }) => (
              <QueueRow key={`${index}-${t.id}`} track={t} onPlay={() => jumpTo(index)} onRemove={() => removeFromQueue(index)} />
            ))}
          </>
        )}

        {restUpcoming.length > 0 && (
          <>
            <p className="mb-1 mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-haze">Next up</p>
            {restUpcoming.map(({ t, index }) => (
              <QueueRow key={`${index}-${t.id}`} track={t} onPlay={() => jumpTo(index)} onRemove={() => removeFromQueue(index)} />
            ))}
          </>
        )}

        {upcoming.length === 0 && (
          <p className="py-6 text-center text-sm text-haze">
            {isYouTube
              ? 'Nothing queued — autoplay will keep similar songs coming.'
              : 'Nothing queued. Use “…” on any song to add it here.'}
          </p>
        )}
        <div className="h-2" />
      </BottomSheet>

      <BottomSheet open={sheet === 'sleep'} onClose={() => setSheet('none')} title="Sleep timer">
        <div className="flex flex-col pb-1">
          {SLEEP_MINUTES.map((minutes) => (
            <SheetOption
              key={minutes}
              label={`${minutes} minutes`}
              onClick={() => chooseSleep({ mode: 'at', at: Date.now() + minutes * 60000 }, `Music stops in ${minutes} minutes`)}
            />
          ))}
          {/* A live station has no end to wait for. */}
          {!isLive && (
            <SheetOption
              label="End of this song"
              selected={sleepTimer.mode === 'end'}
              onClick={() => chooseSleep({ mode: 'end' }, 'Music stops after this song')}
            />
          )}
          {sleepTimer.mode !== 'off' && (
            <SheetOption label="Turn off timer" danger onClick={() => chooseSleep({ mode: 'off' }, 'Sleep timer off')} />
          )}
        </div>
      </BottomSheet>

      {/* The real YouTube embed — mounted once a YouTube song has been played
          this session, and always visible: it sits over the mini player's
          artwork, or the big artwork when the now-playing screen is open
          (YouTube's terms require the player not be hidden). My Files and
          radio play through lib/audioEngine.ts instead. */}
      {showVideo && (
        <div
          className="fixed overflow-hidden bg-black shadow-float ring-1 ring-white/10 transition-[top,left,width,height,border-radius] duration-300 ease-out"
          style={videoStyle}
        >
          <YouTube
            videoId={track.id}
            opts={{
              width: '100%',
              height: '100%',
              playerVars: { controls: 0, rel: 0, playsinline: 1, autoplay: 1 },
            }}
            onReady={(e) => {
              const player = e.target as unknown as YTPlayer;
              ytPlayerRef.current = player;
              registerYouTube({
                play: () => player.playVideo(),
                pause: () => player.pauseVideo(),
                seek: (t) => player.seekTo(t, true),
              });
              const resume = takeResumePosition(track.id);
              if (resume > 0) player.seekTo(resume, true);
              if (useVybeStore.getState().isPlaying) player.playVideo();
              else player.pauseVideo();
            }}
            onStateChange={(e) => {
              const player = e.target as unknown as YTPlayer;
              const s = useVybeStore.getState();
              switch (e.data) {
                case YT_PLAYING:
                  ytErrors.current = 0;
                  usePlaybackClock.setState({ buffering: false, error: null });
                  if (!s.isPlaying) s.setPlaying(true); // started by tapping the video itself
                  onYouTubePlaying();
                  break;
                case YT_PAUSED:
                  // Includes the browser pausing it when the app goes to the
                  // background — the button should say Play when you return.
                  usePlaybackClock.setState({ buffering: false });
                  if (s.isPlaying) s.setPlaying(false);
                  break;
                case YT_BUFFERING:
                  usePlaybackClock.setState({ buffering: true });
                  break;
                case YT_CUED:
                  // Without autoplay, switching videoId only *cues* the next
                  // song. autoplay:1 fixes the normal case; this is a safety
                  // net for when a browser's autoplay policy still cues.
                  if (s.isPlaying) player.playVideo();
                  break;
                case YT_ENDED:
                  onYouTubeEnded(); // handles repeat-one, next, and autoplay
                  break;
              }
            }}
            onError={() => {
              // 2/5: bad id or player error, 100: removed or private, 101/150:
              // the uploader doesn't allow playback outside YouTube. Move on
              // instead of sitting there silently.
              ytErrors.current += 1;
              usePlaybackClock.setState({ buffering: false, error: "This one can't play inside VYBE — skipping." });
              const failedPlayId = useVybeStore.getState().playId;
              setTimeout(() => {
                const s = useVybeStore.getState();
                if (s.playId !== failedPlayId) return; // they've already moved on
                if (ytErrors.current < 5) skipNext();
                else s.setPlaying(false);
              }, 1500);
            }}
            className="h-full w-full"
            iframeClassName="h-full w-full"
          />
        </div>
      )}
    </>
  );
}

function QueueRow({
  track,
  current = false,
  playing = false,
  onPlay,
  onRemove,
}: {
  track: Track;
  current?: boolean;
  playing?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  const art = (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
      <Artwork src={track.thumbnail} seed={track.id} kind={track.source === 'radio' ? 'radio' : 'music'} className="h-full w-full" iconSize={14} />
      {current && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/55">
          <EqBars playing={playing} />
        </span>
      )}
    </div>
  );
  const text = (
    <span className="min-w-0">
      <span className={`block truncate text-sm font-semibold ${current ? 'text-marigold' : 'text-paper'}`}>{track.title}</span>
      <span className="block truncate text-xs text-haze">{track.artist}</span>
    </span>
  );
  return (
    <div className="-mx-2 flex items-center gap-2 rounded-2xl px-2 py-1.5">
      {onPlay ? (
        <button
          onClick={onPlay}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors active:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
        >
          {art}
          {text}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {art}
          {text}
        </div>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${track.title} from the queue`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-haze transition-colors active:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
        >
          <X size={17} />
        </button>
      )}
    </div>
  );
}

function SheetOption({
  label,
  onClick,
  selected = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl px-2 py-3.5 text-left text-[15px] font-medium transition-colors active:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
        danger ? 'text-magenta' : 'text-paper'
      }`}
    >
      {label}
      {selected && <Check size={18} className="text-marigold" />}
    </button>
  );
}
