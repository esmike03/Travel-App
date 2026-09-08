// Ported from FavoritesScreen in ui/screens/Screens.kt.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { destinations, Destination } from '../data/destinations';
import { useFavorites } from '../context/FavoritesContext';
import { AddToTripButton, DestinationPhoto, RatingPill } from '../components/common';
import ChirpyPeek from '../components/ChirpyPeek';
import SkeletonList from '../components/Skeleton';

export default function FavoritesScreen({
  onDestinationClick,
}: {
  onDestinationClick: (id: number) => void;
}) {
  const { colors } = useTheme();
  const { ids, loading, toggle } = useFavorites();
  const saved = destinations.filter((d) => ids.includes(d.id));

  // Without this the screen flashes "Nothing saved yet" before SQLite answers.
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonList rows={3} />
      </View>
    );
  }

  if (saved.length === 0) {
    return <EmptyFavoritesState />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: 20, paddingBottom: 32, gap: 12 }}
    >
      <View style={{ paddingHorizontal: 20, gap: 4 }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: colors.onBackground }}>
          Saved
        </Text>
        <Text style={{ fontSize: 14, color: colors.onSurfaceVariant }}>
          {saved.length} {saved.length === 1 ? 'place' : 'places'} saved for offline
        </Text>
      </View>
      {saved.map((d) => (
        <View key={d.id} style={{ paddingHorizontal: 20 }}>
          <SavedDestinationRow
            destination={d}
            onPress={() => onDestinationClick(d.id)}
            onUnsave={() => toggle(d.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function SavedDestinationRow({
  destination,
  onPress,
  onUnsave,
}: {
  destination: Destination;
  onPress: () => void;
  onUnsave: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { backgroundColor: colors.surface }]}>
      <View>
        <DestinationPhoto destination={destination} style={styles.thumb} />
        <RatingPill rating={destination.rating} style={{ position: 'absolute', top: 4, right: 4 }} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
          {destination.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialIcons name="location-on" size={12} color={colors.onSurfaceVariant} />
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
            {destination.municipality}
          </Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '500', color: colors.primary }}>
          {destination.category}
        </Text>
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Pressable onPress={onUnsave} hitSlop={8} style={{ padding: 4 }}>
          <MaterialIcons name="bookmark" size={24} color={colors.primary} />
        </Pressable>
        <AddToTripButton destinationId={destination.id} compact />
      </View>
    </Pressable>
  );
}

function EmptyFavoritesState() {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.background }]}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.secondaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="favorite-border" size={44} color={colors.onSecondaryContainer} />
      </View>
      <View style={{ height: 20 }} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>
        Nothing saved yet
      </Text>
      <View style={{ height: 6 }} />
      <Text style={{ fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' }}>
        Tap the bookmark on any destination to keep it here for offline trip planning.
      </Text>
      <ChirpyPeek message="Found somewhere you like? Bookmark it and I’ll keep it here." />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  thumb: { width: 96, height: 96, borderRadius: 16 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
