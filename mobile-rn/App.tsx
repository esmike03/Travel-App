import 'react-native-gesture-handler';
import React from 'react';
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
  return (
    <ThemeProvider>
      <ThemedAppShell />
    </ThemeProvider>
  );
}
