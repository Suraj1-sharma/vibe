import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore, useStore } from './store';

const KEY = 'vibe.recentSearches.v1';
const MAX = 12;

export const recentStore = createStore<{ items: string[] }>({ items: [] });

export async function hydrateRecentSearches() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) recentStore.set({ items: JSON.parse(raw) });
  } catch {
    /* ignore */
  }
}

function save(items: string[]) {
  AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
}

export function addRecentSearch(q: string) {
  const query = q.trim();
  if (query.length < 2) return;
  const items = [query, ...recentStore.get().items.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, MAX);
  recentStore.set({ items });
  save(items);
}

export function removeRecentSearch(q: string) {
  const items = recentStore.get().items.filter((x) => x !== q);
  recentStore.set({ items });
  save(items);
}

export function clearRecentSearches() {
  recentStore.set({ items: [] });
  save([]);
}

export function useRecentSearches() {
  return useStore(recentStore, (s) => s.items);
}
