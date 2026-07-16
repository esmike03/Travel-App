// Ported from DiscoverScreen in ui/screens/Screens.kt.
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinations, Destination } from '../data/destinations';
import { useRegionSetting } from '../context/RegionContext';
import { useFavorites } from '../context/FavoritesContext';
import { AddToTripButton, CategoryPill, RatingPill, SavedBadge } from '../components/common';

export default function DiscoverScreen({
  onDestinationClick,
}: {
  onDestinationClick: (id: number) => void;
}) {
  const { colors } = useTheme();
  const { region, isHome } = useRegionSetting();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // The curated set is Bohol's. Showing it while the app is pointed at another
  // province would be plainly wrong, so away from home there is nothing here.
  const spots = useMemo(() => (isHome ? destinations : []), [isHome]);

  const categories = useMemo(
    () => Array.from(new Set(spots.map((d) => d.category))),
    [spots]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots.filter((d) => {
      const matchesQuery =
        q === '' ||
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.municipality.toLowerCase().includes(q) ||
        d.shortDescription.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === null || d.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [spots, query, selectedCategory]);

  const featured = useMemo(
    () => [...spots].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 5),
    [spots]
  );

  const showFeatured = selectedCategory === null && query.trim() === '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: 20, paddingBottom: 32 }}
    >
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={[styles.h1, { color: colors.onBackground }]}>Discover {region.name}</Text>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
          {isHome
            ? 'Curated spots for your next trip.'
            : `Travs has no curated spots for ${region.name} yet.`}
        </Text>
      </View>

      {!isHome ? (
        <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 10 }}>
          <MaterialIcons name="travel-explore" size={40} color={colors.onSurfaceVariant} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface, textAlign: 'center' }}>
            Exploring {region.name}
          </Text>
          <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' }}>
            Hand-picked spots only exist for Bohol so far. Your map, weather and plans all work
            here — add stops by searching for the places you want to visit.
          </Text>
        </View>
      ) : null}

      <View style={{ height: 16 }} />
      <View style={{ paddingHorizontal: 20 }}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
          ]}
        >
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search destinations"
            placeholderTextColor={colors.onSurfaceVariant}
            style={{ flex: 1, color: colors.onSurface, fontSize: 15 }}
          />
        </View>
      </View>

      <View style={{ height: 16 }} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {categories.map((c) => {
          const isSelected = c === selectedCategory;
          return (
            <Pressable
              key={c}
              onPress={() =>
                setSelectedCategory(selectedCategory === c ? null : c)
              }
              style={{
                borderRadius: 50,
                backgroundColor: isSelected
                  ? colors.primary
                  : withAlpha(colors.surfaceVariant, 0.6),
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: isSelected ? colors.onPrimary : colors.onSurface,
                }}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {showFeatured ? (
        <>
          <View style={{ height: 16 }} />
          <SectionHeading title="Popular now" subtitle="Top-rated Bohol picks" />
          <View style={{ height: 12 }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {featured.map((d) => (
              <FeaturedCard
                key={d.id}
                destination={d}
                onPress={() => onDestinationClick(d.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={{ height: 16 }} />
      <SectionHeading
        title={selectedCategory ?? 'All destinations'}
        subtitle={`${filtered.length} places`}
      />
      <View style={{ height: 12 }} />
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        {filtered.map((d) => (
          <DestinationCard
            key={d.id}
            destination={d}
            onPress={() => onDestinationClick(d.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', color: colors.onSurface }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function FeaturedCard({
  destination,
  onPress,
}: {
  destination: Destination;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { isFavorite } = useFavorites();
  const saved = isFavorite(destination.id);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.featuredCard, { backgroundColor: colors.surface }]}
    >
      <View>
        <Image source={{ uri: destination.imageUrl }} style={styles.featuredImage} />
        <View style={[styles.imageOverlay, { height: 160 }]} pointerEvents="none" />
        <View style={styles.topRight}>
          <RatingPill rating={destination.rating} />
          {saved ? <SavedBadge /> : null}
        </View>
        <View style={styles.bottomLeft}>
          <Text numberOfLines={2} style={styles.featuredTitle}>
            {destination.name}
          </Text>
          <Text style={styles.featuredSub}>{destination.municipality}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function DestinationCard({
  destination,
  onPress,
}: {
  destination: Destination;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const saved = isFavorite(destination.id);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <View>
        <Image source={{ uri: destination.imageUrl }} style={styles.cardImage} />
        <View style={styles.cardImageRow}>
          <CategoryPill category={destination.category} />
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <RatingPill rating={destination.rating} />
            {saved ? <SavedBadge /> : null}
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={2}
            style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.onSurface }}
          >
            {destination.name}
          </Text>
          <Pressable onPress={() => toggle(destination.id)} hitSlop={8}>
            <MaterialIcons
              name={saved ? 'bookmark' : 'bookmark-border'}
              size={22}
              color={colors.primary}
            />
          </Pressable>
          <AddToTripButton destinationId={destination.id} compact />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialIcons name="location-on" size={14} color={colors.onSurfaceVariant} />
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
            {destination.municipality}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{ fontSize: 12, color: colors.onSurfaceVariant }}
        >
          {destination.shortDescription}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 32, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 52,
  },
  featuredCard: {
    width: 240,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  featuredImage: { width: '100%', height: 160 },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  topRight: { position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', gap: 6 },
  bottomLeft: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  featuredTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  featuredSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage: { width: '100%', height: 180 },
  cardImageRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
});
