import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Image, Animated, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useApp } from '../context/AppContext';
import { sanitizeFilename, formatBytes } from '../utils/downloader';
import { QUALITY_OPTIONS, FORMAT_OPTIONS } from '../constants';

export default function DownloadScreen({ navigation, route }) {
  const { theme, settings, addToLibrary, showToast, haptic } = useApp();
  const insets = useSafeAreaInsets();
  const API_URL = settings.customServer || 'https://wave-backened-production.up.railway.app';

  const [url, setUrl] = useState(route?.params?.prefillUrl || '');
  const [fetching, setFetching] = useState(false);
  const [info, setInfo] = useState(null);
  const [quality, setQuality] = useState(settings.defaultQuality || '720p');
  const [format, setFormat] = useState(settings.defaultFormat || 'mp4');
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlSpeed, setDlSpeed] = useState('');
  const [dlStatus, setDlStatus] = useState('');
  const [batchVisible, setBatchVisible] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [batchQueue, setBatchQueue] = useState([]);
  const [subPanelVisible, setSubPanelVisible] = useState(false);
  const [subQuery, setSubQuery] = useState('');
  const [subResults, setSubResults] = useState([]);
  const progAnim = useRef(new Animated.Value(0)).current;
  const downloadResumableRef = useRef(null);

  // Auto-fetch if URL was passed from Browser screen
  React.useEffect(() => {
    if (route?.params?.prefillUrl) {
      const u = route.params.prefillUrl;
      setUrl(u);
      setTimeout(() => fetchInfo(u), 300);
    }
  }, [route?.params?.prefillUrl]);

  const fetchInfo = useCallback(async (inputUrl) => {
    const u = (inputUrl || url).trim();
    if (!u.startsWith('http')) { showToast('Enter a valid URL', 'error'); return; }
    setFetching(true);
    setInfo(null);
    try {
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${API_URL}/info?url=${encodeURIComponent(u)}`, { signal: ctrl.signal });
      clearTimeout(tm);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      setInfo(data);
      setSubQuery(data.title || '');
      haptic('medium');
    } catch (e) {
      showToast(e.name === 'AbortError' ? 'Request timed out' : 'Failed to fetch info', 'error');
    } finally { setFetching(false); }
  }, [url, API_URL]);

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text?.startsWith('http')) {
      setUrl(text);
      setTimeout(() => fetchInfo(text), 100);
      haptic('light');
    } else {
      showToast('No URL in clipboard', '');
    }
  };

  // ── REAL IN-APP DOWNLOAD — no browser redirect ──
  const startDownload = useCallback(async () => {
    const u = url.trim();
    if (!u.startsWith('http')) { showToast('Enter a valid URL', 'error'); return; }
    if (downloading) return;

    // Request storage permission first
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      showToast('Storage permission required', 'error');
      return;
    }

    haptic('medium');
    setDownloading(true);
    setDlProgress(0);
    setDlStatus('');

    const title = info?.title || 'WAVE Download';
    const filename = sanitizeFilename(`${title}.${format}`);
    const qualityNum = quality.replace('p','').replace('kbps','');
    const params = new URLSearchParams({ url: u, quality: qualityNum, format });
    const dlUrl = `${API_URL}/download/start?${params}`;
    const destUri = FileSystem.documentDirectory + filename;

    // Show download notification
    let notifId;
    try {
      notifId = await Notifications.scheduleNotificationAsync({
        content: { title: '⬇️ Downloading', body: filename },
        trigger: null,
      });
    } catch (e) {}

    // Animate fake progress until real progress kicks in
    let fakeP = 0;
    const fakeIv = setInterval(() => {
      fakeP += Math.random() * 5 + 1;
      if (fakeP < 85) {
        setDlProgress(Math.round(fakeP));
        Animated.timing(progAnim, { toValue: fakeP / 100, duration: 300, useNativeDriver: false }).start();
        const speeds = ['1.2 MB/s','2.4 MB/s','3.1 MB/s','1.8 MB/s'];
        setDlSpeed(speeds[Math.floor(Math.random() * speeds.length)]);
      }
    }, 500);

    try {
      // Use FileSystem.createDownloadResumable for real in-app downloading
      const downloadResumable = FileSystem.createDownloadResumable(
        dlUrl,
        destUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            clearInterval(fakeIv);
            const pct = Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100);
            setDlProgress(pct);
            setDlSpeed(`${formatBytes(totalBytesWritten)} / ${formatBytes(totalBytesExpectedToWrite)}`);
            Animated.timing(progAnim, { toValue: pct / 100, duration: 150, useNativeDriver: false }).start();
          }
        }
      );
      downloadResumableRef.current = downloadResumable;

      const result = await downloadResumable.downloadAsync();
      clearInterval(fakeIv);

      if (!result?.uri) throw new Error('Download failed — no file received');

      // Save to phone's media library (WAVE Downloads album)
      const asset = await MediaLibrary.createAssetAsync(result.uri);
      const album = await MediaLibrary.getAlbumAsync('WAVE Downloads');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('WAVE Downloads', asset, false);
      }

      // File info
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      const fileSize = fileInfo.size || 0;

      // Done notification
      try {
        if (notifId) await Notifications.dismissNotificationAsync(notifId);
        await Notifications.scheduleNotificationAsync({
          content: { title: '✅ Download Complete', body: filename },
          trigger: null,
        });
      } catch (e) {}

      setDlProgress(100);
      setDlStatus('✅ Saved to WAVE Downloads!');
      setDlSpeed('');
      Animated.timing(progAnim, { toValue: 1, duration: 100, useNativeDriver: false }).start();
      haptic('heavy');

      // Add to library
      if (settings.autoAddToLibrary !== false) {
        const item = {
          id: Date.now(),
          title,
          artist: info?.uploader || info?.channel || '',
          thumbnail: info?.thumbnail || '',
          url: u,
          localUri: result.uri,   // ← actual path on phone storage
          assetUri: asset.uri,    // ← media library URI
          format,
          quality,
          duration: info?.duration || 0,
          size: fileSize,
          date: new Date().toLocaleDateString(),
          fav: false,
          rating: 0,
          type: ['mp3','flac','ogg','m4a','aac','opus','wav'].includes(format) ? 'audio' : 'video',
          playCount: 0,
          lastPlayed: null,
          site: info?.extractor || '',
        };
        await addToLibrary(item);
      }

      showToast(`✅ Saved: ${filename}`, 'success');
      setTimeout(() => { setDlProgress(0); setDlStatus(''); progAnim.setValue(0); }, 5000);

    } catch (e) {
      clearInterval(fakeIv);
      if (notifId) Notifications.dismissNotificationAsync(notifId).catch(() => {});
      showToast(e.message || 'Download failed', 'error');
      setDlProgress(0);
      progAnim.setValue(0);
    } finally {
      setDownloading(false);
      downloadResumableRef.current = null;
    }
  }, [url, info, format, quality, API_URL, settings]);

  const cancelDownload = async () => {
    try {
      await downloadResumableRef.current?.pauseAsync();
    } catch (e) {}
    setDownloading(false);
    setDlProgress(0);
    progAnim.setValue(0);
    showToast('Download cancelled', '');
  };

  // Batch — also fully in-app, no browser
  const startBatch = async () => {
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) { showToast('Enter at least one URL', 'error'); return; }
    setBatchVisible(false);
    const queue = urls.map(u => ({ url: u, status: 'queued', progress: 0 }));
    setBatchQueue(queue);
    showToast(`Starting ${urls.length} downloads...`, '');

    for (let i = 0; i < urls.length; i++) {
      setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'downloading' } : q));
      try {
        setUrl(urls[i]);
        await fetchInfo(urls[i]);
        await startDownload();
        setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done', progress: 100 } : q));
      } catch (e) {
        setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error' } : q));
      }
    }
    showToast(`✅ Batch complete!`, 'success');
  };

  const fetchSubs = async () => {
    if (!subQuery.trim()) return;
    try {
      const res = await fetch(`https://rest.opensubtitles.org/search/query-${encodeURIComponent(subQuery)}/sublanguageid-eng`, {
        headers: { 'X-User-Agent': 'WAVE v2.0' }
      });
      const data = await res.json();
      setSubResults(data.slice(0, 5));
    } catch (e) { showToast('Could not find subtitles', 'error'); }
  };

  const progressWidth = progAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: `${theme.bg}f0`, borderBottomColor: `${theme.border}80` }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Download</Text>
          <Text style={[styles.headerSub, { color: theme.sub }]}>Saves directly to phone storage</Text>
        </View>
        <TouchableOpacity onPress={() => setBatchVisible(true)} style={[styles.headerBtn, { borderColor: theme.border }]}>
          <Ionicons name="list" size={20} color={theme.sub} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        {/* URL bar */}
        <View style={styles.urlBar}>
          <TextInput
            style={[styles.urlInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://youtube.com/watch?v=..."
            placeholderTextColor={theme.sub}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={() => fetchInfo()}
          />
          <TouchableOpacity onPress={pasteFromClipboard} style={[styles.pasteBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="clipboard" size={18} color={theme.sub} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => fetchInfo()} style={[styles.searchBtn, { backgroundColor: theme.primary }]}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Fetching spinner */}
        {fetching && (
          <View style={styles.spinWrap}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
            <Text style={[styles.spinText, { color: theme.sub }]}>Fetching info...</Text>
          </View>
        )}

        {/* Info card */}
        {info && !fetching && (
          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {info.thumbnail && (
              <Image source={{ uri: info.thumbnail }} style={styles.infoThumb} resizeMode="cover" />
            )}
            <View style={styles.infoBadgeRow}>
              <View style={[styles.siteBadge, { backgroundColor: `${theme.primary}20`, borderColor: `${theme.primary}50` }]}>
                <Text style={[styles.siteText, { color: theme.primary }]}>{info.extractor || 'Web'}</Text>
              </View>
              {info.duration > 0 && (
                <Text style={[styles.duration, { color: theme.sub }]}>
                  {Math.floor(info.duration / 60)}:{String(info.duration % 60).padStart(2,'0')}
                </Text>
              )}
            </View>
            <Text style={[styles.infoTitle, { color: theme.text }]}>{info.title}</Text>
            <Text style={[styles.infoUploader, { color: theme.sub }]}>{info.uploader || info.channel || ''}</Text>

            {/* Quality */}
            <Text style={[styles.optLabel, { color: theme.sub }]}>Quality</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {QUALITY_OPTIONS.map(q => (
                <TouchableOpacity
                  key={q}
                  style={[styles.optBtn, { borderColor: theme.border, backgroundColor: theme.bg2 },
                    quality === q && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}
                  onPress={() => { setQuality(q); haptic('light'); }}
                >
                  <Text style={[styles.optBtnText, { color: quality === q ? '#fff' : theme.sub }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Format */}
            <Text style={[styles.optLabel, { color: theme.sub }]}>Format</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FORMAT_OPTIONS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.optBtn, { borderColor: theme.border, backgroundColor: theme.bg2 },
                    format === f && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}
                  onPress={() => { setFormat(f); haptic('light'); }}
                >
                  <Text style={[styles.optBtnText, { color: format === f ? '#fff' : theme.sub }]}>{f.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Subtitles */}
            <View style={styles.subRow}>
              <Text style={[styles.optLabel, { color: theme.sub, marginBottom: 0 }]}>Subtitles</Text>
              <TouchableOpacity onPress={() => setSubPanelVisible(!subPanelVisible)} style={[styles.subSearchBtn, { borderColor: theme.border }]}>
                <Text style={[{ color: theme.primary, fontSize: 11, fontWeight: '700' }]}>Search</Text>
              </TouchableOpacity>
            </View>
            {subPanelVisible && (
              <View style={[styles.subPanel, { backgroundColor: theme.bg2, borderColor: theme.border }]}>
                <View style={styles.subInputRow}>
                  <TextInput
                    style={[styles.subInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    value={subQuery}
                    onChangeText={setSubQuery}
                    placeholder="Movie/show title..."
                    placeholderTextColor={theme.sub}
                  />
                  <TouchableOpacity onPress={fetchSubs} style={[styles.subBtn, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Find</Text>
                  </TouchableOpacity>
                </View>
                {subResults.map((sub, i) => (
                  <TouchableOpacity key={i} style={[styles.subResult, { borderBottomColor: theme.border }]}>
                    <Text style={[{ fontSize: 13, fontWeight: '600', color: theme.text }]} numberOfLines={1}>{sub.MovieName}</Text>
                    <Text style={[{ fontSize: 11, color: theme.sub }]}>{sub.LanguageName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Download button */}
            <View style={styles.dlBtnRow}>
              <TouchableOpacity
                style={[styles.dlBtn, { backgroundColor: theme.primary }, downloading && { opacity: 0.6 }]}
                onPress={startDownload}
                disabled={downloading}
              >
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.dlBtnText}>
                  {downloading ? 'SAVING TO PHONE...' : 'DOWNLOAD TO PHONE'}
                </Text>
              </TouchableOpacity>
              {downloading && (
                <TouchableOpacity onPress={cancelDownload} style={[styles.cancelDlBtn, { borderColor: theme.danger }]}>
                  <Ionicons name="close" size={18} color={theme.danger} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.saveNote, { color: theme.sub }]}>
              💾 Saves to: Phone Storage → WAVE Downloads
            </Text>
          </View>
        )}

        {/* Progress */}
        {(downloading || dlStatus !== '') && (
          <View style={[styles.progressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.progTitle, { color: theme.text }]} numberOfLines={1}>
              {info?.title || 'Downloading...'}
            </Text>
            <View style={[styles.progBarWrap, { backgroundColor: theme.border }]}>
              <Animated.View style={[styles.progBarFill, { width: progressWidth, backgroundColor: theme.primary }]} />
            </View>
            <View style={styles.progInfoRow}>
              <Text style={[styles.progPct, { color: theme.primary }]}>{dlProgress}%</Text>
              <Text style={[styles.progSpeed, { color: theme.sub }]}>{dlSpeed}</Text>
            </View>
            {dlStatus !== '' && (
              <Text style={[styles.progStatus, { color: '#00e676' }]}>{dlStatus}</Text>
            )}
          </View>
        )}

        {/* Batch queue */}
        {batchQueue.length > 0 && (
          <View style={{ paddingHorizontal: 14, gap: 8 }}>
            <Text style={[styles.optLabel, { color: theme.sub }]}>Batch Queue</Text>
            {batchQueue.map((q, i) => (
              <View key={i} style={[styles.batchItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.batchItemTitle, { color: theme.text }]} numberOfLines={1}>{q.url.slice(0, 45)}...</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: q.status === 'done' ? '#00e676' : q.status === 'error' ? theme.danger : theme.sub }}>
                  {q.status}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Batch modal */}
      <Modal visible={batchVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>📋 Batch Download</Text>
            <Text style={[styles.modalDesc, { color: theme.sub }]}>One URL per line — all saved to phone</Text>
            <TextInput
              style={[styles.batchTextarea, { backgroundColor: theme.bg2, borderColor: theme.border, color: theme.text }]}
              value={batchUrls}
              onChangeText={setBatchUrls}
              placeholder={'https://youtube.com/watch?v=...\nhttps://soundcloud.com/...'}
              placeholderTextColor={theme.sub}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <TouchableOpacity style={[styles.dlBtn, { backgroundColor: theme.primary, marginTop: 12 }]} onPress={startBatch}>
              <Text style={styles.dlBtnText}>DOWNLOAD ALL TO PHONE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setBatchVisible(false)}>
              <Text style={[{ color: theme.sub, fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 2 },
  headerBtn: { padding: 8, borderRadius: 10, borderWidth: 1 },
  urlBar: { flexDirection: 'row', gap: 8, padding: 14 },
  urlInput: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  pasteBtn: { padding: 13, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center' },
  searchBtn: { padding: 13, borderRadius: 14, justifyContent: 'center' },
  spinWrap: { alignItems: 'center', paddingVertical: 28 },
  spinText: { fontSize: 13 },
  infoCard: { marginHorizontal: 14, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  infoThumb: { width: '100%', height: 170, borderRadius: 10, marginBottom: 12 },
  infoBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  siteBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  siteText: { fontSize: 11, letterSpacing: 1, fontWeight: '600' },
  duration: { fontSize: 12 },
  infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  infoUploader: { fontSize: 13, marginBottom: 6 },
  optLabel: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 14, fontWeight: '700' },
  optBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, marginRight: 8 },
  optBtnText: { fontSize: 12, fontWeight: '600' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  subSearchBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1 },
  subPanel: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  subInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  subInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  subBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' },
  subResult: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 },
  dlBtnRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  dlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  dlBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  cancelDlBtn: { padding: 16, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center' },
  saveNote: { fontSize: 11, textAlign: 'center', marginTop: 10 },
  progressCard: { marginHorizontal: 14, borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 12 },
  progTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  progBarWrap: { height: 6, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  progBarFill: { height: 6, borderRadius: 6 },
  progInfoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progPct: { fontSize: 13, fontWeight: '700' },
  progSpeed: { fontSize: 11 },
  progStatus: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  batchItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
  batchItemTitle: { fontSize: 13, flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalDesc: { fontSize: 13, marginBottom: 14 },
  batchTextarea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, minHeight: 120 },
  cancelBtn: { borderWidth: 1.5, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10 },
});
