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
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinationById } from '../data/destinations';
import { BOHOL_PATHS, SHAPE_VIEW, projectToShape } from '../data/boholShape';
import { TripStop } from '../context/TripsContext';
import { usePlans, budgetSpent } from '../context/PlansContext';
import { StopGroup } from '../utils/plans';
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

/**
 * The plan's route along the real roads (OSRM), ready to draw on the silhouette.
 *
 * There is deliberately NO straight-line fallback. Joining the stops with
 * straight chords draws lines across open sea — a leg from Anda back to Panglao
 * cuts clean outside the island — which reads as a rendering bug on a shared
 * post. If the road route is unavailable, the card shows pins and no line.
 */
function useRoadRoute(stops: TripStop[]): { points: string; state: RouteState } {
  const legs = useMemo(
    () =>
      stops
        .map((s) => destinationById(s.destinationId))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => [d.longitude, d.latitude] as [number, number]),
    [stops]
  );
  const [points, setPoints] = useState('');
  const [state, setState] = useState<RouteState>(legs.length > 1 ? 'loading' : 'none');

  useEffect(() => {
    if (legs.length < 2) {
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
          setPoints(geom.map(([lng, lat]) => project(lng, lat)).join(' '));
          setState('road');
        } else {
          setState('none'); // routable answer with no geometry
        }
      })
      .catch(() => {
        if (active) setState('none'); // offline / OSRM down
      });
    return () => {
      active = false;
    };
  }, [legs]);

  return { points, state };
}

function project(lng: number, lat: number): string {
  const p = projectToShape(lng, lat);
  return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}

/** The card itself — laid out at export size, scaled down only for preview. */
export function ShareCardView({
  group,
  totals,
  photoUri,
  route,
}: {
  group: StopGroup;
  totals: PlanTotals;
  photoUri: string | null;
  route: { points: string; state: RouteState };
}) {
  const pins = useMemo(
    () =>
      group.stops
        .map((s) => {
          const d = destinationById(s.destinationId);
          if (!d) return null;
          return { id: s.id, visited: s.visited, ...projectToShape(d.longitude, d.latitude) };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [group.stops]
  );

  return (
    <View style={styles.card}>
      {photoUri ? (
        // Full-bleed and untouched — no scrim, no dimming. Legibility comes from
        // the text's own shadow, the way Strava does it.
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      {/* Map sits near the top; everything else is pinned to the bottom, leaving
          the middle of the photo untouched. */}
      <View style={styles.shapeWrap}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${SHAPE_VIEW} ${SHAPE_VIEW}`}>
          {BOHOL_PATHS.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="rgba(255,255,255,0.10)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={0.7}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* Only ever the real road route — never a straight stand-in. */}
          {route.state === 'road' ? (
            <Polyline
              points={route.points}
              fill="none"
              stroke="#fff"
              strokeWidth={1.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {pins.map((p) => (
            <Circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={2.4}
              fill={p.visited ? VISITED_GREEN : PIN_IDLE}
              stroke="#fff"
              strokeWidth={0.7}
            />
          ))}
        </Svg>
      </View>

      {/* Bare photo between the map and the text — the point of the card. */}
      <View style={{ flex: 1 }} />

      <Text numberOfLines={1} style={styles.title}>
        {group.label}
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

      <Text style={styles.brand}>TRAVS · BOHOL</Text>
    </View>
  );
}

// Left-aligned so the stats line up with the title rather than forming a
// separate centred band.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'flex-start' }}>
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
 * Full-screen sheet: preview the card, attach a photo, then share or save it.
 */
export default function ShareVisitModal({
  group,
  onClose,
}: {
  group: StopGroup;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const totals = usePlanTotals(group);
  const route = useRoadRoute(group.stops);
  const shotRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Preview is a scaled-down view of the same export-sized card.
  const previewW = Math.min(screenW - 40, 340);
  const scale = previewW / EXPORT_W;
  const previewH = EXPORT_H * scale;

  const pickPhoto = async (from: 'library' | 'camera') => {
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
    // No allowsEditing: pick a photo and it just fills the card, the way Strava
    // does it. The card crops it to 4:5 itself (resizeMode cover), so there is
    // no editor step in the way.
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.9,
    };
    const res =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
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
        dialogTitle: `${group.label} · Travs`,
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

  // Sharing while the road route is still loading would post the straight-line
  // fallback, so the actions wait for it to resolve either way.
  const waiting = route.state === 'loading';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 48, paddingBottom: 8 }}>
          <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface }}>
              Share this trip
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              {group.label} · {EXPORT_W}×{EXPORT_H} for Instagram & Facebook
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center', paddingBottom: 40 }}>
          {/* The preview box reserves the scaled size; the card inside keeps its
              full 1080x1350 layout and is only visually scaled, so the capture
              is native resolution rather than an upscaled screenshot. */}
          {/* Rounded for the preview only — the exported PNG keeps square
              corners, which is what a feed post wants. */}
          <View style={{ width: previewW, height: previewH, borderRadius: 20, overflow: 'hidden' }}>
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
              <ShareCardView group={group} totals={totals} photoUri={photoUri} route={route} />
            </View>
          </View>

          {waiting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                Tracing your route along the roads…
              </Text>
            </View>
          ) : route.state === 'none' && group.stops.length > 1 ? (
            // Say so rather than quietly drawing a made-up line.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <MaterialIcons name="cloud-off" size={14} color={colors.onSurfaceVariant} />
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                Route unavailable offline — sharing your stops without it.
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
            <PhotoButton
              icon="photo-library"
              label={photoUri ? 'Change photo' : 'Pick photo'}
              onPress={() => pickPhoto('library')}
            />
            <PhotoButton icon="photo-camera" label="Camera" onPress={() => pickPhoto('camera')} />
            {photoUri ? (
              <Pressable
                onPress={() => setPhotoUri(null)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(colors.surfaceVariant, 0.6),
                }}
              >
                <MaterialIcons name="delete-outline" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.surface }}>
          <Pressable
            disabled={busy || waiting}
            onPress={onSave}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 50,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              opacity: busy || waiting ? 0.6 : 1,
            }}
          >
            <MaterialIcons name="download" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text>
          </Pressable>
          <Pressable
            disabled={busy || waiting}
            onPress={onShare}
            style={{
              flex: 2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 50,
              borderRadius: 14,
              backgroundColor: colors.primary,
              opacity: busy || waiting ? 0.6 : 1,
            }}
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
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 44,
        borderRadius: 12,
        backgroundColor: withAlpha(colors.primary, 0.14),
      }}
    >
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{label}</Text>
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

// Authored at export pixels (1080x1350), not screen points — see EXPORT_W.
const styles = StyleSheet.create({
  card: {
    width: EXPORT_W,
    height: EXPORT_H,
    backgroundColor: CARD_BG,
    paddingHorizontal: 64,
    paddingTop: 56,
    paddingBottom: 64,
  },
  // Sits near the top and takes about a third of the card, so the photo below it
  // is the thing you actually see.
  shapeWrap: {
    height: 440,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 60,
    fontWeight: '800',
    color: '#fff',
    ...shadow,
  },
  towns: {
    fontSize: 30,
    color: '#fff',
    marginTop: 6,
    opacity: 0.9,
    ...shadow,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 34,
  },
  statValue: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    ...shadow,
  },
  statLabel: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#fff',
    marginTop: 2,
    opacity: 0.85,
    ...shadow,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#fff',
    marginTop: 30,
    opacity: 0.8,
    ...shadow,
  },
});
