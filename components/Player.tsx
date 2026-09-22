'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Heart,
  Shuffle,
  Repeat,
  Repeat1,
  Music,
} from 'lucide-react';
import { useVybeStore } from '@/lib/store';
import { formatTime } from '@/lib/format';
import { getLocalFile } from '@/lib/localAudioDb';

// Minimal shape of the bits of the YT player instance we actually call.
// Kept narrow on purpose instead of importing react-youtube's own types,
// so this stays correct even if that package's type exports shift.
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export default function Player() {
  const [expanded, setExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localSrc, setLocalSrc] = useState<string | null>(null);

  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTrackId = useRef<string | null>(null);
  const appliedSrcRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const queue = useVybeStore((s) => s.queue);
  const currentIndex = useVybeStore((s) => s.currentIndex);
  const isPlaying = useVybeStore((s) => s.isPlaying);
  const likedTracks = useVybeStore((s) => s.likedTracks);
  const shuffleEnabled = useVybeStore((s) => s.shuffleEnabled);
  const repeatMode = useVybeStore((s) => s.repeatMode);
  const togglePlay = useVybeStore((s) => s.togglePlay);
  const toggleLike = useVybeStore((s) => s.toggleLike);
  const playNext = useVybeStore((s) => s.playNext);
  const playPrev = useVybeStore((s) => s.playPrev);
  const appendToQueue = useVybeStore((s) => s.appendToQueue);
  const toggleShuffle = useVybeStore((s) => s.toggleShuffle);
  const cycleRepeat = useVybeStore((s) => s.cycleRepeat);

  const track = currentIndex >= 0 ? queue[currentIndex] : null;
  const isLocal = track?.source === 'local';
  const isLiked = track ? likedTracks.some((t) => t.id === track.id) : false;

  // Spotify-style autoplay radio: once the queue genuinely runs out (no
  // repeat-all to loop it), fetch more songs by the same artist and keep
  // playing instead of just stopping. Reads everything fresh from the store
  // rather than closing over queue/currentIndex, so it's safe to call from
  // event listeners that were attached once and never re-subscribed.
  const continueRadio = useCallback(async () => {
    const { queue: q, currentIndex: idx } = useVybeStore.getState();
    const current = q[idx];
    if (!current || current.source !== 'youtube') return; // no radio for "My Files"
    try {
      const params = new URLSearchParams({
        id: current.id,
        title: current.title,
        artist: current.artist,
        thumbnail: current.thumbnail,
        exclude: q.map((t) => t.id).join(','),
      });
      const res = await fetch(`/api/related?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const related = (data.results ?? []) as typeof q;
      if (related.length === 0) return;
      appendToQueue(related);
      playNext();
    } catch {
      // Network hiccup — same as before this feature existed, playback just stops.
    }
  }, [appendToQueue, playNext]);

  // Shared "a track just ended" handler for both playback engines: repeat-one
  // replays itself (handled by the caller before this runs), otherwise this
  // advances normally unless the queue is exhausted, in which case it hands
  // off to continueRadio() instead of stopping.
  const handleTrackEnded = useCallback(() => {
    const { queue: q, currentIndex: idx, repeatMode: mode } = useVybeStore.getState();
    if (idx >= q.length - 1 && mode !== 'all') {
      continueRadio();
    } else {
      playNext();
    }
  }, [continueRadio, playNext]);

  // Seeks whichever engine is actually playing right now.
  const seek = (value: number) => {
    setCurrentTime(value);
    if (isLocal) {
      if (audioRef.current) audioRef.current.currentTime = value;
    } else {
      ytPlayerRef.current?.seekTo(value, true);
    }
  };

  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Local file: fetch its bytes from IndexedDB and turn them into a playable
  // URL whenever a local track becomes current. Old object URLs are revoked
  // so we don't leak memory as the user moves through their library.
  useEffect(() => {
    if (!track || track.source !== 'local') {
      setLocalSrc(null);
      return;
    }
    let cancelled = false;
    getLocalFile(track.id).then((blob) => {
      if (cancelled) return;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (blob) {
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setLocalSrc(url);
      } else {
        setLocalSrc(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [track?.id, track?.source]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // YouTube: only handle play/pause here when the track hasn't changed. When
  // it has, the <YouTube videoId> prop below already tells the player to
  // load and auto-play the new video on its own — calling playVideo/
  // pauseVideo again at the same moment used to race with that.
  useEffect(() => {
    if (isLocal) return;
    const player = ytPlayerRef.current;
    if (!player || !track) return;
    if (lastTrackId.current === track.id) {
      isPlaying ? player.playVideo() : player.pauseVideo();
    }
    lastTrackId.current = track.id;
  }, [isPlaying, track?.id, isLocal]);

  // Local file: same idea — only reload the element when the source itself
  // changed; a routine play/pause toggle on the same file just calls
  // play()/pause() directly, so it doesn't reset playback position to 0.
  useEffect(() => {
    if (!isLocal) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (appliedSrcRef.current !== localSrc) {
      appliedSrcRef.current = localSrc;
      audio.load();
      if (isPlaying && localSrc) audio.play().catch(() => {});
      return;
    }

    isPlaying ? audio.play().catch(() => {}) : audio.pause();
  }, [isPlaying, isLocal, localSrc]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [track?.id]);

  // YouTube: poll for position — the IFrame API doesn't push time updates.
  useEffect(() => {
    if (isLocal || !isPlaying) return;
    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime());
      setDuration(player.getDuration());
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, track?.id, isLocal]);

  // Local file: the <audio> element fires real events — attached once, since
  // they read fresh values (refs / store actions) rather than closing over
  // anything that goes stale.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleTrackEnded();
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [handleTrackEnded]);

  // Lock-screen / notification metadata and controls. For local tracks this
  // is also *why* background playback actually works — see the README.
  useEffect(() => {
    if (!track || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: '320x180', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (!isPlaying) togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (isPlaying) togglePlay();
    });
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', handleTrackEnded);
    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) seek(details.seekTime);
      });
    } catch {
      // Some browsers don't support the seekto action — harmless if so.
    }
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, isPlaying, togglePlay, playPrev, handleTrackEnded]);

  if (!track) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {!expanded && (
        <div className="fixed inset-x-0 bottom-14 z-30 bg-dusk border-t border-white/5">
          <div className="h-0.5 bg-white/10">
            <div className="h-full bg-marigold" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
            >
              {track.thumbnail ? (
                <img src={track.thumbnail} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-md bg-dusk-hover shrink-0 flex items-center justify-center">
                  <Music size={16} className="text-haze" />
                </div>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-paper">{track.title}</span>
                <span className="block truncate text-xs text-haze">{track.artist}</span>
              </span>
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="p-2 text-paper shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col p-5 pt-[max(1.25rem,env(safe-area-inset-top))] motion-reduce:transition-none"
          style={{ background: 'linear-gradient(to bottom, #2E1B3A, #1B1023 60%)' }}
        >
          <button
            onClick={() => setExpanded(false)}
            aria-label="Minimize"
            className="self-start p-2 -ml-2 mb-4 text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
          >
            <ChevronDown size={24} />
          </button>

          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-dusk flex items-center justify-center">
              {track.thumbnail ? (
                <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music size={48} className="text-haze" />
              )}
            </div>

            <div className="w-full max-w-xs flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-paper truncate">{track.title}</p>
                <p className="text-sm text-haze truncate">{track.artist}</p>
              </div>
              <button
                onClick={() => toggleLike(track)}
                aria-label={isLiked ? 'Unlike' : 'Like'}
                className="p-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full"
              >
                <Heart size={22} className={isLiked ? 'fill-magenta text-magenta' : 'text-haze'} />
              </button>
            </div>

            <div className="w-full max-w-xs px-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#F5A623' }}
                aria-label="Seek"
              />
              <div className="flex justify-between text-xs text-haze -mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between w-full max-w-xs px-1">
              <button
                onClick={toggleShuffle}
                aria-label="Shuffle"
                aria-pressed={shuffleEnabled}
                className={`p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full ${
                  shuffleEnabled ? 'text-marigold' : 'text-haze'
                }`}
              >
                <Shuffle size={18} />
              </button>

              <div className="flex items-center gap-6 text-paper">
                <button onClick={playPrev} aria-label="Previous" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full">
                  <SkipBack size={26} />
                </button>
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-16 h-16 rounded-full bg-marigold text-ink flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-paper/60"
                >
                  {isPlaying ? <Pause size={28} /> : <Play size={28} />}
                </button>
                <button onClick={handleTrackEnded} aria-label="Next" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full">
                  <SkipForward size={26} />
                </button>
              </div>

              <button
                onClick={cycleRepeat}
                aria-label="Repeat"
                aria-pressed={repeatMode !== 'off'}
                className={`p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded-full ${
                  repeatMode !== 'off' ? 'text-marigold' : 'text-haze'
                }`}
              >
                {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local files play through a real (hidden) <audio> element — this is
          what actually survives the screen locking or the app backgrounding,
          unlike the YouTube embed below. No visibility requirement here
          since it's not a YouTube embed. */}
      <audio ref={audioRef} src={localSrc ?? undefined} className="hidden" preload="metadata" />

      {/* The real YouTube embed — only mounted while a YouTube track is
          playing. Kept small but always visible, top-right — YouTube's terms
          require the player not be hidden. */}
      {!isLocal && (
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-[60] w-24 h-14 rounded-xl overflow-hidden ring-1 ring-white/10">
          <YouTube
            videoId={track.id}
            opts={{
              width: '100%',
              height: '100%',
              playerVars: { controls: 0, rel: 0, playsinline: 1, autoplay: 1 },
            }}
            onReady={(e) => {
              ytPlayerRef.current = e.target;
              if (isPlaying) e.target.playVideo();
            }}
            onStateChange={(e) => {
              // 5 = YT.PlayerState.CUED. Without playerVars.autoplay, switching
              // `videoId` only *cues* the next track instead of playing it —
              // that's the "next song loads then just sits there paused" bug.
              // autoplay:1 fixes the normal case; this is a safety net for
              // whenever a browser's autoplay policy still cues instead.
              if (e.data === 5) {
                if (isPlaying) e.target.playVideo();
                return;
              }
              if (e.data !== 0) return; // 0 = YT.PlayerState.ENDED
              if (repeatModeRef.current === 'one' && ytPlayerRef.current) {
                ytPlayerRef.current.seekTo(0, true);
                ytPlayerRef.current.playVideo();
              } else {
                handleTrackEnded();
              }
            }}
            className="w-full h-full"
          />
        </div>
      )}
    </>
  );
}
