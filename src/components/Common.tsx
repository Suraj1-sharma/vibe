import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOnline } from '../services/network';
import { colors, font, radius, spacing } from '../theme';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.bg} />
      <Text style={styles.bannerText}>You're offline — showing your downloaded music</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={font.h2}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[font.small, { fontWeight: '700', color: colors.textMuted }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color={colors.textFaint} />
      <Text style={[font.h3, { marginTop: spacing.md, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[font.small, { marginTop: spacing.xs, textAlign: 'center' }]}>{body}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[font.small, { color: active ? colors.bg : colors.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function PillButton({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        primary && styles.pillPrimary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={primary ? colors.bg : colors.text} /> : null}
      <Text style={[font.small, { color: primary ? colors.bg : colors.text, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.warning,
    paddingVertical: 6,
  },
  bannerText: { ...font.small, color: colors.bg, fontWeight: '600' },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: 40 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    // never inherit the parent's height - a chip is always its own content size
    alignSelf: 'center',
  },
  chipActive: { backgroundColor: colors.accent },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  pillPrimary: { backgroundColor: colors.accent },
});
