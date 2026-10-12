import { Track } from './types';

// Live radio from Radio Browser (radio-browser.info): a free, open,
// community-run directory of internet radio stations — no API key, no
// quota. Stations publish these streams for anyone to listen to, and VYBE
// plays them through the same <audio> element as My Files, so radio is the
// part of the catalogue that keeps playing with the screen locked.

const API_HOSTS = ['https://de1.api.radio-browser.info', 'https://all.api.radio-browser.info'];
// Radio Browser asks every app to identify itself.
const USER_AGENT = 'VYBE/1.0 (personal music app)';

export type RadioCategory = 'tamil' | 'english';

const QUERIES: Record<RadioCategory, Record<string, string>> = {
  tamil: { language: 'tamil' },
  // Plain language=english is mostly talk radio; "hits" keeps it to music.
  english: { language: 'english', tagList: 'hits' },
};

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  country: string;
  hls: number;
  lastcheckok: number;
}

export async function getRadioStations(category: RadioCategory, limit = 40): Promise<Track[]> {
  const params = new URLSearchParams({
    ...QUERIES[category],
    hidebroken: 'true',
    is_https: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: String(limit * 2), // headroom for the filtering below
  });

  let lastError: unknown = null;
  for (const host of API_HOSTS) {
    try {
      // Cached for an hour like the YouTube shelves — station lists barely
      // change, and it keeps VYBE a polite user of a volunteer-run service.
      const res = await fetch(`${host}/json/stations/search?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new Error(`Radio Browser error: ${res.status}`);
      const stations: RadioBrowserStation[] = await res.json();
      return toTracks(stations).slice(0, limit);
    } catch (err) {
      lastError = err; // try the next mirror
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Radio Browser is unavailable');
}

function toTracks(stations: RadioBrowserStation[]): Track[] {
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const s of stations) {
    const url = s.url_resolved?.trim();
    // HTTPS only — browsers block plain-http audio on an https page. HLS
    // playlists are skipped too: not every Android browser/WebView plays
    // them in a plain <audio> element, while MP3/AAC streams play everywhere.
    if (!url?.startsWith('https://') || s.lastcheckok !== 1 || s.hls === 1) continue;
    const name = s.name.trim().replace(/\s+/g, ' ');
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue; // the directory has plenty of duplicates
    seen.add(key);
    tracks.push({
      id: `radio:${s.stationuuid}`,
      title: name,
      artist: s.country ? `Live · ${s.country}` : 'Live radio',
      thumbnail: s.favicon?.startsWith('https://') ? s.favicon : '',
      source: 'radio',
      streamUrl: url,
    });
  }
  return tracks;
}
