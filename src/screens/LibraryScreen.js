import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Image, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { formatBytes, formatDuration } from '../utils/downloader';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const FILTERS = ['all','audio','video','favorites'];
const SORTS = ['date-desc','date-asc','name-asc','name-desc','size-desc','plays-desc'];
const SORT_LABELS = { 'date-desc':'Newest','date-asc':'Oldest','name-asc':'A–Z','name-desc':'Z–A','size-desc':'Largest','plays-desc':'Most Played' };

export default function LibraryScreen({ navigation }) {
  const {
    theme, library, removeFromLibrary, toggleFavorite, renameItem, showToast,
    playlists, addToPlaylist, createPlaylist, haptic, playTrack,
  } = useApp();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('date-desc');
  const [viewMode, setViewMode] = useState('list'); // list, grid
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [contextItem, setContextItem] = useState(null);
  const [contextVisible, setContextVisible] = useState(false);

  const filtered = useMemo(() => {
    let items = [...library];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.artist?.toLowerCase().includes(q) ||
        i.format?.toLowerCase().includes(q)
      );
    }

    // Filter
    if (filter === 'audio') items = items.filter(i => i.type === 'audio');
    else if (filter === 'video') items = items.filter(i => i.type === 'video');
    else if (filter === 'favorites') items = items.filter(i => i.fav);

    // Sort
    switch (sort) {
      case 'date-asc':   items.sort((a,b) => a.id - b.id); break;
      case 'name-asc':   items.sort((a,b) => (a.title||'').localeCompare(b.title||'')); break;
      case 'name-desc':  items.sort((a,b) => (b.title||'').localeCompare(a.title||'')); break;
      case 'size-desc':  items.sort((a,b) => (b.size||0) - (a.size||0)); break;
      case 'plays-desc': items.sort((a,b) => (b.playCount||0) - (a.playCount||0)); break;
      default:           items.sort((a,b) => b.id - a.id);
    }

    return items;
  }, [library, search, filter, sort]);

  const toggleSelect = (id) => {
    haptic('light');
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openContext = (item) => {
    haptic('heavy');
    setContextItem(item);
    setContextVisible(true);
  };

  const handlePlay = (item) => {
    const queueItems = filtered.map(i => ({
      ...i,
      url: i.localUri || i.url,
    }));
    const idx = filtered.findIndex(i => i.id === item.id);
    playTrack({ ...item, url: item.localUri || item.url }, queueItems, idx);
    navigation.navigate('Player', { track: item });
    haptic('light');
  };

  const handleDelete = async (item) => {
    Alert.alert(
      'Delete File',
      `Delete "${item.title}"?`,
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete local file if exists
            if (item.localUri) {
              try {
                await FileSystem.deleteAsync(item.localUri, { idempotent: true });
              } catch (e) {}
            }
            await removeFromLibrary(item.id);
            showToast('Deleted 🗑', '');
            haptic('medium');
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShare = async (item) => {
    const uri = item.localUri;
    if (!uri) { showToast('No local file to share', 'error'); return; }
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        showToast('Sharing not available', 'error');
      }
    } catch (e) {
      showToast('Share failed', 'error');
    }
  };

  const handleRename = (item) => {
    setRenameTarget(item);
    setRenameText(item.title || '');
    setRenameVisible(true);
    setContextVisible(false);
  };

  const confirmRename = async () => {
    if (!renameText.trim() || !renameTarget) return;
    await renameItem(renameTarget.id, renameText.trim());
    showToast('Renamed ✅', 'success');
    setRenameVisible(false);
    setRenameTarget(null);
    haptic('medium');
  };

  const handleAddToPlaylist = (item) => {
    setPlaylistTarget(item);
    setPlaylistModalVisible(true);
    setContextVisible(false);
  };

  const deleteSelected = async () => {
    Alert.alert('Delete Selected', `Delete ${selected.size} items?`, [
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          for (const id of selected) {
            const item = library.find(i => i.id === id);
            if (item?.localUri) {
              try { await FileSystem.deleteAsync(item.localUri, { idempotent: true }); } catch (e) {}
            }
            await removeFromLibrary(id);
          }
          setSelected(new Set());
          setMultiSelect(false);
          showToast(`Deleted ${selected.size} items`, '');
          haptic('heavy');
        }
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item, index }) => {
    const isSelected = selected.has(item.id);

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          style={[styles.gridCard, { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border }]}
          onPress={() => multiSelect ? toggleSelect(item.id) : handlePlay(item)}
          onLongPress={() => { if (!multiSelect) { setMultiSelect(true); } openContext(item); }}
          activeOpacity={0.8}
        >
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.gridThumb} />
          ) : (
            <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.gridThumb}>
              <Ionicons name={item.type === 'audio' ? 'musical-notes' : 'videocam'} size={24} color="#fff" />
            </LinearGradient>
          )}
          {isSelected && (
            <View style={[styles.selectedOverlay, { backgroundColor: `${theme.primary}80` }]}>
              <Ionicons name="checkmark-circle" size={28} color="#fff" />
            </View>
          )}
          <View style={styles.gridInfo}>
            <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
            <View style={[styles.badge, { backgroundColor: `${theme.primary}20` }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>{item.format?.toUpperCase()}</Text>
            </View>
          </View>
          {item.fav && <Ionicons name="heart" size={12} color="#ff6d9d" style={styles.favBadge} />}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.listItem, { borderBottomColor: `${theme.border}60` },
          isSelected && { backgroundColor: `${theme.primary}15` }
        ]}
        onPress={() => multiSelect ? toggleSelect(item.id) : handlePlay(item)}
        onLongPress={() => openContext(item)}
        activeOpacity={0.7}
      >
        {multiSelect && (
          <View style={[styles.checkbox, { borderColor: theme.border }, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}

        <View style={[styles.listArt, { overflow: 'hidden' }]}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} />
          ) : (
            <LinearGradient colors={[theme.primary, theme.primary2]} style={StyleSheet.absoluteFill}>
              <Ionicons name={item.type === 'audio' ? 'musical-notes' : 'videocam'} size={18} color="#fff" style={{ margin: 'auto' }} />
            </LinearGradient>
          )}
          {item.localUri && (
            <View style={styles.localBadge}>
              <Ionicons name="save" size={8} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{item.title || 'Unknown'}</Text>
          <Text style={[styles.listMeta, { color: theme.sub }]}>
            {item.format?.toUpperCase()} {item.quality ? `· ${item.quality}` : ''}
            {item.size ? ` · ${formatBytes(item.size)}` : ''}
            {item.playCount > 0 ? ` · ${item.playCount} plays` : ''}
          </Text>
        </View>

        <View style={styles.listRight}>
          {item.fav && <Ionicons name="heart" size={14} color="#ff6d9d" />}
          <TouchableOpacity onPress={() => openContext(item)} style={styles.moreBtn}>
            <Ionicons name="ellipsis-vertical" size={16} color={theme.sub} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const totalSize = filtered.reduce((sum, i) => sum + (i.size || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: `${theme.bg}f0`, borderBottomColor: `${theme.border}80` }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Library</Text>
          <Text style={[styles.headerSub, { color: theme.sub }]}>
            {filtered.length} items · {formatBytes(totalSize)}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} style={styles.headerBtn}>
          <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={20} color={theme.sub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilterVisible(true)} style={styles.headerBtn}>
          <Ionicons name="options" size={20} color={theme.sub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMultiSelect(!multiSelect); setSelected(new Set()); }} style={styles.headerBtn}>
          <Ionicons name={multiSelect ? 'close' : 'checkmark-done'} size={20} color={multiSelect ? theme.danger : theme.sub} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.sub} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search library..."
            placeholderTextColor={theme.sub}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={theme.sub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterChips}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, { borderColor: theme.border }, filter === f && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={() => { setFilter(f); haptic('light'); }}
          >
            <Text style={[styles.chipText, { color: filter === f ? '#fff' : theme.sub }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Multi-select actions */}
      {multiSelect && selected.size > 0 && (
        <View style={[styles.multiBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.multiCount, { color: theme.text }]}>{selected.size} selected</Text>
          <TouchableOpacity onPress={() => { selected.forEach(id => toggleFavorite(id)); showToast('Toggled favorites ❤️', 'success'); }} style={styles.multiBtn}>
            <Ionicons name="heart" size={16} color="#ff6d9d" />
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteSelected} style={styles.multiBtn}>
            <Ionicons name="trash" size={16} color={theme.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setSelected(new Set(filtered.map(i => i.id))); }} style={styles.multiBtn}>
            <Ionicons name="checkmark-done" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 50, marginBottom: 12 }}>📭</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {search || filter !== 'all' ? 'No matches found' : 'Library is empty'}
          </Text>
          <Text style={[styles.emptyDesc, { color: theme.sub }]}>
            {search || filter !== 'all' ? 'Try a different search or filter' : 'Download something to see it here'}
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        columnWrapperStyle={viewMode === 'grid' ? { gap: 10, paddingHorizontal: 12, marginBottom: 10 } : undefined}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Context Menu Modal */}
      <Modal visible={contextVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} onPress={() => setContextVisible(false)}>
          <View style={[styles.contextSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            {contextItem && (
              <>
                <Text style={[styles.contextTitle, { color: theme.text }]} numberOfLines={1}>{contextItem.title}</Text>
                {[
                  { icon: 'play', label: 'Play', action: () => { handlePlay(contextItem); setContextVisible(false); } },
                  { icon: 'heart', label: contextItem?.fav ? 'Remove Favorite' : 'Add to Favorites', action: () => { toggleFavorite(contextItem.id); showToast(contextItem?.fav ? 'Removed from favorites' : '❤️ Favorited', 'success'); setContextVisible(false); } },
                  { icon: 'add', label: 'Add to Playlist', action: () => handleAddToPlaylist(contextItem) },
                  { icon: 'share-outline', label: 'Share File', action: () => { handleShare(contextItem); setContextVisible(false); } },
                  { icon: 'pencil', label: 'Rename', action: () => handleRename(contextItem) },
                  { icon: 'information-circle', label: 'File Info', action: () => {
                    Alert.alert('File Info', `Title: ${contextItem.title}\nFormat: ${contextItem.format}\nQuality: ${contextItem.quality}\nSize: ${formatBytes(contextItem.size)}\nPlays: ${contextItem.playCount || 0}\nDate: ${contextItem.date}`);
                    setContextVisible(false);
                  }},
                  { icon: 'trash', label: 'Delete', action: () => { setContextVisible(false); handleDelete(contextItem); }, color: theme.danger },
                ].map(a => (
                  <TouchableOpacity
                    key={a.label}
                    style={[styles.contextItem, { borderBottomColor: `${theme.border}50` }]}
                    onPress={a.action}
                  >
                    <Ionicons name={a.icon} size={18} color={a.color || theme.text} />
                    <Text style={[styles.contextLabel, { color: a.color || theme.text }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.renameSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.contextTitle, { color: theme.text }]}>Rename File</Text>
            <TextInput
              style={[styles.renameInput, { backgroundColor: theme.bg2, borderColor: theme.border, color: theme.text }]}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="New name..."
              placeholderTextColor={theme.sub}
              autoFocus
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setRenameVisible(false)}>
                <Text style={[{ color: theme.sub, fontWeight: '600' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={confirmRename}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Playlist Modal */}
      <Modal visible={playlistModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.contextSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.contextTitle, { color: theme.text }]}>Add to Playlist</Text>
            {playlists.length === 0 ? (
              <Text style={[styles.emptyDesc, { color: theme.sub, textAlign: 'center', paddingVertical: 20 }]}>No playlists yet</Text>
            ) : (
              playlists.map(pl => (
                <TouchableOpacity
                  key={pl.id}
                  style={[styles.contextItem, { borderBottomColor: `${theme.border}50` }]}
                  onPress={() => {
                    if (playlistTarget) addToPlaylist(pl.id, playlistTarget.id);
                    setPlaylistModalVisible(false);
                  }}
                >
                  <Ionicons name="musical-notes" size={18} color={theme.primary} />
                  <Text style={[styles.contextLabel, { color: theme.text }]}>{pl.name}</Text>
                  <Text style={[{ color: theme.sub, fontSize: 11 }]}>{pl.items.length} tracks</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.primary, marginTop: 10 }]}
              onPress={() => {
                Alert.prompt?.('New Playlist', 'Enter playlist name:', async (name) => {
                  if (name) {
                    await createPlaylist(name);
                    if (playlistTarget) {
                      // will be added after create
                    }
                  }
                });
                setPlaylistModalVisible(false);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ New Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border, marginTop: 8 }]} onPress={() => setPlaylistModalVisible(false)}>
              <Text style={[{ color: theme.sub, fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filter/Sort Modal */}
      <Modal visible={filterVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.contextSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.contextTitle, { color: theme.text }]}>Sort & Filter</Text>
            <Text style={[styles.sortLabel, { color: theme.sub }]}>Sort by</Text>
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.contextItem, { borderBottomColor: `${theme.border}50` }]}
                onPress={() => { setSort(key); setFilterVisible(false); haptic('light'); }}
              >
                <Ionicons name={sort === key ? 'radio-button-on' : 'radio-button-off'} size={18} color={sort === key ? theme.primary : theme.sub} />
                <Text style={[styles.contextLabel, { color: sort === key ? theme.primary : theme.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border, marginTop: 12 }]} onPress={() => setFilterVisible(false)}>
              <Text style={[{ color: theme.sub, fontWeight: '600' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 2 },
  headerBtn: { padding: 8 },
  searchWrap: { padding: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterChips: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: '600' },
  multiBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, marginHorizontal: 12, borderRadius: 12, marginBottom: 8, gap: 12,
  },
  multiCount: { flex: 1, fontSize: 13, fontWeight: '600' },
  multiBtn: { padding: 6 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  listArt: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  localBadge: {
    position: 'absolute', bottom: 2, right: 2, backgroundColor: '#00e676',
    borderRadius: 4, padding: 2,
  },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  listMeta: { fontSize: 11 },
  listRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moreBtn: { padding: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  gridCard: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  gridThumb: { width: '100%', height: 110, alignItems: 'center', justifyContent: 'center' },
  gridInfo: { padding: 10 },
  gridTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  favBadge: { position: 'absolute', top: 8, right: 8 },
  selectedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 110,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  contextSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1,
    padding: 20, paddingBottom: 40,
  },
  renameSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20 },
  contextTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  contextItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  contextLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  renameInput: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 15, marginBottom: 16 },
  renameActions: { flexDirection: 'row', gap: 10 },
  sortLabel: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
});
