import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { TripsProvider } from './src/context/TripsContext';
import { PlansProvider } from './src/context/PlansContext';
import { WeatherProvider } from './src/context/WeatherContext';
import { RegionProvider } from './src/context/RegionContext';
import { PlacesProvider } from './src/context/PlacesContext';
import RootNavigator from './src/navigation/RootNavigator';

const CHIRPY_ICON = require('./assets/branding/chirpy-app-icon.png');
const CHIRPY_WALKING = require('./assets/branding/chirpy-walking.png');

function ChirpySplash({ onFinish }: { onFinish: () => void }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const mascot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(reveal, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(mascot, {
        toValue: 1,
        delay: 120,
        speed: 9,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
    const timer = setTimeout(onFinish, 2100);
    return () => clearTimeout(timer);
  }, [mascot, onFinish, reveal]);

  return (
    <View style={splashStyles.root}>
      <StatusBar style="dark" />
      <View style={splashStyles.sun} />
      <View style={splashStyles.cloudOne} />
      <View style={splashStyles.cloudTwo} />
      <Animated.View
        style={[
          splashStyles.iconWrap,
          {
            opacity: reveal,
            transform: [
              {
                translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
              },
            ],
          },
        ]}
      >
        <Image source={CHIRPY_ICON} style={splashStyles.icon} />
      </Animated.View>
      <Animated.Image
        source={CHIRPY_WALKING}
        resizeMode="contain"
        style={[
          splashStyles.mascot,
          {
            opacity: mascot,
            transform: [
              { scale: mascot.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
              { translateX: mascot.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          splashStyles.wordmark,
          {
            opacity: reveal,
            transform: [
              { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          },
        ]}
      >
        <Text style={splashStyles.name}>Chirpy</Text>
        <Text style={splashStyles.tagline}>Your Travel Companion</Text>
      </Animated.View>
      <Animated.View style={[splashStyles.readyPill, { opacity: reveal }]}>
        <Text style={splashStyles.readyText}>PACK LIGHT · WANDER FAR</Text>
      </Animated.View>
    </View>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

// The root view carries the themed background so screen transitions never reveal
// a white window behind the navigator (ThemeProvider must sit above it).
function ThemedAppShell() {
  const { colors } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <FavoritesProvider>
            {/* Places above Trips: a stop can reference a place the traveller
                added, so those must be loaded before stops resolve. */}
            <PlacesProvider>
              <TripsProvider>
                <PlansProvider>
                  {/* Region above Weather: the forecast follows wherever the
                      app is currently pointed. */}
                  <RegionProvider>
                    <WeatherProvider>
                      <ThemedStatusBar />
                      <RootNavigator />
                    </WeatherProvider>
                  </RegionProvider>
                </PlansProvider>
              </TripsProvider>
            </PlacesProvider>
          </FavoritesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <ChirpySplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <ThemeProvider>
      <ThemedAppShell />
    </ThemeProvider>
  );
}

const splashStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 28,
  },
  sun: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#FFE6A6',
    top: -155,
    right: -115,
  },
  cloudOne: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#DDF5EF',
    left: -95,
    top: '24%',
  },
  cloudTwo: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#F3C96B30',
    right: -130,
    bottom: -105,
  },
  iconWrap: {
    position: 'absolute',
    top: 62,
    width: 54,
    height: 54,
    borderRadius: 18,
    padding: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16312E',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  icon: { width: '100%', height: '100%', borderRadius: 15 },
  mascot: { width: 320, height: 320, marginTop: -22 },
  wordmark: { alignItems: 'center', marginTop: -28 },
  name: {
    color: '#103F3B',
    fontSize: 43,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  tagline: {
    color: '#4E6965',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  readyPill: {
    position: 'absolute',
    bottom: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFFB8',
  },
  readyText: { color: '#0B6E69', fontSize: 9, fontWeight: '900', letterSpacing: 1.15 },
});
