// Ported from ui/screens/ItineraryScreen.kt, then extended into a day/week/month
// trip planner: stops are grouped by date granularity, each leg shows the ETA to
// the next stop, every group opens a route map, a "Start" flow routes from the
// user's location and marks nearby stops visited.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinations, destinationById, distanceKm, Destination } from '../data/destinations';
import { useTrips, TripStop } from '../context/TripsContext';
import { useRegionSetting } from '../context/RegionContext';
import { usePlaces } from '../context/PlacesContext';
import { PlaceHit, searchPlaces } from '../data/places';
import { PlanScope, PlanRange, formatDate, formatTime, isoToDate } from '../utils/planDates';
import { StopGroup, groupPlans, isArchived } from '../utils/plans';
import {
  PlanDraft,
  PlanDraftFields,
  SCOPE_META,
  draftRange,
  newPlanDraft,
  stopDateFor,
} from '../components/PlanPicker';
import { useUserLocation, Coords } from '../hooks/useUserLocation';
import { usePlans, budgetSpent } from '../context/PlansContext';
import { estimateEtaMinutes, formatDistance, formatEta, formatKm } from '../utils/format';
import { routeSuggestion } from '../utils/route';
import { showToast } from '../utils/toast';
import TripDayMap from './TripDayMap';
import PlanDetailsModal from './PlanDetailsModal';
import ShareVisitModal from '../components/ShareCard';
import { PlanWeatherBanner, StopWeatherPill } from '../components/Weather';
import PlanListSheet from '../components/PlanListSheet';

const VISITED_GREEN = '#16A34A';

export default function ItineraryScreen() {
  const { colors } = useTheme();
  const { stops, add, update, remove, setVisited, reorder } = useTrips();
  const { location, hasPermission, request } = useUserLocation();
  // Subscribing keeps this screen (and the map, share card and details modal it
  // renders) in step with the custom-place registry: a stop pointing at a place
  // that hasn't loaded yet resolves to nothing and would render blank.
  usePlaces();
  // Which plan the page is showing. Null means "today's", so the page follows
  // the date on its own until the user opens another from the plans list.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showPlanList, setShowPlanList] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [detailsGroup, setDetailsGroup] = useState<StopGroup | null>(null);
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  // The open map is tracked by plan key, not by a copy of its stops, so a
  // reorder made from the map redraws the route instead of going stale.
  const [mapView, setMapView] = useState<{ key: string; withUser: boolean } | null>(null);

  const groups = useMemo(() => groupPlans(stops), [stops]);
  const activeGroups = useMemo(() => groups.filter((g) => !isArchived(g)), [groups]);

  // The page shows exactly one plan: today's by default, or whichever the user
  // opened from the plans list. Everything else lives in that list.
  const todayGroup = activeGroups.find((g) => g.isCurrent) ?? null;
  const shownGroup = selectedKey ? groups.find((g) => g.key === selectedKey) ?? null : todayGroup;
  const shownArchived = shownGroup ? isArchived(shownGroup) : false;
  const suggestion = shownGroup && !shownArchived ? routeSuggestion(shownGroup.stops) : null;
  const mapGroup = mapView ? groups.find((g) => g.key === mapView.key) ?? null : null;
  // Read the live group so the card reflects edits made while it is open.
  const sharingGroup = sharingKey ? groups.find((g) => g.key === sharingKey) ?? null : null;

  // Reorder within a group: rebuild the full ordered id list (all groups in
  // chronological order, with this group replaced by its new sequence) and persist.
  const applyGroupOrder = useCallback(
    (groupKey: string, newStops: TripStop[]) => {
      const fullIds: number[] = [];
      for (const g of groups) {
        if (g.key === groupKey) newStops.forEach((s) => fullIds.push(s.id));
        else g.stops.forEach((s) => fullIds.push(s.id));
      }
      reorder(fullIds);
    },
    [groups, reorder]
  );

  // Move a single stop up/down within its group.
  const moveWithinGroup = useCallback(
    (group: StopGroup, fromIdx: number, toIdx: number) => {
      if (toIdx < 0 || toIdx >= group.stops.length) return;
      const next = [...group.stops];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      applyGroupOrder(group.key, next);
    },
    [applyGroupOrder]
  );

  // Mark any stop within ~300 m of the given coords as visited.
  const markNearbyVisited = (coords: Coords): number => {
    let count = 0;
    for (const s of stops) {
      if (s.visited) continue;
      const dest = destinationById(s.destinationId);
      if (dest && distanceKm(coords, dest) <= 0.3) {
        setVisited(s.id, true);
        count += 1;
      }
    }
    return count;
  };

  // Start acts on whatever plan the page is showing — there is nothing to select.
  const handleStart = async () => {
    const first = shownGroup;
    if (!first) return;
    if (!location && !hasPermission) {
      await request();
      showToast('Turn on location, then tap Start to route from where you are');
    }
    if (location) {
      const n = markNearbyVisited(location);
      if (n > 0) showToast(`${n} nearby stop${n === 1 ? '' : 's'} marked as visited`);
    }
    setMapView({ key: first.key, withUser: !!location });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {stops.length === 0 ? (
        <EmptyTripsState onAdd={() => setShowPicker(true)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 170 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 32, fontWeight: '700', color: colors.onBackground }}>
                {shownGroup?.isCurrent ? 'Today' : 'My trip'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 }}>
                {activeGroups.length} {activeGroups.length === 1 ? 'plan' : 'plans'} ·{' '}
                {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
              </Text>
            </View>
          </View>

          {shownGroup ? (
            <View style={{ marginTop: 18 }}>
              <GroupHeader
                planKey={shownGroup.key}
                label={shownGroup.label}
                scope={shownGroup.scope}
                count={shownGroup.stops.length}
                archived={shownArchived}
                archivedReason={
                  shownArchived
                    ? shownGroup.stops.every((s) => s.visited)
                      ? 'completed'
                      : 'missed'
                    : undefined
                }
                isCurrent={shownGroup.isCurrent}
                canShare={shownGroup.stops.some((s) => s.visited)}
                onShare={() => setSharingKey(shownGroup.key)}
                onOpenDetails={() => setDetailsGroup(shownGroup)}
                onOpenMap={() => setMapView({ key: shownGroup.key, withUser: false })}
              />
              {!shownArchived ? <PlanWeatherBanner stops={shownGroup.stops} /> : null}
              {suggestion ? (
                <SuggestionBanner
                  savedKm={suggestion.savedKm}
                  onApply={() => {
                    applyGroupOrder(shownGroup.key, suggestion.optimized);
                    showToast(`Reordered — about ${formatKm(suggestion.savedKm)} less travel`);
                  }}
                />
              ) : null}
              <View style={{ height: 12 }} />
              {shownGroup.stops.map((item, idx) => {
                const destination = destinationById(item.destinationId);
                if (!destination) return null;
                const next = shownGroup.stops[idx + 1];
                const nextDest = next ? destinationById(next.destinationId) : undefined;
                return (
                  <React.Fragment key={item.id}>
                    <StopCard
                      order={idx + 1}
                      stop={item}
                      destination={destination}
                      archived={shownArchived}
                      canMoveUp={!shownArchived && idx > 0}
                      canMoveDown={!shownArchived && idx < shownGroup.stops.length - 1}
                      onMoveUp={() => moveWithinGroup(shownGroup, idx, idx - 1)}
                      onMoveDown={() => moveWithinGroup(shownGroup, idx, idx + 1)}
                      onEdit={() => setEditingStop(item)}
                      onRemove={() => remove(item.id)}
                      onToggleVisited={() => setVisited(item.id, !item.visited)}
                    />
                    {nextDest ? (
                      <LegConnector fromDest={destination} toDest={nextDest} />
                    ) : (
                      <View style={{ height: 14 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          ) : (
            // Nothing is happening today — say so plainly and point at the plans
            // list rather than dumping every other plan onto the page.
            <View style={{ alignItems: 'center', paddingVertical: 56, gap: 10 }}>
              <MaterialIcons name="event-available" size={40} color={colors.onSurfaceVariant} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface }}>
                Nothing planned for today
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.onSurfaceVariant,
                  textAlign: 'center',
                  paddingHorizontal: 20,
                }}
              >
                {activeGroups.length > 0
                  ? 'Open your plans to pick one, or add stops to start a new one.'
                  : 'Add stops to start a new plan.'}
              </Text>
              {activeGroups.length > 0 ? (
                <Pressable
                  onPress={() => setShowPlanList(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                    paddingHorizontal: 16,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: withAlpha(colors.primary, 0.14),
                  }}
                >
                  <MaterialIcons name="list" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    See {activeGroups.length} {activeGroups.length === 1 ? 'plan' : 'plans'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}

      {/* A column of matching FABs. Start is always live for the plan on screen
          — no selecting it first. */}
      {stops.length > 0 ? (
        <View style={styles.fabStack}>
          <MiniFab icon="list" label="Plans" onPress={() => setShowPlanList(true)} />
          <MiniFab icon="add" label="Add stops" onPress={() => setShowPicker(true)} />
          {shownGroup && !shownArchived ? (
            <Pressable
              onPress={handleStart}
              style={[styles.fab, styles.startFab, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="navigation" size={20} color={colors.onPrimary} />
              <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 15 }}>
                Start plan
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showPlanList ? (
        <PlanListSheet
          groups={groups}
          activeKey={shownGroup?.key ?? null}
          onSelect={(key) => {
            setSelectedKey(key);
            setShowPlanList(false);
          }}
          onOpenMap={(key) => {
            setShowPlanList(false);
            setMapView({ key, withUser: false });
          }}
          onAdd={() => {
            setShowPlanList(false);
            setShowPicker(true);
          }}
          onClose={() => setShowPlanList(false)}
        />
      ) : null}

      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <DestinationPicker
          existingIds={new Set(stops.map((s) => s.destinationId))}
          onDismiss={() => setShowPicker(false)}
          onConfirm={(selectedIds, scope, range, baseDate) => {
            // A stop's own date must sit inside its plan's range; each stop can
            // then be moved to another day in that range from the stop editor.
            const date = stopDateFor(range, baseDate);
            selectedIds.forEach((id) => add(id, scope, range, date, 9, 0, null));
            setShowPicker(false);
          }}
        />
      </Modal>

      {editingStop ? (
        <DateTimeEditorDialog
          initial={editingStop}
          onDismiss={() => setEditingStop(null)}
          onSave={(date, hour, minute, notes) => {
            update({ ...editingStop, date, hour, minute, notes: notes && notes.trim() ? notes : null });
            setEditingStop(null);
          }}
        />
      ) : null}

      {mapView && mapGroup ? (
        <TripDayMap
          title={mapGroup.label}
          stops={mapGroup.stops}
          userLocation={mapView.withUser ? location : null}
          // Archived plans are read-only, so they get no reorder banner.
          onReorder={
            isArchived(mapGroup)
              ? undefined
              : (next, savedKm) => {
                  applyGroupOrder(mapGroup.key, next);
                  showToast(`Reordered — about ${formatKm(savedKm)} less travel`);
                }
          }
          onClose={() => setMapView(null)}
        />
      ) : null}

      {sharingGroup ? (
        <ShareVisitModal group={sharingGroup} onClose={() => setSharingKey(null)} />
      ) : null}

      {detailsGroup ? (
        <PlanDetailsModal
          planKey={detailsGroup.key}
          label={detailsGroup.label}
          scope={detailsGroup.scope}
          stops={detailsGroup.stops}
          onClose={() => setDetailsGroup(null)}
        />
      ) : null}
    </View>
  );
}

// A secondary FAB: same pill shape as Start, in surface colours so the primary
// action still reads as the primary one.
function MiniFab({
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
      accessibilityRole="button"
      style={[
        styles.fab,
        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant },
      ]}
    >
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>{label}</Text>
    </Pressable>
  );
}

function SuggestionBanner({
  savedKm,
  onApply,
}: {
  savedKm: number;
  onApply: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: withAlpha(colors.secondary, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(colors.secondary, 0.4),
      }}
    >
      <MaterialIcons name="auto-awesome" size={18} color={colors.secondary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onSurface }}>
          Reorder for a shorter route
        </Text>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          Visiting the nearest stop next saves about {formatKm(savedKm)} of travel.
        </Text>
      </View>
      <Pressable
        onPress={onApply}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: colors.secondary,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onSecondary }}>Apply</Text>
      </Pressable>
    </View>
  );
}

function pesoShort(n: number): string {
  return `₱${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const CURRENT_BADGE: Record<PlanScope, string> = {
  day: 'Today',
  // A week plan can now span any range, so "This week" would be a lie on a
  // 3-day or 3-week plan; "Ongoing" is true for every range covering today.
  week: 'Ongoing',
  month: 'This month',
};

function GroupHeader({
  planKey,
  label,
  scope,
  count,
  archived,
  archivedReason,
  isCurrent,
  canShare,
  onOpenDetails,
  onOpenMap,
  onShare,
}: {
  planKey: string;
  label: string;
  scope: PlanScope;
  count: number;
  archived?: boolean;
  archivedReason?: 'completed' | 'missed';
  isCurrent?: boolean;
  canShare?: boolean;
  onOpenDetails: () => void;
  onOpenMap: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const { getMeta } = usePlans();
  const meta = SCOPE_META[scope];
  const planMeta = getMeta(planKey);
  const spent = budgetSpent(planMeta);
  const budgetLabel =
    planMeta.targetBudget != null
      ? `${pesoShort(spent)} / ${pesoShort(planMeta.targetBudget)}`
      : spent > 0
      ? pesoShort(spent)
      : null;
  const overBudget = planMeta.targetBudget != null && spent > planMeta.targetBudget;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {/* The page shows one plan, so the header no longer folds or selects —
          tapping it opens that plan's details. */}
      <Pressable
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        onPress={onOpenDetails}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                borderRadius: 50,
                backgroundColor: withAlpha(colors.primary, 0.14),
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <MaterialIcons name={meta.icon} size={12} color={colors.primary} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                {meta.label}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface }}>{label}</Text>
            {isCurrent && !archived ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  borderRadius: 50,
                  backgroundColor: colors.secondary,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <MaterialIcons name="bolt" size={12} color={colors.onSecondary} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.onSecondary }}>
                  {CURRENT_BADGE[scope]}
                </Text>
              </View>
            ) : null}
            {archived && archivedReason === 'completed' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  borderRadius: 50,
                  backgroundColor: withAlpha(VISITED_GREEN, 0.16),
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <MaterialIcons name="check-circle" size={12} color={VISITED_GREEN} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: VISITED_GREEN }}>Completed</Text>
              </View>
            ) : null}
            {archived && archivedReason === 'missed' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  borderRadius: 50,
                  backgroundColor: withAlpha(colors.error, 0.14),
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <MaterialIcons name="history" size={12} color={colors.error} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.error }}>Past</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {count} {count === 1 ? 'stop' : 'stops'}
            </Text>
            {budgetLabel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialIcons
                  name="account-balance-wallet"
                  size={12}
                  color={overBudget ? colors.error : colors.onSurfaceVariant}
                />
                <Text style={{ fontSize: 11, fontWeight: '600', color: overBudget ? colors.error : colors.onSurfaceVariant }}>
                  {budgetLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Sharing a trip nobody has been on yet would be a lie, so the chip only
          appears once at least one stop in the plan is marked visited. */}
      {canShare ? <HeaderChip icon="share" onPress={onShare} /> : null}
      <HeaderChip icon="tune" onPress={onOpenDetails} />
      <HeaderChip icon="map" onPress={onOpenMap} />
    </View>
  );
}

function HeaderChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: label ? 10 : 0,
        width: label ? undefined : 34,
        height: 34,
        borderRadius: 50,
        backgroundColor: withAlpha(colors.primary, 0.14),
      }}
    >
      <MaterialIcons name={icon} size={16} color={colors.primary} />
      {label ? (
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

// Travel estimate between two consecutive stops (straight-line distance → ETA).
function LegConnector({
  fromDest,
  toDest,
}: {
  fromDest: Destination;
  toDest: Destination;
}) {
  const { colors } = useTheme();
  const km = distanceKm(fromDest, toDest);
  const eta = estimateEtaMinutes(km);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 18, paddingVertical: 8 }}>
      <MaterialIcons name="more-vert" size={16} color={withAlpha(colors.onSurfaceVariant, 0.6)} />
      <MaterialIcons name="directions-car" size={14} color={colors.onSurfaceVariant} />
      <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
        {formatEta(eta)} · {formatDistance(km)} to next stop
      </Text>
    </View>
  );
}

/* ---------------- Stop card ---------------- */

function StopCard({
  order,
  stop,
  destination,
  archived,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onRemove,
  onToggleVisited,
}: {
  order: number;
  stop: TripStop;
  destination: Destination;
  archived?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggleVisited: () => void;
}) {
  const { colors } = useTheme();
  const visited = stop.visited;
  // Constant border width avoids a layout shift (and the gray shadow artifact it
  // exposed) when toggling visited; colour is solid, never a translucent tint.
  const borderColor = visited ? VISITED_GREEN : 'transparent';
  const showReorder = !archived && (canMoveUp || canMoveDown);
  return (
    <View
      style={[
        styles.stopCard,
        { backgroundColor: colors.surface, borderWidth: 1.5, borderColor },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {showReorder ? (
          <View style={{ marginRight: -2 }}>
            <Pressable
              onPress={onMoveUp}
              disabled={!canMoveUp}
              hitSlop={6}
              style={{ opacity: canMoveUp ? 1 : 0.3 }}
            >
              <MaterialIcons name="keyboard-arrow-up" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
            <Pressable
              onPress={onMoveDown}
              disabled={!canMoveDown}
              hitSlop={6}
              style={{ opacity: canMoveDown ? 1 : 0.3 }}
            >
              <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
        ) : null}
        {/* The number is the visited toggle: tap it to tick the stop off, tap
            again to undo. It already shows the state, so a separate button for
            it was saying the same thing twice. */}
        <Pressable
          onPress={onToggleVisited}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={visited ? 'Mark as not visited' : 'Mark as visited'}
          style={[styles.indexBadge, { backgroundColor: visited ? VISITED_GREEN : colors.primary }]}
        >
          {visited ? (
            <MaterialIcons name="check" size={20} color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onPrimary }}>
              {order}
            </Text>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
            {destination.name}
          </Text>
          {/* Visited sits with the place, not down among the date/time pills —
              it says something about the stop, not about its schedule. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="location-on" size={14} color={colors.onSurfaceVariant} />
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              {destination.municipality}
            </Text>
            {visited ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  borderRadius: 50,
                  backgroundColor: withAlpha(VISITED_GREEN, 0.16),
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <MaterialIcons name="check-circle" size={11} color={VISITED_GREEN} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: VISITED_GREEN }}>
                  Visited
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit stop"
          style={{ padding: 4 }}
        >
          <MaterialIcons name="edit" size={19} color={colors.primary} />
        </Pressable>
        {archived ? null : (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove stop"
            style={{ padding: 4 }}
          >
            <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <InfoPill icon="calendar-month" text={formatDate(stop.date)} />
        <InfoPill icon="schedule" text={formatTime(stop.hour, stop.minute)} />
        {/* Renders nothing when the stop's date is past the forecast horizon. */}
        <StopWeatherPill destinationId={stop.destinationId} date={stop.date} />
      </View>

      {stop.notes ? (
        <Text style={{ fontSize: 14, color: colors.onSurfaceVariant, marginTop: 10 }}>
          {stop.notes}
        </Text>
      ) : null}

    </View>
  );
}

function InfoPill({
  icon,
  text,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 50,
        backgroundColor: withAlpha(colors.surfaceVariant, 0.6),
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <MaterialIcons name={icon} size={14} color={colors.primary} />
      <Text style={{ fontSize: 12, color: colors.onSurface }}>{text}</Text>
    </View>
  );
}

function EmptyTripsState({ onAdd }: { onAdd: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
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
        <MaterialIcons name="explore" size={44} color={colors.onSecondaryContainer} />
      </View>
      <View style={{ height: 20 }} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>
        Plan your Bohol trip
      </Text>
      <View style={{ height: 6 }} />
      <Text style={{ fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' }}>
        Pick multiple places to visit, then set the date and time for each stop.
      </Text>
      <View style={{ height: 24 }} />
      <Pressable
        onPress={onAdd}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 48,
          paddingHorizontal: 20,
          borderRadius: 14,
          backgroundColor: colors.primary,
        }}
      >
        <MaterialIcons name="add" size={18} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Add your first stops</Text>
      </Pressable>
    </View>
  );
}

/* ---------------- Destination picker ---------------- */

type PickerTabKey = 'NEAR' | 'POPULAR' | 'ALL';
const PICKER_TABS: { key: PickerTabKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'NEAR', label: 'Near you', icon: 'near-me' },
  { key: 'POPULAR', label: 'Popular', icon: 'local-fire-department' },
  { key: 'ALL', label: 'All', icon: 'explore' },
];

function DestinationPicker({
  existingIds,
  onDismiss,
  onConfirm,
}: {
  existingIds: Set<number>;
  onDismiss: () => void;
  onConfirm: (ids: number[], scope: PlanScope, range: PlanRange, baseDate: string) => void;
}) {
  const { colors } = useTheme();
  const { location } = useUserLocation();
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<PickerTabKey>('POPULAR');
  const [draft, setDraft] = useState<PlanDraft>(newPlanDraft);
  const { region, isHome } = useRegionSetting();
  const { places, addPlace } = usePlaces();
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const seq = useRef(0);

  const range = draftRange(draft);

  // What's tappable without searching: curated spots at home, plus anything the
  // traveller has already added in this region.
  const known = useMemo(() => {
    const mine = places.filter(
      (p) =>
        p.latitude >= region.bbox[0] &&
        p.latitude <= region.bbox[1] &&
        p.longitude >= region.bbox[2] &&
        p.longitude <= region.bbox[3]
    );
    return isHome ? [...destinations, ...mine] : mine;
  }, [places, region, isHome]);

  const filtered = useMemo(() => {
    let base: Destination[];
    if (tab === 'NEAR') {
      base = location
        ? [...known].sort((a, b) => distanceKm(location, a) - distanceKm(location, b))
        : [...known];
    } else if (tab === 'POPULAR') {
      base = [...known].sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'));
    } else {
      base = [...known].sort((a, b) => a.name.localeCompare(b.name));
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.municipality.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [known, query, tab, location]);

  // Search the map for anything the app doesn't already know about. Debounced to
  // stay inside Nominatim's one-request-a-second policy.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchErr(null);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchErr(null);
      try {
        const found = await searchPlaces(q, region);
        if (mine !== seq.current) return; // a newer keystroke won
        // Don't offer what's already in the list above.
        const names = new Set(filtered.map((d) => d.name.toLowerCase()));
        setHits(found.filter((h) => !names.has(h.name.toLowerCase())));
      } catch (e) {
        if (mine === seq.current) setSearchErr(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // `filtered` deliberately omitted: it changes as results arrive and would
    // restart the search in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, region]);

  const toggleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // A searched place has to exist before a stop can point at it.
  const addSearched = async (hit: PlaceHit) => {
    try {
      const place = await addPlace(hit, region);
      setSelected((prev) => (prev.includes(place.id) ? prev : [...prev, place.id]));
      setHits((prev) => prev.filter((h) => h.name !== hit.name));
      setQuery('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't add that place");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 48, paddingBottom: 8 }}>
        <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 8 }}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>
            Add stops
          </Text>
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
            {selected.length === 0 ? "Tap places you'd like to visit" : `${selected.length} selected`}
          </Text>
        </View>
      </View>

      {/* Plan type + date: the plan this batch of stops will be created under */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 }}>
          Plan for
        </Text>
        <PlanDraftFields draft={draft} onChange={setDraft} />
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isHome ? 'Search Bohol, or any place on the map' : `Search places in ${region.name}`}
            placeholderTextColor={colors.onSurfaceVariant}
            autoCorrect={false}
            style={{ flex: 1, color: colors.onSurface, fontSize: 15 }}
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 8 }}>
        {PICKER_TABS.map((t) => {
          const isSelected = tab === t.key;
          const enabled = t.key !== 'NEAR' || location !== null;
          return (
            <Pressable
              key={t.key}
              disabled={!enabled}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
                borderRadius: 12,
                opacity: enabled ? 1 : 0.5,
                backgroundColor: isSelected ? colors.primary : withAlpha(colors.surfaceVariant, 0.6),
              }}
            >
              <MaterialIcons
                name={t.icon}
                size={16}
                color={isSelected ? colors.onPrimary : colors.onSurface}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isSelected ? colors.onPrimary : colors.onSurface,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'NEAR' && location === null ? (
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, paddingHorizontal: 20, paddingVertical: 4 }}>
          Turn on location to sort by distance from you. Showing all destinations.
        </Text>
      ) : null}

      {/* List */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 10 }}
      >
        {filtered.length === 0 && hits.length === 0 && query.trim().length < 2 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
            <MaterialIcons name="search" size={34} color={colors.onSurfaceVariant} />
            <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' }}>
              Search for the places you want to visit in {region.name} and add them as stops.
            </Text>
          </View>
        ) : null}

        {filtered.map((d) => (
          <PickerRow
            key={d.id}
            destination={d}
            distanceLabel={location ? formatKm(distanceKm(location, d)) : null}
            alreadyInTrip={existingIds.has(d.id)}
            selected={selected.includes(d.id)}
            onToggle={() => toggleSelect(d.id)}
          />
        ))}

        {/* Anything the app doesn't already know, straight off the map. */}
        {hits.length > 0 ? (
          <>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.onSurfaceVariant,
                marginTop: 6,
              }}
            >
              FOUND ON THE MAP
            </Text>
            {hits.map((h) => (
              <SearchHitRow
                key={`${h.name}-${h.latitude}-${h.longitude}`}
                hit={h}
                distanceLabel={location ? formatKm(distanceKm(location, h)) : null}
                onAdd={() => addSearched(h)}
              />
            ))}
          </>
        ) : null}

        {searchErr ? (
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center' }}>
            {searchErr}
          </Text>
        ) : null}

        {!searching && query.trim().length >= 2 && filtered.length === 0 && hits.length === 0 ? (
          <Text
            style={{
              fontSize: 13,
              color: colors.onSurfaceVariant,
              textAlign: 'center',
              paddingVertical: 24,
            }}
          >
            Nothing found for “{query.trim()}” in {region.name}.
          </Text>
        ) : null}
      </ScrollView>

      {/* Bottom bar */}
      <View style={{ padding: 16, backgroundColor: colors.surface }}>
        <Pressable
          disabled={selected.length === 0}
          onPress={() =>
            selected.length > 0 && onConfirm(selected, draft.scope, range, draft.baseDate)
          }
          style={{
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            opacity: selected.length === 0 ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>
            {selected.length === 0
              ? 'Select destinations'
              : `Add ${selected.length} ${selected.length === 1 ? 'stop' : 'stops'} to ${SCOPE_META[draft.scope].label} plan`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// A place found on the map rather than curated: no photo, no rating, no
// description — just what OSM knows. Shown as an icon tile so it never looks
// like a broken image.
function SearchHitRow({
  hit,
  distanceLabel,
  onAdd,
}: {
  hit: PlaceHit;
  distanceLabel: string | null;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  const [adding, setAdding] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        setAdding(true);
        await onAdd();
        setAdding(false);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        padding: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.primary, 0.12),
        }}
      >
        <MaterialIcons name="place" size={26} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface }}>
          {hit.name}
        </Text>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          {hit.category} · {hit.municipality}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </Text>
        <Text style={{ fontSize: 10, color: colors.onSurfaceVariant }}>From the map</Text>
      </View>
      {adding ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
      )}
    </Pressable>
  );
}

function PickerRow({
  destination,
  distanceLabel,
  alreadyInTrip,
  selected,
  onToggle,
}: {
  destination: Destination;
  distanceLabel: string | null;
  alreadyInTrip: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        padding: 10,
        backgroundColor: selected ? colors.primaryContainer : colors.surface,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      {/* Only curated spots have a photo and a rating; a searched place shows
          neither rather than an empty star and a broken frame. */}
      {destination.imageUrl ? (
        <Image source={{ uri: destination.imageUrl }} style={{ width: 64, height: 64, borderRadius: 12 }} />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(colors.primary, 0.12),
          }}
        >
          <MaterialIcons name="place" size={26} color={colors.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface }}>
          {destination.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {destination.rating ? (
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>
              ★ {destination.rating}
            </Text>
          ) : null}
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
            {destination.rating ? '· ' : ''}
            {destination.category}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialIcons name="location-on" size={12} color={colors.onSurfaceVariant} />
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
            {destination.municipality}
          </Text>
          {distanceLabel ? (
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>· {distanceLabel}</Text>
          ) : null}
        </View>
        {alreadyInTrip ? (
          <Text style={{ fontSize: 11, fontWeight: '500', color: colors.secondary }}>
            Already in your trip
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? colors.primary : withAlpha(colors.surfaceVariant, 0.7),
        }}
      >
        {selected ? <MaterialIcons name="check" size={18} color={colors.onPrimary} /> : null}
      </View>
    </Pressable>
  );
}

/* ---------------- Date/time editor ---------------- */

function DateTimeEditorDialog({
  initial,
  onDismiss,
  onSave,
}: {
  initial: TripStop;
  onDismiss: () => void;
  onSave: (date: string, hour: number, minute: number, notes: string) => void;
}) {
  const { colors } = useTheme();
  const [date, setDate] = useState<Date>(isoToDate(initial.date));
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const destination = destinationById(initial.destinationId);

  const iso = () => {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  };

  const timeAsDate = () => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.dialogScrim}>
        <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>
                Edit stop
              </Text>
              {destination ? (
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                  {destination.name}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <PickerField
              label="Date"
              value={formatDate(iso())}
              icon="calendar-month"
              onPress={() => setShowDate(true)}
            />
            <PickerField
              label="Time"
              value={formatTime(hour, minute)}
              icon="schedule"
              onPress={() => setShowTime(true)}
            />
          </View>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            style={{
              marginTop: 14,
              minHeight: 64,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              borderRadius: 12,
              padding: 12,
              color: colors.onSurface,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <Pressable onPress={onDismiss} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(iso(), hour, minute, notes)}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {showDate ? (
        <DateTimePicker
          value={date}
          mode="date"
          // A stop belongs to a plan that covers a fixed range, so it can only
          // be moved within it — otherwise it would show a date its own plan
          // header contradicts.
          minimumDate={isoToDate(initial.planStart)}
          maximumDate={isoToDate(initial.planEnd)}
          onChange={(event, selectedDate) => {
            setShowDate(false);
            if (event.type === 'set' && selectedDate) setDate(selectedDate);
          }}
        />
      ) : null}
      {showTime ? (
        <DateTimePicker
          value={timeAsDate()}
          mode="time"
          onChange={(event, selectedTime) => {
            setShowTime(false);
            if (event.type === 'set' && selectedTime) {
              setHour(selectedTime.getHours());
              setMinute(selectedTime.getMinutes());
            }
          }}
        />
      ) : null}
    </Modal>
  );
}

function PickerField({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
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
        gap: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
      }}
    >
      <MaterialIcons name={icon} size={20} color={colors.primary} />
      <View>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.onSurface }}>{value}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A right-aligned column of pill FABs, each only as wide as its own label.
  fabStack: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    alignItems: 'flex-end',
    gap: 10,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // The primary action sits a little taller and heavier than the two above it.
  startFab: {
    height: 56,
    borderRadius: 28,
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  stopCard: {
    borderRadius: 20,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  indexBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 52,
  },
  dialogScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    borderRadius: 24,
    padding: 20,
  },
});
