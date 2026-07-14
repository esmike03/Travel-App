// Ported from ProfileScreen in ui/screens/Screens.kt.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../utils/toast';

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const { session, logout } = useAuth();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.onBackground }}>
        Profile
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.primaryContainer,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="person" size={24} color={colors.onPrimaryContainer} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
              {session?.name ?? 'Guest traveler'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              {session?.email ?? 'Offline mode enabled.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Appearance */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
          Appearance
        </Text>
        <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
          Choose how Travs looks on this device.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <ThemeOption label="Light" icon="wb-sunny" selected={mode === 'LIGHT'} onPress={() => setMode('LIGHT')} />
          <ThemeOption label="Dark" icon="dark-mode" selected={mode === 'DARK'} onPress={() => setMode('DARK')} />
          <ThemeOption
            label="System"
            icon="phone-android"
            selected={mode === 'SYSTEM'}
            onPress={() => setMode('SYSTEM')}
          />
        </View>
      </View>

      <Pressable
        onPress={() => showToast('Sync queued when internet is available')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 48,
          borderRadius: 14,
          backgroundColor: colors.primary,
        }}
      >
        <MaterialIcons name="sync" size={20} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Sync now</Text>
      </Pressable>

      <Pressable
        onPress={logout}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          height: 48,
          borderRadius: 14,
          backgroundColor: colors.secondaryContainer,
        }}
      >
        <Text style={{ color: colors.onSecondaryContainer, fontWeight: '600' }}>
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function ThemeOption({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const bg = selected ? colors.primary : withAlpha(colors.surfaceVariant, 0.6);
  const fg = selected ? colors.onPrimary : colors.onSurface;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 12,
        backgroundColor: bg,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 4,
      }}
    >
      <MaterialIcons name={icon} size={20} color={fg} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: fg }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
