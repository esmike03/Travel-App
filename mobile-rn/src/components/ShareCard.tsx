// Strava-style shareable card for a trip plan: the user's photo full-bleed, Bohol's
// silhouette with a pin per stop in this plan (green once visited, white while
// not) joined by the real road route, and the plan's numbers underneath.
// Captured with react-native-view-shot and handed to the OS share sheet (which is
// what routes it to Instagram/Facebook/etc) or saved to the camera roll.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
// The legacy entry point on purpose. In SDK 57 the package's main export
// became the new Asset/Query API, whose module body eagerly requires the
// `ExpoMediaLibraryNext` native module — which Expo Go does not carry, so a
// bare `from 'expo-media-library'` crashes the app on load. Everything used
// here (permissions + saveToLibraryAsync) is the legacy API anyway.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { Destination, destinationById } from '../data/destinations';
import { BOHOL_SILHOUETTE } from '../data/boholShape';
import { Silhouette, buildSilhouette } from '../data/silhouette';
import { useRegionSetting } from '../context/RegionContext';
import { TripStop } from '../context/TripsContext';
import { usePlans, budgetSpent, tripTitle } from '../context/PlansContext';
import { StopGroup } from '../utils/plans';
import { formatDate } from '../utils/planDates';
import { pathLengthKm } from '../utils/route';
import { showToast } from '../utils/toast';

// 1080x1350 (4:5) — Instagram's portrait feed size, which Facebook also accepts
// uncropped. The card is laid out at these exact pixels and scaled down only for
// the on-screen preview, so the captured image is native resolution, not an
// upscaled thumbnail.
export const EXPORT_W = 1080;
export const EXPORT_H = 1350;

const VISITED_GREEN = '#22C55E';
const CARD_BG = '#0B1F17';
const PIN_IDLE = 'rgba(255,255,255,0.55)';

const CHIRPY_MASCOT = require('../../assets/branding/chirpy-guide.png');

export interface PlanTotals {
  visitedCount: number;
  planCount: number;
  km: number;
  /**
   * How much of the budget went unspent, as a percentage of the target: 40 means
   * came in 40% under, -50 means overspent by half. Null when the plan has no
   * usable target (none set, or zero — nothing to be a percentage of).
   */
  percentSaved: number | null;
  towns: string[];
}

// Everything on the card is scoped to the plan being shared, not the whole app:
// the pins, the route and these numbers all describe one trip.
export function usePlanTotals(group: StopGroup): PlanTotals {
  const { getMeta } = usePlans();
  const meta = getMeta(group.key);
  return useMemo(() => {
    const visited = group.stops.filter((s) => s.visited);
    // Distance actually covered — the visited stops in their planned order.
    const km = pathLengthKm(visited);
    const spent = budgetSpent(meta);
    const target = meta.targetBudget;
    // Guard target > 0: a zero target has no percentage, and dividing by it
    // would put Infinity on the card.
    const percentSaved =
      target != null && target > 0 ? ((target - spent) / target) * 100 : null;
    const towns: string[] = [];
    for (const s of visited) {
      const d = destinationById(s.destinationId);
      if (d && !towns.includes(d.municipality)) towns.push(d.municipality);
    }
    return { visitedCount: visited.length, planCount: group.stops.length, km, percentSaved, towns };
  }, [group, meta]);
}

type RouteState = 'loading' | 'road' | 'none';
type ShareLayout = 'single' | 'collage';
type LngLat = [number, number];

/**
 * The plan's route along the real roads (OSRM), ready to draw on the silhouette.
 *
 * There is deliberately NO straight-line fallback. Joining the stops with
 * straight chords draws lines across open sea — a leg from Anda back to Panglao
 * cuts clean outside the island — which reads as a rendering bug on a shared
 * post. If the road route is unavailable, the card shows pins and no line.
 */
function useRoadRoute(stops: TripStop[]): { coordinates: LngLat[]; state: RouteState } {
  const legs = useMemo(
    () =>
      stops
        .map((s) => destinationById(s.destinationId))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => [d.longitude, d.latitude] as [number, number]),
    [stops]
  );
  const [coordinates, setCoordinates] = useState<LngLat[]>([]);
  const [state, setState] = useState<RouteState>(legs.length > 1 ? 'loading' : 'none');

  useEffect(() => {
    if (legs.length < 2) {
      setCoordinates([]);
      setState('none');
      return;
    }
    let active = true;
    setState('loading');
    const coords = legs.map(([lng, lat]) => `${lng},${lat}`).join(';');
    // overview=simplified, not full: at 16 stops `full` returns ~16k points
    // (~187KB) for a shape 100 units across — pointless detail that is slow to
    // download on mobile and a huge string to hand to SVG. `simplified` is ~258
    // points (~3KB) and identical at this size.
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const geom = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (geom && geom.length > 1) {
          setCoordinates(geom);
          setState('road');
        } else {
          setCoordinates([]);
          setState('none'); // routable answer with no geometry
        }
      })
      .catch(() => {
        if (active) {
          setCoordinates([]);
          setState('none'); // offline / OSRM down
        }
      });
    return () => {
      active = false;
    };
  }, [legs]);

  return { coordinates, state };
}

/** The card itself — laid out at export size, scaled down only for preview. */
function PhotoBackdrop({ uris, layout }: { uris: string[]; layout: ShareLayout }) {
  const photos = uris.slice(0, 4);
  if (!photos.length) return null;

  if (layout === 'single' || photos.length === 1) {
    return <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }

  if (photos.length === 2) {
    return (
      <View style={styles.collageBackdrop}>
        <Image source={{ uri: photos[0] }} style={styles.collageImage} resizeMode="cover" />
        <Image source={{ uri: photos[1] }} style={styles.collageImage} resizeMode="cover" />
      </View>
    );
  }

  if (photos.length === 3) {
    return (
      <View style={styles.collageBackdrop}>
        <Image source={{ uri: photos[0] }} style={styles.collageImage} resizeMode="cover" />
        <View style={styles.collageColumn}>
          <Image source={{ uri: photos[1] }} style={styles.collageImage} resizeMode="cover" />
          <Image source={{ uri: photos[2] }} style={styles.collageImage} resizeMode="cover" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.collageGrid}>
      <View style={styles.collageRow}>
        <Image source={{ uri: photos[0] }} style={styles.collageImage} resizeMode="cover" />
        <Image source={{ uri: photos[1] }} style={styles.collageImage} resizeMode="cover" />
      </View>
      <View style={styles.collageRow}>
        <Image source={{ uri: photos[2] }} style={styles.collageImage} resizeMode="cover" />
        <Image source={{ uri: photos[3] }} style={styles.collageImage} resizeMode="cover" />
      </View>
    </View>
  );
}

export function ShareCardView({
  group,
  totals,
  photoUris,
  layout,
  route,
  silhouette,
}: {
  group: StopGroup;
  totals: PlanTotals;
  photoUris: string[];
  layout: ShareLayout;
  route: { coordinates: LngLat[]; state: RouteState };
  silhouette: Silhouette;
}) {
  const { getMeta } = usePlans();
  const title = tripTitle(getMeta(group.key));
  const pins = useMemo(
    () =>
      group.stops
        .map((s) => {
          const d = destinationById(s.destinationId);
          if (!d) return null;
          return { id: s.id, visited: s.visited, ...silhouette.project(d.longitude, d.latitude) };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [group.stops, silhouette]
  );
  const routePoints = useMemo(
    () =>
      route.coordinates
        .map(([longitude, latitude]) => {
          const point = silhouette.project(longitude, latitude);
          return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        })
        .join(' '),
    [route.coordinates, silhouette]
  );

  return (
    <View style={styles.card}>
      <PhotoBackdrop uris={photoUris} layout={layout} />

      {/* Map sits near the top; everything else is pinned to the bottom, leaving
          the middle of the photo untouched. */}
      <View style={styles.shapeWrap}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${silhouette.view} ${silhouette.view}`}>
          {/* Stroke widths and the pin radius are viewBox units, so they scale
              with the shape. They are set against a small silhouette — shrink it
              further and these need raising again or the outline disappears once
              the export is viewed at feed size. */}
          {silhouette.paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="rgba(255,255,255,0.10)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={1.1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* Only ever the real road route — never a straight stand-in. */}
          {route.state === 'road' ? (
            <Polyline
              points={routePoints}
              fill="none"
              stroke="#fff"
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {pins.map((p) => (
            <Circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={3.4}
              fill={p.visited ? VISITED_GREEN : PIN_IDLE}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </Svg>
      </View>

      {/* Bare photo between the map and the text — the point of the card. */}
      <View style={{ flex: 1 }} />

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {totals.towns.length ? (
        <Text numberOfLines={1} style={styles.towns}>
          {totals.towns.slice(0, 3).join(' · ')}
          {totals.towns.length > 3 ? ` +${totals.towns.length - 3}` : ''}
        </Text>
      ) : null}

      {/* No separator rule — the spacing does that job. Every stat here is one
          that always says something: a slot that reads 0 or "—" on a shared post
          just looks broken, so the budget only appears once a target is set. */}
      <View style={styles.statsRow}>
        <Stat value={`${totals.visitedCount}/${totals.planCount}`} label="PLACES" />
        <Stat value={formatKmStat(totals.km)} label="DISTANCE" />
        {totals.percentSaved != null ? (
          <Stat value={formatPercent(totals.percentSaved)} label="BUDGET SAVED" />
        ) : null}
      </View>

      {/* Chirpy signs the card off, so a shared post carries the app's face and
          not just its name. */}
      <View style={styles.brandRow}>
        <Image source={CHIRPY_MASCOT} style={styles.brandMascot} resizeMode="contain" />
        <Text style={styles.brand}>CHIRPY · BOHOL</Text>
      </View>
    </View>
  );
}

/**
 * The same card for a single place rather than a whole plan: one pin on the
 * province, the place's own name, and no route — there is no journey to draw
 * between one stop and itself.
 */
export function StopShareCardView({
  destination,
  date,
  visited,
  photoUris,
  layout,
  silhouette,
}: {
  destination: Destination;
  date: string;
  visited: boolean;
  photoUris: string[];
  layout: ShareLayout;
  silhouette: Silhouette;
}) {
  const pin = useMemo(
    () => silhouette.project(destination.longitude, destination.latitude),
    [destination, silhouette]
  );

  return (
    <View style={styles.card}>
      <PhotoBackdrop uris={photoUris} layout={layout} />

      <View style={styles.shapeWrap}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${silhouette.view} ${silhouette.view}`}>
          {silhouette.paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="rgba(255,255,255,0.10)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={1.1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* A halo around the pin: a lone dot on a whole province is easy to
              lose, where a plan's cluster of pins reads on its own. */}
          <Circle
            cx={pin.x}
            cy={pin.y}
            r={7}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={1}
          />
          <Circle
            cx={pin.x}
            cy={pin.y}
            r={3.4}
            fill={visited ? VISITED_GREEN : PIN_IDLE}
            stroke="#fff"
            strokeWidth={1}
          />
        </Svg>
      </View>

      <View style={{ flex: 1 }} />

      <Text numberOfLines={2} style={styles.title}>
        {destination.name}
      </Text>
      <Text numberOfLines={1} style={styles.towns}>
        {destination.municipality}
      </Text>

      <View style={styles.statsRow}>
        <Stat value={formatDate(date)} label={visited ? 'VISITED' : 'PLANNED'} />
        <Stat value={destination.category} label="KIND OF PLACE" />
      </View>

      <View style={styles.brandRow}>
        <Image source={CHIRPY_MASCOT} style={styles.brandMascot} resizeMode="contain" />
        <Text style={styles.brand}>CHIRPY · BOHOL</Text>
      </View>
    </View>
  );
}

// Centred, in step with the rest of the card.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function formatKmStat(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 100 ? 1 : 0)} km`;
}

// Overspend is real information, so it goes on the card as a negative rather
// than being clamped to 0 or hidden.
function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

/**
 * The province the cards draw: the hand-made Bohol shape at home (its OSM admin
 * boundary is a territorial-waters blob), the province polygon everywhere else,
 * and Bohol as a last resort if that province's polygon hasn't loaded.
 */
function useSilhouette(): Silhouette {
  const { region, isHome } = useRegionSetting();
  return useMemo<Silhouette>(
    () => (isHome ? BOHOL_SILHOUETTE : buildSilhouette(region.polygon) ?? BOHOL_SILHOUETTE),
    [isHome, region]
  );
}

/**
 * Full-screen sheet: preview the card, attach a photo, then share or save it.
 *
 * Everything except the card itself is shared between the plan card and the
 * single-place card — photo picking, the scaled preview, capture, and the two
 * actions all behave identically, so only `renderCard` differs.
 */
function ShareSheet({
  heading,
  subheading,
  dialogTitle,
  waiting,
  waitingLabel,
  notice,
  renderCard,
  onClose,
}: {
  heading: string;
  subheading: string;
  /** Names the file in the OS share sheet. */
  dialogTitle: string;
  /** Blocks Save/Share while something the card needs is still resolving. */
  waiting: boolean;
  waitingLabel: string;
  /** Shown once `waiting` clears, to explain anything missing from the card. */
  notice?: string | null;
  renderCard: (photoUris: string[], layout: ShareLayout) => React.ReactNode;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shotRef = useRef<View>(null);
  const [layout, setLayout] = useState<ShareLayout>('single');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Preview is a scaled-down view of the same export-sized card.
  const previewW = Math.min(screenW - 40, 340);
  const scale = previewW / EXPORT_W;
  const previewH = EXPORT_H * scale;

  const pickPhoto = async (from: 'library' | 'camera') => {
    if (layout === 'collage' && from === 'camera' && photoUris.length >= 4) {
      showToast('A collage can include up to 4 photos');
      return;
    }
    const perm =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast(
        from === 'camera'
          ? 'Camera access is needed to take a photo'
          : 'Photo access is needed to pick a photo'
      );
      return;
    }
    const isMultiPick = from === 'library' && layout === 'collage';
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.9,
      ...(isMultiPick
        ? {
            allowsMultipleSelection: true,
            selectionLimit: 4,
            orderedSelection: true,
          }
        : {}),
    };
    const res =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets.length) {
      const selected = res.assets.map((asset) => asset.uri).slice(0, 4);
      if (layout === 'collage') {
        if (from === 'camera') {
          setPhotoUris((current) => [...current, ...selected].slice(0, 4));
        } else {
          setPhotoUris(selected);
        }
      } else {
        setPhotoUris([selected[0]]);
      }
    }
  };

  // The view is already laid out at EXPORT_W x EXPORT_H, so no width/height
  // here: passing them makes view-shot rescale the bitmap for nothing.
  // `tmpfile` gives a file:///...png URI, which is what MediaLibrary and the
  // share sheet both need on Android.
  const capture = async (): Promise<string> =>
    captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });

  const onShare = async () => {
    setBusy(true);
    try {
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) {
        showToast('Sharing is not available on this device');
        return;
      }
      // The OS share sheet is what offers Instagram/Facebook/Messenger etc.
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `${dialogTitle} · Chirpy`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[ShareCard] share failed:', e);
      showToast(`Couldn't share: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    try {
      // writeOnly: saving needs permission to add photos, not to read the whole
      // library — the smaller ask is likelier to be granted.
      let perm = await MediaLibrary.getPermissionsAsync(true);
      if (!perm.granted && perm.canAskAgain) perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        showToast(
          perm.canAskAgain
            ? 'Photo access is needed to save the card'
            : 'Photo access is blocked — enable it for Expo Go in Settings'
        );
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast('Saved to your photos');
    } catch (e) {
      // Say what actually went wrong; a bare "couldn't save" leaves the user
      // (and us) with nothing to act on.
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[ShareCard] save failed:', e);
      showToast(`Couldn't save: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[styles.sheetHeader, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: withAlpha(colors.surfaceVariant, pressed ? 0.9 : 0.55),
              },
            ]}
          >
            <MaterialIcons name="close" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>{heading}</Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 1 }}
            >
              {subheading}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, alignItems: 'center', paddingBottom: 28 }}
        >
          <View
            style={[
              styles.layoutPicker,
              { width: previewW, backgroundColor: withAlpha(colors.surfaceVariant, 0.58) },
            ]}
          >
            {([
              { id: 'single' as const, icon: 'crop-portrait' as const, label: 'Single photo' },
              { id: 'collage' as const, icon: 'grid-view' as const, label: 'Collage' },
            ]).map((option) => {
              const selected = layout === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setLayout(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.layoutOption,
                    {
                      backgroundColor: selected ? colors.surface : 'transparent',
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={option.icon}
                    size={17}
                    color={selected ? colors.primary : colors.onSurfaceVariant}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: selected ? '800' : '600',
                      color: selected ? colors.onSurface : colors.onSurfaceVariant,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* The preview box reserves the scaled size; the card inside keeps its
              full 1080x1350 layout and is only visually scaled, so the capture
              is native resolution rather than an upscaled screenshot. */}
          <View
            style={[
              styles.preview,
              { width: previewW, height: previewH, backgroundColor: CARD_BG },
            ]}
          >
            {/* The captured view MUST carry the export size itself. Without an
                explicit width it stretches to the preview box (340pt) and the
                card is clipped to a narrow slice — captureRef snapshots the
                view's own layout box, not its children. */}
            <View
              ref={shotRef}
              collapsable={false}
              style={{
                width: EXPORT_W,
                height: EXPORT_H,
                transform: [{ scale }],
                transformOrigin: 'top left',
              }}
            >
              {renderCard(photoUris, layout)}
            </View>
          </View>

          {waiting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>{waitingLabel}</Text>
            </View>
          ) : notice ? (
            // Say so rather than quietly drawing a made-up line.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <MaterialIcons name="cloud-off" size={14} color={colors.onSurfaceVariant} />
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>{notice}</Text>
            </View>
          ) : null}

          {/* Format is worth stating once, quietly, rather than in the title. */}
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, marginTop: 12 }}>
            {layout === 'collage' && photoUris.length
              ? `${photoUris.length}/4 photos · `
              : ''}
            {EXPORT_W}×{EXPORT_H} · 4:5 for Instagram & Facebook
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, alignSelf: 'stretch' }}>
            <PhotoButton
              icon="photo-library"
              label={
                layout === 'collage'
                  ? photoUris.length
                    ? 'Change photos'
                    : 'Add photos'
                  : photoUris.length
                    ? 'Change photo'
                    : 'Add photo'
              }
              onPress={() => pickPhoto('library')}
            />
            <PhotoButton
              icon="photo-camera"
              label={layout === 'collage' && photoUris.length ? 'Add camera' : 'Camera'}
              onPress={() => pickPhoto('camera')}
            />
            {photoUris.length ? (
              <Pressable
                onPress={() => setPhotoUris([])}
                accessibilityRole="button"
                accessibilityLabel="Remove selected photos"
                style={({ pressed }) => [
                  styles.ghostButton,
                  {
                    width: 46,
                    borderColor: withAlpha(colors.outlineVariant, 0.9),
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <MaterialIcons name="delete-outline" size={19} color={colors.onSurfaceVariant} />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>

        {/* Actions */}
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: withAlpha(colors.outlineVariant, 0.7),
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable
            disabled={busy || waiting}
            onPress={onSave}
            style={({ pressed }) => [
              styles.actionButton,
              {
                flex: 1,
                borderWidth: 1,
                borderColor: withAlpha(colors.outlineVariant, 0.9),
                opacity: busy || waiting ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="download" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text>
          </Pressable>
          <Pressable
            disabled={busy || waiting}
            onPress={onShare}
            style={({ pressed }) => [
              styles.actionButton,
              {
                flex: 2,
                backgroundColor: colors.primary,
                opacity: busy || waiting ? 0.5 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="share" size={18} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Share</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Share a whole plan: every stop pinned, joined by the road route travelled. */
export default function ShareVisitModal({
  group,
  onClose,
}: {
  group: StopGroup;
  onClose: () => void;
}) {
  const { getMeta } = usePlans();
  const title = tripTitle(getMeta(group.key));
  const silhouette = useSilhouette();
  const totals = usePlanTotals(group);
  // A planned stop should not appear as travelled on the share card. Route only
  // through stops the traveller has actually marked as visited.
  const visitedStops = useMemo(() => group.stops.filter((stop) => stop.visited), [group.stops]);
  const route = useRoadRoute(visitedStops);

  return (
    <ShareSheet
      heading="Share this trip"
      subheading={title}
      dialogTitle={title}
      // Sharing while the road route is still loading would post the card
      // without it, so the actions wait for it to resolve either way.
      waiting={route.state === 'loading'}
      waitingLabel="Tracing your route along the roads…"
      notice={
        route.state === 'none' && visitedStops.length > 1
          ? 'Route unavailable offline — sharing your stops without it.'
          : null
      }
      onClose={onClose}
      renderCard={(photoUris, layout) => (
        <ShareCardView
          group={group}
          totals={totals}
          photoUris={photoUris}
          layout={layout}
          route={route}
          silhouette={silhouette}
        />
      )}
    />
  );
}

/** Share one place on its own, in the same visual language as the plan card. */
export function ShareStopModal({
  destinationId,
  date,
  visited,
  onClose,
}: {
  destinationId: number;
  date: string;
  visited: boolean;
  onClose: () => void;
}) {
  const silhouette = useSilhouette();
  const destination = destinationById(destinationId);

  // A stop whose destination has gone (a custom place deleted, say) has nothing
  // to put on a card, so there is no sheet to show.
  useEffect(() => {
    if (!destination) onClose();
  }, [destination, onClose]);
  if (!destination) return null;

  return (
    <ShareSheet
      heading={visited ? 'Share this visit' : 'Share this place'}
      subheading={`${destination.name} · ${destination.municipality}`}
      dialogTitle={destination.name}
      // One pin needs no route lookup, so the card is ready immediately.
      waiting={false}
      waitingLabel=""
      onClose={onClose}
      renderCard={(photoUris, layout) => (
        <StopShareCardView
          destination={destination}
          date={date}
          visited={visited}
          photoUris={photoUris}
          layout={layout}
          silhouette={silhouette}
        />
      )}
    />
  );
}

function PhotoButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.ghostButton,
        {
          flex: 1,
          borderColor: withAlpha(colors.outlineVariant, 0.9),
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>{label}</Text>
    </Pressable>
  );
}

// With no scrim over the photo, every white element carries its own shadow —
// that alone has to hold the text legible against an unknown background.
const shadow = {
  textShadowColor: 'rgba(0,0,0,0.75)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 16,
} as const;

// Card styles are authored at export pixels (1080x1350), not screen points —
// see EXPORT_W. The sheet styles below them are ordinary screen points.
const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutPicker: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
  },
  layoutOption: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  // Rounded for the preview only — the exported PNG keeps square corners.
  preview: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 52,
    borderRadius: 16,
  },
  card: {
    width: EXPORT_W,
    height: EXPORT_H,
    backgroundColor: CARD_BG,
    paddingHorizontal: 64,
    paddingTop: 56,
    paddingBottom: 64,
    // One centred column: the silhouette, the title block and the sign-off all
    // share the card's centre line.
    alignItems: 'center',
  },
  // Sits near the top as a small locator mark, leaving the photo to carry the
  // card. The viewBox is square and the wrap is wider than it is tall, so this
  // height is what sets the silhouette's size.
  // alignSelf: stretch on these — the card centres its children, which would
  // otherwise shrink them to their content and collapse the SVG's width="100%".
  shapeWrap: {
    alignSelf: 'stretch',
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collageBackdrop: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: CARD_BG,
  },
  collageGrid: {
    ...StyleSheet.absoluteFill,
    gap: 8,
    backgroundColor: CARD_BG,
  },
  collageRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  collageColumn: {
    flex: 1,
    gap: 8,
  },
  collageImage: {
    flex: 1,
  },
  title: {
    alignSelf: 'stretch',
    fontSize: 60,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    ...shadow,
  },
  towns: {
    alignSelf: 'stretch',
    fontSize: 30,
    color: '#fff',
    marginTop: 6,
    opacity: 0.9,
    textAlign: 'center',
    ...shadow,
  },
  statsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    marginTop: 34,
  },
  statValue: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    ...shadow,
  },
  statLabel: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#fff',
    marginTop: 2,
    opacity: 0.85,
    textAlign: 'center',
    ...shadow,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 26,
  },
  brandMascot: { width: 62, height: 62 },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#fff',
    opacity: 0.8,
    ...shadow,
  },
});
