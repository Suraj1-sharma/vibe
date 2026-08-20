import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, Empty, PillButton } from '../components/Common';
import { TrackRow } from '../components/TrackRow';
import {
  downloadAll,
  downloadsStore,
  formatBytes,
  removeAllDownloads,
  useDownloadedIds,
  useDownloadedTracks,
  useDownloadsTotalBytes,
} from '../services/downloads';
import { importSongs } from '../services/localImport';
import { useLikedTracks } from '../services/likes';
import { useOnline } from '../services/network';
import { playQueue } from '../services/player';
import { useStore } from '../services/store';
import { colors, font, spacing } from '../theme';
import { Track } from '../types';

type Tab = 'downloads' | 'liked';

export function LibraryScreen({ onMore, bottomInset }: { onMore: (t: Track) => void; bottomInset: number }) {
  const [tab, setTab] = useState<Tab>('downloads');
  const online = useOnline();
  const downloaded = useDownloadedTracks();
  const liked = useLikedTracks();
  const totalBytes = useDownloadsTotalBytes();
  const ids = useDownloadedIds();
  const entries = useStore(downloadsStore, (s) => s.entries);

  const inFlight = useMemo(
    () => ids.map((id) => entries[id]).filter((e) => e && e.status !== 'done'),
    [ids, entries],
  );

  const [importing, setImporting] = useState(false);

  const onImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const r = await importSongs();
      if (r.cancelled) return;
      if (r.added === 0 && r.failed > 0) {
        Alert.alert('Import failed', 'None of the selected files could be read.');
      } else if (r.added > 0) {
        Alert.alert(
          'Songs added',
          `${r.added} song${r.added === 1 ? '' : 's'} added to your Library${r.failed ? ` (${r.failed} could not be read)` : ''}.`,
        );
      }
    } finally {
      setImporting(false);
    }
  };

  const list = tab === 'downloads' ? downloaded : liked;
  const queueTitle = tab === 'downloads' ? 'Downloads' : 'Liked Songs';
  const likedNotDownloaded = liked.filter((t) => entries[t.id]?.status !== 'done');

  return (
    <View style={{ flex: 1 }}>
      <Text style={[font.h1, styles.pad, { marginTop: spacing.md }]}>Your Library</Text>
      <View style={[styles.chips, styles.pad]}>
        <Chip label={`Downloads (${downloaded.length})`} active={tab === 'downloads'} onPress={() => setTab('downloads')} />
        <Chip label={`Liked (${liked.length})`} active={tab === 'liked'} onPress={() => setTab('liked')} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: bottomInset, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.pad}>
            {tab === 'downloads' ? (
              <>
                <View style={styles.statRow}>
                  <Ionicons name="phone-portrait-outline" size={16} color={colors.textMuted} />
                  <Text style={font.small}>
                    {downloaded.length} songs · {formatBytes(totalBytes)} on this phone
                    {inFlight.length ? ` · ${inFlight.length} downloading` : ''}
                  </Text>
                </View>
                <View style={styles.rowBtns}>
                  <PillButton
                    icon="add-circle-outline"
                    label={importing ? 'Importing...' : 'Import songs from phone'}
                    disabled={importing}
                    onPress={() => void onImport()}
                  />
                </View>
                {downloaded.length > 0 && (
                  <View style={styles.rowBtns}>
                    <PillButton icon="play" label="Play all" primary onPress={() => void playQueue(downloaded, 0, 'Downloads')} />
                    <PillButton icon="shuffle" label="Shuffle" onPress={() => void playQueue(shuffleCopy(downloaded), 0, 'Downloads')} />
                    <PillButton
                      icon="trash-outline"
                      label="Remove all"
                      onPress={() =>
                        Alert.alert('Remove all downloads?', `This frees ${formatBytes(totalBytes)}.`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove all', style: 'destructive', onPress: removeAllDownloads },
                        ])
                      }
                    />
                  </View>
                )}
                {inFlight.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[font.small, { fontWeight: '700', marginBottom: 4 }]}>Downloading</Text>
                    {inFlight.map((e) => (
                      <TrackRow key={e.track.id} track={e.track} compact onPress={() => {}} onMore={onMore} />
                    ))}
                  </View>
                )}
              </>
            ) : (
              liked.length > 0 && (
                <View style={styles.rowBtns}>
                  <PillButton icon="play" label="Play all" primary onPress={() => void playQueue(liked, 0, 'Liked Songs')} />
                  {online && likedNotDownloaded.length > 0 && (
                    <PillButton
                      icon="arrow-down-circle-outline"
                      label={`Download all (${likedNotDownloaded.length})`}
                      onPress={() => downloadAll(likedNotDownloaded)}
                    />
                  )}
                </View>
              )
            )}
          </View>
        }
        ListEmptyComponent={
          tab === 'downloads' ? (
            inFlight.length ? null : (
              <Empty
                icon="arrow-down-circle-outline"
                title="No downloads yet"
                body="Tap the down-arrow on any song to save it, or use “Import songs from phone” above to add music you already own. Both play with no internet."
              />
            )
          ) : (
            <Empty icon="heart-outline" title="Songs you like will appear here" body="Tap the ♥ on the player or long-press a song." />
          )
        }
        renderItem={({ item, index }) => (
          <TrackRow track={item} onPress={() => void playQueue(list, index, queueTitle)} onMore={onMore} />
        )}
      />
    </View>
  );
}

function shuffleCopy<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg },
  chips: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  rowBtns: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
});
