import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getPlaylistTracks } from '../api/audius';
import { Artwork } from '../components/Artwork';
import { Empty, Loading, PillButton } from '../components/Common';
import { TrackRow } from '../components/TrackRow';
import { downloadAll, downloadsStore } from '../services/downloads';
import { playQueue } from '../services/player';
import { useStore } from '../services/store';
import { colors, font, spacing } from '../theme';
import { Playlist, Track } from '../types';

type Props = { playlist: Playlist; onBack: () => void; onMore: (t: Track) => void; bottomInset: number; topInset: number };

export function PlaylistScreen({ playlist, onBack, onMore, bottomInset, topInset }: Props) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = useStore(downloadsStore, (s) => s.entries);

  useEffect(() => {
    let alive = true;
    getPlaylistTracks(playlist.id)
      .then((t) => alive && setTracks(t))
      .catch((e) => alive && (setError(e?.message ?? 'Failed'), setTracks([])));
    return () => {
      alive = false;
    };
  }, [playlist.id]);

  const doneCount = tracks ? tracks.filter((t) => entries[t.id]?.status === 'done').length : 0;
  const totalDur = tracks ? tracks.reduce((n, t) => n + t.duration, 0) : 0;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={tracks ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        ListHeaderComponent={
          <LinearGradient colors={['#4a4a4a', colors.bg]} style={{ paddingTop: topInset }}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
              <Ionicons name="arrow-back" size={26} color={colors.text} />
            </Pressable>
            <View style={styles.hero}>
              <Artwork uri={playlist.artwork} size={200} rounded={6} />
              <Text style={[font.h1, { marginTop: spacing.lg, textAlign: 'center' }]} numberOfLines={2}>
                {playlist.name}
              </Text>
              {playlist.description ? (
                <Text style={[font.small, { textAlign: 'center', marginTop: 4 }]} numberOfLines={2}>
                  {playlist.description}
                </Text>
              ) : null}
              <Text style={[font.small, { marginTop: 6 }]}>
                {playlist.owner} · {tracks?.length ?? playlist.trackCount} songs · {Math.round(totalDur / 60)} min
                {tracks && doneCount > 0 ? ` · ${doneCount} offline` : ''}
              </Text>
              {tracks && tracks.length > 0 && (
                <View style={styles.rowBtns}>
                  <PillButton icon="play" label="Play" primary onPress={() => void playQueue(tracks, 0, playlist.name)} />
                  <PillButton
                    icon={doneCount === tracks.length ? 'checkmark-circle' : 'arrow-down-circle-outline'}
                    label={doneCount === tracks.length ? 'Downloaded' : `Download all (${tracks.length - doneCount})`}
                    disabled={doneCount === tracks.length}
                    onPress={() => downloadAll(tracks)}
                  />
                </View>
              )}
            </View>
          </LinearGradient>
        }
        ListEmptyComponent={
          tracks === null ? <Loading /> : <Empty icon="musical-notes-outline" title="No playable songs" body={error ?? undefined} />
        }
        renderItem={({ item, index }) => (
          <TrackRow track={item} onPress={() => void playQueue(tracks ?? [], index, playlist.name)} onMore={onMore} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  back: { padding: spacing.lg, alignSelf: 'flex-start' },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  rowBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
