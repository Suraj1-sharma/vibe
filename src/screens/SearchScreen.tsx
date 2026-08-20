import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPlaylists, searchTracks } from '../api/audius';
import { Artwork } from '../components/Artwork';
import { Empty, Loading, PillButton } from '../components/Common';
import { TrackRow } from '../components/TrackRow';
import { downloadAll, useDownloadedTracks } from '../services/downloads';
import { useOnline } from '../services/network';
import { playQueue } from '../services/player';
import { colors, font, radius, spacing } from '../theme';
import { Playlist, Track } from '../types';

type Props = {
  onOpenPlaylist: (p: Playlist) => void;
  onMore: (t: Track) => void;
  bottomInset: number;
};

export function SearchScreen({ onOpenPlaylist, onMore, bottomInset }: Props) {
  const online = useOnline();
  const downloaded = useDownloadedTracks();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setTracks(null);
      setPlaylists([]);
      setLoading(false);
      return;
    }
    if (!online) return; // offline: filter downloads locally (below)
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const [tr, pl] = await Promise.all([searchTracks(q, 40), searchPlaylists(q, 8).catch(() => [])]);
        if (id !== reqId.current) return;
        setTracks(tr);
        setPlaylists(pl);
      } catch (e: any) {
        if (id !== reqId.current) return;
        setError(e?.message ?? 'Search failed');
        setTracks([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, online]);

  const offlineMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return downloaded;
    return downloaded.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }, [downloaded, query]);

  const list = online ? tracks : offlineMatches;
  const queueTitle = online ? `Search: ${query.trim()}` : 'Downloads';

  return (
    <View style={{ flex: 1 }}>
      <Text style={[font.h1, styles.pad, { marginTop: spacing.md }]}>Search</Text>
      <View style={[styles.searchBox, styles.padH]}>
        <Ionicons name="search" size={20} color={colors.bg} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={online ? 'What do you want to listen to?' : 'Search your downloads'}
          placeholderTextColor="#555"
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={Keyboard.dismiss}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color="#555" />
          </Pressable>
        )}
      </View>

      {loading && <Loading />}
      {!loading && list && list.length === 0 && query.trim().length >= 2 && (
        <Empty icon="search-outline" title="No results" body={error ?? `Nothing found for "${query.trim()}"`} />
      )}
      {!loading && !list && online && (
        <Empty icon="musical-notes-outline" title="Find any song" body="Search millions of free tracks by title, artist or mood, then hit ⬇ to keep them offline." />
      )}
      {list && list.length > 0 && (
        <FlatList
          data={list}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: bottomInset }}
          ListHeaderComponent={
            <View>
              {playlists.length > 0 && (
                <FlatList
                  horizontal
                  data={playlists}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
                  renderItem={({ item: p }) => (
                    <Pressable onPress={() => onOpenPlaylist(p)} style={styles.plCard}>
                      <Artwork uri={p.artwork} size={110} rounded={6} />
                      <Text numberOfLines={2} style={[font.small, { color: colors.text, marginTop: 6 }]}>
                        {p.name}
                      </Text>
                      <Text numberOfLines={1} style={font.tiny}>
                        Playlist · {p.trackCount} songs
                      </Text>
                    </Pressable>
                  )}
                />
              )}
              <View style={[styles.rowBtns, styles.pad]}>
                <PillButton icon="play" label="Play all" primary onPress={() => void playQueue(list, 0, queueTitle)} />
                {online && (
                  <PillButton icon="arrow-down-circle-outline" label={`Download all (${list.length})`} onPress={() => downloadAll(list)} />
                )}
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <TrackRow track={item} onPress={() => void playQueue(list, index, queueTitle)} onMore={onMore} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg },
  padH: { marginHorizontal: spacing.lg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  input: { flex: 1, color: '#000', fontSize: 16, fontWeight: '500', paddingVertical: 0 },
  rowBtns: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginVertical: spacing.sm },
  plCard: { width: 110, marginRight: spacing.md },
});
