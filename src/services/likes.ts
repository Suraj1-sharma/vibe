import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../types';
import { createStore, useStore } from './store';

const KEY = 'vibe.likes.v1';

type LikesState = { tracks: Track[]; ids: Record<string, true>; hydrated: boolean };

export const likesStore = createStore<LikesState>({ tracks: [], ids: {}, hydrated: false });

export async function hydrateLikes() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const tracks: Track[] = raw ? JSON.parse(raw) : [];
    const ids: Record<string, true> = {};
    tracks.forEach((t) => (ids[t.id] = true));
    likesStore.set({ tracks, ids, hydrated: true });
  } catch {
    likesStore.set({ hydrated: true });
  }
}

function save(tracks: Track[]) {
  AsyncStorage.setItem(KEY, JSON.stringify(tracks)).catch(() => {});
}

export function toggleLike(track: Track) {
  const { tracks, ids } = likesStore.get();
  let next: Track[];
  if (ids[track.id]) next = tracks.filter((t) => t.id !== track.id);
  else next = [track, ...tracks];
  const nextIds: Record<string, true> = {};
  next.forEach((t) => (nextIds[t.id] = true));
  likesStore.set({ tracks: next, ids: nextIds });
  save(next);
}

export function useIsLiked(id: string) {
  return useStore(likesStore, (s) => !!s.ids[id]);
}

export function useLikedTracks() {
  return useStore(likesStore, (s) => s.tracks);
}
