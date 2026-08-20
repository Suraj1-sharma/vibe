import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { Artist } from '../types';
import { Artwork } from './Artwork';

export function ArtistRow({ artist, onPress }: { artist: Artist; onPress: (a: Artist) => void }) {
  return (
    <Pressable
      onPress={() => onPress(artist)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgElevated }]}
    >
      <Artwork uri={artist.artwork} size={52} rounded={26} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text numberOfLines={1} style={font.body}>
            {artist.name}
          </Text>
          {artist.isVerified && <Ionicons name="checkmark-circle" size={14} color={colors.accent} />}
        </View>
        <Text numberOfLines={1} style={font.small}>
          Artist · {artist.trackCount} {artist.trackCount === 1 ? 'song' : 'songs'}
          {artist.followerCount > 0 ? ` · ${formatCount(artist.followerCount)} followers` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
