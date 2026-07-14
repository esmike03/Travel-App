// Small reusable UI atoms shared across screens (RatingPill, CategoryPill,
// SavedBadge, StarRow) — ported from the equivalent private composables.
import React from 'react';
import {
  Linking,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { Destination } from '../data/destinations';
import { useTrips } from '../context/TripsContext';
import { showToast } from '../utils/toast';

export function RatingPill({
  rating,
  style,
}: {
  rating: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha('#000000', 0.55) }, style]}>
      <MaterialIcons name="star" size={12} color="#FFC107" />
      <Text style={styles.pillText}>{rating}</Text>
    </View>
  );
}

export function SavedBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.primary }, style]}>
      <MaterialIcons name="bookmark" size={12} color={colors.onPrimary} />
      <Text style={[styles.pillText, { color: colors.onPrimary }]}>Saved</Text>
    </View>
  );
}

export function CategoryPill({ category }: { category: string }) {
  return (
    <View style={[styles.categoryPill, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]}>
      <Text style={styles.categoryText}>{category}</Text>
    </View>
  );
}

export function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name =
          rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-border';
        return (
          <MaterialIcons key={i} name={name} size={size} color={colors.primary} />
        );
      })}
    </View>
  );
}

/**
 * Add/remove a destination from the trip with one tap. `compact` renders a small
 * round icon button (for cards / the map callout); otherwise a labeled pill (for
 * the detail screen).
 */
export function AddToTripButton({
  destinationId,
  compact,
  style,
}: {
  destinationId: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { isInTrip, toggleTrip } = useTrips();
  const inTrip = isInTrip(destinationId);

  const onPress = () => {
    const nowIn = toggleTrip(destinationId);
    showToast(nowIn ? 'Added to your trip' : 'Removed from your trip');
  };

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={[
          styles.tripCompact,
          {
            backgroundColor: inTrip ? colors.primary : withAlpha(colors.primary, 0.14),
          },
          style,
        ]}
      >
        <MaterialIcons
          name={inTrip ? 'event-available' : 'add'}
          size={20}
          color={inTrip ? colors.onPrimary : colors.primary}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tripPill,
        {
          backgroundColor: inTrip ? colors.primary : withAlpha(colors.primary, 0.14),
        },
        style,
      ]}
    >
      <MaterialIcons
        name={inTrip ? 'event-available' : 'add'}
        size={18}
        color={inTrip ? colors.onPrimary : colors.primary}
      />
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: inTrip ? colors.onPrimary : colors.primary,
        }}
      >
        {inTrip ? 'In your trip' : 'Add to trip'}
      </Text>
    </Pressable>
  );
}

/* ---------------- external intents (ported from openDirections/openMap/openSource) ---------------- */

export function openDirections(dest: Destination) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`;
  Linking.openURL(url);
}

export function openMap(dest: Destination) {
  const url = `https://www.google.com/maps/search/?api=1&query=${dest.latitude},${dest.longitude}`;
  Linking.openURL(url);
}

export function openSource(dest: Destination) {
  Linking.openURL(dest.sourceUrl);
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryPill: {
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
  },
  tripCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 44,
  },
});
