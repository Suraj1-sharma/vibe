export type Track = {
  id: string;
  title: string;
  artist: string;
  artistHandle: string;
  /** seconds */
  duration: number;
  artwork: string | null;
  artworkLarge: string | null;
  genre: string | null;
  playCount: number;
  /** true for songs the user imported from their own device — never streamed from the network */
  isLocal?: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  owner: string;
  artwork: string | null;
  trackCount: number;
  description: string | null;
};

export type Artist = {
  id: string;
  name: string;
  handle: string;
  artwork: string | null;
  trackCount: number;
  followerCount: number;
  isVerified: boolean;
  bio: string | null;
};

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'done' | 'error';

export type DownloadEntry = {
  track: Track;
  status: DownloadStatus;
  /** 0..1 */
  progress: number;
  localUri: string | null;
  artworkUri: string | null;
  bytes: number;
  savedAt: number;
  error?: string;
  /** file extension on disk, without the dot. Defaults to 'mp3' for streamed downloads. */
  ext?: string;
};

export type RepeatMode = 'off' | 'all' | 'one';
