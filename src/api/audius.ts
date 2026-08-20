import { Playlist, Track } from '../types';

/**
 * Audius public API (https://audiusproject.github.io/api-docs/) — free, no API key.
 * Music on Audius is uploaded by artists for free streaming.
 */
const APP_NAME = 'VibeMusic';
const FALLBACK_HOST = 'https://api.audius.co';

let hostPromise: Promise<string> | null = null;

async function getHost(): Promise<string> {
  if (!hostPromise) {
    hostPromise = (async () => {
      try {
        const res = await fetch('https://api.audius.co', { headers: { Accept: 'application/json' } });
        const json = await res.json();
        const hosts: string[] = json?.data ?? [];
        return hosts.length ? hosts[Math.floor(Math.random() * hosts.length)] : FALLBACK_HOST;
      } catch {
        return FALLBACK_HOST;
      }
    })();
  }
  return hostPromise;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  p.set('app_name', APP_NAME);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, String(v));
  });
  return p.toString();
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const host = await getHost();
  const url = `${host}/v1${path}?${qs(params)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    // host might be unhealthy — reset discovery so next call picks another one
    hostPromise = null;
    throw new Error(`Audius ${res.status} for ${path}`);
  }
  const json = await res.json();
  return json.data as T;
}

// ---- mappers -------------------------------------------------------------

type RawTrack = {
  id: string;
  title: string;
  duration: number;
  genre?: string | null;
  play_count?: number;
  is_streamable?: boolean;
  artwork?: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string } | null;
  user?: { name?: string; handle?: string };
};

type RawPlaylist = {
  id: string;
  playlist_name: string;
  description?: string | null;
  track_count?: number;
  artwork?: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string } | null;
  user?: { name?: string };
};

export function mapTrack(t: RawTrack): Track {
  return {
    id: t.id,
    title: t.title,
    artist: t.user?.name ?? 'Unknown artist',
    artistHandle: t.user?.handle ?? '',
    duration: t.duration ?? 0,
    artwork: t.artwork?.['150x150'] ?? t.artwork?.['480x480'] ?? null,
    artworkLarge: t.artwork?.['1000x1000'] ?? t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? null,
    genre: t.genre ?? null,
    playCount: t.play_count ?? 0,
  };
}

function mapPlaylist(p: RawPlaylist): Playlist {
  return {
    id: p.id,
    name: p.playlist_name,
    owner: p.user?.name ?? '',
    artwork: p.artwork?.['480x480'] ?? p.artwork?.['150x150'] ?? null,
    trackCount: p.track_count ?? 0,
    description: p.description ?? null,
  };
}

const streamable = (t: RawTrack) => t.is_streamable !== false;

// ---- public API ----------------------------------------------------------

export type TrendingTime = 'week' | 'month' | 'allTime';

export const GENRES = [
  'All',
  'Electronic',
  'Hip-Hop/Rap',
  'Lo-Fi',
  'Pop',
  'R&B/Soul',
  'Rock',
  'Alternative',
  'House',
  'Trap',
  'Ambient',
  'Jazz',
  'Latin',
  'Dubstep',
  'Drum & Bass',
  'Techno',
];

/**
 * Indian / desi discovery presets. Audius has no original Bollywood label catalogue
 * (that music is licensed and cannot be streamed here), so these surface the remixes,
 * covers, fusion and independent desi tracks that ARE on the platform. For original
 * label songs, use "Import songs from phone" in Your Library.
 */
export const DESI_PRESETS: { label: string; query: string }[] = [
  { label: 'Bollywood', query: 'bollywood' },
  { label: 'Punjabi', query: 'punjabi' },
  { label: 'Hindi', query: 'hindi' },
  { label: 'Desi', query: 'desi' },
  { label: 'Bhangra', query: 'bhangra' },
  { label: 'Lo-Fi Hindi', query: 'lofi hindi' },
  { label: 'Tamil', query: 'tamil' },
  { label: 'Telugu', query: 'telugu' },
  { label: 'Indian Classical', query: 'indian classical' },
  { label: 'Sitar', query: 'sitar' },
  { label: 'Tabla', query: 'tabla' },
  { label: 'Bhajan', query: 'bhajan' },
  { label: 'Ghazal', query: 'ghazal' },
  { label: 'Qawwali', query: 'qawwali' },
  { label: 'Indian Remix', query: 'indian remix' },
];

export async function getTrending(opts: { genre?: string; time?: TrendingTime; limit?: number } = {}) {
  const raw = await get<RawTrack[]>('/tracks/trending', {
    genre: opts.genre && opts.genre !== 'All' ? opts.genre : undefined,
    time: opts.time ?? 'week',
    limit: opts.limit ?? 50,
  });
  return raw.filter(streamable).map(mapTrack);
}

export async function getUnderground(limit = 30) {
  const raw = await get<RawTrack[]>('/tracks/trending/underground', { limit });
  return raw.filter(streamable).map(mapTrack);
}

export async function searchTracks(query: string, limit = 40) {
  const raw = await get<RawTrack[]>('/tracks/search', { query, limit });
  return raw.filter(streamable).map(mapTrack);
}

export async function getTrendingPlaylists(limit = 20) {
  const raw = await get<RawPlaylist[]>('/playlists/trending', { limit });
  return raw.map(mapPlaylist);
}

export async function searchPlaylists(query: string, limit = 20) {
  const raw = await get<RawPlaylist[]>('/playlists/search', { query, limit });
  return raw.map(mapPlaylist);
}

export async function getPlaylistTracks(playlistId: string) {
  const raw = await get<RawTrack[]>(`/playlists/${playlistId}/tracks`);
  return raw.filter(streamable).map(mapTrack);
}

export async function getTrack(id: string) {
  const raw = await get<RawTrack>(`/tracks/${id}`);
  return mapTrack(raw);
}

/** Direct stream URL. The API 302-redirects to the actual mp3; both the player and downloader follow it. */
export async function getStreamUrl(trackId: string) {
  const host = await getHost();
  return `${host}/v1/tracks/${trackId}/stream?${qs({})}`;
}
