// The setting that decides where the app is pointed: its home province (Bohol,
// curated) or wherever the traveller actually is.
//
// Deliberately province-level. A province is the unit a trip is planned in, and
// it keeps the map, the weather and the plans agreeing with each other.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useRegionSetting } from '../context/RegionContext';
import { Region, searchProvinces } from '../data/region';

export default function RegionSetting() {
  const { colors } = useTheme();
  const { region, enabled, locating, error, isHome, useBohol, useMyLocation, useRegion } =
    useRegionSetting();
  const [picking, setPicking] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
              Travel outside Bohol
            </Text>
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: colors.secondaryContainer,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                  color: colors.onSecondaryContainer,
                }}
              >
                EXPERIMENTAL
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
          Off keeps Chirpy on Bohol. On points the map, weather and your plans at another
            province.
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(on) => (on ? setPicking(true) : useBohol())}
          trackColor={{ true: withAlpha(colors.primary, 0.5), false: colors.outlineVariant }}
          thumbColor={enabled ? colors.primary : undefined}
        />
      </View>

      {/* Current region */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
        }}
      >
        <MaterialIcons name={isHome ? 'home' : 'place'} size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>Currently exploring</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.onSurface }}>
            {region.name}
            {isHome ? '' : ' province'}
          </Text>
        </View>
        {enabled ? (
          <Pressable
            onPress={() => setPicking(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: withAlpha(colors.primary, 0.14),
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Change</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Curated-content warning: outside Bohol there are no curated spots, and
          pretending otherwise would be the dishonest part. */}
      {enabled && !isHome ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 }}>
          <MaterialIcons name="info-outline" size={14} color={colors.onSurfaceVariant} />
          <Text style={{ flex: 1, fontSize: 11, color: colors.onSurfaceVariant }}>
            Travelling outside Bohol is experimental. Chirpy only has curated spots for Bohol —
            in {region.name} you can search for places to add as stops, and weather and maps work
            as normal.
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={{ fontSize: 11, color: colors.error, marginTop: 8 }}>{error}</Text>
      ) : null}

      {picking ? (
        <RegionPicker
          locating={locating}
          onUseMyLocation={async () => {
            await useMyLocation();
            setPicking(false);
          }}
          onPick={(r) => {
            useRegion(r);
            setPicking(false);
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}

function RegionPicker({
  locating,
  onUseMyLocation,
  onPick,
  onDismiss,
}: {
  locating: boolean;
  onUseMyLocation: () => void;
  onPick: (region: Region) => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Region[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (q: string) => {
    const mine = ++seq.current;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setErr(null);
    try {
      const found = await searchProvinces(q);
      // Ignore a slow reply that a newer keystroke has already superseded.
      if (mine !== seq.current) return;
      setResults(found);
      if (found.length === 0) setErr('No province matched that name.');
    } catch (e) {
      if (mine === seq.current) setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      if (mine === seq.current) setSearching(false);
    }
  }, []);

  // Debounced: Nominatim's usage policy is one request a second, and typing
  // would blow straight through that.
  useEffect(() => {
    const t = setTimeout(() => run(query), 600);
    return () => clearTimeout(t);
  }, [query, run]);

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.grabber} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface }}>
              Where are you travelling?
            </Text>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              Pick a province
            </Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        <Pressable
          onPress={onUseMyLocation}
          disabled={locating}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary, 0.14),
            opacity: locating ? 0.6 : 1,
          }}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="my-location" size={18} color={colors.primary} />
          )}
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.primary }}>
            {locating ? 'Finding your province…' : 'Use my current location'}
          </Text>
        </Pressable>

        <View
          style={[
            styles.search,
            { backgroundColor: withAlpha(colors.surfaceVariant, 0.5), borderColor: colors.outlineVariant },
          ]}
        >
          <MaterialIcons name="search" size={18} color={colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a province, e.g. Cebu"
            placeholderTextColor={colors.onSurfaceVariant}
            autoCorrect={false}
            style={{ flex: 1, color: colors.onSurface, fontSize: 15 }}
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        {err ? (
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 8 }}>{err}</Text>
        ) : null}

        <ScrollView style={{ maxHeight: 260, marginTop: 8 }} keyboardShouldPersistTaps="handled">
          {results.map((r) => (
            <Pressable
              key={`${r.name}-${r.latitude}`}
              onPress={() => onPick(r)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
              }}
            >
              <MaterialIcons name="place" size={18} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 15, color: colors.onSurface }}>{r.name}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, gap: 4 },
  // Full-bleed scrim, so the sheet's rounded top corners sit on dimmed backdrop
  // rather than cutting through to the page underneath. See PlanListSheet.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    marginBottom: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginTop: 10,
  },
});
