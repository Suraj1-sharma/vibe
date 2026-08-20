import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getArtistTracks } from '../api/audius';
import { formatCount } from '../components/ArtistRow';
import { Artwork } from '../components/Artwork';
import { Empty, Loading, PillButton } from '../components/Common';
import { TrackRow } from '../components/TrackRow';
import { downloadAll, downloadsStore } from '../services/downloads';
import { playQueue } from '../services/player';
import { useStore } from '../services/store';
import { colors, font, spacing } from '../theme';
import { Artist, Track } from '../types';

type Props = {
  artist: Artist;
  onBack: () => void;
  onMore: (t: Track) => void;
  bottomInset: number;
  topInset: number;
};

export function ArtistScreen({ artist, onBack, onMore, bottomInset, topInset }: Props) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = useStore(downloadsStore, (s) => s.entries);

  useEffect(() => {
    let alive = true;
    setTracks(null);
    getArtistTracks(artist.id, 50)
      .then((t) => alive && setTracks(t))
      .catch((e) => {
        if (!alive) return;
        setError(e?.message ?? 'Could not load this artist');
        setTracks([]);
      });
    return () => {
      alive = false;
    };
  }, [artist.id]);

  const doneCount = tracks ? tracks.filter((t) => entries[t.id]?.status === 'done').length : 0;
  const notDownloaded = tracks ? tracks.filter((t) => entries[t.id]?.status !== 'done') : [];

  return (
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
            <Artwork uri={artist.artwork} size={140} rounded={70} />
            <View style={styles.nameRow}>
              <Text style={[font.h1, { textAlign: 'center' }]} numberOfLines={2}>
                {artist.name}
              </Text>
              {artist.isVerified && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
            </View>
            <Text style={[font.small, { marginTop: 4 }]}>
              @{artist.handle}
              {artist.followerCount > 0 ? ` · ${formatCount(artist.followerCount)} followers` : ''}
              {tracks ? ` · ${tracks.length} songs` : ''}
              {doneCount > 0 ? ` · ${doneCount} offline` : ''}
            </Text>
            {artist.bio ? (
              <Text style={[font.small, { textAlign: 'center', marginTop: spacing.sm }]} numberOfLines={3}>
                {artist.bio}
              </Text>
            ) : null}
            {tracks && tracks.length > 0 && (
              <View style={styles.rowBtns}>
                <PillButton icon="play" label="Play" primary onPress={() => void playQueue(tracks, 0, artist.name)} />
                <PillButton
                  icon="shuffle"
                  label="Shuffle"
                  onPress={() => void playQueue(shuffled(tracks), 0, artist.name)}
                />
                <PillButton
                  icon={notDownloaded.length === 0 ? 'checkmark-circle' : 'arrow-down-circle-outline'}
                  label={notDownloaded.length === 0 ? 'Downloaded' : `Download (${notDownloaded.length})`}
                  disabled={notDownloaded.length === 0}
                  onPress={() => downloadAll(notDownloaded)}
                />
              </View>
            )}
          </View>
        </LinearGradient>
      }
      ListEmptyComponent={
        tracks === null ? (
          <Loading />
        ) : (
          <Empty
            icon="musical-notes-outline"
            title="No playable songs"
            body={error ?? 'This artist has no streamable tracks on Audius.'}
          />
        )
      }
      renderItem={({ item, index }) => (
        <TrackRow track={item} onPress={() => void playQueue(tracks ?? [], index, artist.name)} onMore={onMore} />
      )}
    />
  );
}

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const styles = StyleSheet.create({
  back: { padding: spacing.lg, alignSelf: 'flex-start' },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg },
  rowBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
});
