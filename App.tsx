import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from './src/components/Common';
import { MiniPlayer } from './src/components/MiniPlayer';
import { NowPlaying } from './src/components/NowPlaying';
import { TrackSheet } from './src/components/TrackSheet';
import { ArtistScreen } from './src/screens/ArtistScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { PlaylistScreen } from './src/screens/PlaylistScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { hydrateDownloads } from './src/services/downloads';
import { hydrateLikes } from './src/services/likes';
import { hydrateRecentSearches } from './src/services/recentSearches';
import { startNetworkWatcher } from './src/services/network';
import { useCurrentTrack } from './src/services/player';
import { colors, font, MINI_PLAYER_HEIGHT, TAB_BAR_HEIGHT } from './src/theme';
import { Artist, Playlist, Track } from './src/types';

type Tab = 'home' | 'search' | 'library';

const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; iconActive: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'search', label: 'Search', icon: 'search-outline', iconActive: 'search' },
  { key: 'library', label: 'Your Library', icon: 'library-outline', iconActive: 'library' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [nowPlaying, setNowPlaying] = useState(false);
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);
  const [ready, setReady] = useState(false);
  const current = useCurrentTrack();

  useEffect(() => {
    startNetworkWatcher();
    Promise.all([hydrateDownloads(), hydrateLikes(), hydrateRecentSearches()]).finally(() => setReady(true));
  }, []);

  const bottomInset = TAB_BAR_HEIGHT + insets.bottom + (current ? MINI_PLAYER_HEIGHT + 8 : 0) + 8;

  return (
    <View style={styles.root}>
      <View style={{ height: insets.top }} />
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        {!ready ? null : artist ? (
          <ArtistScreen
            artist={artist}
            onBack={() => setArtist(null)}
            onMore={setSheetTrack}
            bottomInset={bottomInset}
            topInset={0}
          />
        ) : playlist ? (
          <PlaylistScreen playlist={playlist} onBack={() => setPlaylist(null)} onMore={setSheetTrack} bottomInset={bottomInset} topInset={0} />
        ) : tab === 'home' ? (
          <HomeScreen onOpenPlaylist={setPlaylist} onMore={setSheetTrack} onGoLibrary={() => setTab('library')} bottomInset={bottomInset} />
        ) : tab === 'search' ? (
          <SearchScreen onOpenPlaylist={setPlaylist} onOpenArtist={setArtist} onMore={setSheetTrack} bottomInset={bottomInset} />
        ) : (
          <LibraryScreen onMore={setSheetTrack} bottomInset={bottomInset} />
        )}
      </View>

      {/* bottom overlay: mini player + tab bar */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        <MiniPlayer onOpen={() => setNowPlaying(true)} />
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key && !playlist && !artist;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  setPlaylist(null);
                  setArtist(null);
                  setTab(t.key);
                }}
                style={styles.tab}
              >
                <Ionicons name={active ? t.iconActive : t.icon} size={24} color={active ? colors.text : colors.textMuted} />
                <Text style={[font.tiny, { color: active ? colors.text : colors.textMuted, marginTop: 2 }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <NowPlaying visible={nowPlaying} onClose={() => setNowPlaying(false)} />
      <TrackSheet track={sheetTrack} onClose={() => setSheetTrack(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,18,18,0.97)',
    paddingTop: 6,
  },
  tabBar: { flexDirection: 'row', height: TAB_BAR_HEIGHT, alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
