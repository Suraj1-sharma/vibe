# Expo HAS CHANGED

This project targets **Expo SDK 54** — read the exact versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Do NOT upgrade the SDK. Expo Go on the iOS App Store is pinned to SDK 54; newer Expo Go
builds ship only via TestFlight, which needs a paid Apple Developer account. Bumping the
SDK makes the app un-runnable on the user's iPhone.

SDK 54 gotchas that have already bitten this project:
- `expo-file-system` has no `File.createDownloadTask`. Use `createDownloadResumable`
  from `expo-file-system/legacy` for downloads with progress.
- `AudioStatus` has no `error` field — read it defensively.
- The `expo-audio` config plugin has no `enableBackgroundPlayback` option. Background audio
  comes from `ios.infoPlist.UIBackgroundModes: ["audio"]` set manually in app.json.
