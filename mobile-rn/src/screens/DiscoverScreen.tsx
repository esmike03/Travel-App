import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { destinationById, destinations, Destination } from '../data/destinations';
import { REGION_POINT_ID, isWashout, weatherIcon, weatherLabel } from '../data/weather';
import { useRegionSetting } from '../context/RegionContext';
import { usePlaces } from '../context/PlacesContext';
import { useWeather } from '../context/WeatherContext';
import { TripStop, useTrips } from '../context/TripsContext';
import { PlaceHit, searchPlaces } from '../data/places';
import { useFavorites } from '../context/FavoritesContext';
import { showToast } from '../utils/toast';
import {
  AddToTripButton,
  CategoryPill,
  DestinationPhoto,
  RatingPill,
  SavedBadge,
} from '../components/common';
import { formatDate, formatTime, isoToDate, todayIso } from '../utils/planDates';

const CHIRPY_GUIDE = require('../../assets/branding/chirpy-guide.png');

const CATEGORY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  Waterfall: 'water-drop',
  Beach: 'beach-access',
  Nature: 'park',
  Hike: 'terrain',
  'Cliff jump': 'waves',
  Spring: 'pool',
};

function ratingOf(destination: Destination): number {
  const value = Number.parseFloat(destination.rating);
  return Number.isFinite(value) ? value : 0;
}

function tripTimingLabel(date: string): string {
  const days = Math.max(
    0,
    Math.round((isoToDate(date).getTime() - isoToDate(todayIso()).getTime()) / 86_400_000)
  );
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'in 1 week';
  if (days < 30) return `in ${Math.round(days / 7)} weeks`;
  if (days < 60) return 'in 1 month';
  return `in ${Math.round(days / 30)} months`;
}

export default function DiscoverScreen({
  onDestinationClick,
  onOpenTrips,
}: {
  onDestinationClick: (id: number) => void;
  onOpenTrips: () => void;
}) {
  const { colors } = useTheme();
  const { region, isHome } = useRegionSetting();
  const { places, addPlace } = usePlaces();
  const { byDestination, loading: weatherLoading } = useWeather();
  const { stops } = useTrips();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [tripReminderVisible, setTripReminderVisible] = useState(false);
  const [tripCycleVersion, setTripCycleVersion] = useState(0);
  const restartTripCycleHidden = useRef(false);
  const seq = useRef(0);

  const nextScheduledTrip = useMemo(() => {
    const today = todayIso();
    const futureStops = stops
      .filter((stop) => stop.date >= today)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
      );
    if (futureStops.length === 0) return null;
    const date = futureStops[0].date;
    return { date, stops: futureStops.filter((stop) => stop.date === date) };
  }, [stops]);
  const tripNoticeKey = nextScheduledTrip
    ? `${nextScheduledTrip.date}:${nextScheduledTrip.stops.map((stop) => stop.id).join(',')}`
    : null;

  useEffect(() => {
    if (!tripNoticeKey) {
      setTripReminderVisible(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const showReminder = () => {
      setTripReminderVisible(true);
      timer = setTimeout(hideReminder, 5_000);
    };
    const hideReminder = () => {
      setTripReminderVisible(false);
      timer = setTimeout(showReminder, 10_000);
    };

    if (restartTripCycleHidden.current) {
      restartTripCycleHidden.current = false;
      setTripReminderVisible(false);
      timer = setTimeout(showReminder, 10_000);
    } else {
      showReminder();
    }

    return () => clearTimeout(timer);
  }, [tripNoticeKey, tripCycleVersion]);

  const spots = useMemo(() => {
    const mine = places.filter(
      (place) =>
        place.latitude >= region.bbox[0] &&
        place.latitude <= region.bbox[1] &&
        place.longitude >= region.bbox[2] &&
        place.longitude <= region.bbox[3]
    );
    return isHome ? [...destinations, ...mine] : mine;
  }, [places, region, isHome]);

  const categories = useMemo(
    () => Array.from(new Set(spots.map((destination) => destination.category))),
    [spots]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return spots.filter((destination) => {
      const matchesQuery =
        normalizedQuery === '' ||
        destination.name.toLowerCase().includes(normalizedQuery) ||
        destination.category.toLowerCase().includes(normalizedQuery) ||
        destination.municipality.toLowerCase().includes(normalizedQuery) ||
        destination.shortDescription.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        selectedCategory === null || destination.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [spots, query, selectedCategory]);

  const regionWeather =
    byDestination[REGION_POINT_ID] ?? Object.values(byDestination)[0] ?? null;
  const currentConditions = regionWeather?.current;
  const todayForecast = regionWeather?.daily[0];
  const currentCode = currentConditions?.code ?? todayForecast?.code ?? 0;
  const rainChance = todayForecast?.rainChance ?? 0;
  const wetDay = isWashout(currentCode, rainChance);

  const recommended = useMemo(() => {
    const preferred = wetDay
      ? ['Nature', 'Spring']
      : currentCode <= 2
        ? ['Beach', 'Nature', 'Hike']
        : ['Nature', 'Waterfall', 'Spring'];
    const sorted = [...spots].sort((a, b) => ratingOf(b) - ratingOf(a));
    const bestMatch = sorted.filter((destination) => preferred.includes(destination.category));
    return [...bestMatch, ...sorted.filter((destination) => !bestMatch.includes(destination))].slice(
      0,
      5
    );
  }, [spots, wetDay, currentCode]);

  const showRecommendations =
    recommended.length > 0 && selectedCategory === null && query.trim() === '';

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setHits([]);
      return;
    }
    const request = ++seq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(normalizedQuery, region);
        if (request !== seq.current) return;
        const known = new Set(spots.map((destination) => destination.name.toLowerCase()));
        setHits(found.filter((hit) => !known.has(hit.name.toLowerCase())));
      } catch {
        if (request === seq.current) setHits([]);
      } finally {
        if (request === seq.current) setSearching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
    // spots is intentionally excluded so saving a result does not restart a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, region]);

  const openHit = async (hit: PlaceHit) => {
    try {
      const place = await addPlace(hit, region);
      onDestinationClick(place.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't open that place");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: 18, paddingBottom: 34 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pagePadding}>
        <View style={styles.brandRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, { color: colors.onBackground }]}>Ready to wander?</Text>
          </View>
          <View
            style={[
              styles.locationPill,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
              },
            ]}
          >
            <View style={styles.locationIcon}>
              <MaterialIcons name="location-on" size={17} color={colors.primary} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.locationLabel, { color: colors.onSurfaceVariant }]}>EXPLORING</Text>
              <Text numberOfLines={1} style={[styles.locationName, { color: colors.onSurface }]}>
                {region.name}
              </Text>
            </View>
          </View>
        </View>

        <ChirpyBrief
          loading={weatherLoading}
          code={currentCode}
          temp={currentConditions?.tempC}
          rainChance={rainChance}
          regionName={region.name}
          tripStops={
            nextScheduledTrip && tripReminderVisible ? nextScheduledTrip.stops : undefined
          }
          tripDate={nextScheduledTrip?.date}
          onOpenTrip={onOpenTrips}
          onDismissTrip={() => {
            restartTripCycleHidden.current = true;
            setTripCycleVersion((version) => version + 1);
          }}
        />

        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
          ]}
        >
          <View style={[styles.searchIcon, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="search" size={19} color={colors.primary} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isHome ? 'Search Bohol or any place' : `Search in ${region.name}`}
            placeholderTextColor={colors.onSurfaceVariant}
            autoCorrect={false}
            style={{ flex: 1, color: colors.onSurface, fontSize: 14, height: '100%' }}
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialIcons name="cancel" size={18} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          <CategoryChip
            label="All"
            icon="apps"
            selected={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category}
              label={category}
              icon={CATEGORY_ICONS[category] ?? 'place'}
              selected={category === selectedCategory}
              onPress={() => setSelectedCategory(category === selectedCategory ? null : category)}
            />
          ))}
        </ScrollView>
      ) : null}

      {!isHome && query.trim().length < 2 && spots.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="travel-explore" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Let’s explore {region.name}</Text>
          <Text style={[styles.emptyBody, { color: colors.onSurfaceVariant }]}>
            Search for beaches, cafés, landmarks, or hidden gems. Save anything you like and Chirpy
            will keep it close.
          </Text>
        </View>
      ) : null}

      {showRecommendations ? (
        <View style={{ marginTop: 26 }}>
          <SectionHeading
            title="Made for today"
            subtitle={wetDay ? 'Flexible picks for a rainy day' : 'Chirpy’s weather-smart picks'}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationRow}
          >
            {recommended.map((destination, index) => (
              <RecommendationCard
                key={destination.id}
                destination={destination}
                label={index === 0 ? 'BEST MATCH' : 'CHIRPY PICK'}
                onPress={() => onDestinationClick(destination.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {filtered.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <SectionHeading
            title={selectedCategory ?? (isHome ? 'Explore nearby' : 'Saved around here')}
            subtitle={`${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} to discover`}
          />
          <View style={[styles.destinationList, styles.pagePadding]}>
            {filtered.map((destination) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                onPress={() => onDestinationClick(destination.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {hits.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <SectionHeading title="Found on the map" subtitle={`${hits.length} around ${region.name}`} />
          <View style={[styles.destinationList, styles.pagePadding]}>
            {hits.map((hit) => (
              <MapResultCard
                key={`${hit.name}-${hit.latitude}-${hit.longitude}`}
                hit={hit}
                onPress={() => openHit(hit)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!searching && query.trim().length >= 2 && filtered.length === 0 && hits.length === 0 ? (
        <View style={[styles.emptySearch, { backgroundColor: colors.surface }]}>
          <MaterialIcons name="search-off" size={28} color={colors.onSurfaceVariant} />
          <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' }}>
            Chirpy couldn’t find “{query.trim()}” in {region.name}.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ChirpyBrief({
  loading,
  code,
  temp,
  rainChance,
  regionName,
  tripStops,
  tripDate,
  onOpenTrip,
  onDismissTrip,
}: {
  loading: boolean;
  code: number;
  temp?: number;
  rainChance: number;
  regionName: string;
  tripStops?: TripStop[];
  tripDate?: string;
  onOpenTrip: () => void;
  onDismissTrip: () => void;
}) {
  const { colors } = useTheme();
  const noticeReveal = useRef(new Animated.Value(0)).current;
  const wet = isWashout(code, rainChance);
  const firstStop = tripStops?.[0];
  const firstDestination = firstStop ? destinationById(firstStop.destinationId) : undefined;
  const tripTiming = tripDate ? tripTimingLabel(tripDate) : null;
  const advice = loading
    ? `I’m checking the skies over ${regionName}. Your fresh picks are almost ready.`
    : wet
      ? `Rain may drop by today. Choose easy-access stops and keep a cozy backup nearby.`
      : code <= 2
        ? `The skies look friendly. It’s a lovely day for a beach, viewpoint, or slow scenic drive.`
        : `Soft skies and cooler air make today great for nature walks and hidden local stops.`;

  useEffect(() => {
    if (!tripStops?.length) {
      noticeReveal.setValue(0);
      return;
    }
    Animated.spring(noticeReveal, {
      toValue: 1,
      speed: 14,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [noticeReveal, tripStops]);

  return (
    <Pressable
      onPress={tripStops?.length ? onOpenTrip : undefined}
      disabled={!tripStops?.length}
      style={[styles.briefCard, { backgroundColor: colors.primary }]}
    >
      <View style={[styles.briefOrb, { backgroundColor: withAlpha(colors.secondary, 0.22) }]} />
      <View style={[styles.briefOrbSmall, { backgroundColor: withAlpha(colors.onPrimary, 0.08) }]} />
      {tripStops?.length && firstStop ? (
        <Animated.View
          style={[
            styles.tripBriefCopy,
            {
              opacity: noticeReveal,
              transform: [
                { scale: noticeReveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                {
                  translateY: noticeReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                },
              ],
            },
          ]}
        >
          <View style={styles.briefLabel}>
            <MaterialIcons name="notifications-active" size={13} color={colors.secondaryContainer} />
            <Text style={[styles.briefLabelText, { color: colors.secondaryContainer }]}>
              {tripDate === todayIso() ? 'TODAY’S TRIP' : 'UPCOMING TRIP'}
            </Text>
          </View>
          <Text style={[styles.tripBriefTitle, { color: colors.onPrimary }]}>Trip {tripTiming}</Text>
          <Text numberOfLines={3} style={[styles.tripBriefBody, { color: withAlpha(colors.onPrimary, 0.86) }]}>
            {tripDate && tripDate !== todayIso() ? `${formatDate(tripDate)} · ` : ''}
            {tripStops.length === 1 ? '1 stop' : `${tripStops.length} stops`}
            {firstDestination ? ` · ${firstDestination.name}` : ''} at{' '}
            {formatTime(firstStop.hour, firstStop.minute)}
          </Text>
          <View style={styles.tripBriefLink}>
            <Text style={{ color: colors.secondaryContainer, fontSize: 10, fontWeight: '900' }}>
              Open trip
            </Text>
            <MaterialIcons name="arrow-forward" size={14} color={colors.secondaryContainer} />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.briefCopy}>
          <View style={styles.briefLabel}>
            <MaterialIcons name="auto-awesome" size={13} color={colors.secondaryContainer} />
            <Text style={[styles.briefLabelText, { color: colors.secondaryContainer }]}>CHIRPY’S TAKE</Text>
          </View>
          <View style={styles.weatherLine}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <MaterialIcons
                name={weatherIcon(code)}
                size={25}
                color={colors.secondaryContainer}
              />
            )}
            <Text style={[styles.weatherTemp, { color: colors.onPrimary }]}>
              {temp == null ? 'Today' : `${Math.round(temp)}°`}
            </Text>
            {!loading ? (
              <Text style={[styles.weatherCondition, { color: withAlpha(colors.onPrimary, 0.78) }]}>
                {weatherLabel(code)}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.briefAdvice, { color: withAlpha(colors.onPrimary, 0.88) }]}>
            {advice}
          </Text>
          {!loading && rainChance > 20 ? (
            <View style={styles.rainPill}>
              <MaterialIcons name="water-drop" size={12} color={colors.onPrimary} />
              <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '700' }}>
                {rainChance}% rain
              </Text>
            </View>
          ) : null}
        </View>
      )}
      {tripStops?.length ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onDismissTrip();
          }}
          hitSlop={10}
          style={[styles.tripBriefClose, { backgroundColor: withAlpha(colors.onPrimary, 0.13) }]}
        >
          <MaterialIcons name="close" size={17} color={colors.onPrimary} />
        </Pressable>
      ) : null}
      <Image source={CHIRPY_GUIDE} style={styles.guideMascot} resizeMode="contain" />
    </Pressable>
  );
}

function CategoryChip({
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
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.categoryChip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.outlineVariant,
        },
      ]}
    >
      <MaterialIcons name={icon} size={16} color={selected ? colors.onPrimary : colors.primary} />
      <Text
        style={{
          color: selected ? colors.onPrimary : colors.onSurface,
          fontSize: 12,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionHeading, styles.pagePadding]}>
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>{subtitle}</Text> : null}
    </View>
  );
}

function RecommendationCard({
  destination,
  label,
  onPress,
}: {
  destination: Destination;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { isFavorite } = useFavorites();
  const saved = isFavorite(destination.id);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.recommendationCard, { backgroundColor: colors.surface }]}
    >
      <DestinationPhoto
        destination={destination}
        style={StyleSheet.absoluteFill}
        iconSize={46}
      />
      <View style={styles.photoScrim} />
      <View style={styles.recommendationTop}>
        <View style={[styles.pickLabel, { backgroundColor: colors.secondary }]}> 
          <Text style={{ color: '#3F2A00', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
            {label}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <RatingPill rating={destination.rating} />
          {saved ? <SavedBadge /> : null}
        </View>
      </View>
      <View style={styles.recommendationBottom}>
        <Text numberOfLines={2} style={styles.recommendationTitle}>
          {destination.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <MaterialIcons name="location-on" size={13} color="rgba(255,255,255,0.88)" />
          <Text style={styles.recommendationLocation}>{destination.municipality}</Text>
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
      style={[styles.destinationCard, { backgroundColor: colors.surface }]}
    >
      <DestinationPhoto
        destination={destination}
        style={StyleSheet.absoluteFill}
        iconSize={46}
      />
      <View style={styles.destinationScrim} pointerEvents="none" />

      <View style={styles.destinationTopRow}>
        <CategoryPill category={destination.category} />
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <RatingPill rating={destination.rating} />
          {saved ? <SavedBadge /> : null}
        </View>
      </View>

      <View style={styles.destinationOverlayCopy}>
        <Text numberOfLines={2} style={styles.destinationTitle}>
          {destination.name}
        </Text>
        <View style={styles.destinationMetaRow}>
          <MaterialIcons name="location-on" size={14} color="rgba(255,255,255,0.9)" />
          <Text numberOfLines={1} style={styles.destinationLocation}>
            {destination.municipality}
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.destinationDescription}>
          {destination.shortDescription}
        </Text>
      </View>

      <View style={styles.destinationActions}>
        <Pressable
          onPress={() => toggle(destination.id)}
          hitSlop={8}
          style={styles.destinationActionButton}
        >
          <MaterialIcons
            name={saved ? 'bookmark' : 'bookmark-border'}
            size={20}
            color="#FFFFFF"
          />
        </Pressable>
        <AddToTripButton destinationId={destination.id} compact />
      </View>
    </Pressable>
  );
}

function MapResultCard({
  hit,
  onPress,
}: {
  hit: PlaceHit;
  onPress: () => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const [opening, setOpening] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        setOpening(true);
        try {
          await onPress();
        } finally {
          setOpening(false);
        }
      }}
      style={[
        styles.mapResult,
        { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
      ]}
    >
      <View style={[styles.mapResultIcon, { backgroundColor: colors.primaryContainer }]}>
        <MaterialIcons name="place" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.onSurface }}>
          {hit.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          {hit.category} · {hit.municipality}
        </Text>
      </View>
      {opening ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <MaterialIcons name="arrow-forward" size={19} color={colors.primary} />
      )}
    </Pressable>
  );
}

const cardShadow = {
  elevation: 3,
  shadowColor: '#082521',
  shadowOpacity: 0.09,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
} as const;

const styles = StyleSheet.create({
  pagePadding: { paddingHorizontal: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.8 },
  locationPill: {
    maxWidth: 132,
    minWidth: 112,
    height: 48,
    padding: 6,
    paddingRight: 11,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: { fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: 0.9 },
  locationName: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  briefCard: {
    minHeight: 212,
    marginTop: 20,
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    ...cardShadow,
  },
  briefOrb: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -38,
    top: -55,
  },
  briefOrbSmall: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    left: -30,
    bottom: -42,
  },
  briefCopy: { width: '55%', zIndex: 2 },
  tripBriefCopy: { width: '62%', zIndex: 2, justifyContent: 'center' },
  tripBriefTitle: { fontSize: 21, lineHeight: 25, fontWeight: '900', marginTop: 10 },
  tripBriefBody: { fontSize: 11, lineHeight: 16, marginTop: 6, fontWeight: '600' },
  tripBriefLink: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripBriefClose: {
    position: 'absolute',
    zIndex: 5,
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  briefLabelText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  weatherLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  weatherTemp: { fontSize: 27, fontWeight: '900', letterSpacing: -0.5 },
  weatherCondition: { flexShrink: 1, fontSize: 11, fontWeight: '600' },
  briefAdvice: { fontSize: 12, lineHeight: 17, marginTop: 8, fontWeight: '500' },
  rainPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  guideMascot: {
    position: 'absolute',
    right: -14,
    bottom: -12,
    width: 174,
    height: 174,
  },
  search: {
    height: 54,
    marginTop: 16,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  categoryChip: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: { gap: 3 },
  sectionTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
  recommendationRow: { paddingHorizontal: 20, paddingTop: 13, gap: 12 },
  recommendationCard: {
    width: 245,
    height: 210,
    borderRadius: 24,
    overflow: 'hidden',
    ...cardShadow,
  },
  photoScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,24,22,0.29)',
  },
  recommendationTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickLabel: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  recommendationBottom: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 5 },
  recommendationTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '800' },
  recommendationLocation: { color: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: '600' },
  destinationList: { paddingTop: 13, gap: 12 },
  destinationCard: {
    height: 238,
    borderRadius: 24,
    overflow: 'hidden',
    ...cardShadow,
  },
  destinationScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4,22,20,0.30)',
  },
  destinationTopRow: {
    position: 'absolute',
    top: 13,
    left: 13,
    right: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  destinationOverlayCopy: {
    position: 'absolute',
    left: 15,
    right: 66,
    bottom: 15,
    gap: 5,
  },
  destinationTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.35,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  destinationMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  destinationLocation: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '700' },
  destinationDescription: { color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 15 },
  destinationActions: {
    position: 'absolute',
    right: 13,
    bottom: 13,
    alignItems: 'center',
    gap: 8,
  },
  destinationActionButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,31,28,0.55)',
  },
  mapResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderRadius: 18,
    borderWidth: 1,
  },
  mapResultIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
    alignItems: 'center',
    gap: 8,
    ...cardShadow,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  emptySearch: {
    marginHorizontal: 20,
    marginTop: 28,
    padding: 28,
    borderRadius: 22,
    alignItems: 'center',
    gap: 9,
  },
});
