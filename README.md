# Vibe — offline-first music player

A Spotify-style music app (React Native + Expo SDK 54) with one killer feature: **tap ⬇ on any song
and it's saved to the phone forever — plays with zero internet.**

Music comes from two places:

1. **Audius** — a free, legal streaming catalog (millions of tracks uploaded by artists, no API key needed).
2. **Your own files** — import MP3/M4A/FLAC/WAV from the Files app, iCloud Drive, WhatsApp
   downloads or a USB transfer. This is how you add music the streaming catalog does not carry.

### About Indian music

Audius carries desi **remixes, covers, fusion and independent artists** — the Home screen has an
**Indian & Desi** row (Bollywood, Punjabi, Hindi, Bhangra, Lo-Fi Hindi, Tamil, Telugu, Indian
Classical, Sitar, Tabla, Bhajan, Ghazal, Qawwali, Indian Remix) that searches for exactly that.

It does **not** have original Bollywood/regional label recordings — no T-Series, Zee, Sony or Saregama
masters, no original Arijit Singh or Lata Mangeshkar album tracks. That catalogue is licensed;
no app can legally stream or let you download it without paying the labels
(JioSaavn Pro, Spotify, YouTube Music and Wynk all do, and all include offline downloads).

To have those songs in Vibe, use **Your Library → Import songs from phone** and add files you
already own. Imported songs are stored on the device and behave exactly like downloads: they play
offline, queue, shuffle and can be liked. They show a phone icon instead of the download arrow.

## Features

- Home: trending tracks (by genre + week/month/all-time), trending playlists, underground picks
- Search: tracks + playlists, debounced; when offline it searches your downloads instead
- Library: **Downloads** (with size on disk, play all / shuffle / remove all) and **Liked Songs**
- **Download button on every song** + **"Download all"** on any list/playlist (2 parallel downloads, progress ring, cancel, retry)
- **Import songs from phone** — add your own audio files; duration is probed automatically and
  "Artist - Title.mp3" filenames are parsed into proper artist/title (site tags and track numbers stripped)
- Player: mini player, full Now Playing screen, seek, shuffle, repeat (off / all / one), queue view, play-next / add-to-queue
- Background playback + lock-screen controls (title/artist/artwork)
- Offline mode: auto-detects no internet, shows banner, Home switches to your downloads, streams fall back to local files
- Cover art is saved alongside the song so everything still looks right offline

> **SDK note:** this project targets **Expo SDK 54** on purpose. Expo Go on the iOS App Store is
> pinned to SDK 54; newer Expo Go builds (SDK 57) only ship via TestFlight, which needs a paid
> Apple Developer account. Do not upgrade the SDK unless you have that account.

## Run it on your iPhone RIGHT NOW (dev preview, free)

1. On the iPhone: install **Expo Go** from the App Store.
2. Phone and laptop on the **same Wi-Fi**. On the laptop, in this folder:

   ```bash
   npx expo start --lan
   ```

   (`--tunnel` works across different networks but depends on ngrok, which can be flaky.)
3. Scan the QR code with the iPhone camera → opens in Expo Go.
4. Play something, tap ⬇ on a song, then turn on Airplane Mode → it still plays.

This only works while the laptop server is running. For a permanent install, see below.

## Install permanently on the iPhone

iOS apps must be compiled on macOS, so both routes below use a cloud Mac.

### Route A — paid ($99/yr Apple Developer Program), proper install

Best experience: real home-screen app, valid 1 year, no weekly refresh, installs over the air.

```bash
eas device:create                      # register your iPhone (one time)
eas build -p ios --profile preview     # cloud build, ~15-25 min
```

EAS prompts for your Apple ID and generates the certificate + provisioning profile for you.
When it finishes, open the build link **in Safari on the iPhone** and tap Install.
If iOS says "Untrusted Developer": Settings → General → VPN & Device Management → trust the profile.

For TestFlight instead: `eas build -p ios --profile production` then `eas submit -p ios`.

### Route B — free, unsigned IPA + sideload (7-day expiry)

Uses the included GitHub Actions workflow to build an **unsigned** `.ipa` on a free macOS runner,
then re-signs it on Windows with your free Apple ID.

1. Push this repo to GitHub.
2. Actions tab → **Build unsigned iOS IPA** → *Run workflow*.
3. Download the `Vibe-unsigned-ipa` artifact when it finishes (~20 min), unzip to get the `.ipa`.
4. On Windows install **iTunes** and **iCloud** (Apple's website versions, *not* Microsoft Store)
   plus **Sideloadly** (sideloadly.io).
5. Plug in the iPhone, drag the `.ipa` into Sideloadly, enter your Apple ID → Start.
6. On the phone: Settings → General → VPN & Device Management → trust your Apple ID.
   Then Settings → Privacy & Security → Developer Mode → On.

Limits of the free route: the app **stops working after 7 days** (re-run Sideloadly to refresh),
max 3 sideloaded apps, and no push notifications. AltStore can auto-refresh it over Wi-Fi.

### Android APK (free, no restrictions)

```bash
eas build -p android --profile preview
```

Open the resulting link on the Android phone and install the APK.

## Project layout

```
App.tsx                      root: tabs, mini player, Now Playing modal, boot hydration
src/api/audius.ts            Audius API client (host discovery, trending, search, playlists, stream URL)
src/services/player.ts       playback engine (expo-audio), queue, shuffle/repeat, lock screen
src/services/downloads.ts    offline downloads (expo-file-system) + AsyncStorage metadata, progress, queue
src/services/localImport.ts  import songs from the device (picker, copy, filename parsing, duration probe)
src/services/likes.ts        liked songs
src/services/network.ts      online/offline detection (NetInfo)
src/services/store.ts        tiny external store (useSyncExternalStore)
src/components/              Artwork, DownloadButton, TrackRow, TrackSheet, MiniPlayer, NowPlaying, Common
src/screens/                 HomeScreen, SearchScreen, LibraryScreen, PlaylistScreen
```

## Dev

```bash
npm install
npx tsc --noEmit        # typecheck
npx expo start --web    # browser preview (downloads are disabled on web — filesystem is native-only)
```
