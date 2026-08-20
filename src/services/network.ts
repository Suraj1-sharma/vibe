import NetInfo from '@react-native-community/netinfo';
import { createStore, useStore } from './store';

type NetState = { online: boolean; known: boolean };

export const networkStore = createStore<NetState>({ online: true, known: false });

let started = false;
export function startNetworkWatcher() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((state) => {
    // isInternetReachable can be null while probing; treat null as "assume connected"
    const online = !!state.isConnected && state.isInternetReachable !== false;
    networkStore.set({ online, known: true });
  });
}

export function isOnline() {
  return networkStore.get().online;
}

export function useOnline() {
  return useStore(networkStore, (s) => s.online);
}
