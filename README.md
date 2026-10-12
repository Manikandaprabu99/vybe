# VYBE

A free, install-on-your-phone music app for Tamil & English songs. No login, no
subscription — and it runs entirely on GitHub: the website on GitHub Pages, its
data refreshed by GitHub Actions, and the Android app published on GitHub
Releases. No Vercel, no Play Store, no servers to pay for.

## What it does

- **Home** — Recently played, Trending in India, Popular artists, Live Tamil
  radio, New Tamil songs (straight from the big labels' channels), English hits
  (the US chart), Tamil evergreens, English classics. Filter chips: All / Tamil
  / English / Radio.
- **Search** — any song on YouTube. Tapping a result plays it and then keeps
  going with similar songs (same movie first, then the same singer, then the
  same label) — Spotify's "song radio".
- **Up Next** — "…" on any song: Play next / Add to queue / Like / Add to
  playlist / Share. The queue button on the now-playing screen shows what's
  coming; jump, remove, clear. Queued songs stay next even when you start
  something else or shuffle.
- **Sleep timer** — 15/30/45/60 minutes or the end of the song.
- **Library** — Liked Songs, playlists, and **My Files**: songs you add from
  your phone, which play in the background and offline.
- **Radio** — live Tamil and English-hits stations, with the screen locked.
- Lock-screen controls, picks up where you left off, works offline, installs
  like an app (PWA) or as a real Android app (APK).

## About background / lock-screen playback

Short version: **My Files and Radio keep playing with the screen locked or the
app in the background; YouTube songs don't.** That holds in the browser, the
installed web app, and the Android app alike.

| | Background / lock screen | Where it comes from |
|---|---|---|
| **YouTube catalog** (Home, Search, artists) | No — pauses when you leave the app | YouTube's official embedded player |
| **My Files** (Library) | Yes, with lock-screen controls | Audio files you add from your phone |
| **Radio** (Radio tab, Home) | Yes, with lock-screen controls | Live stations from radio-browser.info |

- **The YouTube catalog** streams through YouTube's own embedded player —
  that's what makes an unlimited library of current Tamil/English songs
  possible for free. YouTube's terms don't allow background or audio-only
  playback of embeds (it's a YouTube Premium feature), and phones pause the
  embed once the app backgrounds or the screen locks. Getting around it would
  mean ripping the audio or hiding the player, which breaks YouTube's terms —
  Google can switch off the API key the whole catalog depends on — so VYBE
  doesn't. The video plays visibly inside the mini player, and fills the
  artwork when you open the now-playing screen.
- **My Files and Radio** play through VYBE's own `<audio>` element
  (`lib/audioEngine.ts`), so none of that applies. When a song finishes with
  the screen off, the next one starts within the same event — its file is
  loaded ahead of time — because if the page went quiet waiting on anything,
  the phone would suspend it and the queue would stall. In browsers the
  lock-screen controls come from the Media Session API; in the Android app a
  native plugin provides them and runs a foreground media service, so Android
  doesn't kill playback a few minutes after the screen goes off.

On iPhone, use VYBE from Safari (or Add to Home Screen). iOS has had on-and-off
WebKit bugs with background audio in Home Screen web apps — if playback stops
when you lock the phone, play from a Safari tab instead.

## Put it online (GitHub only)

Everything is automated by `.github/workflows/deploy.yml`. One-time setup:

### 1. Two YouTube keys

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials):
create a project → enable **YouTube Data API v3** → create **two API keys**.

| Key | Used for | Restrict it to |
|---|---|---|
| **Build key** | Home, Radio and artist pages, fetched while the site is built on GitHub | API restrictions: YouTube Data API v3 |
| **Browser key** | Search and autoplay, from people's phones | API restrictions: YouTube Data API v3 · Application restrictions: **Websites** → `https://manikandaprabu99.github.io/*` |

Why two: the site is static, so Search has to call YouTube from the phone with
a key that's visible in the app's code. Locking that one to your site's
address means nobody can use it from anywhere else; the build key never leaves
GitHub's secrets.

### 2. Turn on GitHub Pages

Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 3. Add the secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `YOUTUBE_API_KEY` = the build key
- `YOUTUBE_BROWSER_KEY` = the browser key

### 4. Push

Every push to `main` builds and publishes the site at
**https://manikandaprabu99.github.io/vybe/** (Actions tab → *Deploy site*). It
also rebuilds every 4 hours on its own, so Home's charts and new songs stay
fresh. GitHub pauses scheduled workflows in repos with no commits for 60 days —
any push, or *Enable workflow* in the Actions tab, resumes it.

Open the site on your phone and **Add to Home Screen** (iPhone, Safari Share
menu) or **Install app** (Android Chrome) — or use the APK below.

## Android app (APK on GitHub Releases — no Play Store)

`android/` is a small native app (Capacitor) that opens the GitHub Pages site
full-screen and adds native lock-screen controls plus a foreground media
service for My Files and Radio. Because it loads the live site, every change
you push reaches the app straight away; a new APK is only needed when
something inside `android/` changes.

### The signing key — once, keep it forever

Android only installs an update over an existing app if both are signed with
the same key; lose it and everyone has to uninstall (which wipes their My
Files). A key was generated for you in `~/vybe-signing/` (WSL home folder) —
**back that folder up**. `SECRETS.txt` there lists four repository secrets to
add (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the contents of `vybe-release.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | from `SECRETS.txt` |
| `ANDROID_KEY_ALIAS` | `vybe` |
| `ANDROID_KEY_PASSWORD` | from `SECRETS.txt` |

(Prefer your own key? `keytool -genkeypair -v -keystore vybe-release.keystore -alias vybe -keyalg RSA -keysize 2048 -validity 10000`, then `base64 -w0 vybe-release.keystore`.)

### Release it

```bash
git tag v1.0.0 && git push origin v1.0.0
```

`.github/workflows/android.yml` builds `vybe-v1.0.0.apk` (about 10 minutes)
and attaches it to the repo's **Releases** page. For a test build without a
release: Actions → *Android app* → *Run workflow*, then download the APK from
the run's *Artifacts*. Tagged releases refuse to build without the signing
secrets, so every release can update the previous one.

### Install on a phone

Open the release page on the phone, download the `.apk`, tap it, and allow
"install unknown apps" for your browser when Android asks. Updating is the
same — it installs over the old version and keeps playlists and My Files. If
music stops after a while with the screen off (Xiaomi, Samsung, OnePlus are
aggressive about this): Settings → Apps → VYBE → Battery → **Unrestricted**.

The app opens `https://<you>.github.io/<repo>/` by default; set a repository
variable `VYBE_APP_URL` only if you host the site elsewhere. The app id is
`io.github.manikandaprabu99.vybe` (`capacitor.config.ts`,
`android/app/build.gradle`) — change it before the first release if you want,
never after.

There's no iPhone app: installing outside the App Store needs a Mac and an
Apple developer account. iPhone users add the website to their Home Screen.

## Local development

Needs Node.js 18+.

```bash
git clone https://github.com/Manikandaprabu99/vybe.git && cd vybe
npm install
cp .env.example .env.local   # fill in both keys
npm run dev                  # http://localhost:3000
npm run build                # static site in out/
```

For the browser key to work locally, add `http://localhost:3000/*` to its
website restrictions. To build the APK on your own machine you need JDK 21 and
the Android SDK (Android Studio installs both):
`VYBE_APP_URL=https://manikandaprabu99.github.io/vybe/ npm run android:sync`,
then `cd android && ./gradlew assembleDebug`.

## How far the free YouTube quota goes

The free quota is 10,000 units a day. A **search costs 100 units**; a chart, a
channel's uploads or a batch of video details costs **1**. VYBE avoids
searches wherever a 1-unit call does the job and reuses answers:

| What | Cost | Reused for |
|---|---|---|
| Home's charts + new Tamil songs (each build, every 4 h) | ~10 units | 1 hour (build cache) |
| Home's evergreens + the four artist pages | 600 units | 1 day (build cache) |
| A search someone types | 100 units | 1 day on that phone |
| Autoplay after a song | 0–200 units | 1 day per movie/artist on that phone |

That's roughly 650 units a day for the site itself, leaving room for about 90
fresh searches or autoplays a day across everyone. Search results are cached
per phone (not shared between friends) because there's no server.

## Autoplay (song radio)

When the queue runs out, VYBE keeps playing similar songs instead of stopping.
YouTube's API no longer offers "related videos", so similarity comes from the
song itself (`getRelatedTracks` in `lib/youtube/core.ts`): other songs from the
same movie (Tamil film-song titles name it — `| Jailer |`, `(From "Leo")`),
then the same singer, then the newest songs from the same label. Other uploads
of the same song (lyric video vs video song), dubbed versions and trailers are
skipped. The next songs are fetched as soon as the last song starts, so they're
already in Up Next. Like all YouTube songs, this plays while the app is open.

## Project structure

```
app/
  page.tsx                 Home (built ahead of time with YouTube + radio data)
  search/page.tsx          Search (runs in the browser)
  radio/page.tsx           Live radio (station lists built ahead of time)
  library/page.tsx         Liked Songs, playlists, My Files
  liked/page.tsx           Liked Songs
  playlist/page.tsx        A playlist (/playlist/?id=…)
  artist/[slug]/page.tsx   Featured artists (built ahead of time)
  layout.tsx               Fonts, metadata, player, nav
components/
  Player.tsx               Mini player, now-playing screen, queue + sleep sheets, YouTube embed
  HomeFeed.tsx             Home's shelves and filter chips
  TrackRow.tsx             A song in a list, with its "…" sheet
  CollectionHeader.tsx     The top of Liked / playlist / artist pages
  ui/Artwork.tsx           Images with generated-gradient fallbacks
  ui/bits.tsx              Chips, equalizer bars, LIVE badge, empty states
  ...                      Cards, nav, sheets, toasts
lib/
  audioEngine.ts           Background-capable playback for My Files and radio
  store.ts                 Zustand store — library, queue, shuffle/repeat, recently played, sleep timer
  youtube/core.ts          All YouTube logic (shelves, autoplay picks, label channels)
  youtube/server.ts        …fetched at build time with the build key
  youtube/client.ts        …fetched from the phone with the browser key (cached)
  mediaControls.ts         Lock-screen controls: Media Session (web) or native plugin (app)
  radio.ts                 Station lists from radio-browser.info
  paths.ts                 The GitHub Pages sub-path (/vybe)
public/
  sw.js                    Offline support (network-first pages, cached build files)
  manifest.webmanifest     Install metadata (relative URLs, works under /vybe/)
android/                   The Android app (Capacitor)
.github/workflows/         deploy.yml (GitHub Pages) · android.yml (APK → Releases)
```

## Changing the label channels and artists

`TAMIL_LABEL_CHANNELS` and `FEATURED_ARTISTS` in `lib/youtube/core.ts`.
Labels: Sony Music South, Think Music India, Saregama Tamil, T-Series Tamil,
U1 Records, Tips Tamil (each id checked against the channel's own page). To
find a channel's id: open the channel → "..." → "Share channel" → "Copy channel
ID". Each label costs 1 unit per build; each artist one search a day.

## Design

A deep aubergine night with warm festival light — marigold into magenta —
rather than Spotify's black-and-green: frosted glass bars, a floating mini
player, artwork-tinted now-playing screen, generated gradient covers for
anything without artwork, Plus Jakarta Sans throughout. Swipe the mini player
sideways to skip or up to open; swipe the now-playing screen and sheets down
to close. Respects "reduce motion".

## Changelog

**October 2026 — GitHub-only, modern redesign.** Moved off Vercel to a static
site on GitHub Pages, data refreshed by GitHub Actions; Search and autoplay
now run in the browser. New design across every screen (chips, recently-played
grid, browse tiles, floating mini player with the live YouTube video in it,
artwork-tinted now-playing, swipe gestures, sheets with drag handles, skeleton
loading, empty states). Fixed: station logos that failed before the page
loaded showed broken-image icons; the install manifest and icons now work
under the /vybe/ sub-path.

**October 2026 — the Spotify basics.** Up Next queue, smarter autoplay,
Recently played, sleep timer, much lighter use of the YouTube quota (and a fix
for the evergreen shelves defeating their own cache).

**October 2026 — background playback that holds up.** Playback for My Files
moved into `lib/audioEngine.ts` (next song started inside the "ended" event,
so queues keep going with the screen locked); the play button follows pauses
from calls/headphones/the lock screen; switching from a file to a YouTube song
stops the file; unplayable YouTube videos are skipped; sessions survive the
app being closed; live radio; the Android app; the build fixed.

**September 2026.** Title clean-up, Liked Songs, now-playing seek bar,
shuffle/repeat, PWA install fixes, My Files, faster track switching.

## Good to know

- Playlists, liked songs and My Files live on each phone. With no login there's
  no account to sync through, so each friend builds their own library.
- My Files storage is whatever the browser/app grants (commonly hundreds of MB
  to a few GB); Library shows how much is used.
- If a track doesn't start the first time on iPhone, tap play once — that's
  iOS's autoplay policy.
