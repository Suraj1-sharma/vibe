import { AudioPlayer, AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getStreamUrl } from '../api/audius';
import { RepeatMode, Track } from '../types';
import { getLocalArtwork, getLocalUri } from './downloads';
import { isOnline } from './network';
import { createStore, useStore } from './store';

type PlayerState = {
  queue: Track[];
  /** play order (indices into queue) — identity when shuffle is off */
  order: number[];
  /** position within `order` */
  pos: number;
  current: Track | null;
  queueTitle: string;
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  /** true when the current track is playing from a local file */
  playingOffline: boolean;
};

export const playerStore = createStore<PlayerState>({
  queue: [],
  order: [],
  pos: -1,
  current: null,
  queueTitle: '',
  playing: false,
  isLoaded: false,
  isBuffering: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off',
  error: null,
  playingOffline: false,
});

let player: AudioPlayer | null = null;
let initPromise: Promise<void> | null = null;
let loadToken = 0;
let finishedFor: string | null = null;

async function ensurePlayer(): Promise<AudioPlayer> {
  if (player) return player;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      } catch (e) {
        console.warn('[player] setAudioModeAsync failed', e);
      }
      player = createAudioPlayer(null, { updateInterval: 500 });
      player.addListener('playbackStatusUpdate', onStatus);
    })();
  }
  await initPromise;
  return player!;
}

function onStatus(s: AudioStatus) {
  const st = playerStore.get();
  const patch: Partial<PlayerState> = {
    playing: s.playing,
    isLoaded: s.isLoaded,
    isBuffering: s.isBuffering,
    position: Number.isFinite(s.currentTime) ? s.currentTime : 0,
    duration: Number.isFinite(s.duration) && s.duration > 0 ? s.duration : st.current?.duration ?? 0,
  };
  // `error` exists on newer expo-audio status payloads; read defensively for SDK 54
  const statusError = (s as AudioStatus & { error?: string | null }).error;
  if (statusError) patch.error = statusError;
  playerStore.set(patch);

  if (s.didJustFinish && st.current && finishedFor !== st.current.id) {
    finishedFor = st.current.id;
    handleTrackEnded();
  }
}

function handleTrackEnded() {
  const st = playerStore.get();
  if (st.repeat === 'one' && st.current) {
    void loadAndPlay(st.current);
    return;
  }
  const last = st.pos >= st.order.length - 1;
  if (last && st.repeat === 'off') {
    // stop at end of queue, keep track shown
    player?.pause();
    player?.seekTo(0).catch(() => {});
    playerStore.set({ playing: false, position: 0 });
    return;
  }
  void next(true);
}

function makeOrder(n: number, shuffle: boolean, keepFirst?: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (!shuffle) return idx;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (keepFirst != null) {
    const k = idx.indexOf(keepFirst);
    if (k > 0) {
      idx.splice(k, 1);
      idx.unshift(keepFirst);
    }
  }
  return idx;
}

async function loadAndPlay(track: Track) {
  const token = ++loadToken;
  finishedFor = null;
  playerStore.set({ current: track, error: null, position: 0, duration: track.duration, isLoaded: false, isBuffering: true });

  const local = getLocalUri(track.id);
  if (!local && track.isLocal) {
    // imported file was deleted or the app container moved -- there is nothing to stream
    playerStore.set({
      error: 'This imported song is missing from storage. Import it again to play it.',
      isBuffering: false,
      playing: false,
    });
    return;
  }
  if (!local && !isOnline()) {
    playerStore.set({
      error: 'Not downloaded — connect to the internet or download this song for offline play.',
      isBuffering: false,
      playing: false,
    });
    return;
  }

  const p = await ensurePlayer();
  const uri = local ?? (await getStreamUrl(track.id));
  if (token !== loadToken) return; // superseded

  try {
    p.replace({ uri });
    p.play();
    playerStore.set({ playingOffline: !!local });
    p.setActiveForLockScreen(
      true,
      {
        title: track.title,
        artist: track.artist,
        albumTitle: playerStore.get().queueTitle || 'Vibe',
        artworkUrl: getLocalArtwork(track.id) ?? track.artworkLarge ?? track.artwork ?? undefined,
      },
      { showSeekForward: false, showSeekBackward: false },
    );
  } catch (e: any) {
    playerStore.set({ error: String(e?.message ?? e), isBuffering: false });
  }
}

// ---- public actions -----------------------------------------------------

/** Replace the queue and start playing at `startIndex`. */
export async function playQueue(tracks: Track[], startIndex = 0, title = '') {
  if (!tracks.length) return;
  const st = playerStore.get();
  const order = makeOrder(tracks.length, st.shuffle, startIndex);
  const pos = order.indexOf(startIndex);
  playerStore.set({ queue: tracks, order, pos, queueTitle: title });
  await loadAndPlay(tracks[startIndex]);
}

export async function playTrack(track: Track) {
  return playQueue([track], 0, '');
}

export function playNext(track: Track) {
  const st = playerStore.get();
  if (!st.queue.length) {
    void playTrack(track);
    return;
  }
  const queue = [...st.queue];
  const insertAt = st.order[st.pos] + 1;
  queue.splice(insertAt, 0, track);
  // shift order indices >= insertAt, then place new index right after current pos
  const order = st.order.map((i) => (i >= insertAt ? i + 1 : i));
  order.splice(st.pos + 1, 0, insertAt);
  playerStore.set({ queue, order });
}

export function addToQueue(track: Track) {
  const st = playerStore.get();
  if (!st.queue.length) {
    void playTrack(track);
    return;
  }
  playerStore.set({ queue: [...st.queue, track], order: [...st.order, st.queue.length] });
}

export async function togglePlay() {
  const st = playerStore.get();
  if (!st.current) return;
  const p = await ensurePlayer();
  if (st.error && !st.isLoaded) {
    await loadAndPlay(st.current); // retry
    return;
  }
  if (st.playing) p.pause();
  else p.play();
}

export async function next(auto = false) {
  const st = playerStore.get();
  if (!st.queue.length) return;
  let pos = st.pos + 1;
  if (pos >= st.order.length) {
    if (st.repeat === 'all' || !auto) pos = 0;
    else return;
  }
  playerStore.set({ pos });
  await loadAndPlay(st.queue[st.order[pos]]);
}

export async function previous() {
  const st = playerStore.get();
  if (!st.queue.length) return;
  if (st.position > 3 || st.pos <= 0) {
    // restart current track
    const p = await ensurePlayer();
    await p.seekTo(0).catch(() => {});
    if (!st.playing) p.play();
    return;
  }
  const pos = st.pos - 1;
  playerStore.set({ pos });
  await loadAndPlay(st.queue[st.order[pos]]);
}

export async function seekTo(seconds: number) {
  const p = await ensurePlayer();
  playerStore.set({ position: seconds });
  await p.seekTo(Math.max(0, seconds)).catch(() => {});
}

export function toggleShuffle() {
  const st = playerStore.get();
  const shuffle = !st.shuffle;
  const currentIdx = st.order[st.pos];
  const order = makeOrder(st.queue.length, shuffle, currentIdx);
  playerStore.set({ shuffle, order, pos: currentIdx == null ? -1 : order.indexOf(currentIdx) });
}

export function cycleRepeat() {
  const st = playerStore.get();
  const nextMode: RepeatMode = st.repeat === 'off' ? 'all' : st.repeat === 'all' ? 'one' : 'off';
  playerStore.set({ repeat: nextMode });
}

export function skipToQueuePos(pos: number) {
  const st = playerStore.get();
  if (pos < 0 || pos >= st.order.length) return;
  playerStore.set({ pos });
  void loadAndPlay(st.queue[st.order[pos]]);
}

export function removeFromQueue(pos: number) {
  const st = playerStore.get();
  if (pos === st.pos) return;
  const idx = st.order[pos];
  const queue = st.queue.filter((_, i) => i !== idx);
  const order = st.order.filter((_, i) => i !== pos).map((i) => (i > idx ? i - 1 : i));
  playerStore.set({ queue, order, pos: pos < st.pos ? st.pos - 1 : st.pos });
}

// ---- hooks --------------------------------------------------------------

export const useCurrentTrack = () => useStore(playerStore, (s) => s.current);
export const useIsPlaying = () => useStore(playerStore, (s) => s.playing);
export const usePlayerFlags = () => useStore(playerStore, selectFlags);
export const usePosition = () => useStore(playerStore, (s) => s.position);
export const useDuration = () => useStore(playerStore, (s) => s.duration);
export const usePlayerError = () => useStore(playerStore, (s) => s.error);
export const useShuffle = () => useStore(playerStore, (s) => s.shuffle);
export const useRepeat = () => useStore(playerStore, (s) => s.repeat);
export const useQueue = () => useStore(playerStore, (s) => s.queue);
export const useQueueOrder = () => useStore(playerStore, (s) => s.order);
export const useQueuePos = () => useStore(playerStore, (s) => s.pos);
export const useQueueTitle = () => useStore(playerStore, (s) => s.queueTitle);
export const usePlayingOffline = () => useStore(playerStore, (s) => s.playingOffline);
export const useCurrentTrackId = () => useStore(playerStore, (s) => s.current?.id ?? null);

let flagsCache = { playing: false, isBuffering: false, isLoaded: false };
function selectFlags(s: PlayerState) {
  if (
    flagsCache.playing !== s.playing ||
    flagsCache.isBuffering !== s.isBuffering ||
    flagsCache.isLoaded !== s.isLoaded
  ) {
    flagsCache = { playing: s.playing, isBuffering: s.isBuffering, isLoaded: s.isLoaded };
  }
  return flagsCache;
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
