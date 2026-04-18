import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Animated, Dimensions, Modal, ScrollView, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import TrackPlayer, {
  useProgress, usePlaybackState, State, RepeatMode, Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { useApp } from '../context/AppContext';
import { EQ_PRESETS } from '../constants';
import { formatDuration } from '../utils/downloader';
import BackgroundAnimation from '../components/BackgroundAnimation';

const { width: W, height: H } = Dimensions.get('window');

export default function PlayerScreen({ navigation, route }) {
  const {
    theme, currentTrack, setCurrentTrack, isPlaying, setIsPlaying,
    queue, shuffle, setShuffle, repeat, setRepeat,
    playNext, playPrev, sleepTimer, startSleepTimer,
    library, playTrack, showToast, haptic, settings, toggleFavorite,
  } = useApp();

  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const playbackState = usePlaybackState();

  const [eqVisible, setEqVisible] = useState(false);
  const [sleepVisible, setSleepVisible] = useState(false);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const [eqPreset, setEqPreset] = useState(settings.eqPreset || 'flat');
  const [volume, setVolume] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);

  const artRotate = useRef(new Animated.Value(0)).current;
  const artScale = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateLoop = useRef(null);

  const track = route?.params?.track || currentTrack;
  const isFav = library.find(i => i.id === track?.id)?.fav || false;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (track) {
      initTrackPlayer(track);
    }
  }, [track?.id]);

  // Rotate album art when playing
  useEffect(() => {
    const playing = playbackState.state === State.Playing || isPlaying;
    if (playing) {
      rotateLoop.current = Animated.loop(
        Animated.timing(artRotate, { toValue: 1, duration: 12000, useNativeDriver: true })
      );
      rotateLoop.current.start();
      Animated.spring(artScale, { toValue: 1, useNativeDriver: true }).start();
    } else {
      rotateLoop.current?.stop();
      Animated.spring(artScale, { toValue: 0.95, useNativeDriver: true }).start();
    }
  }, [playbackState.state, isPlaying]);

  const initTrackPlayer = async (t) => {
    try {
      await TrackPlayer.setupPlayer({ maxCacheSize: 1024 * 50 });
      await TrackPlayer.updateOptions({
        capabilities: [
          TrackPlayer.CAPABILITY_PLAY, TrackPlayer.CAPABILITY_PAUSE,
          TrackPlayer.CAPABILITY_SKIP_TO_NEXT, TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
          TrackPlayer.CAPABILITY_SEEK_TO, TrackPlayer.CAPABILITY_STOP,
        ],
        compactCapabilities: [
          TrackPlayer.CAPABILITY_PLAY, TrackPlayer.CAPABILITY_PAUSE,
          TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
        ],
        notificationCapabilities: [
          TrackPlayer.CAPABILITY_PLAY, TrackPlayer.CAPABILITY_PAUSE,
          TrackPlayer.CAPABILITY_SKIP_TO_NEXT, TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
        ],
        stopWithApp: false,
      });

      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: t.id?.toString(),
        url: t.localUri || t.url,
        title: t.title || 'Unknown',
        artist: t.artist || 'WAVE',
        artwork: t.thumbnail || undefined,
        duration: t.duration || 0,
      });
      await TrackPlayer.play();
      setIsPlaying(true);
    } catch (e) {
      // Player might already be set up
      try {
        const current = await TrackPlayer.getActiveTrack();
        if (!current || current.id !== t.id?.toString()) {
          await TrackPlayer.reset();
          await TrackPlayer.add({
            id: t.id?.toString(),
            url: t.localUri || t.url,
            title: t.title || 'Unknown',
            artist: t.artist || 'WAVE',
            artwork: t.thumbnail || undefined,
          });
          await TrackPlayer.play();
          setIsPlaying(true);
        }
      } catch (e2) {}
    }
  };

  const togglePlay = async () => {
    haptic('light');
    try {
      if (playbackState.state === State.Playing || isPlaying) {
        await TrackPlayer.pause();
        setIsPlaying(false);
      } else {
        await TrackPlayer.play();
        setIsPlaying(true);
      }
    } catch (e) {
      setIsPlaying(!isPlaying);
    }
  };

  const seek = async (value) => {
    try {
      await TrackPlayer.seekTo(value * (progress.duration || track?.duration || 0));
    } catch (e) {}
  };

  const handleNext = () => { haptic('medium'); playNext(); };
  const handlePrev = () => { haptic('medium'); playPrev(); };

  const cycleRepeat = () => {
    haptic('light');
    const modes = ['off', 'one', 'all'];
    const next = modes[(modes.indexOf(repeat) + 1) % modes.length];
    setRepeat(next);
    try {
      if (next === 'one') TrackPlayer.setRepeatMode(RepeatMode.Track);
      else if (next === 'all') TrackPlayer.setRepeatMode(RepeatMode.Queue);
      else TrackPlayer.setRepeatMode(RepeatMode.Off);
    } catch (e) {}
    showToast(`Repeat: ${next}`, '');
  };

  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    try { await TrackPlayer.setRate(newSpeed); } catch (e) {}
    haptic('light');
  };

  const rotation = artRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const playingState = playbackState.state === State.Playing || isPlaying;
  const dur = progress.duration || track?.duration || 0;
  const pos = progress.position || 0;
  const progressPct = dur > 0 ? pos / dur : 0;

  // Swipe down to close
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) navigation.goBack();
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]} {...panResponder.panHandlers}>
      <BackgroundAnimation theme={theme} intensity="full" />

      {/* Blurred artwork background */}
      {track?.thumbnail && (
        <Image source={{ uri: track.thumbnail }} style={styles.bgArt} blurRadius={40} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.bg}cc` }]} />

      <Animated.View style={[styles.inner, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={24} color={theme.sub} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.nowPlaying, { color: theme.sub }]}>NOW PLAYING</Text>
            <Text style={[styles.queueInfo, { color: theme.sub }]}>
              {queue.length > 0 ? `${(queue.indexOf(track) + 1 || 1)} / ${queue.length}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setQueueVisible(true)} style={styles.headerBtn}>
            <Ionicons name="list" size={22} color={theme.sub} />
          </TouchableOpacity>
        </View>

        {/* Album Art */}
        <View style={styles.artContainer}>
          <Animated.View style={[styles.artWrap, {
            transform: [{ rotate: rotation }, { scale: artScale }],
            borderColor: `${theme.primary}40`,
          }]}>
            {track?.thumbnail ? (
              <Image source={{ uri: track.thumbnail }} style={styles.art} />
            ) : (
              <LinearGradient colors={[theme.primary, theme.primary2, theme.accent]} style={styles.art}>
                <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            )}
            {/* Vinyl hole */}
            <View style={[styles.vinylHole, { backgroundColor: theme.bg2, borderColor: theme.border }]} />
          </Animated.View>

          {/* Playing rings */}
          {playingState && [1, 2, 3].map(i => (
            <Animated.View
              key={i}
              style={[styles.ring, {
                width: 220 + i * 30,
                height: 220 + i * 30,
                borderColor: `${theme.primary}${Math.round(20 / i).toString(16).padStart(2, '0')}`,
              }]}
            />
          ))}
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trackTitle, { color: theme.text }]} numberOfLines={1}>
              {track?.title || 'Unknown'}
            </Text>
            <Text style={[styles.trackArtist, { color: theme.sub }]} numberOfLines={1}>
              {track?.artist || track?.site || 'WAVE'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { toggleFavorite(track?.id); haptic('medium'); }}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={isFav ? '#ff6d9d' : theme.sub} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <TouchableOpacity
            style={styles.progressBarWrap}
            onPress={(e) => seek(e.nativeEvent.locationX / (W - 48))}
            activeOpacity={1}
          >
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { width: `${progressPct * 100}%`, backgroundColor: theme.primary }]} />
              <View style={[styles.progressThumb, { left: `${progressPct * 100}%`, backgroundColor: theme.primary }]} />
            </View>
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: theme.sub }]}>{formatDuration(pos)}</Text>
            <Text style={[styles.timeText, { color: theme.sub }]}>{formatDuration(dur)}</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => { setShuffle(!shuffle); haptic('light'); showToast(shuffle ? 'Shuffle off' : 'Shuffle on 🔀', ''); }}>
            <Ionicons name="shuffle" size={22} color={shuffle ? theme.primary : theme.sub} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePrev} style={styles.skipBtn}>
            <Ionicons name="play-skip-back" size={28} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlay}
            style={[styles.playBtn, { shadowColor: theme.primary }]}
          >
            <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.playBtnInner}>
              <Ionicons name={playingState ? 'pause' : 'play'} size={32} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNext} style={styles.skipBtn}>
            <Ionicons name="play-skip-forward" size={28} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity onPress={cycleRepeat}>
            <Ionicons
              name={repeat === 'one' ? 'repeat-outline' : 'repeat'}
              size={22}
              color={repeat !== 'off' ? theme.primary : theme.sub}
            />
            {repeat === 'one' && (
              <Text style={[styles.repeatOne, { color: theme.primary }]}>1</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Extra Controls */}
        <View style={styles.extraControls}>
          <TouchableOpacity style={styles.extraBtn} onPress={() => setEqVisible(true)}>
            <Ionicons name="options" size={20} color={theme.sub} />
            <Text style={[styles.extraLabel, { color: theme.sub }]}>EQ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.extraBtn} onPress={() => setLyricsVisible(true)}>
            <Ionicons name="text" size={20} color={theme.sub} />
            <Text style={[styles.extraLabel, { color: theme.sub }]}>Lyrics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.extraBtn} onPress={() => setSleepVisible(true)}>
            <Ionicons name="moon" size={20} color={sleepTimer ? theme.accent : theme.sub} />
            <Text style={[styles.extraLabel, { color: sleepTimer ? theme.accent : theme.sub }]}>
              {sleepTimer ? `${sleepTimer}m` : 'Sleep'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.extraBtn} onPress={() => handleSpeedChange(speed === 1.0 ? 1.5 : speed === 1.5 ? 2.0 : speed === 2.0 ? 0.5 : 1.0)}>
            <Ionicons name="speedometer" size={20} color={speed !== 1.0 ? theme.primary : theme.sub} />
            <Text style={[styles.extraLabel, { color: speed !== 1.0 ? theme.primary : theme.sub }]}>{speed}x</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* EQ Modal */}
      <Modal visible={eqVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🎚 Equalizer</Text>
            <Text style={[styles.modalSub, { color: theme.sub }]}>Presets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {Object.entries(EQ_PRESETS).map(([key, preset]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.eqPreset, { borderColor: eqPreset === key ? theme.primary : theme.border, backgroundColor: eqPreset === key ? `${theme.primary}20` : theme.bg2 }]}
                  onPress={() => { setEqPreset(key); haptic('light'); showToast(`EQ: ${preset.name}`, ''); }}
                >
                  <Text style={[styles.eqPresetText, { color: eqPreset === key ? theme.primary : theme.sub }]}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.modalSub, { color: theme.sub }]}>Bands (visual)</Text>
            <View style={styles.eqBands}>
              {EQ_PRESETS[eqPreset]?.bands.map((v, i) => (
                <View key={i} style={styles.eqBand}>
                  <View style={[styles.eqBar, { backgroundColor: theme.border }]}>
                    <View style={[styles.eqFill, {
                      height: `${((v + 10) / 20) * 100}%`,
                      backgroundColor: theme.primary,
                    }]} />
                  </View>
                  <Text style={[styles.eqFreq, { color: theme.sub }]}>
                    {['32','64','125','250','500','1k','2k','4k','8k','16k'][i]}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.doneBtn, { borderColor: theme.border }]} onPress={() => setEqVisible(false)}>
              <Text style={[styles.doneBtnText, { color: theme.sub }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep Timer Modal */}
      <Modal visible={sleepVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>⏰ Sleep Timer</Text>
            <Text style={[styles.modalSub, { color: theme.sub }]}>Auto-stop playback after:</Text>
            <View style={styles.sleepGrid}>
              {[0, 10, 15, 30, 45, 60, 90, 120].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.sleepOption, { borderColor: sleepTimer === m || (m === 0 && !sleepTimer) ? theme.primary : theme.border, backgroundColor: sleepTimer === m || (m === 0 && !sleepTimer) ? `${theme.primary}20` : theme.bg2 }]}
                  onPress={() => { startSleepTimer(m); setSleepVisible(false); }}
                >
                  <Text style={[styles.sleepOptionText, { color: sleepTimer === m || (m === 0 && !sleepTimer) ? theme.primary : theme.sub }]}>
                    {m === 0 ? 'Off' : m < 60 ? `${m} min` : `${m/60}h`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.doneBtn, { borderColor: theme.border }]} onPress={() => setSleepVisible(false)}>
              <Text style={[styles.doneBtnText, { color: theme.sub }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Queue Modal */}
      <Modal visible={queueVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.queueSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🎵 Queue ({queue.length})</Text>
            <ScrollView style={{ maxHeight: H * 0.6 }}>
              {queue.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.queueItem, { borderBottomColor: `${theme.border}50` }, item.id === track?.id && { backgroundColor: `${theme.primary}15` }]}
                  onPress={() => { playTrack(item, queue, i); setQueueVisible(false); }}
                >
                  {item.id === track?.id && <Ionicons name="musical-notes" size={14} color={theme.primary} />}
                  <Text style={[styles.queueTitle, { color: item.id === track?.id ? theme.primary : theme.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.queueMeta, { color: theme.sub }]}>{item.format?.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
              {queue.length === 0 && (
                <Text style={[styles.emptyQueue, { color: theme.sub }]}>Queue is empty</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.doneBtn, { borderColor: theme.border, marginTop: 12 }]} onPress={() => setQueueVisible(false)}>
              <Text style={[styles.doneBtnText, { color: theme.sub }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lyrics Modal */}
      <Modal visible={lyricsVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.queueSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🎤 Lyrics</Text>
            <Text style={[styles.lyricsPlaceholder, { color: theme.sub }]}>
              Lyrics sync coming soon.{'\n\n'}
              Currently playing:{'\n'}
              {track?.title || 'Unknown'}
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { borderColor: theme.border }]} onPress={() => setLyricsVisible(false)}>
              <Text style={[styles.doneBtnText, { color: theme.sub }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgArt: { position: 'absolute', width: W, height: H, opacity: 0.25 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  headerBtn: { padding: 8 },
  nowPlaying: { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700' },
  queueInfo: { fontSize: 11, marginTop: 2 },
  artContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 20, height: W * 0.65 },
  artWrap: {
    width: W * 0.62, height: W * 0.62, borderRadius: W * 0.31,
    borderWidth: 2, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  art: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  vinylHole: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 2,
  },
  ring: {
    position: 'absolute', borderRadius: 999, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.1,
  },
  trackInfo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, marginBottom: 16 },
  trackTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  trackArtist: { fontSize: 14 },
  progressSection: { paddingHorizontal: 24, marginBottom: 10 },
  progressBarWrap: { paddingVertical: 10 },
  progressTrack: { height: 4, borderRadius: 4, position: 'relative' },
  progressFill: { height: 4, borderRadius: 4 },
  progressThumb: {
    position: 'absolute', top: -6, width: 16, height: 16, borderRadius: 8,
    marginLeft: -8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, elevation: 4,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timeText: { fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 28 },
  skipBtn: { padding: 8 },
  playBtn: {
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  playBtnInner: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  repeatOne: { position: 'absolute', top: -4, right: -4, fontSize: 8, fontWeight: '900' },
  extraControls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 24, paddingBottom: 20 },
  extraBtn: { alignItems: 'center', gap: 4, padding: 10 },
  extraLabel: { fontSize: 10, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40 },
  queueSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, maxHeight: H * 0.8 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalSub: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 12 },
  eqPreset: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  eqPresetText: { fontSize: 12, fontWeight: '600' },
  eqBands: { flexDirection: 'row', gap: 4, height: 100, alignItems: 'flex-end', marginBottom: 20 },
  eqBand: { flex: 1, alignItems: 'center', gap: 4 },
  eqBar: { flex: 1, width: '60%', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  eqFill: { borderRadius: 4, width: '100%' },
  eqFreq: { fontSize: 8 },
  sleepGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  sleepOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, minWidth: '22%', alignItems: 'center' },
  sleepOptionText: { fontSize: 13, fontWeight: '600' },
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  queueTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
  queueMeta: { fontSize: 11 },
  emptyQueue: { textAlign: 'center', padding: 30, fontSize: 13 },
  lyricsPlaceholder: { textAlign: 'center', fontSize: 15, lineHeight: 24, paddingVertical: 30 },
  doneBtn: { borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  doneBtnText: { fontWeight: '600', fontSize: 14 },
});
