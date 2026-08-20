import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  next,
  togglePlay,
  useCurrentTrack,
  useDuration,
  usePlayerError,
  usePlayerFlags,
  usePlayingOffline,
  usePosition,
} from '../services/player';
import { colors, font, MINI_PLAYER_HEIGHT, spacing } from '../theme';
import { Artwork } from './Artwork';
import { DownloadButton } from './DownloadButton';

export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const track = useCurrentTrack();
  const { playing, isBuffering, isLoaded } = usePlayerFlags();
  const position = usePosition();
  const duration = useDuration();
  const error = usePlayerError();
  const offline = usePlayingOffline();
  if (!track) return null;
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <Pressable onPress={onOpen} style={styles.wrap}>
      <View style={styles.inner}>
        <Artwork trackId={track.id} uri={track.artwork} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={font.body}>
            {track.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {offline && <Ionicons name="arrow-down-circle" size={12} color={colors.accent} style={{ marginRight: 4 }} />}
            <Text numberOfLines={1} style={[font.small, error ? { color: colors.danger } : null]}>
              {error ? error : track.artist}
            </Text>
          </View>
        </View>
        <DownloadButton track={track} size={24} />
        <Pressable onPress={() => void togglePlay()} hitSlop={10} style={styles.btn}>
          {isBuffering && !isLoaded ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Ionicons name={playing ? 'pause' : 'play'} size={28} color={colors.text} />
          )}
        </Pressable>
        <Pressable onPress={() => void next()} hitSlop={10} style={styles.btn}>
          <Ionicons name="play-skip-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progress, { width: `${pct * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: MINI_PLAYER_HEIGHT,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  btn: { padding: 4 },
  progressBg: { height: 2, backgroundColor: colors.cardHover },
  progress: { height: 2, backgroundColor: colors.text },
});
