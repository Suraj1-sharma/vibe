import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DESI_PRESETS, searchAll, SearchResults } from '../api/audius';
import { ArtistRow } from '../components/ArtistRow';
import { Artwork } from '../components/Artwork';
import { Chip, Empty, Loading, PillButton } from '../components/Common';
import { TrackRow } from '../components/TrackRow';
import { downloadAll, useDownloadedTracks } from '../services/downloads';
import { useOnline } from '../services/network';
import { playQueue } from '../services/player';
import { addRecentSearch, clearRecentSearches, removeRecentSearch, useRecentSearches } from '../services/recentSearches';
import { colors, font, radius, spacing } from '../theme';
import { Artist, Playlist, Track } from '../types';

type Tab = 'all' | 'songs' | 'artists' | 'playlists';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
];

const EMPTY: SearchResults = { tracks: [], artists: [], playlists: [] };

type Props = {
  onOpenPlaylist: (p: Playlist) => void;
  onOpenArtist: (a: Artist) => void;
  onMore: (t: Track) => void;
  bottomInset: number;
};

/**
 * The search box is rendered ONCE at the top level and never inside a conditional
 * branch. Swapping the tree under it would unmount the TextInput, which drops focus
 * and closes the keyboard mid-typing. Only `body` below changes as results load.
 */
export function SearchScreen({ onOpenPlaylist, onOpenArtist, onMore, bottomInset }: Props) {
  const online = useOnline();
  const downloaded = useDownloadedTracks();
  const recents = useRecentSearches();

  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [res, setRes] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const inputRef = useRef<TextInput>(null);

  // debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRes(null);
      setLoading(false);
      setSubmitted('');
      return;
    }
    if (!online) return; // offline: filter downloads locally instead
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await searchAll(q, 30);
        if (id !== reqId.current) return;
        setRes(r);
        setSubmitted(q);
        addRecentSearch(q);
      } catch (e: any) {
        if (id !== reqId.current) return;
        setError(e?.message ?? 'Search failed');
        setRes(EMPTY);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, online]);

  /** Tapping a tile or a recent search is a deliberate jump, so the keyboard goes away. */
  const jumpTo = (q: string) => {
    setQuery(q);
    setTab('all');
    addRecentSearch(q);
    Keyboard.dismiss();
  };

  const offlineMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return downloaded;
    return downloaded.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }, [downloaded, query]);

  const r = res ?? EMPTY;
  const hasResults = !!res && (r.tracks.length > 0 || r.artists.length > 0 || r.playlists.length > 0);
  const playFrom = (list: Track[], i: number) => void playQueue(list, i, `Search: ${submitted || query.trim()}`);

  // shared props: taps land on the row without a first tap being eaten to close the
  // keyboard, and dragging the list never dismisses it
  const listKeyboardProps = {
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: 'none' as const,
  };

  const tabBar = hasResults ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {TABS.map((t) => {
        const n =
          t.key === 'songs'
            ? r.tracks.length
            : t.key === 'artists'
              ? r.artists.length
              : t.key === 'playlists'
                ? r.playlists.length
                : 0;
        if (t.key !== 'all' && n === 0) return null;
        return (
          <Chip
            key={t.key}
            label={t.key === 'all' ? 'All' : `${t.label} (${n})`}
            active={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        );
      })}
    </ScrollView>
  ) : null;

  // ---- body ----------------------------------------------------------------
  let body: React.ReactNode;

  if (!online) {
    body = offlineMatches.length ? (
      <FlatList
        {...listKeyboardProps}
        data={offlineMatches}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        ListHeaderComponent={
          <View style={[styles.rowBtns, styles.pad]}>
            <PillButton icon="play" label="Play all" primary onPress={() => void playQueue(offlineMatches, 0, 'Downloads')} />
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow track={item} onPress={() => void playQueue(offlineMatches, index, 'Downloads')} onMore={onMore} />
        )}
      />
    ) : (
      <Empty icon="cloud-offline-outline" title="You are offline" body="Only your downloaded songs can be searched right now." />
    );
  } else if (!res && !loading) {
    body = (
      <ScrollView {...listKeyboardProps} contentContainerStyle={{ paddingBottom: bottomInset }}>
        {recents.length > 0 && (
          <>
            <View style={[styles.sectionRow, styles.pad, { marginTop: spacing.md }]}>
              <Text style={font.h3}>Recent searches</Text>
              <Pressable onPress={clearRecentSearches} hitSlop={8}>
                <Text style={[font.small, { fontWeight: '700' }]}>Clear</Text>
              </Pressable>
            </View>
            {recents.map((q) => (
              <Pressable
                key={q}
                onPress={() => jumpTo(q)}
                style={({ pressed }) => [styles.recent, pressed && { backgroundColor: colors.bgElevated }]}
              >
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                <Text numberOfLines={1} style={[font.body, { flex: 1 }]}>
                  {q}
                </Text>
                <Pressable onPress={() => removeRecentSearch(q)} hitSlop={10}>
                  <Ionicons name="close" size={18} color={colors.textFaint} />
                </Pressable>
              </Pressable>
            ))}
          </>
        )}
        <Text style={[font.h3, styles.pad, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Browse Indian &amp; Desi</Text>
        <View style={[styles.grid, styles.pad]}>
          {DESI_PRESETS.map((d) => (
            <Pressable key={d.query} onPress={() => jumpTo(d.query)} style={styles.tile}>
              <Text style={[font.body, { fontWeight: '700' }]} numberOfLines={2}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  } else if (loading && !res) {
    body = <Loading />;
  } else if (!hasResults) {
    body = (
      <Empty
        icon="search-outline"
        title={`No results for "${submitted || query.trim()}"`}
        body={
          error ??
          'This catalogue carries independent artists, remixes and covers - original label recordings are not on it. Try a broader word, or add your own files from Your Library.'
        }
      />
    );
  } else if (tab === 'all') {
    const topArtist = r.artists[0];
    body = (
      <FlatList
        {...listKeyboardProps}
        data={r.tracks.slice(0, 8)}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        ListHeaderComponent={
          <View>
            {topArtist && (
              <>
                <Text style={[font.h3, styles.pad, { marginBottom: spacing.sm }]}>Top artist</Text>
                <ArtistRow artist={topArtist} onPress={onOpenArtist} />
              </>
            )}
            {r.tracks.length > 0 && (
              <View style={[styles.sectionRow, styles.pad, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                <Text style={font.h3}>Songs</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <PillButton icon="play" label="Play" primary onPress={() => playFrom(r.tracks, 0)} />
                  <PillButton icon="arrow-down-circle-outline" label={`Save ${r.tracks.length}`} onPress={() => downloadAll(r.tracks)} />
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => <TrackRow track={item} onPress={() => playFrom(r.tracks, index)} onMore={onMore} />}
        ListFooterComponent={
          <View>
            {r.tracks.length > 8 && (
              <Pressable onPress={() => setTab('songs')} style={styles.seeAll}>
                <Text style={[font.small, { fontWeight: '700', color: colors.text }]}>See all {r.tracks.length} songs</Text>
              </Pressable>
            )}
            {r.playlists.length > 0 && (
              <>
                <Text style={[font.h3, styles.pad, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Playlists</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                  {r.playlists.slice(0, 10).map((p) => (
                    <Pressable key={p.id} onPress={() => onOpenPlaylist(p)} style={styles.plCard}>
                      <Artwork uri={p.artwork} size={120} rounded={6} />
                      <Text numberOfLines={2} style={[font.small, { color: colors.text, marginTop: 6 }]}>
                        {p.name}
                      </Text>
                      <Text numberOfLines={1} style={font.tiny}>
                        {p.trackCount} songs
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
            {r.artists.length > 1 && (
              <>
                <Text style={[font.h3, styles.pad, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Artists</Text>
                {r.artists.slice(1, 5).map((a) => (
                  <ArtistRow key={a.id} artist={a} onPress={onOpenArtist} />
                ))}
              </>
            )}
          </View>
        }
      />
    );
  } else if (tab === 'songs') {
    body = (
      <FlatList
        {...listKeyboardProps}
        data={r.tracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        ListHeaderComponent={
          <View style={[styles.rowBtns, styles.pad]}>
            <PillButton icon="play" label="Play all" primary onPress={() => playFrom(r.tracks, 0)} />
            <PillButton
              icon="arrow-down-circle-outline"
              label={`Download all (${r.tracks.length})`}
              onPress={() => downloadAll(r.tracks)}
            />
          </View>
        }
        renderItem={({ item, index }) => <TrackRow track={item} onPress={() => playFrom(r.tracks, index)} onMore={onMore} />}
      />
    );
  } else if (tab === 'artists') {
    body = (
      <FlatList
        {...listKeyboardProps}
        data={r.artists}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        renderItem={({ item }) => <ArtistRow artist={item} onPress={onOpenArtist} />}
      />
    );
  } else {
    body = (
      <FlatList
        {...listKeyboardProps}
        data={r.playlists}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpenPlaylist(item)}
            style={({ pressed }) => [styles.plRow, pressed && { backgroundColor: colors.bgElevated }]}
          >
            <Artwork uri={item.artwork} size={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={font.body}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={font.small}>
                Playlist · {item.trackCount} songs{item.owner ? ` · ${item.owner}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* mounted once - never swapped, so typing is never interrupted */}
      <Text style={[font.h1, styles.pad, { marginTop: spacing.md }]}>Search</Text>
      <View style={[styles.searchBox, { marginHorizontal: spacing.lg }]}>
        <Ionicons name="search" size={20} color="#000" />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={online ? 'Songs, artists or playlists' : 'Search your downloads'}
          placeholderTextColor="#555"
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
          clearButtonMode="never"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {loading && query.trim().length >= 2 ? (
          <Ionicons name="ellipsis-horizontal" size={18} color="#888" />
        ) : query.length > 0 ? (
          <Pressable
            onPress={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={20} color="#555" />
          </Pressable>
        ) : null}
      </View>
      {tabBar}
      <View style={{ flex: 1 }}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg },
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
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  rowBtns: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginVertical: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    justifyContent: 'center',
  },
  plCard: { width: 120, marginRight: spacing.md },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  seeAll: { alignItems: 'center', paddingVertical: spacing.md },
});
