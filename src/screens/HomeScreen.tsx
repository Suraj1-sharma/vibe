import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  DESI_PRESETS,
  GENRES,
  getTrending,
  getTrendingPlaylists,
  getUnderground,
  searchTracks,
  TrendingTime,
} from '../api/audius';
import { Artwork } from '../components/Artwork';
import { Chip, Empty, Loading, PillButton, SectionHeader } from '../components/Common';
import { TrackRow } from '../components/TrackRow';
import { downloadAll, useDownloadedTracks } from '../services/downloads';
import { useOnline } from '../services/network';
import { playQueue } from '../services/player';
import { colors, font, spacing } from '../theme';
import { Playlist, Track } from '../types';

type Props = {
  onOpenPlaylist: (p: Playlist) => void;
  onMore: (t: Track) => void;
  onGoLibrary: () => void;
  bottomInset: number;
};

export function HomeScreen({ onOpenPlaylist, onMore, onGoLibrary, bottomInset }: Props) {
  const online = useOnline();
  const downloaded = useDownloadedTracks();
  const [genre, setGenre] = useState('All');
  const [desi, setDesi] = useState<string | null>(null);
  const [time, setTime] = useState<TrendingTime>('week');
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [underground, setUnderground] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!online) return;
    setError(null);
    try {
      const showExtras = genre === 'All' && !desi;
      const [t, u, p] = await Promise.all([
        desi ? searchTracks(desi, 50) : getTrending({ genre, time, limit: 50 }),
        showExtras ? getUnderground(20) : Promise.resolve([]),
        showExtras ? getTrendingPlaylists(12) : Promise.resolve([]),
      ]);
      setTracks(t);
      setUnderground(u);
      setPlaylists(p);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
      if (!tracks) setTracks([]);
    }
  }, [genre, time, desi, online]);

  useEffect(() => {
    setTracks(null);
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const desiLabel = desi ? DESI_PRESETS.find((d) => d.query === desi)?.label ?? desi : null;
  const title = desiLabel ? `${desiLabel} on Audius` : `Trending${genre !== 'All' ? ` · ${genre}` : ''}`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!online) {
    return (
      <View style={{ flex: 1 }}>
        <Text style={[font.h1, styles.pad]}>{greeting}</Text>
        {downloaded.length ? (
          <>
            <SectionHeader title="Your downloads" action="See all" onAction={onGoLibrary} />
            <View style={[styles.rowBtns, styles.pad]}>
              <PillButton icon="play" label="Play all" primary onPress={() => void playQueue(downloaded, 0, 'Downloads')} />
            </View>
            <FlatList
              data={downloaded}
              keyExtractor={(t) => t.id}
              renderItem={({ item, index }) => (
                <TrackRow track={item} onPress={() => void playQueue(downloaded, index, 'Downloads')} onMore={onMore} />
              )}
              contentContainerStyle={{ paddingBottom: bottomInset }}
            />
          </>
        ) : (
          <Empty
            icon="cloud-offline-outline"
            title="You're offline"
            body="Songs you download will appear here and play without internet."
          />
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={tracks ?? []}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      ListHeaderComponent={
        <View>
          <View style={[styles.topRow, styles.pad]}>
            <Text style={font.h1}>{greeting}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {GENRES.map((g) => (
              <Chip
                key={g}
                label={g}
                active={g === genre && !desi}
                onPress={() => {
                  setDesi(null);
                  setGenre(g);
                }}
              />
            ))}
          </ScrollView>

          <View style={[styles.pad, styles.desiHead]}>
            <Text style={font.h3}>Indian &amp; Desi</Text>
            <Text style={font.tiny}>Remixes, covers &amp; independent artists</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chips, { paddingVertical: spacing.sm }]}
          >
            {DESI_PRESETS.map((d) => (
              <Chip
                key={d.query}
                label={d.label}
                active={desi === d.query}
                onPress={() => setDesi(desi === d.query ? null : d.query)}
              />
            ))}
          </ScrollView>

          {genre === 'All' && playlists.length > 0 && (
            <>
              <SectionHeader title="Trending playlists" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                {playlists.map((p) => (
                  <Pressable key={p.id} onPress={() => onOpenPlaylist(p)} style={styles.playlistCard}>
                    <Artwork uri={p.artwork} size={140} rounded={6} />
                    <Text numberOfLines={2} style={[font.body, { marginTop: 8 }]}>
                      {p.name}
                    </Text>
                    <Text numberOfLines={1} style={font.small}>
                      {p.trackCount} songs · {p.owner}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {genre === 'All' && underground.length > 0 && (
            <>
              <SectionHeader title="Underground picks" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                {underground.map((t, i) => (
                  <Pressable key={t.id} onPress={() => void playQueue(underground, i, 'Underground picks')} onLongPress={() => onMore(t)} style={styles.trackCard}>
                    <Artwork trackId={t.id} uri={t.artwork} size={120} rounded={6} />
                    <Text numberOfLines={1} style={[font.small, { color: colors.text, marginTop: 6 }]}>
                      {t.title}
                    </Text>
                    <Text numberOfLines={1} style={font.tiny}>
                      {t.artist}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <SectionHeader title={title} />
          <View style={[styles.rowBtns, styles.pad, desi ? { display: 'none' } : null]}>
            {(['week', 'month', 'allTime'] as TrendingTime[]).map((t) => (
              <Chip key={t} label={t === 'week' ? 'This week' : t === 'month' ? 'This month' : 'All time'} active={time === t} onPress={() => setTime(t)} />
            ))}
          </View>
          {tracks && tracks.length > 0 && (
            <View style={[styles.rowBtns, styles.pad, { marginTop: spacing.sm }]}>
              <PillButton icon="play" label="Play all" primary onPress={() => void playQueue(tracks, 0, title)} />
              <PillButton icon="arrow-down-circle-outline" label={`Download all (${tracks.length})`} onPress={() => downloadAll(tracks)} />
            </View>
          )}
          {tracks === null && <Loading />}
          {error && (
            <View style={[styles.pad, { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }]}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={[font.small, { color: colors.warning }]}>{error} — pull to retry</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <TrackRow track={item} onPress={() => void playQueue(tracks ?? [], index, title)} onMore={onMore} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  desiHead: { marginTop: spacing.sm },
  rowBtns: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  playlistCard: { width: 140, marginRight: spacing.md },
  trackCard: { width: 120, marginRight: spacing.md },
});
