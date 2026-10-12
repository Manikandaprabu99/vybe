'use client';

import { createYouTube, YouTubeGet } from './core';

// In-app YouTube access for Search and autoplay. VYBE is a static site (GitHub
// Pages), so these calls go straight from the phone to YouTube with a
// *browser* key — one that's visible in the app's code by design and locked
// down in Google Cloud to this site's address and the YouTube Data API only
// (see README, "YouTube keys"). Answers are kept on the device for as long as
// each call allows (a search for a day), so repeating a search is free.

export type YouTubeErrorKind = 'quota' | 'key' | 'network' | 'other';

export class YouTubeError extends Error {
  constructor(
    public kind: YouTubeErrorKind,
    message: string
  ) {
    super(message);
  }
}

const API_BASE = process.env.NEXT_PUBLIC_YOUTUBE_API_BASE ?? 'https://www.googleapis.com/youtube/v3'; // tests point this at a mock
const KEY = process.env.NEXT_PUBLIC_YOUTUBE_KEY ?? '';
const CACHE_PREFIX = 'vybe-yt:';
const MAX_ENTRIES = 120;

interface CacheEntry {
  t: number;
  data: unknown;
}

function cacheKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  return keys;
}

function readCache(key: string, maxAgeSeconds: number): unknown | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry;
    return Date.now() - entry.t < maxAgeSeconds * 1000 ? entry.data : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, data: unknown) {
  const value = JSON.stringify({ t: Date.now(), data } satisfies CacheEntry);
  try {
    // Keep the cache bounded: drop the oldest answers first.
    const keys = cacheKeys();
    if (keys.length >= MAX_ENTRIES) {
      const byAge = keys
        .map((k) => ({ k, t: (JSON.parse(localStorage.getItem(k) ?? '{"t":0}') as CacheEntry).t }))
        .sort((a, b) => a.t - b.t);
      for (const { k } of byAge.slice(0, keys.length - MAX_ENTRIES + 1)) localStorage.removeItem(k);
    }
    localStorage.setItem(key, value);
  } catch {
    // Storage full — clear our own entries and carry on without caching this one.
    try {
      cacheKeys().forEach((k) => localStorage.removeItem(k));
    } catch {
      // Storage unavailable (private mode) — caching is optional.
    }
  }
}

const browserGet: YouTubeGet = async (endpoint, params, cacheSeconds) => {
  if (!KEY) throw new YouTubeError('key', 'No YouTube browser key configured');
  const query = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))).toString();
  const cacheKey = `${CACHE_PREFIX}${endpoint}?${query}`;
  const cached = readCache(cacheKey, cacheSeconds);
  if (cached !== undefined) return cached;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${endpoint}?${query}&key=${encodeURIComponent(KEY)}`);
  } catch {
    throw new YouTubeError('network', 'Network error');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } } | null;
    const text = [
      body?.error?.message,
      ...(body?.error?.errors ?? []).map((e) => e.reason),
      ...(body?.error?.details ?? []).map((d) => d.reason),
    ].join(' ');
    if (/quota|ratelimit|dailylimit/i.test(text)) throw new YouTubeError('quota', text);
    if (/api[_ ]?key|referr?er|blocked|not valid/i.test(text)) throw new YouTubeError('key', text);
    throw new YouTubeError('other', text || `YouTube error ${res.status}`);
  }
  const data = await res.json();
  writeCache(cacheKey, data);
  return data;
};

export const ytClient = createYouTube(browserGet);

// What to tell the person when a search or autoplay can't reach YouTube.
export function describeYouTubeError(err: unknown): string {
  const kind = err instanceof YouTubeError ? err.kind : 'other';
  switch (kind) {
    case 'quota':
      return "Today's free YouTube searches are used up — they reset around midday India time. Radio and My Files still work.";
    case 'key':
      return "Search isn't set up yet: the YouTube browser key is missing or blocked (see the README).";
    case 'network':
      return "You're offline. My Files still play.";
    default:
      return 'YouTube search failed — please try again.';
  }
}
