import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

function Particle({ color, delay, duration, size, startX, startY, endX, endY }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const translateY = useRef(new Animated.Value(startY)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animate = () => {
      opacity.setValue(0);
      translateX.setValue(startX);
      translateY.setValue(startY);
      scale.setValue(0.5);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.8, duration: duration * 0.3, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: endX, duration, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: endY, duration, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.5, duration, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: duration * 0.3, useNativeDriver: true }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

function PulsingOrb({ color, x, y, size, delay }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.3, duration: 3000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.25, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.1, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

function FloatingShape({ color, startY, duration, delay, size, shape }) {
  const x = useRef(new Animated.Value(Math.random() * W)).current;
  const y = useRef(new Animated.Value(startY)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      const newX = Math.random() * W;
      x.setValue(newX);
      y.setValue(H + 20);
      opacity.setValue(0);
      rotate.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.5, duration: 500, useNativeDriver: true }),
          Animated.timing(y, { toValue: -50, duration, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 360, duration, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  const rotateInterpolated = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: shape === 'circle' ? size / 2 : shape === 'diamond' ? 0 : 4,
        borderWidth: 1,
        borderColor: color,
        opacity,
        transform: [{ translateX: x }, { translateY: y }, { rotate: rotateInterpolated }],
      }}
    />
  );
}

export default function BackgroundAnimation({ theme, style, intensity = 'full' }) {
  const primary = theme?.primary || '#7c6dfa';
  const accent = theme?.accent || '#00e5ff';
  const primary2 = theme?.primary2 || '#b06dfa';

  const particles = useMemo(() => Array.from({ length: intensity === 'full' ? 20 : 10 }).map((_, i) => ({
    id: i,
    color: i % 3 === 0 ? primary : i % 3 === 1 ? accent : primary2,
    size: Math.random() * 4 + 2,
    startX: Math.random() * W,
    startY: Math.random() * H,
    endX: (Math.random() - 0.5) * 200 + Math.random() * W,
    endY: (Math.random() - 0.5) * 200 + Math.random() * H,
    duration: 4000 + Math.random() * 8000,
    delay: Math.random() * 5000,
  })), [primary, accent, primary2]);

  const shapes = useMemo(() => Array.from({ length: intensity === 'full' ? 8 : 4 }).map((_, i) => ({
    id: i,
    color: i % 2 === 0 ? primary : accent,
    startY: H + 20,
    duration: 8000 + Math.random() * 6000,
    delay: i * 1200,
    size: Math.random() * 12 + 6,
    shape: ['circle', 'square', 'diamond'][i % 3],
  })), [primary, accent]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {/* Radial gradients */}
      <LinearGradient
        colors={[`${primary}20`, 'transparent']}
        style={{ position: 'absolute', left: -W * 0.2, top: H * 0.1, width: W * 0.8, height: W * 0.8, borderRadius: W * 0.4 }}
      />
      <LinearGradient
        colors={[`${accent}15`, 'transparent']}
        style={{ position: 'absolute', right: -W * 0.2, top: -H * 0.1, width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35 }}
      />
      <LinearGradient
        colors={[`${primary2}12`, 'transparent']}
        style={{ position: 'absolute', left: W * 0.2, bottom: H * 0.1, width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35 }}
      />

      {/* Pulsing orbs */}
      <PulsingOrb color={primary} x={W * 0.15} y={H * 0.3} size={W * 0.5} delay={0} />
      <PulsingOrb color={accent} x={W * 0.85} y={H * 0.15} size={W * 0.4} delay={1500} />
      <PulsingOrb color={primary2} x={W * 0.5} y={H * 0.75} size={W * 0.45} delay={3000} />

      {/* Floating particles */}
      {particles.map(p => <Particle key={p.id} {...p} />)}

      {/* Floating shapes */}
      {shapes.map(s => <FloatingShape key={s.id} {...s} />)}

      {/* Grid lines (subtle) */}
      <View style={{ position: 'absolute', inset: 0, opacity: 0.03 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', left: (W / 8) * i, top: 0, bottom: 0, width: 1, backgroundColor: primary }} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', top: (H / 12) * i, left: 0, right: 0, height: 1, backgroundColor: accent }} />
        ))}
      </View>
    </View>
  );
}
