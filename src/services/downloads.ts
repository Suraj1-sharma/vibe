import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import { getStreamUrl } from '../api/audius';
import { DownloadEntry, Track } from '../types';
import { createStore, useStore } from './store';

/**
 * Download manager: saves songs (mp3 + artwork) into the app's persistent document
 * directory so they play with no internet. Metadata is persisted in AsyncStorage.
 */

const STORAGE_KEY = 'vibe.downloads.v1';
const MAX_CONCURRENT = 2;

type DownloadsState = {
  entries: Record<string, DownloadEntry>;
  /** stable ordered list of ids (newest first) so selectors can return a stable ref */
  order: string[];
  hydrated: boolean;
  totalBytes: number;
};

export const downloadsStore = createStore<DownloadsState>({
  entries: {},
  order: [],
  hydrated: false,
  totalBytes: 0,
});

/** Offline downloads need a real filesystem (iOS/Android). On web the API is a no-op. */
export const DOWNLOADS_SUPPORTED = Platform.OS !== 'web';

function musicDir() {
  return `${FS.documentDirectory ?? ''}music/`;
}

async function ensureDir() {
  try {
    const info = await FS.getInfoAsync(musicDir());
    if (!info.exists) await FS.makeDirectoryAsync(musicDir(), { intermediates: true });
  } catch (e) {
    console.warn('[downloads] could not create music dir', e);
  }
}

function audioPath(id: string, ext = 'mp3') {
  return `${musicDir()}${id}.${ext}`;
}

/** Extension recorded for an entry, falling back to mp3 for streamed downloads. */
function entryExt(id: string) {
  return downloadsStore.get().entries[id]?.ext ?? 'mp3';
}
function artworkPath(id: string) {
  return `${musicDir()}${id}.jpg`;
}

async function fileInfo(uri: string) {
  try {
    return await FS.getInfoAsync(uri);
  } catch {
    return { exists: false } as FS.FileInfo;
  }
}

async function safeDelete(uri: string) {
  try {
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

function recompute(entries: Record<string, DownloadEntry>) {
  const order = Object.values(entries)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((e) => e.track.id);
  const totalBytes = Object.values(entries).reduce((n, e) => n + (e.status === 'done' ? e.bytes : 0), 0);
  return { order, totalBytes };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    const { entries } = downloadsStore.get();
    // only persist finished downloads; in-flight ones restart on next launch
    const done: Record<string, DownloadEntry> = {};
    for (const e of Object.values(entries)) if (e.status === 'done') done[e.track.id] = e;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch (e) {
      console.warn('[downloads] persist failed', e);
    }
  }, 300);
}

function setEntry(id: string, patch: Partial<DownloadEntry>) {
  downloadsStore.set((s) => {
    const prev = s.entries[id];
    if (!prev) return {};
    const entries = { ...s.entries, [id]: { ...prev, ...patch } };
    return { entries, ...recompute(entries) };
  });
}

/** Load persisted metadata and verify files still exist on disk. */
export async function hydrateDownloads() {
  if (!DOWNLOADS_SUPPORTED) {
    downloadsStore.set({ hydrated: true });
    return;
  }
  await ensureDir();
  let entries: Record<string, DownloadEntry> = {};
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) entries = JSON.parse(raw);
  } catch (e) {
    console.warn('[downloads] hydrate failed', e);
  }
  // verify the files are still there (iOS can change container path between installs → recompute uri)
  const verified: Record<string, DownloadEntry> = {};
  for (const e of Object.values(entries)) {
    const audio = audioPath(e.track.id, e.ext);
    const info = await fileInfo(audio);
    if (info.exists) {
      const art = artworkPath(e.track.id);
      const artInfo = await fileInfo(art);
      verified[e.track.id] = {
        ...e,
        localUri: audio,
        artworkUri: artInfo.exists ? art : null,
        status: 'done',
        progress: 1,
        bytes: (info as any).size ?? e.bytes,
      };
    }
  }
  downloadsStore.set({ entries: verified, ...recompute(verified), hydrated: true });
}

// ---- queue --------------------------------------------------------------

const queue: string[] = [];
let active = 0;
/** in-flight resumables, so a download can be cancelled mid-transfer */
const inFlight = new Map<string, { cancelled: boolean; task?: FS.DownloadResumable }>();

function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const id = queue.shift()!;
    const entry = downloadsStore.get().entries[id];
    if (!entry || entry.status !== 'queued') continue;
    active++;
    runDownload(entry.track).finally(() => {
      active--;
      pump();
    });
  }
}

async function runDownload(track: Track) {
  const id = track.id;
  const handle: { cancelled: boolean; task?: FS.DownloadResumable } = { cancelled: false };
  inFlight.set(id, handle);
  setEntry(id, { status: 'downloading', progress: 0, error: undefined });
  try {
    await ensureDir();
    const url = await getStreamUrl(id);
    const dest = audioPath(id);
    await safeDelete(dest);

    let lastEmit = 0;
    const task = FS.createDownloadResumable(url, dest, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const now = Date.now();
      if (now - lastEmit < 150) return;
      lastEmit = now;
      const p = totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0;
      setEntry(id, { progress: Math.min(0.99, p), bytes: totalBytesWritten });
    });
    handle.task = task;

    const result = await task.downloadAsync();
    if (handle.cancelled) throw new CancelledError();
    if (!result) throw new Error('Download did not complete');

    const info = await fileInfo(dest);
    const size = (info as any).size ?? 0;
    if (!info.exists || size < 1024) throw new Error('Downloaded file is empty');

    // artwork (best effort — lets Library/Now Playing show covers offline)
    let artworkUri: string | null = null;
    const artSrc = track.artworkLarge ?? track.artwork;
    if (artSrc) {
      try {
        const art = artworkPath(id);
        await safeDelete(art);
        await FS.downloadAsync(artSrc, art);
        artworkUri = art;
      } catch {
        artworkUri = null;
      }
    }

    setEntry(id, {
      status: 'done',
      progress: 1,
      localUri: dest,
      artworkUri,
      bytes: size,
      savedAt: Date.now(),
      ext: 'mp3', // runDownload always writes .mp3; keep it explicit so removeDownload agrees
    });
    persist();
  } catch (e: any) {
    if (handle.cancelled || e instanceof CancelledError) {
      await safeDelete(audioPath(id));
      removeEntry(id);
    } else {
      console.warn('[downloads] failed', id, e);
      setEntry(id, { status: 'error', error: String(e?.message ?? e) });
    }
  } finally {
    inFlight.delete(id);
  }
}

class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

function removeEntry(id: string) {
  downloadsStore.set((s) => {
    const entries = { ...s.entries };
    delete entries[id];
    return { entries, ...recompute(entries) };
  });
}

// ---- public API ---------------------------------------------------------

export function download(track: Track) {
  if (!DOWNLOADS_SUPPORTED) {
    Alert.alert('Not available on web', 'Offline downloads work in the iPhone/Android app.');
    return;
  }
  if (track.isLocal) return; // already on the device; there is nothing to fetch
  const cur = downloadsStore.get().entries[track.id];
  if (cur && (cur.status === 'done' || cur.status === 'downloading' || cur.status === 'queued')) return;
  downloadsStore.set((s) => {
    const entries = {
      ...s.entries,
      [track.id]: {
        track,
        status: 'queued' as const,
        progress: 0,
        localUri: null,
        artworkUri: null,
        bytes: 0,
        savedAt: Date.now(),
      },
    };
    return { entries, ...recompute(entries) };
  });
  queue.push(track.id);
  pump();
}

export function downloadAll(tracks: Track[]) {
  tracks.forEach(download);
}

export function cancelDownload(id: string) {
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  const h = inFlight.get(id);
  if (h) {
    h.cancelled = true;
    h.task?.cancelAsync().catch(() => {});
  } else {
    removeEntry(id); // was still queued
  }
}

export function removeDownload(id: string) {
  const h = inFlight.get(id);
  if (h) {
    h.cancelled = true;
    h.task?.cancelAsync().catch(() => {});
  }
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  void safeDelete(audioPath(id, entryExt(id)));
  void safeDelete(artworkPath(id));
  removeEntry(id);
  persist();
}

export function removeAllDownloads() {
  Object.keys(downloadsStore.get().entries).forEach(removeDownload);
}

export function retryDownload(id: string) {
  const e = downloadsStore.get().entries[id];
  if (!e) return;
  removeEntry(id);
  download(e.track);
}

/** Local file URI if the track is fully downloaded, otherwise null. */
export function getLocalUri(id: string): string | null {
  const e = downloadsStore.get().entries[id];
  return e && e.status === 'done' ? e.localUri : null;
}

export function getLocalArtwork(id: string): string | null {
  const e = downloadsStore.get().entries[id];
  return e && e.status === 'done' ? e.artworkUri : null;
}

export function isDownloaded(id: string) {
  return getLocalUri(id) != null;
}

/**
 * Registers a song the user imported from their own device. The file is already inside
 * the music directory; this just records it so it shows up in Library and plays offline
 * exactly like a downloaded track.
 */
export function registerLocalTrack(track: Track, localUri: string, bytes: number, ext: string) {
  downloadsStore.set((s) => {
    const entries: Record<string, DownloadEntry> = {
      ...s.entries,
      [track.id]: {
        track,
        status: 'done',
        progress: 1,
        localUri,
        artworkUri: null,
        bytes,
        savedAt: Date.now(),
        ext,
      },
    };
    return { entries, ...recompute(entries) };
  });
  persist();
}

/** Absolute path a newly imported file should be copied to. */
export function importDestination(id: string, ext: string) {
  return audioPath(id, ext);
}

export async function ensureMusicDir() {
  await ensureDir();
}

/** Updates a track's duration once it has been probed (imported files have no metadata). */
export function setTrackDuration(id: string, duration: number) {
  downloadsStore.set((s) => {
    const prev = s.entries[id];
    if (!prev || prev.track.duration === duration) return {};
    const entries = { ...s.entries, [id]: { ...prev, track: { ...prev.track, duration } } };
    return { entries, ...recompute(entries) };
  });
  persist();
}

// ---- hooks --------------------------------------------------------------

export function useDownloadEntry(id: string): DownloadEntry | undefined {
  return useStore(downloadsStore, (s) => s.entries[id]);
}

export function useDownloadedIds(): string[] {
  return useStore(downloadsStore, (s) => s.order);
}

export function useDownloadsHydrated() {
  return useStore(downloadsStore, (s) => s.hydrated);
}

export function useDownloadsTotalBytes() {
  return useStore(downloadsStore, (s) => s.totalBytes);
}

export function useDownloadedTracks(): Track[] {
  // memoized list of finished tracks (stable ref while entries unchanged)
  return useStore(downloadsStore, selectDoneTracks);
}

let doneCacheKey: Record<string, DownloadEntry> | null = null;
let doneCache: Track[] = [];
function selectDoneTracks(s: DownloadsState): Track[] {
  if (s.entries === doneCacheKey) return doneCache;
  doneCacheKey = s.entries;
  doneCache = s.order.map((id) => s.entries[id]).filter((e) => e.status === 'done').map((e) => e.track);
  return doneCache;
}

export function formatBytes(n: number) {
  if (n <= 0) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
