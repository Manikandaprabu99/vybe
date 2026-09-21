// Cleans up the noisy titles and channel names YouTube uploads typically
// carry, so VYBE shows something closer to "Song — Artist" the way a real
// music app would, instead of "Song (Official Video) HD | ChannelVEVO".
// Regex cleanup can't catch every upload's exact formatting — this handles
// the common, well-known patterns rather than promising perfection.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Multi-word phrases ("official music video") are safe to strip wherever
// they appear — a real song title is very unlikely to contain one by
// coincidence. Short, generic single words ("hd", "audio") are only
// stripped from the end, so a song genuinely titled e.g. "Audio" is left
// alone rather than gutted mid-string.
function buildNoiseRegex(phrase: string, endOnly: boolean): RegExp {
  const p = escapeRegExp(phrase);
  const bare = endOnly ? `\\s+${p}\\s*$` : `\\b${p}\\b`;
  return new RegExp(`\\(\\s*${p}\\s*\\)|\\[\\s*${p}\\s*\\]|${bare}`, 'gi');
}

const NOISE_PHRASES: { phrase: string; endOnly?: boolean }[] = [
  { phrase: 'official music video' },
  { phrase: 'official video' },
  { phrase: 'official audio' },
  { phrase: 'official lyric video' },
  { phrase: 'official lyrics video' },
  { phrase: 'lyric video' },
  { phrase: 'lyrics video' },
  { phrase: 'full video song' },
  { phrase: 'full audio song' },
  { phrase: 'full song' },
  { phrase: 'audio song' },
  { phrase: 'video song' },
  { phrase: 'visualizer', endOnly: true },
  { phrase: 'audio', endOnly: true },
  { phrase: 'hd', endOnly: true },
  { phrase: 'hq', endOnly: true },
  { phrase: '4k', endOnly: true },
];

const NOISE_REGEXES = NOISE_PHRASES.map(({ phrase, endOnly }) =>
  buildNoiseRegex(phrase, !!endOnly)
);

export function cleanTitle(raw: string): string {
  let title = raw;
  for (const re of NOISE_REGEXES) title = title.replace(re, '');

  return title
    .replace(/\(\s*\)|\[\s*\]/g, '') // brackets left empty after stripping
    .replace(/^[\s|\-–—]+/, '') // dangling separator left at the start
    .replace(/[\s|\-–—]+$/, '') // dangling separator left at the end
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanArtist(raw: string): string {
  return raw
    .replace(/\s*-\s*topic\s*$/i, '') // auto-generated "Artist - Topic" channels
    .replace(/vevo\s*$/i, '') // e.g. "TaylorSwiftVEVO" — no space before the suffix
    .replace(/\s*official\s*$/i, '')
    .trim();
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
