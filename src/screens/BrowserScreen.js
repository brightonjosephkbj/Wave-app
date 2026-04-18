import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, Share, Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { BROWSER_QUICK_LINKS } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';

const DOWNLOADABLE_EXTS = ['.mp3','.mp4','.m4a','.webm','.ogg','.flac','.mkv','.avi','.wav','.opus','.aac'];
const MEDIA_DOMAINS = ['youtube.com','soundcloud.com','vimeo.com','dailymotion.com','tiktok.com','audiomack.com','mixcloud.com','bandcamp.com'];

export default function BrowserScreen({ navigation }) {
  const { theme, bookmarks, addBookmark, removeBookmark, showToast, haptic, addToLibrary, settings } = useApp();
  const insets = useSafeAreaInsets();
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHome, setShowHome] = useState(true);
  const [pageTitle, setPageTitle] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [interceptedUrl, setInterceptedUrl] = useState(null);
  const webViewRef = useRef(null);
  const progAnim = useRef(new Animated.Value(0)).current;

  const API_URL = settings.customServer || 'https://wave-backened-production.up.railway.app';

  const navigate = useCallback((url) => {
    let finalUrl = url.trim();
    if (!finalUrl) return;
    if (!finalUrl.startsWith('http') && !finalUrl.startsWith('//')) {
      // Check if it's a domain-like string
      if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
        finalUrl = `https://${finalUrl}`;
      } else {
        finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(finalUrl)}`;
      }
    }
    setInputUrl(finalUrl);
    setCurrentUrl(finalUrl);
    setShowHome(false);
    setShowHistory(false);
    setShowBookmarks(false);
    haptic('light');
    // Add to history
    setHistory(prev => [{ url: finalUrl, title: finalUrl, timestamp: Date.now() }, ...prev.slice(0, 49)]);
  }, [haptic]);

  const handleUrlSubmit = () => navigate(inputUrl);

  const handleNavigationChange = useCallback((state) => {
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    if (state.url !== currentUrl) {
      setCurrentUrl(state.url);
      setInputUrl(state.url);
    }
    setPageTitle(state.title || '');
  }, [currentUrl]);

  const handleLoadProgress = useCallback(({ nativeEvent }) => {
    const p = nativeEvent.progress;
    setProgress(p);
    Animated.timing(progAnim, { toValue: p, duration: 100, useNativeDriver: false }).start();
    if (p >= 1) {
      setTimeout(() => setProgress(0), 400);
    }
  }, []);

  const handleShouldStartLoad = useCallback((request) => {
    const url = request.url;
    const lower = url.toLowerCase();

    // Intercept direct media file downloads
    const isMedia = DOWNLOADABLE_EXTS.some(ext => lower.includes(ext));
    if (isMedia) {
      setInterceptedUrl(url);
      showDownloadPrompt(url);
      return false;
    }
    return true;
  }, []);

  const showDownloadPrompt = (url) => {
    const filename = url.split('/').pop().split('?')[0] || 'download';
    Alert.alert(
      '⬇️ Download this file?',
      filename,
      [
        { text: 'Download with WAVE', onPress: () => downloadWithWAVE(url, filename) },
        { text: 'Open in browser', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const downloadWithWAVE = (url, filename) => {
    navigation.navigate('Download', { prefillUrl: url });
    showToast('URL sent to downloader! 📥', 'success');
    haptic('medium');
  };

  const checkForMedia = () => {
    if (!currentUrl) return;
    const isMedia = MEDIA_DOMAINS.some(d => currentUrl.includes(d));
    if (isMedia) {
      Alert.alert(
        '🎵 Grab Media',
        `Download from ${pageTitle || currentUrl}?`,
        [
          { text: 'Download', onPress: () => downloadWithWAVE(currentUrl, 'media') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      navigation.navigate('Download', { prefillUrl: currentUrl });
      showToast('URL sent to downloader 📥', 'success');
    }
  };

  const shareCurrentPage = async () => {
    try {
      await Share.share({ url: currentUrl, title: pageTitle });
    } catch (e) {}
  };

  const bookmarkCurrentPage = () => {
    if (!currentUrl) return;
    addBookmark({ url: currentUrl, title: pageTitle || currentUrl });
    haptic('medium');
  };

  const isBookmarked = bookmarks.some(b => b.url === currentUrl);

  const progressWidth = progAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const renderQuickLink = ({ item }) => (
    <TouchableOpacity
      style={[styles.quickLink, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => navigate(item.url)}
    >
      <Text style={styles.quickLinkIcon}>{item.icon}</Text>
      <Text style={[styles.quickLinkName, { color: theme.text }]}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderBookmark = ({ item }) => (
    <TouchableOpacity
      style={[styles.histItem, { borderBottomColor: theme.border }]}
      onPress={() => navigate(item.url)}
      onLongPress={() => {
        Alert.alert('Remove Bookmark', item.title || item.url, [
          { text: 'Remove', onPress: () => removeBookmark(item.id), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }}
    >
      <Ionicons name="bookmark" size={14} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.histTitle, { color: theme.text }]} numberOfLines={1}>{item.title || item.url}</Text>
        <Text style={[styles.histUrl, { color: theme.sub }]} numberOfLines={1}>{item.url}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHistItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.histItem, { borderBottomColor: theme.border }]}
      onPress={() => { navigate(item.url); setShowHistory(false); }}
    >
      <Ionicons name="time" size={14} color={theme.sub} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.histTitle, { color: theme.text }]} numberOfLines={1}>{item.title || item.url}</Text>
        <Text style={[styles.histUrl, { color: theme.sub }]} numberOfLines={1}>{item.url}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Browser bar */}
      <View style={[styles.browBar, { paddingTop: insets.top + 6, backgroundColor: `${theme.bg}f0`, borderBottomColor: `${theme.border}80` }]}>
        <TouchableOpacity
          style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
          onPress={() => webViewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <Ionicons name="chevron-back" size={20} color={canGoBack ? theme.text : theme.sub} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
          onPress={() => webViewRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <Ionicons name="chevron-forward" size={20} color={canGoForward ? theme.text : theme.sub} />
        </TouchableOpacity>

        <TextInput
          style={[styles.urlInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={inputUrl}
          onChangeText={setInputUrl}
          placeholder="Search or enter URL..."
          placeholderTextColor={theme.sub}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleUrlSubmit}
          onFocus={() => setInputUrl(currentUrl)}
        />

        {loading ? (
          <TouchableOpacity style={styles.navBtn} onPress={() => webViewRef.current?.stopLoading()}>
            <Ionicons name="close" size={20} color={theme.sub} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={() => webViewRef.current?.reload()}>
            <Ionicons name="refresh" size={20} color={theme.sub} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.goBtn, { backgroundColor: theme.primary }]} onPress={handleUrlSubmit}>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {loading && progress > 0 && (
        <View style={[styles.progBar, { backgroundColor: theme.border }]}>
          <Animated.View style={[styles.progFill, { width: progressWidth, backgroundColor: theme.primary }]} />
        </View>
      )}

      {/* Action bar */}
      {!showHome && (
        <View style={[styles.actionBar, { backgroundColor: `${theme.bg}e0`, borderBottomColor: `${theme.border}50` }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={checkForMedia}>
            <Ionicons name="cloud-download" size={18} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Grab</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={bookmarkCurrentPage}>
            <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={isBookmarked ? theme.accent : theme.sub} />
            <Text style={[styles.actionText, { color: isBookmarked ? theme.accent : theme.sub }]}>
              {isBookmarked ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={shareCurrentPage}>
            <Ionicons name="share-outline" size={18} color={theme.sub} />
            <Text style={[styles.actionText, { color: theme.sub }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowBookmarks(!showBookmarks)}>
            <Ionicons name="bookmarks" size={18} color={theme.sub} />
            <Text style={[styles.actionText, { color: theme.sub }]}>Bookmarks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowHome(true); setCurrentUrl(''); }}>
            <Ionicons name="home" size={18} color={theme.sub} />
            <Text style={[styles.actionText, { color: theme.sub }]}>Home</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bookmarks panel */}
      {showBookmarks && (
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: theme.text }]}>🔖 Bookmarks</Text>
            <TouchableOpacity onPress={() => setShowBookmarks(false)}>
              <Ionicons name="close" size={18} color={theme.sub} />
            </TouchableOpacity>
          </View>
          {bookmarks.length === 0 ? (
            <Text style={[styles.emptyPanel, { color: theme.sub }]}>No bookmarks yet</Text>
          ) : (
            <FlatList data={bookmarks} renderItem={renderBookmark} keyExtractor={i => i.id.toString()} style={{ maxHeight: 200 }} />
          )}
        </View>
      )}

      {/* History panel */}
      {showHistory && (
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: theme.text }]}>🕒 History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={18} color={theme.sub} />
            </TouchableOpacity>
          </View>
          <FlatList data={history} renderItem={renderHistItem} keyExtractor={(_, i) => i.toString()} style={{ maxHeight: 200 }} />
        </View>
      )}

      {/* Home screen */}
      {showHome ? (
        <FlatList
          data={[{ type: 'content' }]}
          renderItem={() => (
            <View style={styles.homeContent}>
              <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: 12 }}>🌐</Text>
              <Text style={[styles.homeTitle, { color: theme.text }]}>WAVE Browser</Text>
              <Text style={[styles.homeSub, { color: theme.sub }]}>
                Search or enter a URL · Tap a media site to grab content
              </Text>

              <Text style={[styles.sectionLabel, { color: theme.sub }]}>Quick Links</Text>
              <FlatList
                data={BROWSER_QUICK_LINKS}
                renderItem={renderQuickLink}
                keyExtractor={i => i.url}
                numColumns={4}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
              />

              {history.length > 0 && (
                <>
                  <View style={styles.sectionRow}>
                    <Text style={[styles.sectionLabel, { color: theme.sub, marginBottom: 0 }]}>🕒 Recent</Text>
                    <TouchableOpacity onPress={() => setShowHistory(true)}>
                      <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
                    </TouchableOpacity>
                  </View>
                  {history.slice(0, 5).map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.histItem, { borderBottomColor: `${theme.border}50` }]}
                      onPress={() => navigate(h.url)}
                    >
                      <Ionicons name="time" size={14} color={theme.sub} />
                      <Text style={[styles.histTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>{h.url}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
          keyExtractor={() => 'home'}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        />
      ) : (
        /* WebView */
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={{ flex: 1, backgroundColor: theme.bg }}
          onNavigationStateChange={handleNavigationChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={handleLoadProgress}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          onError={() => showToast('Failed to load page', 'error')}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 400) showToast(`HTTP ${nativeEvent.statusCode}`, 'error');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  browBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1,
  },
  navBtn: { padding: 8 },
  navBtnDisabled: { opacity: 0.3 },
  urlInput: {
    flex: 1, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 8, fontSize: 12,
  },
  goBtn: { padding: 8, borderRadius: 16, marginLeft: 2 },
  progBar: { height: 2 },
  progFill: { height: 2 },
  actionBar: {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 2 },
  actionText: { fontSize: 9, fontWeight: '600' },
  panel: {
    position: 'absolute', left: 0, right: 0, top: 100,
    borderBottomWidth: 1, zIndex: 10, maxHeight: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 8,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  panelTitle: { fontSize: 14, fontWeight: '700' },
  emptyPanel: { padding: 20, textAlign: 'center', fontSize: 13 },
  homeContent: { flex: 1 },
  homeTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  homeSub: { fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  sectionLabel: { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700', marginBottom: 10, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  seeAll: { fontSize: 12, fontWeight: '600' },
  quickLink: {
    flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1,
  },
  quickLinkIcon: { fontSize: 22, marginBottom: 4 },
  quickLinkName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  histItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  histTitle: { fontSize: 13, fontWeight: '600' },
  histUrl: { fontSize: 11, marginTop: 1 },
});
