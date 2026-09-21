# VYBE

A free, install-on-your-phone music player for Tamil & English songs. No login, no subscription.

## How it actually works

VYBE doesn't host or download any audio — there's no free, legal way to do that with
current commercial tracks. Instead it streams songs through YouTube's own official
embedded player, the same one youtube.com uses, so every song is licensed the way its
label intended. Because of that, YouTube's rules for embeds apply: the player has to
stay visible (a small live video shows top-right whenever something's playing) and
you may occasionally see a YouTube ad, since that's part of how labels get paid for
the upload.

New releases aren't stored anywhere. The Home screen runs a live YouTube search every
time it loads, so it stays current without anyone touching the code.

## About background / lock-screen playback

Short version: **it works now, for songs you add yourself.** Longer version
below, because the two playback paths behave differently and it's worth
understanding why.

VYBE plays songs two different ways:

- **The YouTube-backed catalog** (Home, Search, artist pages) streams through
  a YouTube video embed — that's what makes an unlimited library of current
  Tamil/English songs possible for free. YouTube's own rules for embeds
  require the player to stay visible and don't allow background/audio-only
  use of their content, and mobile browsers enforce that by pausing embedded
  video once the tab backgrounds or the screen locks. No code change here can
  override that — it's a restriction on the platform's side, not a bug, and
  it applies just as much to a native app built on YouTube's own SDKs as it
  does to a website.
- **"My Files"** (in your Library) plays through a real `<audio>` element,
  for files you add yourself — something you own, ripped, purchased, or
  otherwise have the rights to. Because that's genuine audio playback and
  not a YouTube embed, it isn't subject to that restriction at all: it
  keeps playing when the screen locks or the app is backgrounded, with real
  lock-screen controls via the Media Session API (play/pause/skip/seek,
  track title and artist).

The trade-off doesn't go away, it just moves: My Files only plays what you've
actually added as a file, not any Tamil or English song on demand. The
unlimited catalog and background playback were never both available for free
at the same time — that's YouTube's trade, not a limitation of this app
specifically.

## What you'll need (all free)

1. **A YouTube Data API key** — required for search and new releases to work.
   - Go to https://console.cloud.google.com/apis/credentials
   - Create a project → enable "YouTube Data API v3" → create an API key.
   - Free tier is 10,000 units/day (~100 searches). Fine for personal/friend use;
     if you outgrow it, the quota resets daily.
2. **Node.js 18+** installed locally.
3. **A free Vercel account** for deployment.

## Setup

```bash
unzip vybe.zip && cd vybe
npm install
cp .env.example .env.local
# paste your YouTube API key into .env.local
npm run dev
```

Open http://localhost:3000 — on your phone, use your computer's local IP instead of
localhost while both are on the same Wi-Fi. Note that the "Install app" / "Add to
Home Screen" option specifically will **not** appear this way, even once everything
else works — see "Getting the install option to show up" below.

## Deploy for free

```bash
npx vercel
```

Follow the prompts, then add `YOUTUBE_API_KEY` under Vercel → Project → Settings →
Environment Variables, and redeploy. Once it's live, open the URL on your phone and
tap "Add to Home Screen" (iOS Safari, Share icon) or "Install app" (Android Chrome) —
that's what makes it behave like a real app icon instead of a browser tab.

## Getting the install option to show up

Two things both have to be true, and the first is the one that usually trips
people up:

1. **The page has to be served over HTTPS** (or from `localhost` itself).
   Opening `http://<your-computer's-LAN-IP>:3000` on a phone — the usual way
   of testing "on your phone" during local development — does **not** count;
   browsers won't offer to install a plain-HTTP page that isn't localhost.
   The install option only actually shows up once the app is open from its
   deployed `https://...` Vercel URL.
2. **Properly-sized icons.** The manifest previously listed only an SVG icon,
   which some browsers' installability checks are stricter about.
   `public/icon-192.png` and `public/icon-512.png` (plain PNGs) have been
   added, and `app/manifest.ts` / `app/layout.tsx` now point at those — the
   more universally-supported setup.

## Project structure

```
app/
  page.tsx                 Home — trending, artists, new releases, evergreens
  artist/[name]/page.tsx   Songs for one artist (from a Home artist tile)
  search/page.tsx          Search
  library/page.tsx         My Files (background-playable) + playlists + Liked Songs
  playlist/[id]/page.tsx   Playlist detail
  liked/page.tsx           Liked Songs (heart icon on the now-playing screen)
  api/search/route.ts      GET /api/search?q=...
  api/latest/route.ts      GET /api/latest
  manifest.ts              PWA manifest (installability)
components/                 UI pieces (player, nav, cards, shelves, sheets)
lib/
  types.ts                  Track / Playlist types (source: 'youtube' | 'local')
  store.ts                  Zustand store — playlists, liked songs, local-file
                             metadata, shuffle/repeat
  youtube.ts                YouTube Data API wrapper + FEATURED_ARTISTS + PINNED_CHANNELS
  format.ts                 Title/artist cleanup, seek-bar time formatting
  localAudioDb.ts            IndexedDB storage for imported audio file bytes
public/
  sw.js                      Offline app-shell caching
  icon.svg, icon-192.png,    App icons (favicon, manifest, apple-touch-icon)
  icon-512.png
```

## Home screen shelves

Home is now laid out like Spotify's home tab — horizontal shelves instead of a
plain list:

- **Trending now** — YouTube's actual "most popular" music chart for India, so
  it naturally mixes whatever's really trending rather than a guess.
- **Popular artists** — a small starter list in `FEATURED_ARTISTS` (edit
  `lib/youtube.ts` to swap in your own); tapping an artist opens their songs.
- **New movie songs / New releases** — Tamil and English, sorted by upload date.
- **Evergreens / classics** — older, high-view-count uploads (10+ years back).

Home refreshes once an hour (`revalidate = 3600` in `app/page.tsx`) instead of
on every visit. With six queries now running to build all these shelves,
fetching on every single page load would burn through the 10,000-unit daily
quota fast once more than a couple of people are using it — caching for an
hour means that cost is paid at most once an hour, no matter how many friends
open the app in that window. If you still hit quota errors, raise that number
(e.g. `10800` for three hours) or trim a shelf.

## Sample API response

`GET /api/search?q=Anirudh`
```json
{
  "results": [
    { "id": "abc123", "title": "Song Title", "artist": "Channel Name", "thumbnail": "https://..." }
  ]
}
```

## Tightening up "official" results

Search and new-releases are currently filtered to YouTube's Music category and sorted
by relevance or upload date — there's no hardcoded channel list, since verifying exact
channel IDs needs live access to YouTube, which this build didn't have. If you want to
lock results to specific labels you trust (Think Music, Sony Music South, T-Series,
etc.), add their channel IDs to `PINNED_CHANNELS` in `lib/youtube.ts` — open the
channel → "..." menu → "Share channel" → "Copy channel ID" — and filter results by
`channelId` in the two API routes.

## Design direction

Instead of Spotify's black-and-green, VYBE uses a warm dusk/festival palette (deep
aubergine background, marigold + magenta accents) with a serif wordmark over a clean
sans UI — its own identity, built around the same bottom-nav-plus-mini-player pattern
people already know how to use.

## Fixed / added after the second round of testing

- **Messy YouTube titles** — `lib/format.ts` now strips common upload noise
  ("(Official Video)", "HD", "- Topic", "VEVO" suffixes, etc.) from every
  title and channel name before it reaches the UI, applied once in
  `lib/youtube.ts` so every screen gets clean data automatically. It's
  regex-based, so it won't catch every possible upload format, but it
  handles the common ones.
- **No favorite/heart icon** — tap the heart on the now-playing screen to
  save a song. Saved songs live in a "Liked Songs" card at the top of your
  Library (`app/liked/page.tsx`), the same way Spotify's Liked Songs works.
- **Now-playing screen didn't look like Spotify's** — it was missing the
  thing that most makes a now-playing screen feel like one: a progress bar
  with elapsed/remaining time you can drag to seek. Added, along with
  shuffle and repeat (off/all/one) controls — the store already had the
  logic for these from an earlier pass, they just weren't wired to any
  buttons yet.
- **PWA install option not appearing** — see "Getting the install option to
  show up" above; most likely cause is testing over plain HTTP via a LAN IP,
  which the fixed icon setup alone doesn't solve.
- **Background playback** — explained honestly rather than "fixed" at the
  time; see the next section for what actually changed since.

## Added after you asked for background playback

Going native wouldn't have fixed this — YouTube's API terms restrict
background/audio-only use of their content the same way for native apps
built on their own SDKs as for a web embed, so a rewrite would have hit the
identical wall with a lot more overhead (Xcode, an Apple Developer account,
app review, no ability to even build/test an iOS app from this environment).

What actually gets background play: not going through YouTube at all for
those tracks. **Library → My Files** now lets you add audio files from your
own phone (`app/library/page.tsx` handles picking and importing them,
`lib/localAudioDb.ts` stores the bytes in IndexedDB, `components/Player.tsx`
plays them through a real `<audio>` element instead of the YouTube embed).
Add something you own, and it plays in the background and on the lock screen
like any other music app — because at that point it genuinely is just audio
playback, with none of YouTube's restrictions attached. See "About
background / lock-screen playback" above for the full picture, including why
this only covers files you've added rather than the whole catalog.

## Fixed after the first run

- **`/icon` and `/apple-icon` returning 500 on Windows** — those used Next's
  `ImageResponse` (`next/og`) to draw an icon on the fly, which has a
  Windows-specific bug resolving its own bundled font. Replaced with the
  plain `public/icon.svg` referenced directly in `app/layout.tsx`'s metadata
  and `app/manifest.ts` — no dynamic image generation involved anymore.
- **Slow/unreliable track switching** — `components/Player.tsx` had two
  separate pieces of code both trying to start/stop the video on every track
  change (its own effect, and the player library's own reaction to the
  `videoId` prop changing), which could race each other. Now only one is in
  charge per situation. A song still takes a moment to buffer when it first
  starts — that's YouTube fetching the stream, not something a code fix
  removes entirely.

## Good to know

- Playlists, liked songs and local-file metadata live on each phone's own
  storage. With no login there's no account to sync through, so a friend who
  installs VYBE builds their own separate library.
- My Files storage isn't unlimited — it's whatever IndexedDB quota the
  browser grants the site (commonly hundreds of MB to a few GB, varies by
  device). If an import fails, that's almost always why. `saveLocalFile` in
  `lib/localAudioDb.ts` is the place to add a clearer size warning if you
  want one.
- If a track doesn't autoplay the first time on iPhone, tap play once — that's iOS's
  autoplay policy, not a bug.
- Worth testing first after you deploy: switching tracks quickly, and changing tabs
  mid-playback. `components/Player.tsx` is the file to check if playback ever feels off.

## Suggested tests, when you're ready for them

- `store.ts`: adding/removing a track from a playlist doesn't duplicate entries or
  crash on an empty playlist; deleting a playlist mid-playback doesn't break the queue.
- `api/search`: returns 400 with no `q`, 500 with a clear message when
  `YOUTUBE_API_KEY` is missing or invalid.
- Edge case: a track with no thumbnail falls back to a placeholder block instead of a
  broken image.
