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

// Most Tamil/Bollywood/English music uploads come from the *label's* channel,
// not the artist's — "Think Music India", "Zee Music Company", "T-Series".
// cleanArtist() only catches auto-generated "Artist - Topic"/VEVO channels;
// this catches the label channels so callers know to look elsewhere for the
// actual artist instead of just displaying the record label as if it were one.
const LABEL_CHANNEL_RE =
  /\b(music\s*(company|india|south)?|records?|entertainment|studios?|films?|t-?series|saregama|zee|sony|aditya\s*music|lahari|divo|muzik\s*247|sun\s*tv|goldmines|shemaroo|wave\s*music|think\s*music)\b/i;

export function looksLikeLabelChannel(name: string): boolean {
  return LABEL_CHANNEL_RE.test(name);
}

// Music uploads very commonly title themselves "Artist - Song" or
// "Song - Artist". When the channel turns out to be a label rather than the
// artist, this is a better guess at who's actually singing. Deliberately
// conservative: only fires on an unambiguous two-part split, and only picks
// a side when the other side looks like the song part (has a featuring
// credit or a number, e.g. a movie/year) — otherwise it's a coin flip, so it
// returns null and the caller keeps the label name rather than guessing wrong.
export function extractArtistFromTitle(title: string): string | null {
  const parts = title
    .split(/\s+[-–—|]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;

  const looksLikeSongPart = (s: string) => /\b(feat\.?|ft\.?)\b|\d/i.test(s);
  const [a, b] = parts;
  if (looksLikeSongPart(a) && !looksLikeSongPart(b)) return b;
  if (looksLikeSongPart(b) && !looksLikeSongPart(a)) return a;
  return null;
}

// Tamil film-song uploads usually name the movie in the title, in a handful
// of well-worn label formats:
//   'Naa Ready (From "Leo")'                               -> Leo
//   'Hukum - Lyric Video | Jailer | Rajinikanth | Anirudh'  -> Jailer
//   '#Coolie - Chikitu Video | Rajinikanth | Anirudh'       -> Coolie
// Autoplay uses it to keep playing songs from the same album first. Returns
// null whenever it isn't clear — English titles ("Artist - Song") have no
// album in them, and a wrong guess is worse than none.
const GENERIC_SEGMENT =
  /^(tamil|telugu|hindi|malayalam|kannada|english|lyrics?|lyrical|lyric(al)? video|video( song)?|audio( song)?|official( video| audio)?|full (video )?song|4k|hd|\d{4}|new song|latest song|trending)$/i;

function tidyAlbum(s: string): string | null {
  const album = s
    .replace(/#/g, '')
    .replace(/\((tamil|telugu|hindi|malayalam|kannada)\)/gi, '')
    .replace(/\s+(tamil\s+)?(movie|film)(\s+songs?)?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!album || GENERIC_SEGMENT.test(album) || album.split(/\s+/).length > 5) return null;
  return album;
}

export function extractAlbum(rawTitle: string): string | null {
  // Quoted names are taken whole, so 'From "Gunaa (Tamil)"' keeps its own
  // brackets; unquoted ones run to the closing bracket.
  const from =
    rawTitle.match(/[([]\s*from\s+["“'‘]([^"”'’]+)["”'’]/i) ?? rawTitle.match(/[([]\s*from\s+([^)\]]+)[)\]]/i);
  if (from) return tidyAlbum(from[1]);

  const hashtag = rawTitle.match(/^\s*#([\p{L}\p{N}]+)/u);
  if (hashtag) return tidyAlbum(hashtag[1]);

  const parts = rawTitle
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) return tidyAlbum(parts[1]);
  return null;
}

// Trailers, teasers, jukeboxes and the like that label channels upload
// alongside the songs — never something to drop into a music queue.
const NON_SONG_RE =
  /\b(trailer|teaser|glimpse|promo|making( of)?|behind the scenes|bts|interview|press meet|audio launch|launch event|jukebox|non[\s-]?stop|full movie|movie scenes?|comedy|bgm|first look|motion poster|announcement|title (card|reveal)|reaction|shorts?)\b|#shorts/i;

export function looksLikeNonSong(title: string): boolean {
  return NON_SONG_RE.test(title);
}

// A rough identity for "the same song", so the lyric video, the video song
// and the audio of one track aren't all queued one after another. For film
// songs (those with an album) the song name is the part before " - "
// ("Hukum - Thalaivar Alappara Lyric" and "Hukum - Video Song" are one
// song); English titles put the artist there instead, so they keep it all.
export function songKey(title: string, hasAlbum = false): string {
  const head = cleanTitle(title).split(/\s*\|\s*/)[0];
  const songPart = hasAlbum ? head.split(/\s+[-–—]\s+/)[0] : head;
  return songPart
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/\b(lyric(al)?s?|video|audio|song|official|full|4k|hd|from|tamil|telugu|hindi)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Dubbed versions ("Hukum (Telugu)") of a Tamil song shouldn't follow it in
// autoplay unless the song you started was itself that language.
const OTHER_LANGUAGE_RE = /\b(telugu|hindi|malayalam|kannada)\b/i;

export function isOtherLanguageVersion(title: string, seedTitle: string): boolean {
  const lang = title.match(OTHER_LANGUAGE_RE)?.[1]?.toLowerCase();
  return !!lang && !seedTitle.toLowerCase().includes(lang);
}

// ISO 8601 durations as the YouTube API returns them ("PT3M45S") -> seconds.
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
