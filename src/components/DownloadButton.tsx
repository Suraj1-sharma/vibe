import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { cancelDownload, download, removeDownload, retryDownload, useDownloadEntry } from '../services/downloads';
import { useOnline } from '../services/network';
import { colors } from '../theme';
import { Track } from '../types';

type Props = { track: Track; size?: number };

/**
 * The "save for offline" button. States:
 *  idle → arrow-down-circle (outline)   tap → start download
 *  queued/downloading → progress ring    tap → cancel
 *  done → green filled arrow             tap → ask to remove
 *  error → red alert icon                tap → retry
 */
export function DownloadButton({ track, size = 26 }: Props) {
  const entry = useDownloadEntry(track.id);
  const online = useOnline();
  const status = entry?.status ?? 'idle';

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    if (track.isLocal) {
      Alert.alert('Remove this song?', `"${track.title}" was imported from your phone. Remove it from Vibe?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeDownload(track.id) },
      ]);
      return;
    }
    if (status === 'idle') {
      if (!online) {
        Alert.alert('You are offline', 'Connect to the internet to download this song.');
        return;
      }
      download(track);
    } else if (status === 'queued' || status === 'downloading') {
      cancelDownload(track.id);
    } else if (status === 'done') {
      Alert.alert('Remove download?', `"${track.title}" will no longer be available offline.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeDownload(track.id) },
      ]);
    } else if (status === 'error') {
      retryDownload(track.id);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.btn}
      accessibilityLabel={
        track.isLocal
          ? 'Imported from your phone, tap to remove'
          : status === 'done'
            ? 'Downloaded, tap to remove'
            : status === 'idle'
              ? 'Download for offline'
              : 'Cancel download'
      }
    >
      {track.isLocal && <Ionicons name="phone-portrait" size={size - 4} color={colors.accent} />}
      {!track.isLocal && status === 'idle' && (
        <Ionicons name="arrow-down-circle-outline" size={size} color={colors.textMuted} />
      )}
      {!track.isLocal && status === 'done' && <Ionicons name="arrow-down-circle" size={size} color={colors.accent} />}
      {!track.isLocal && status === 'error' && <Ionicons name="alert-circle-outline" size={size} color={colors.danger} />}
      {!track.isLocal && (status === 'queued' || status === 'downloading') && (
        <ProgressRing size={size} progress={status === 'queued' ? 0 : entry?.progress ?? 0} />
      )}
    </Pressable>
  );
}

export function ProgressRing({ size, progress }: { size: number; progress: number }) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  const sq = size * 0.3;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.card} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        <Rect x={(size - sq) / 2} y={(size - sq) / 2} width={sq} height={sq} rx={1.5} fill={colors.textMuted} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4, alignItems: 'center', justifyContent: 'center' },
});
