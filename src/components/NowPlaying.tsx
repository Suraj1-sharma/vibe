import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toggleLike, useIsLiked } from '../services/likes';
import {
  cycleRepeat,
  formatTime,
  next,
  previous,
  removeFromQueue,
  seekTo,
  skipToQueuePos,
  togglePlay,
  toggleShuffle,
  useCurrentTrack,
  useDuration,
  usePlayerError,
  usePlayerFlags,
  usePlayingOffline,
  usePosition,
  useQueue,
  useQueueOrder,
  useQueuePos,
  useQueueTitle,
  useRepeat,
  useShuffle,
} from '../services/player';
import { colors, font, spacing } from '../theme';
import { Artwork } from './Artwork';
import { DownloadButton } from './DownloadButton';
import { TrackSheet } from './TrackSheet';
import { Track } from '../types';

const { width } = Dimensions.get('window');
const ART = Math.min(width - 64, 360);

export function NowPlaying({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const track = useCurrentTrack();
  const { playing, isBuffering, isLoaded } = usePlayerFlags();
  const position = usePosition();
  const duration = useDuration();
  const error = usePlayerError();
  const shuffle = useShuffle();
  const repeat = useRepeat();
  const offline = usePlayingOffline();
  const queueTitle = useQueueTitle();
  const liked = useIsLiked(track?.id ?? '');
  const [scrub, setScrub] = useState<number | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);

  if (!track) return null;
  const shown = scrub ?? position;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <LinearGradient colors={['#3a3a3a', colors.bg, colors.bg]} style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          {/* header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="chevron-down" size={28} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={font.tiny}>{showQueue ? 'QUEUE' : 'PLAYING FROM'}</Text>
              <Text numberOfLines={1} style={[font.small, { color: colors.text, fontWeight: '700' }]}>
                {queueTitle || 'RhythmX'}
              </Text>
            </View>
            <Pressable onPress={() => setSheetTrack(track)} hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </Pressable>
          </View>

          {showQueue ? (
            <QueueList onPick={() => setShowQueue(false)} />
          ) : (
            <View style={styles.artWrap}>
              <Artwork trackId={track.id} uri={track.artworkLarge ?? track.artwork} size={ART} rounded={8} />
            </View>
          )}

          {/* title row */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={font.h2}>
                {track.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                {offline && <Ionicons name="arrow-down-circle" size={14} color={colors.accent} style={{ marginRight: 4 }} />}
                <Text numberOfLines={1} style={[font.body, { color: colors.textMuted }]}>
                  {track.artist}
                </Text>
              </View>
            </View>
            <DownloadButton track={track} size={28} />
            <Pressable onPress={() => toggleLike(track)} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? colors.accent : colors.textMuted} />
            </Pressable>
          </View>

          {/* seek */}
          <Slider
            style={{ width: '100%', height: 32 }}
            minimumValue={0}
            maximumValue={Math.max(duration, 1)}
            value={Math.min(shown, Math.max(duration, 1))}
            minimumTrackTintColor={colors.text}
            maximumTrackTintColor={colors.textFaint}
            thumbTintColor={colors.text}
            onSlidingStart={() => setScrub(position)}
            onValueChange={(v) => setScrub(v)}
            onSlidingComplete={(v) => {
              setScrub(null);
              void seekTo(v);
            }}
          />
          <View style={styles.times}>
            <Text style={font.tiny}>{formatTime(shown)}</Text>
            <Text style={font.tiny}>{formatTime(duration)}</Text>
          </View>

          {/* controls */}
          <View style={styles.controls}>
            <Pressable onPress={toggleShuffle} hitSlop={10}>
              <Ionicons name="shuffle" size={26} color={shuffle ? colors.accent : colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => void previous()} hitSlop={10}>
              <Ionicons name="play-skip-back" size={34} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => void togglePlay()} style={styles.playBtn}>
              {isBuffering && !isLoaded ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Ionicons name={playing ? 'pause' : 'play'} size={34} color={colors.bg} style={playing ? null : { marginLeft: 3 }} />
              )}
            </Pressable>
            <Pressable onPress={() => void next()} hitSlop={10}>
              <Ionicons name="play-skip-forward" size={34} color={colors.text} />
            </Pressable>
            <Pressable onPress={cycleRepeat} hitSlop={10}>
              <View>
                <Ionicons name="repeat" size={26} color={repeat === 'off' ? colors.textMuted : colors.accent} />
                {repeat === 'one' && (
                  <View style={styles.repeatOne}>
                    <Text style={{ color: colors.bg, fontSize: 9, fontWeight: '800' }}>1</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {error ? (
            <Text style={[font.small, { color: colors.danger, textAlign: 'center', marginTop: spacing.md }]}>{error}</Text>
          ) : null}

          <View style={styles.footer}>
            <Pressable onPress={() => setShowQueue((q) => !q)} hitSlop={10} style={styles.footerBtn}>
              <Ionicons name="list" size={22} color={showQueue ? colors.accent : colors.textMuted} />
              <Text style={[font.tiny, showQueue && { color: colors.accent }]}>Queue</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
      <TrackSheet track={sheetTrack} onClose={() => setSheetTrack(null)} />
    </Modal>
  );
}

function QueueList({ onPick }: { onPick: () => void }) {
  const queue = useQueue();
  const order = useQueueOrder();
  const pos = useQueuePos();
  return (
    <FlatList
      style={{ flex: 1, marginVertical: spacing.md }}
      data={order}
      keyExtractor={(idx, i) => `${queue[idx]?.id}-${i}`}
      initialScrollIndex={pos > 0 ? Math.max(0, pos - 1) : 0}
      getItemLayout={(_, i) => ({ length: 56, offset: 56 * i, index: i })}
      renderItem={({ item: idx, index }) => {
        const t = queue[idx];
        if (!t) return null;
        const active = index === pos;
        return (
          <Pressable
            onPress={() => {
              skipToQueuePos(index);
              onPick();
            }}
            style={[styles.qRow, active && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
          >
            <Artwork trackId={t.id} uri={t.artwork} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[font.body, active && { color: colors.accent }]}>
                {t.title}
              </Text>
              <Text numberOfLines={1} style={font.small}>
                {t.artist}
              </Text>
            </View>
            {!active && (
              <Pressable onPress={() => removeFromQueue(index)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  artWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOne: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: colors.accent,
    borderRadius: 7,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg },
  footerBtn: { alignItems: 'center', gap: 2 },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 56, paddingHorizontal: spacing.sm, borderRadius: 6 },
});
