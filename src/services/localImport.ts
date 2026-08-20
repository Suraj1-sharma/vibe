import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { Alert } from 'react-native';
import { Track } from '../types';
import {
  DOWNLOADS_SUPPORTED,
  ensureMusicDir,
  importDestination,
  registerLocalTrack,
  setTrackDuration,
} from './downloads';

/**
 * Import songs the user already owns (Files app, iCloud Drive, Google Drive, WhatsApp
 * downloads, USB transfer...). Copies each file into the app's music directory and
 * registers it, so it behaves exactly like a downloaded track — offline, queueable, likeable.
 *
 * This is how you get music the streaming catalog does not carry (for example original
 * Bollywood / regional label tracks, which cannot be legally streamed or redistributed).
 */

const AUDIO_TYPES = ['audio/*', 'public.audio', 'application/ogg'];
const KNOWN_EXT = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'mp4', 'caf', 'aiff', 'wma'];

/** "Artist - Title.mp3" → {artist, title}; otherwise the whole filename becomes the title. */
export function parseFilename(name: string): { title: string; artist: string; ext: string } {
  const dot = name.lastIndexOf('.');
  const rawExt = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const ext = KNOWN_EXT.includes(rawExt) ? rawExt : 'mp3';
  let base = dot > 0 ? name.slice(0, dot) : name;

  // strip common junk: leading track numbers, bracketed site tags
  base = base
    .replace(/\[[^\]]*\]|\([^)]*(?:www\.|\.com|\.in)[^)]*\)/gi, ' ')
    .replace(/^\s*\d{1,3}\s*[-._)]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sep = base.match(/^(.{1,60}?)\s+-\s+(.+)$/);
  if (sep) {
    const [, left, right] = sep;
    return { title: right.trim() || base, artist: left.trim() || 'Unknown artist', ext };
  }
  return { title: base || name, artist: 'Unknown artist', ext };
}

function makeId() {
  // no crypto in RN core; timestamp + random is plenty for local file ids
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reads the real duration by briefly loading the file. Imported files carry no metadata,
 * so without this every row would read 0:00.
 */
async function probeDuration(uri: string): Promise<number> {
  return new Promise((resolve) => {
    let done = false;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let sub: { remove: () => void } | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (d: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      try {
        sub?.remove();
        player?.remove();
      } catch {
        /* ignore */
      }
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };

    const timer = setTimeout(() => finish(0), 8000);

    try {
      // The player is never started — creating it is enough to load the file's metadata.
      // Starting it would grab the audio session (configured 'doNotMix') and interrupt
      // whatever the user is currently listening to.
      player = createAudioPlayer({ uri }, { updateInterval: 100 });
      sub = player.addListener('playbackStatusUpdate', (s) => {
        if (s.isLoaded && s.duration > 0) finish(s.duration);
      });
      // Belt and braces: some platforms settle `duration` on the object without ever
      // emitting a status event for an idle player, so poll the property too.
      poll = setInterval(() => {
        const d = player?.duration ?? 0;
        if (d > 0) finish(d);
      }, 150);
    } catch {
      finish(0);
    }
  });
}

export type ImportResult = { added: number; failed: number; cancelled: boolean };

export async function importSongs(): Promise<ImportResult> {
  if (!DOWNLOADS_SUPPORTED) {
    Alert.alert('Not available on web', 'Importing songs works in the iPhone/Android app.');
    return { added: 0, failed: 0, cancelled: true };
  }

  let picked: DocumentPicker.DocumentPickerResult;
  try {
    picked = await DocumentPicker.getDocumentAsync({
      type: AUDIO_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
  } catch (e) {
    console.warn('[import] picker failed', e);
    Alert.alert('Could not open the file picker', String((e as Error)?.message ?? e));
    return { added: 0, failed: 0, cancelled: true };
  }

  if (picked.canceled || !picked.assets?.length) return { added: 0, failed: 0, cancelled: true };

  await ensureMusicDir();

  let added = 0;
  let failed = 0;
  const imported: { id: string; uri: string }[] = [];

  for (const asset of picked.assets) {
    try {
      const { title, artist, ext } = parseFilename(asset.name || 'Unknown');
      const id = makeId();
      const dest = importDestination(id, ext);

      await FS.copyAsync({ from: asset.uri, to: dest });

      const info = await FS.getInfoAsync(dest);
      const size = info.exists ? ((info as { size?: number }).size ?? asset.size ?? 0) : 0;
      if (!info.exists || size < 1024) throw new Error('copied file is empty');

      const track: Track = {
        id,
        title,
        artist,
        artistHandle: '',
        duration: 0,
        artwork: null,
        artworkLarge: null,
        genre: 'My music',
        playCount: 0,
        isLocal: true,
      };
      registerLocalTrack(track, dest, size, ext);
      imported.push({ id, uri: dest });
      added++;
    } catch (e) {
      console.warn('[import] failed for', asset.name, e);
      failed++;
    }
  }

  // Probe durations after the files are visible, so the UI updates as each resolves.
  void (async () => {
    for (const { id, uri } of imported) {
      const d = await probeDuration(uri);
      if (d > 0) setTrackDuration(id, d);
    }
  })();

  return { added, failed, cancelled: false };
}
