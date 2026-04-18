import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import TrackPlayer from 'react-native-track-player';

import { AppProvider, useApp } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import DownloadScreen from './src/screens/DownloadScreen';
import SearchScreen from './src/screens/SearchScreen';
import ARIAScreen from './src/screens/ARIAScreen';
import BrowserScreen from './src/screens/BrowserScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MiniPlayer from './src/components/MiniPlayer';
import Toast from './src/components/Toast';
import BackgroundAnimation from './src/components/BackgroundAnimation';

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS = {
  Home:     { active: 'home',            inactive: 'home-outline' },
  Download: { active: 'cloud-download',  inactive: 'cloud-download-outline' },
  Search:   { active: 'search',          inactive: 'search-outline' },
  ARIA:     { active: 'chatbubbles',     inactive: 'chatbubbles-outline' },
  Browser:  { active: 'globe',           inactive: 'globe-outline' },
  Library:  { active: 'library',         inactive: 'library-outline' },
};

function SplashScreenComp({ onDone }) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }),
    ]).start(() => setTimeout(onDone, 200));
  }, []);

  const progWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={sp.container}>
      <BackgroundAnimation theme={{ primary: '#7c6dfa', accent: '#00e5ff', primary2: '#b06dfa' }} intensity="full" />
      <Animated.View style={[sp.content, { opacity, transform: [{ scale }] }]}>
        <Text style={sp.logo}>🌊</Text>
        <Text style={sp.name}>WAVE</Text>
        <Text style={sp.tag}>MUSIC · VIDEOS · AI · EVERYTHING</Text>
        <View style={sp.barWrap}>
          <Animated.View style={[sp.barFill, { width: progWidth }]} />
        </View>
        <Text style={sp.version}>v2.0</Text>
      </Animated.View>
    </View>
  );
}

const sp = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06060f', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  logo: { fontSize: 80, marginBottom: 8, textShadowColor: 'rgba(124,109,250,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 },
  name: { fontSize: 52, fontWeight: '900', letterSpacing: 10, color: '#7c6dfa', marginBottom: 8 },
  tag: { fontSize: 11, letterSpacing: 5, color: '#7070a0', textTransform: 'uppercase', marginBottom: 40 },
  barWrap: { width: 160, height: 2, backgroundColor: '#1e1e3a', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 2, backgroundColor: '#7c6dfa', borderRadius: 2 },
  version: { color: '#7070a0', fontSize: 11, marginTop: 20 },
});

function MainTabs({ navigation: navProp }) {
  const { theme, toast, currentTrack } = useApp();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route, navigation }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: `${theme.bg}f8`,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: 68,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.sub,
          tabBarLabelStyle: {
            fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
          },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = TAB_ICONS[route.name];
            return <Ionicons name={focused ? icons.active : icons.inactive} size={20} color={color} />;
          },
          tabBarIndicatorStyle: { backgroundColor: theme.primary, height: 2, borderRadius: 2 },
        })}
      >
        <Tab.Screen name="Home"     component={HomeScreen} />
        <Tab.Screen name="Download" component={DownloadScreen} />
        <Tab.Screen name="Search"   component={SearchScreen} />
        <Tab.Screen name="ARIA"     component={ARIAScreen} />
        <Tab.Screen name="Browser"  component={BrowserScreen} />
        <Tab.Screen name="Library"  component={LibraryScreen} />
      </Tab.Navigator>

      {/* Mini Player above tab bar */}
      {currentTrack && <MiniPlayer navigation={navProp} theme={theme} />}

      {/* Global Toast */}
      <Toast toast={toast} theme={theme} />
    </View>
  );
}

function AppNav() {
  const { theme } = useApp();

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: theme.primary,
          background: theme.bg,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          notification: theme.primary,
        },
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'modal' }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            cardStyleInterpolator: ({ current, layouts }) => ({
              cardStyle: {
                transform: [{
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.height, 0],
                  }),
                }],
              },
            }),
          }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

async function initTrackPlayer() {
  try {
    await TrackPlayer.setupPlayer({
      maxCacheSize: 1024 * 50,
    });
    await TrackPlayer.updateOptions({
      stopWithApp: false,
      capabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
        TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
        TrackPlayer.CAPABILITY_SEEK_TO,
        TrackPlayer.CAPABILITY_STOP,
      ],
      compactCapabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
      ],
    });
  } catch (e) {
    // Already initialized
  }
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    initTrackPlayer();
    SplashScreen.hideAsync();
  }, []);

  if (!splashDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppProvider>
            <SplashScreenComp onDone={() => setSplashDone(true)} />
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <AppNav />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
