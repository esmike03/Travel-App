// Ported from DestinationDetailScreen in ui/screens/Screens.kt.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import {
  Destination,
  destinationById,
  destinations,
  distanceKm,
  isCustomPlace,
} from '../data/destinations';
import { fetchPlacePhoto, PlacePhoto } from '../data/photos';
import { useFavorites } from '../context/FavoritesContext';
import { useUserLocation } from '../hooks/useUserLocation';
import {
  estimateEtaMinutes,
  formatDistance,
  formatEta,
} from '../utils/format';
import {
  AddToTripButton,
  StarRow,
  openDirections,
  openMap,
  openSource,
  DestinationPhoto,
} from '../components/common';
import { showToast } from '../utils/toast';
import { WeatherCard } from '../components/Weather';

interface Review {
  author: string;
  date: string;
  rating: number;
  comment: string;
}

const sampleReviewPool: Review[] = [
  {
    author: 'Andrea M.',
    date: '2 weeks ago',
    rating: 5,
    comment:
      'Absolutely stunning. Went early morning and had it almost to ourselves. Bring water and grippy shoes.',
  },
  {
    author: 'Miguel S.',
    date: '1 month ago',
    rating: 4,
    comment:
      'Beautiful spot, worth the ride. Signage is a bit thin so use offline maps to be safe.',
  },
  {
    author: 'Kayla T.',
    date: '1 month ago',
    rating: 5,
    comment:
      'One of the highlights of our Bohol trip — locals were friendly and the scenery is unreal.',
  },
  {
    author: 'Rafael D.',
    date: '2 months ago',
    rating: 4,
    comment:
      'Great half-day stop. A little crowded around noon, plan for sunrise or late afternoon.',
  },
  {
    author: 'Sam P.',
    date: '3 months ago',
    rating: 3,
    comment:
      'Nice place but conditions vary with weather. Check recent posts before making the trip.',
  },
];

function sampleReviewsFor(destination: Destination): Review[] {
  const seed = Math.max(1, destination.id);
  return [0, 1, 2].map(
    (i) => sampleReviewPool[(seed + i) % sampleReviewPool.length]
  );
}

export default function DestinationDetailScreen({
  destinationId,
  onBack,
  onNavigate,
}: {
  destinationId: number;
  onBack: () => void;
  onNavigate: () => void;
}) {
  const { colors } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const { hasPermission, location, request } = useUserLocation();
  const insets = useSafeAreaInsets();

  const destination = destinationById(destinationId) ?? destinations[0];
  const saved = isFavorite(destination.id);
  // A place the traveller searched off the map: no curated photo, rating,
  // write-up or reviews. The screen shows what's real and hides the rest rather
  // than faking any of it.
  const curated = !isCustomPlace(destination.id);

  // Custom places have no curated photo; try Wikimedia Commons for one nearby.
  // Comes with a credit that must be shown (CC licensing) — see the hero.
  const [photo, setPhoto] = useState<PlacePhoto | null>(null);
  useEffect(() => {
    if (curated) return;
    let active = true;
    setPhoto(null);
    fetchPlacePhoto(destination.latitude, destination.longitude).then((p) => {
      if (active) setPhoto(p);
    });
    return () => {
      active = false;
    };
  }, [destination.id, destination.latitude, destination.longitude, curated]);

  // The hero image: curated photo, else a fetched Commons photo, else nothing.
  const heroUri = destination.imageUrl || photo?.url || null;

  const nearby = useMemo(() => {
    // Only curated Bohol spots can be "nearby"; for a custom place elsewhere
    // there is nothing honest to suggest.
    if (!curated) return [] as Destination[];
    const sameMunicipality = destinations
      .filter((d) => d.id !== destination.id && d.municipality === destination.municipality)
      .slice(0, 5);
    return sameMunicipality.length > 0
      ? sameMunicipality
      : destinations.filter((d) => d.id !== destination.id).slice(0, 5);
  }, [destination.id, curated]);

  const reviews = useMemo(
    () => (curated ? sampleReviewsFor(destination) : []),
    [destination.id, curated]
  );

  const distance = location ? distanceKm(location, destination) : null;
  const eta = distance !== null ? estimateEtaMinutes(distance) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 96 }}
    >
      {/* Hero */}
      <View style={{ width: '100%', height: 320 }}>
        {heroUri ? (
          <>
            <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
            {/* CC licensing requires crediting the photographer + license. */}
            {photo && !destination.imageUrl ? (
              <View style={styles.photoCredit}>
                <MaterialIcons name="photo-camera" size={11} color="rgba(255,255,255,0.9)" />
                <Text numberOfLines={1} style={styles.photoCreditText}>
                  {photo.credit}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          // No photo anywhere: a solid header carries the same white text.
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <MaterialIcons name="place" size={72} color={withAlpha('#FFFFFF', 0.85)} />
          </View>
        )}
        <View style={[styles.heroTopRow, { paddingTop: insets.top + 8 }]}>
          <CircleIconButton icon="arrow-back" onPress={onBack} />
          <CircleIconButton
            icon={saved ? 'bookmark' : 'bookmark-border'}
            onPress={() => {
              const nowSaved = toggle(destination.id);
              if (nowSaved) {
                showToast(`${destination.name} saved for offline trip planning`);
              }
            }}
          />
        </View>
        <View style={styles.heroBottom}>
          <View style={[styles.heroCategory, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#000' }}>
              {destination.category}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{destination.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="location-on" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14 }}>{destination.location}</Text>
          </View>
        </View>
      </View>

      {/* Detail header — curated spots carry a rating and guide framing; a
          searched place shows where it came from instead. */}
      <View style={styles.detailHeader}>
        {curated ? (
          <>
            <View style={[styles.ratingChip, { backgroundColor: colors.secondaryContainer }]}>
              <MaterialIcons name="star" size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.onSurface }}>
                {destination.rating} ({reviews.length + 48} reviews)
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Local guide picks</Text>
          </>
        ) : (
          <View style={[styles.ratingChip, { backgroundColor: colors.secondaryContainer }]}>
            <MaterialIcons name="map" size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.onSurface }}>
              Added from the map
            </Text>
          </View>
        )}
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="drive-eta"
          title="ETA"
          body={eta !== null ? formatEta(eta) : !hasPermission ? 'Enable location' : '—'}
          actionable={!hasPermission}
          onPress={!hasPermission ? request : undefined}
        />
        <StatCard
          icon="my-location"
          title="Distance"
          body={distance !== null ? formatDistance(distance) : '—'}
        />
        <StatCard
          icon="wb-sunny"
          title="Best time"
          body={destination.bestTimeToVisit || 'Anytime'}
        />
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <ActionButton
          icon="directions"
          label="Route"
          primary
          onPress={() => openDirections(destination)}
        />
        <ActionButton icon="map" label="Map" onPress={() => openMap(destination)} />
        {destination.sourceUrl ? (
          <ActionButton
            icon="link"
            label={curated ? 'Source' : 'OSM'}
            onPress={() => openSource(destination)}
          />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
        <AddToTripButton destinationId={destination.id} />
      </View>

      <SectionTitle title="Weather" />
      <View style={{ paddingHorizontal: 20 }}>
        <WeatherCard destinationId={destination.id} />
      </View>

      {destination.shortDescription ? (
        <>
          <SectionTitle title="About" />
          <Text
            style={{
              fontSize: 16,
              color: colors.onSurface,
              paddingHorizontal: 20,
              lineHeight: 22,
            }}
          >
            {destination.shortDescription}
          </Text>
        </>
      ) : null}

      {/* No invented reviews for a searched place. */}
      {curated ? (
        <>
          <SectionTitle title="Rating & reviews" />
          <RatingSummary destination={destination} reviews={reviews} />
          {reviews.map((r, i) => (
            <ReviewCard key={i} review={r} />
          ))}
        </>
      ) : null}

      <SectionTitle title="Information" />
      <InfoGrid destination={destination} />

      {nearby.length > 0 ? (
        <>
          <SectionTitle title="Nearby attractions" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {nearby.map((d) => (
              <NearbyCard key={d.id} destination={d} />
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>

      {/* Live-navigation FAB */}
      <Pressable
        onPress={onNavigate}
        style={[styles.navFab, { bottom: insets.bottom + 20, backgroundColor: colors.primary }]}
      >
        <MaterialIcons name="navigation" size={22} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 15 }}>Navigate</Text>
      </Pressable>
    </View>
  );
}

function CircleIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialIcons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

function StatCard({
  icon,
  title,
  body,
  actionable,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
  actionable?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 16,
        backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
        padding: 12,
        gap: 6,
      }}
    >
      <MaterialIcons name={icon} size={20} color={colors.primary} />
      <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>{title}</Text>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 14,
          fontWeight: actionable ? '600' : '500',
          color: actionable ? colors.primary : colors.onSurface,
        }}
      >
        {body}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const bg = primary ? colors.primary : colors.secondaryContainer;
  const fg = primary ? colors.onPrimary : colors.onSecondaryContainer;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 44,
        borderRadius: 14,
        backgroundColor: bg,
      }}
    >
      <MaterialIcons name={icon} size={18} color={fg} />
      <Text style={{ color: fg, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontSize: 16,
        fontWeight: '600',
        color: colors.onSurface,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}

function RatingSummary({
  destination,
  reviews,
}: {
  destination: Destination;
  reviews: Review[];
}) {
  const { colors } = useTheme();
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
  const totalReviews = reviews.length + 48;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));
  const displayAvg = average > 0 ? average : parseFloat(destination.rating) || 4.5;

  return (
    <View
      style={{
        marginHorizontal: 20,
        borderRadius: 16,
        backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '700', color: colors.onSurface }}>
          {displayAvg.toFixed(1)}
        </Text>
        <StarRow rating={displayAvg} />
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          {totalReviews} reviews
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {distribution.map(({ star, count }) => (
          <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontSize: 11,
                width: 10,
                textAlign: 'right',
                color: colors.onSurface,
              }}
            >
              {star}
            </Text>
            <MaterialIcons name="star" size={12} color={colors.primary} />
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 50,
                backgroundColor: withAlpha(colors.primary, 0.2),
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  height: '100%',
                  backgroundColor: colors.primary,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginVertical: 6,
        borderRadius: 16,
        backgroundColor: colors.surface,
        padding: 14,
        gap: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primaryContainer,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="person" size={20} color={colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: colors.onSurface }}>
            {review.author}
          </Text>
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
            {review.date}
          </Text>
        </View>
        <StarRow rating={review.rating} />
      </View>
      <Text style={{ fontSize: 14, color: colors.onSurface }}>{review.comment}</Text>
    </View>
  );
}

function InfoGrid({ destination }: { destination: Destination }) {
  const { colors } = useTheme();
  const custom = isCustomPlace(destination.id);
  const rows: {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    value: string;
  }[] = [
    { icon: 'category', label: 'Category', value: destination.category },
    {
      icon: 'location-on',
      label: 'Coordinates',
      value: `${destination.latitude}, ${destination.longitude}`,
    },
    // Skip fields a searched place has nothing real for.
    ...(destination.bestTimeToVisit
      ? [
          {
            icon: 'schedule' as const,
            label: 'Best time to visit',
            value: destination.bestTimeToVisit,
          },
        ]
      : []),
    {
      icon: 'info',
      label: 'Source',
      value: custom ? 'OpenStreetMap' : 'Journey Era Bohol guide',
    },
  ];
  return (
    <View
      style={{
        marginHorizontal: 20,
        borderRadius: 16,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      {rows.map((row, i) => (
        <View key={row.label}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.secondaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name={row.icon} size={18} color={colors.onSecondaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                {row.label}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.onSurface }}>
                {row.value}
              </Text>
            </View>
          </View>
          {i < rows.length - 1 ? (
            <View style={{ height: 1, backgroundColor: withAlpha(colors.outlineVariant, 0.4) }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function NearbyCard({ destination }: { destination: Destination }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 180,
        borderRadius: 16,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <DestinationPhoto
        destination={destination}
        style={{ width: '100%', height: 110 }}
        iconSize={32}
      />
      <View style={{ padding: 10, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '600', color: colors.onSurface }}>
          {destination.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialIcons name="star" size={14} color={colors.primary} />
          <Text style={{ fontSize: 11, color: colors.onSurface }}>{destination.rating}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
            · {destination.municipality}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  // Small, unobtrusive, but always present when a Commons photo is shown.
  photoCredit: {
    position: 'absolute',
    top: 64,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '70%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoCreditText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    gap: 6,
  },
  heroCategory: {
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navFab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 27,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
