import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  StyleSheet, Image, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import BackgroundAnimation from '../components/BackgroundAnimation';
import { API } from '../constants';
import { formatBytes } from '../utils/downloader';
import * as Network from 'expo-network';

const { width: W } = Dimensions.get('window');

const QUICK_ACTIONS = [
  { id: 'download', icon: 'cloud-download', label: 'Download', desc: '1400+ sites', screen: 'Download' },
  { id: 'search',   icon: 'search',         label: 'Search',   desc: 'Multi-site', screen: 'Search' },
  { id: 'aria',     icon: 'chatbubbles',    label: 'ARIA',     desc: 'AI Assistant', screen: 'ARIA' },
  { id: 'browser',  icon: 'globe',          label: 'Browser',  desc: 'Browse & grab', screen: 'Browser' },
  { id: 'library',  icon: 'library',        label: 'Library',  desc: 'Your files', screen: 'Library' },
  { id: 'player',   icon: 'musical-notes',  label: 'Player',   desc: 'Now playing', screen: 'Player' },
];

export default function HomeScreen({ navigation }) {
  const { theme, stats, library, profile, showToast, settings } = useApp();
  const [serverOnline, setServerOnline] = useState(null);
  const [trending, setTrending] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [netState, setNetState] = useState(true);
  const insets = useSafeAreaInsets();
  const greetingAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 5)  return 'Good Night 🌙';
    if (h < 12) return 'Good Morning ☀️';
    if (h < 17) return 'Good Afternoon 🌤';
    if (h < 21) return 'Good Evening 🌆';
    return 'Good Night 🌙';
  };

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(greetingAnim, { toValue: 1, useNativeDriver: true, tension: 80 }),
      Animated.spring(statsAnim, { toValue: 1, useNativeDriver: true, tension: 80 }),
    ]).start();
    checkServer();
    loadTrending();
    checkNetwork();
  }, []);

  const checkNetwork = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setNetState(state.isConnected);
    } catch (e) {}
  };

  const checkServer = async () => {
    try {
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${settings.customServer || API}/health`, { signal: ctrl.signal });
      clearTimeout(tm);
      setServerOnline(res.ok);
    } catch (e) {
      setServerOnline(false);
    }
  };

  const loadTrending = async () => {
    try {
      const res = await fetch(`${settings.customServer || API}/trending`);
      const data = await res.json();
      if (data.items) setTrending(data.items.slice(0, 10));
    } catch (e) {
      // Generate placeholder trending
      setTrending([]);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([checkServer(), loadTrending(), checkNetwork()]);
    setRefreshing(false);
    showToast('Refreshed! ✅', 'success');
  }, []);

  const recent = library.slice(0, 5);
  const favCount = stats.favorites;

  const StatCard = ({ value, label, icon, color }) => (
    <Animated.View
      style={[
        styles.statCard,
        { backgroundColor: theme.card, borderColor: theme.border },
        { opacity: statsAnim, transform: [{ translateY: statsAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }] }
      ]}
    >
      <Ionicons name={icon} size={16} color={color || theme.primary} style={{ marginBottom: 4 }} />
      <Text style={[styles.statValue, { color: color || theme.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.sub }]}>{label}</Text>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {settings.backgroundAnimations !== false && (
        <BackgroundAnimation theme={theme} style={{ zIndex: 0 }} intensity="full" />
      )}

      <ScrollView
        style={{ zIndex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={[`${theme.primary}22`, 'transparent']}
          style={styles.hero}
        >
          <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 22, paddingBottom: 20 }}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Animated.Text
                  style={[styles.greeting, { color: theme.sub },
                    { opacity: greetingAnim, transform: [{ translateY: greetingAnim.interpolate({ inputRange: [0,1], outputRange: [-10,0] }) }] }
                  ]}
                >
                  {greeting()}
                </Animated.Text>
                <Animated.Text
                  style={[styles.heroName, { color: theme.primary },
                    { opacity: greetingAnim }
                  ]}
                >
                  {profile?.name || 'WAVE'}
                </Animated.Text>
                <Text style={[styles.heroSub, { color: theme.sub }]}>Music · Videos · AI · Everything</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                style={[styles.avatarBtn, { borderColor: theme.primary }]}
              >
                {profile?.picture ? (
                  <Image source={{ uri: profile.picture }} style={styles.avatar} />
                ) : (
                  <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(profile?.name || 'W').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard value={stats.downloads} label="Downloads" icon="cloud-download" />
              <StatCard value={stats.library} label="Library" icon="library" />
              <StatCard value={favCount} label="Favorites" icon="heart" color="#ff6d9d" />
              <StatCard value={formatBytes(stats.totalSize)} label="Saved" icon="save" color={theme.accent} />
            </View>
          </View>
        </LinearGradient>

        {/* Server status */}
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, {
              backgroundColor: serverOnline === null ? theme.sub
                : serverOnline ? '#00e676' : '#ff4c4c'
            }]} />
            <Text style={[styles.statusText, { color: theme.sub }]}>
              {serverOnline === null ? 'Checking server...'
                : serverOnline ? 'Server online ✓'
                : 'Server offline'}
            </Text>
          </View>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, { backgroundColor: netState ? '#00e676' : '#ff4c4c' }]} />
            <Text style={[styles.statusText, { color: theme.sub }]}>
              {netState ? 'Connected' : 'No internet'}
            </Text>
          </View>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={[styles.refreshBtn, { color: theme.primary }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Quick access */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.sub }]}>Quick Access</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  action.id === 'player' && styles.quickCardWide,
                ]}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[`${theme.primary}20`, `${theme.accent}10`]}
                  style={styles.quickIcon}
                >
                  <Ionicons name={action.icon} size={22} color={theme.primary} />
                </LinearGradient>
                <Text style={[styles.quickName, { color: theme.text }]}>{action.label}</Text>
                <Text style={[styles.quickDesc, { color: theme.sub }]}>{action.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trending */}
        {trending.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.sub }]}>🔥 Trending</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
              {trending.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.trendCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => {
                    navigation.navigate('Download');
                  }}
                >
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.trendThumb} />
                  ) : (
                    <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.trendThumb}>
                      <Ionicons name="musical-note" size={20} color="#fff" />
                    </LinearGradient>
                  )}
                  <Text style={[styles.trendTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.trendMeta, { color: theme.sub }]}>{item.uploader || ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent downloads */}
        {recent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.sub }]}>Recently Downloaded</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {recent.map((item, i) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.recentItem, { borderBottomColor: `${theme.border}80` }]}
                onPress={() => navigation.navigate('Player', { track: item })}
                activeOpacity={0.7}
              >
                <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.recentArt}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <Ionicons name="musical-note" size={18} color="#fff" />
                  )}
                </LinearGradient>
                <View style={styles.recentInfo}>
                  <Text style={[styles.recentTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.recentMeta, { color: theme.sub }]}>
                    {item.format?.toUpperCase()} • {item.date}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.recentPlay}
                  onPress={() => navigation.navigate('Player', { track: item })}
                >
                  <Ionicons name="play-circle" size={28} color={theme.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {library.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 60, marginBottom: 16 }}>🌊</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Welcome to WAVE</Text>
            <Text style={[styles.emptyDesc, { color: theme.sub }]}>
              Download music and videos from 1400+ sites. Search, discover, and play — all in one place.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Download')}
            >
              <Text style={styles.emptyBtnText}>START DOWNLOADING</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  heroName: { fontSize: 32, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  heroSub: { fontSize: 13 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 2,
  },
  statValue: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11 },
  refreshBtn: { fontSize: 12, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 12, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: (W - 42) / 2, borderRadius: 16, padding: 16, borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, elevation: 2,
  },
  quickCardWide: { width: '100%' },
  quickIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  quickName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  quickDesc: { fontSize: 11 },
  trendCard: {
    width: 140, borderRadius: 14, padding: 10, borderWidth: 1, marginRight: 10,
  },
  trendThumb: {
    width: '100%', height: 80, borderRadius: 8, marginBottom: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  trendTitle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  trendMeta: { fontSize: 10 },
  recentItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12,
  },
  recentArt: {
    width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  recentMeta: { fontSize: 11 },
  recentPlay: { padding: 4 },
  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: {
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
  },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 2 },
});
