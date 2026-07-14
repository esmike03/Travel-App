// Ported from data/preferences/ThemePreference.kt + ui/theme/Theme.kt.
// Provides the active ColorScheme plus the user's ThemeMode (SYSTEM/LIGHT/DARK),
// persisted to AsyncStorage the same way ThemePreference used SharedPreferences.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorScheme, darkColors, lightColors } from './colors';

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';

const STORAGE_KEY = 'travs_theme_mode';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorScheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('SYSTEM');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'LIGHT' || stored === 'DARK' || stored === 'SYSTEM') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const isDark = mode === 'DARK' || (mode === 'SYSTEM' && systemScheme === 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors: isDark ? darkColors : lightColors,
      setMode,
    }),
    [mode, isDark, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
