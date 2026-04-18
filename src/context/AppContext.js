import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { THEMES } from '../constants';

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function AppProvider({ children }) {
  // ── SETTINGS ──
  const [settings, setSettings] = useState({
    theme: 'default',
    fontSize: 'normal',
    defaultQuality: '720p',
    defaultFormat: 'mp4',
    downloadNotifications: true,
    hapticFeedback: true,
    autoAddToLibrary: true,
    backgroundAnimations: true,
    eqPreset: 'flat',
    crossfade: false,
    gapless: true,
    normalization: false,
    customServer: 'https://wave-backened-production.up.railway.app',
  });

  // ── PROFILE ──
  const [profile, setProfile] = useState({ name: 'WAVE User', picture: null });

  // ── LIBRARY ──
  const [library, setLibrary] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [downloadHistory, setDownloadHistory] = useState([]);

  // ── PLAYER ──
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // off, one, all
  const [sleepTimer, setSleepTimer] = useState(null);
  const sleepTimerRef = useRef(null);

  // ── TOAST ──
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const toastTimer = useRef(null);

  // ── THEME ──
  const theme = THEMES[settings.theme] || THEMES.default;

  // ── LOAD SAVED DATA ──
  useEffect(() => {
    loadAll();
    requestNotifPermission();
  }, []);

  async function loadAll() {
    try {
      const [
        savedSettings, savedProfile, savedLib, savedPlaylists,
        savedBookmarks, savedSearchHist, savedChatHist, savedDlHist
      ] = await Promise.all([
        AsyncStorage.getItem('wave_settings'),
        AsyncStorage.getItem('wave_profile'),
        AsyncStorage.getItem('wave_library'),
        AsyncStorage.getItem('wave_playlists'),
        AsyncStorage.getItem('wave_bookmarks'),
        AsyncStorage.getItem('wave_search_hist'),
        AsyncStorage.getItem('wave_chat_hist'),
        AsyncStorage.getItem('wave_dl_hist'),
      ]);
      if (savedSettings)   setSettings(s => ({ ...s, ...JSON.parse(savedSettings) }));
      if (savedProfile)    setProfile(JSON.parse(savedProfile));
      if (savedLib)        setLibrary(JSON.parse(savedLib));
      if (savedPlaylists)  setPlaylists(JSON.parse(savedPlaylists));
      if (savedBookmarks)  setBookmarks(JSON.parse(savedBookmarks));
      if (savedSearchHist) setSearchHistory(JSON.parse(savedSearchHist));
      if (savedChatHist)   setChatHistory(JSON.parse(savedChatHist));
      if (savedDlHist)     setDownloadHistory(JSON.parse(savedDlHist));
    } catch (e) { console.log('Load error:', e); }
  }

  async function requestNotifPermission() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('Notif permission:', status);
    } catch (e) {}
  }

  // ── SAVE HELPERS ──
  const saveSettings = useCallback(async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    await AsyncStorage.setItem('wave_settings', JSON.stringify(merged));
  }, [settings]);

  const saveProfile = useCallback(async (newProfile) => {
    const merged = { ...profile, ...newProfile };
    setProfile(merged);
    await AsyncStorage.setItem('wave_profile', JSON.stringify(merged));
  }, [profile]);

  const saveLibrary = useCallback(async (newLib) => {
    setLibrary(newLib);
    await AsyncStorage.setItem('wave_library', JSON.stringify(newLib));
  }, []);

  const savePlaylists = useCallback(async (newPl) => {
    setPlaylists(newPl);
    await AsyncStorage.setItem('wave_playlists', JSON.stringify(newPl));
  }, []);

  const saveBookmarks = useCallback(async (newBm) => {
    setBookmarks(newBm);
    await AsyncStorage.setItem('wave_bookmarks', JSON.stringify(newBm));
  }, []);

  const saveSearchHistory = useCallback(async (newHist) => {
    const trimmed = newHist.slice(0, 20);
    setSearchHistory(trimmed);
    await AsyncStorage.setItem('wave_search_hist', JSON.stringify(trimmed));
  }, []);

  const saveChatHistory = useCallback(async (newHist) => {
    setChatHistory(newHist);
    await AsyncStorage.setItem('wave_chat_hist', JSON.stringify(newHist));
  }, []);

  // ── LIBRARY CRUD ──
  const addToLibrary = useCallback(async (item) => {
    const newLib = [item, ...library.filter(i => i.id !== item.id)];
    await saveLibrary(newLib);
  }, [library, saveLibrary]);

  const removeFromLibrary = useCallback(async (id) => {
    const newLib = library.filter(i => i.id !== id);
    await saveLibrary(newLib);
  }, [library, saveLibrary]);

  const toggleFavorite = useCallback(async (id) => {
    const newLib = library.map(i => i.id === id ? { ...i, fav: !i.fav } : i);
    await saveLibrary(newLib);
  }, [library, saveLibrary]);

  const renameItem = useCallback(async (id, newTitle) => {
    const newLib = library.map(i => i.id === id ? { ...i, title: newTitle } : i);
    await saveLibrary(newLib);
  }, [library, saveLibrary]);

  const updatePlayCount = useCallback(async (id) => {
    const newLib = library.map(i => i.id === id
      ? { ...i, playCount: (i.playCount || 0) + 1, lastPlayed: new Date().toISOString() }
      : i
    );
    await saveLibrary(newLib);
  }, [library, saveLibrary]);

  // ── PLAYLISTS ──
  const createPlaylist = useCallback(async (name) => {
    const newPl = [...playlists, { id: Date.now(), name, items: [], created: new Date().toISOString() }];
    await savePlaylists(newPl);
    showToast(`Playlist "${name}" created 🎵`, 'success');
  }, [playlists, savePlaylists]);

  const addToPlaylist = useCallback(async (playlistId, trackId) => {
    const newPl = playlists.map(pl => {
      if (pl.id !== playlistId) return pl;
      if (pl.items.includes(trackId)) return pl;
      return { ...pl, items: [...pl.items, trackId] };
    });
    await savePlaylists(newPl);
    showToast('Added to playlist ✅', 'success');
  }, [playlists, savePlaylists]);

  const removeFromPlaylist = useCallback(async (playlistId, trackId) => {
    const newPl = playlists.map(pl =>
      pl.id === playlistId ? { ...pl, items: pl.items.filter(id => id !== trackId) } : pl
    );
    await savePlaylists(newPl);
  }, [playlists, savePlaylists]);

  const deletePlaylist = useCallback(async (playlistId) => {
    const newPl = playlists.filter(pl => pl.id !== playlistId);
    await savePlaylists(newPl);
  }, [playlists, savePlaylists]);

  // ── BOOKMARKS ──
  const addBookmark = useCallback(async (bookmark) => {
    const newBm = [{ id: Date.now(), ...bookmark }, ...bookmarks.filter(b => b.url !== bookmark.url)];
    await saveBookmarks(newBm);
    showToast('Bookmarked! 🔖', 'success');
  }, [bookmarks, saveBookmarks]);

  const removeBookmark = useCallback(async (id) => {
    const newBm = bookmarks.filter(b => b.id !== id);
    await saveBookmarks(newBm);
  }, [bookmarks, saveBookmarks]);

  // ── SEARCH HISTORY ──
  const addSearchHistory = useCallback(async (query) => {
    if (!query.trim()) return;
    const newHist = [query, ...searchHistory.filter(h => h !== query)];
    await saveSearchHistory(newHist);
  }, [searchHistory, saveSearchHistory]);

  // ── PLAYER ──
  const playTrack = useCallback((track, newQueue = null, idx = 0) => {
    if (newQueue) {
      setQueue(newQueue);
      setQueueIndex(idx);
    }
    setCurrentTrack(track);
    setIsPlaying(true);
    updatePlayCount(track.id);
    haptic('light');
  }, [updatePlayCount]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeat === 'all') nextIdx = 0;
        else { setIsPlaying(false); return; }
      }
    }
    setQueueIndex(nextIdx);
    setCurrentTrack(queue[nextIdx]);
    updatePlayCount(queue[nextIdx].id);
  }, [queue, queueIndex, shuffle, repeat, updatePlayCount]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    const prevIdx = Math.max(0, queueIndex - 1);
    setQueueIndex(prevIdx);
    setCurrentTrack(queue[prevIdx]);
  }, [queue, queueIndex]);

  // ── SLEEP TIMER ──
  const startSleepTimer = useCallback((minutes) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (minutes === 0) { setSleepTimer(null); showToast('Sleep timer off', ''); return; }
    setSleepTimer(minutes);
    sleepTimerRef.current = setTimeout(() => {
      setIsPlaying(false);
      setSleepTimer(null);
      showToast('Sleep timer: playback stopped 😴', '');
    }, minutes * 60 * 1000);
    showToast(`Sleep timer: ${minutes} min ⏰`, 'success');
  }, []);

  // ── TOAST ──
  const showToast = useCallback((message, type = '') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
  }, []);

  // ── HAPTIC ──
  const haptic = useCallback((style = 'light') => {
    if (!settings.hapticFeedback) return;
    try {
      if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  }, [settings.hapticFeedback]);

  // ── STATS ──
  const stats = {
    downloads: downloadHistory.length,
    library: library.length,
    favorites: library.filter(i => i.fav).length,
    totalSize: library.reduce((sum, i) => sum + (i.size || 0), 0),
  };

  return (
    <AppContext.Provider value={{
      // theme
      theme, settings, saveSettings,
      // profile
      profile, saveProfile,
      // library
      library, addToLibrary, removeFromLibrary, toggleFavorite, renameItem, updatePlayCount,
      // playlists
      playlists, createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist,
      // bookmarks
      bookmarks, addBookmark, removeBookmark,
      // search history
      searchHistory, addSearchHistory, saveSearchHistory,
      // chat
      chatHistory, saveChatHistory,
      // downloads
      downloadHistory, setDownloadHistory,
      // player
      currentTrack, setCurrentTrack,
      queue, setQueue,
      queueIndex, setQueueIndex,
      isPlaying, setIsPlaying,
      shuffle, setShuffle,
      repeat, setRepeat,
      playTrack, playNext, playPrev,
      sleepTimer, startSleepTimer,
      // ui
      toast, showToast,
      haptic,
      stats,
    }}>
      {children}
    </AppContext.Provider>
  );
}
