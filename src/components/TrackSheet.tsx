import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelDownload, download, removeDownload, useDownloadEntry, formatBytes } from '../services/downloads';
import { toggleLike, useIsLiked } from '../services/likes';
import { addToQueue, playNext, playTrack } from '../services/player';
import { colors, font, radius, spacing } from '../theme';
import { Track } from '../types';
import { Artwork } from './Artwork';

type Props = { track: Track | null; onClose: () => void };

/** Bottom sheet with actions for a track (long-press or "…"). */
export function TrackSheet({ track, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const liked = useIsLiked(track?.id ?? '');
  const entry = useDownloadEntry(track?.id ?? '');
  if (!track) return null;
  const status = entry?.status ?? 'idle';

  const Item = ({
    icon,
    label,
    sub,
    color,
    onPress,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    sub?: string;
    color?: string;
    onPress: () => void;
  }) => (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.card }]}
      onPress={() => {
        onPress();
        onClose();
      }}
    >
      <Ionicons name={icon} size={22} color={color ?? colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[font.body, color ? { color } : null]}>{label}</Text>
        {sub ? <Text style={font.small}>{sub}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Artwork trackId={track.id} uri={track.artwork} size={56} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={font.h3}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={font.small}>
              {track.artist}
              {track.genre ? ` · ${track.genre}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />

        <Item icon="play-circle-outline" label="Play now" onPress={() => void playTrack(track)} />
        <Item icon="play-skip-forward-outline" label="Play next" onPress={() => playNext(track)} />
        <Item icon="list-outline" label="Add to queue" onPress={() => addToQueue(track)} />
        <Item
          icon={liked ? 'heart' : 'heart-outline'}
          label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          color={liked ? colors.accent : undefined}
          onPress={() => toggleLike(track)}
        />
        {status === 'idle' || status === 'error' ? (
          <Item icon="arrow-down-circle-outline" label="Download for offline" onPress={() => download(track)} />
        ) : status === 'done' ? (
          <Item
            icon="trash-outline"
            label="Remove download"
            sub={entry ? formatBytes(entry.bytes) : undefined}
            color={colors.danger}
            onPress={() => removeDownload(track.id)}
          />
        ) : (
          <Item icon="close-circle-outline" label="Cancel download" onPress={() => cancelDownload(track.id)} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, alignSelf: 'center', marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.textFaint, marginVertical: spacing.md, opacity: 0.5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 14 },
});
