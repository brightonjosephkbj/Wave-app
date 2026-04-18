import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Image, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { SEARCH_SITES } from '../constants';
import { formatDuration } from '../utils/downloader';

export default function SearchScreen({ navigation }) {
  const { theme, settings, searchHistory, addSearchHistory, saveSearchHistory, showToast, haptic } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeSites, setActiveSites] = useState(['youtube','soundcloud','dailymotion']);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const API_URL = settings.customServer || 'https://wave-backened-production.up.railway.app';

  const toggleSite = (siteId) => {
    haptic('light');
    setActiveSites(prev =>
      prev.includes(siteId) ? prev.filter(s => s !== siteId) : [...prev, siteId]
    );
  };

  const doSearch = useCallback(async (q) => {
    const searchQ = q || query.trim();
    if (!searchQ) { showToast('Enter a search query', 'error'); return; }
    if (activeSites.length === 0) { showToast('Select at least one site', 'error'); return; }
    haptic('medium');
    setLoading(true);
    setResults([]);
    await addSearchHistory(searchQ);

    const allResults = [];
    await Promise.all(
      activeSites.map(async (site) => {
        try {
          const params = new URLSearchParams({ q: searchQ, site, limit: '8' });
          const res = await fetch(`${API_URL}/search?${params}`);
          const data = await res.json();
          if (data.results) {
            allResults.push(...data.results.map(r => ({ ...r, _site: site })));
          }
        } catch (e) {}
      })
    );

    setResults(allResults);
    setLoading(false);
    if (allResults.length === 0) showToast('No results found', '');
  }, [query, activeSites, API_URL]);

  const clearHistory = async () => {
    await saveSearchHistory([]);
    showToast('Search history cleared', '');
  };

  const renderResult = ({ item }) => (
    <TouchableOpacity
      style={[styles.result, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => {
        navigation.navigate('Download', { prefillUrl: item.url || item.webpage_url });
        haptic('light');
      }}
      activeOpacity={0.8}
    >
      <View style={styles.resultThumbWrap}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.resultThumb} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.resultThumb}>
            <Ionicons name="musical-note" size={22} color="#fff" />
          </LinearGradient>
        )}
        {item.duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.resultMeta, { color: theme.sub }]} numberOfLines={1}>
          {item.uploader || item.channel || ''}{item.view_count ? ` · ${(item.view_count/1000).toFixed(0)}K views` : ''}
        </Text>
        <View style={[styles.sitePill, { backgroundColor: `${theme.primary}20`, borderColor: `${theme.primary}40` }]}>
          <Text style={[styles.siteText, { color: theme.primary }]}>
            {SEARCH_SITES.find(s => s.id === item._site)?.icon || '🔍'} {item._site}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.dlBtn, { backgroundColor: theme.primary }]}
        onPress={() => {
          navigation.navigate('Download', { prefillUrl: item.url || item.webpage_url });
          haptic('medium');
        }}
      >
        <Ionicons name="cloud-download" size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: `${theme.bg}f0`, borderBottomColor: `${theme.border}80` }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Search</Text>
        <Text style={[styles.headerSub, { color: theme.sub }]}>Discover across platforms</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.sub} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search music, videos..."
            placeholderTextColor={theme.sub}
            returnKeyType="search"
            onSubmitEditing={() => doSearch()}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Ionicons name="close-circle" size={18} color={theme.sub} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.goBtn, { backgroundColor: theme.primary }]}
          onPress={() => doSearch()}
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Site filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.siteFilters} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
        {SEARCH_SITES.map(site => (
          <TouchableOpacity
            key={site.id}
            style={[styles.siteChip, { borderColor: theme.border, backgroundColor: theme.card },
              activeSites.includes(site.id) && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` }
            ]}
            onPress={() => toggleSite(site.id)}
          >
            <Text style={styles.siteChipIcon}>{site.icon}</Text>
            <Text style={[styles.siteChipText, { color: activeSites.includes(site.id) ? theme.primary : theme.sub }]}>
              {site.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingWrap}>
          <Text style={{ fontSize: 32, marginBottom: 10 }}>🔍</Text>
          <Text style={[styles.loadingText, { color: theme.sub }]}>Searching {activeSites.length} sites...</Text>
        </View>
      )}

      {/* Search history */}
      {!loading && results.length === 0 && searchHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: theme.sub }]}>Recent Searches</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={[styles.clearText, { color: theme.danger }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {searchHistory.slice(0, 8).map((h, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.histItem, { borderBottomColor: `${theme.border}50` }]}
              onPress={() => { setQuery(h); doSearch(h); }}
            >
              <Ionicons name="time-outline" size={16} color={theme.sub} />
              <Text style={[styles.histText, { color: theme.text }]}>{h}</Text>
              <TouchableOpacity onPress={() => saveSearchHistory(searchHistory.filter((_, idx) => idx !== i))}>
                <Ionicons name="close" size={14} color={theme.sub} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state (no history, no results) */}
      {!loading && results.length === 0 && searchHistory.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>🎵</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Search Anything</Text>
          <Text style={[styles.emptyDesc, { color: theme.sub }]}>
            Find music and videos across YouTube, SoundCloud, TikTok and more
          </Text>
        </View>
      )}

      {/* Results */}
      {results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item, i) => `${item._site}-${i}`}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.resultsCount, { color: theme.sub }]}>
              {results.length} results
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8, padding: 12 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },
  goBtn: { padding: 14, borderRadius: 14 },
  siteFilters: { marginBottom: 8 },
  siteChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  siteChipIcon: { fontSize: 14 },
  siteChipText: { fontSize: 12, fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14 },
  historySection: { paddingHorizontal: 16 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  historyTitle: { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700' },
  clearText: { fontSize: 12, fontWeight: '600' },
  histItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  histText: { flex: 1, fontSize: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  resultsCount: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  result: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 10, gap: 10, alignItems: 'flex-start' },
  resultThumbWrap: { position: 'relative' },
  resultThumb: { width: 80, height: 60, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  durationText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  resultInfo: { flex: 1, gap: 4 },
  resultTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  resultMeta: { fontSize: 11 },
  sitePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  siteText: { fontSize: 10, fontWeight: '600' },
  dlBtn: { padding: 10, borderRadius: 10, alignSelf: 'center' },
});
