import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import TrackPlayer, { usePlaybackState, State } from 'react-native-track-player';

export default function MiniPlayer({ navigation, theme }) {
  const { currentTrack, isPlaying, setIsPlaying, playNext, playPrev, haptic } = useApp();
  const playbackState = usePlaybackState();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isActuallyPlaying = playbackState.state === State.Playing || isPlaying;

  useEffect(() => {
    if (currentTrack) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 100, duration: 200, useNativeDriver: true }).start();
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isActuallyPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActuallyPlaying]);

  if (!currentTrack) return null;

  const togglePlay = async () => {
    haptic('light');
    try {
      if (isActuallyPlaying) {
        await TrackPlayer.pause();
        setIsPlaying(false);
      } else {
        await TrackPlayer.play();
        setIsPlaying(true);
      }
    } catch (e) {
      setIsPlaying(!isActuallyPlaying);
    }
  };

  const handleNext = () => { haptic('light'); playNext(); };
  const handlePrev = () => { haptic('light'); playPrev(); };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[theme.card, theme.bg2]}
        style={styles.gradient}
      >
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.primary, width: '40%' }]} />
        </View>

        <TouchableOpacity
          style={styles.inner}
          onPress={() => navigation.navigate('Player')}
          activeOpacity={0.9}
        >
          {/* Artwork */}
          <Animated.View style={[styles.artWrap, { transform: [{ scale: pulseAnim }] }]}>
            {currentTrack.thumbnail ? (
              <Image source={{ uri: currentTrack.thumbnail }} style={styles.art} />
            ) : (
              <LinearGradient
                colors={[theme.primary, theme.primary2]}
                style={styles.artFallback}
              >
                <Ionicons name="musical-notes" size={18} color="#fff" />
              </LinearGradient>
            )}
            {isActuallyPlaying && (
              <View style={styles.playingIndicator}>
                {[1,2,3].map(i => (
                  <Animated.View
                    key={i}
                    style={[styles.bar, { backgroundColor: theme.accent, height: 8 + i * 4 }]}
                  />
                ))}
              </View>
            )}
          </Animated.View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {currentTrack.title || 'Unknown'}
            </Text>
            <Text style={[styles.artist, { color: theme.sub }]} numberOfLines={1}>
              {currentTrack.artist || currentTrack.format || 'WAVE'}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={handlePrev} style={styles.ctrlBtn}>
              <Ionicons name="play-skip-back" size={18} color={theme.sub} />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: theme.primary }]}>
              <Ionicons name={isActuallyPlaying ? 'pause' : 'play'} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.ctrlBtn}>
              <Ionicons name="play-skip-forward" size={18} color={theme.sub} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 68,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 50,
  },
  gradient: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,30,58,0.5)',
  },
  progressBar: {
    height: 2,
  },
  progressFill: {
    height: 2,
    borderRadius: 2,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  artWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  art: { width: 44, height: 44, borderRadius: 10 },
  artFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingIndicator: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    paddingBottom: 6,
  },
  bar: { width: 3, borderRadius: 2 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '700' },
  artist: { fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctrlBtn: { padding: 6 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
