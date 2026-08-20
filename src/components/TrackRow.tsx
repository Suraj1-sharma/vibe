import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDownloadEntry } from '../services/downloads';
import { useOnline } from '../services/network';
import { useCurrentTrackId, useIsPlaying, formatTime } from '../services/player';
import { colors, font, spacing } from '../theme';
import { Track } from '../types';
import { Artwork } from './Artwork';
import { DownloadButton } from './DownloadButton';

type Props = {
  track: Track;
  index?: number;
  onPress: (track: Track) => void;
  onMore?: (track: Track) => void;
  showArtwork?: boolean;
  compact?: boolean;
};

export const TrackRow = memo(function TrackRow({ track, onPress, onMore, showArtwork = true, compact }: Props) {
  const currentId = useCurrentTrackId();
  const playing = useIsPlaying();
  const online = useOnline();
  const entry = useDownloadEntry(track.id);
  const isCurrent = currentId === track.id;
  const downloaded = entry?.status === 'done';
  const unavailable = !online && !downloaded;

  return (
    <Pressable
      onPress={() => onPress(track)}
      onLongPress={() => onMore?.(track)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, compact && styles.compact]}
    >
      {showArtwork && (
        <View style={styles.art}>
          <Artwork trackId={track.id} uri={track.artwork} size={compact ? 44 : 52} />
          {isCurrent && (
            <View style={styles.playingBadge}>
              <Ionicons name={playing ? 'volume-high' : 'pause'} size={14} color={colors.accent} />
            </View>
          )}
        </View>
      )}
      <View style={[styles.meta, unavailable && styles.dim]}>
        <Text numberOfLines={1} style={[font.body, isCurrent && { color: colors.accent }]}>
          {track.title}
        </Text>
        <View style={styles.sub}>
          {downloaded && <Ionicons name="arrow-down-circle" size={13} color={colors.accent} style={{ marginRight: 4 }} />}
          <Text numberOfLines={1} style={[font.small, { flexShrink: 1 }]}>
            {track.artist}
          </Text>
          <Text style={[font.small, { marginLeft: 6 }]}>· {formatTime(track.duration)}</Text>
        </View>
      </View>
      <DownloadButton track={track} />
      {onMore && (
        <Pressable onPress={() => onMore(track)} hitSlop={10} style={styles.more}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  compact: { paddingVertical: 6 },
  pressed: { backgroundColor: colors.bgElevated },
  art: { position: 'relative' },
  playingBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  meta: { flex: 1, minWidth: 0 },
  sub: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dim: { opacity: 0.45 },
  more: { padding: 4 },
});
