import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useDownloadEntry } from '../services/downloads';
import { colors, radius } from '../theme';

type Props = {
  trackId?: string;
  uri: string | null | undefined;
  size: number;
  rounded?: number;
};

/** Cover art that automatically falls back to the locally-saved copy when a track is downloaded. */
export function Artwork({ trackId, uri, size, rounded = radius.sm }: Props) {
  const entry = useDownloadEntry(trackId ?? '');
  const src = entry?.status === 'done' && entry.artworkUri ? entry.artworkUri : uri;
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: rounded }]}>
      {src ? (
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size, borderRadius: rounded }}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
        />
      ) : (
        <Ionicons name="musical-notes" size={size * 0.45} color={colors.textFaint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
