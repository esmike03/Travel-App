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
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinations, destinationById, distanceKm, Destination } from '../data/destinations';
import { useTrips, TripStop } from '../context/TripsContext';
import { useRegionSetting } from '../context/RegionContext';
import { usePlaces } from '../context/PlacesContext';
import { PlaceHit, searchPlaces } from '../data/places';
import {
  PlanScope,
  PlanRange,
  formatDate,
  formatTime,
  isoToDate,
  planKeyOf,
  todayIso,
} from '../utils/planDates';
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
import { usePlans, budgetSpent, tripTitle } from '../context/PlansContext';
import { estimateEtaMinutes, formatDistance, formatEta, formatKm } from '../utils/format';
import { routeSuggestion } from '../utils/route';
import { showToast } from '../utils/toast';
import TripDayMap from './TripDayMap';
import PlanDetailsModal from './PlanDetailsModal';
import ShareVisitModal, { ShareStopModal } from '../components/ShareCard';
import { PlanWeatherBanner, StopWeatherPill } from '../components/Weather';
import PlanListSheet from '../components/PlanListSheet';
import ChirpyPeek, { CHIRPY_PEEK_LANE } from '../components/ChirpyPeek';
import SkeletonList from '../components/Skeleton';

const VISITED_GREEN = '#16A34A';
const CHIRPY_GUIDE = require('../../assets/branding/chirpy-guide.png');

export default function ItineraryScreen() {
  const { colors } = useTheme();
  const { stops, loading, add, update, remove, setVisited, reorder } = useTrips();
  const { getMeta, setMeta } = usePlans();
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
  // A single stop being shared on its own card, separate from the plan card.
  const [sharingStop, setSharingStop] = useState<TripStop | null>(null);
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
      {loading ? (
        // Stops arrive from SQLite a beat after mount; without this the empty
        // state flashes up and is immediately replaced by the real plan.
        <SkeletonList rows={3} />
      ) : stops.length === 0 ? (
        <EmptyTripsState onAdd={() => setShowPicker(true)} />
      ) : (
        // The stop list is the only scroller on this page. It used to be a
        // non-scrolling list nested in a NestableScrollContainer, which stopped
        // scrolling altogether once a plan had enough stops to fill the screen —
        // the inner VirtualizedList swallowed the pan. Everything above the
        // stops rides along as the list header instead.
        <DraggableFlatList
          data={shownGroup?.stops ?? []}
          keyExtractor={(item) => String(item.id)}
          activationDistance={8}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 170 }}
          onDragEnd={({ data, from, to }) => {
            if (shownGroup && from !== to) applyGroupOrder(shownGroup.key, data);
          }}
          ListHeaderComponent={
            shownGroup ? (
              <>
                <PlanHeader
                  planKey={shownGroup.key}
                  dateLabel={shownGroup.label}
                  scope={shownGroup.scope}
                  count={shownGroup.stops.length}
                  completed={shownGroup.stops.every((stop) => stop.visited)}
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
                />
                <TripOverviewCard
                  group={shownGroup}
                  onOpenDetails={() => setDetailsGroup(shownGroup)}
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
                <RouteHeading
                  canReorder={!shownArchived && shownGroup.stops.length > 1}
                />
              </>
            ) : (
              // No plan on the page: the counts are worth showing here, because
              // the empty state below is about to send you to the plans list.
              <View style={styles.pageHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pageTitle, { color: colors.onBackground }]}>Today</Text>
                  <Text style={[styles.pageMeta, { color: colors.onSurfaceVariant }]}>
                    {activeGroups.length} {activeGroups.length === 1 ? 'plan' : 'plans'} ·{' '}
                    {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
                  </Text>
                </View>
              </View>
            )
          }
          ListEmptyComponent={
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
          }
          renderItem={({ item, drag, isActive, getIndex }) => {
            const idx = getIndex() ?? 0;
            const destination = destinationById(item.destinationId);
            if (!destination) return null;
            const next = shownGroup?.stops[idx + 1];
            const nextDest = next ? destinationById(next.destinationId) : undefined;
            return (
              <ScaleDecorator activeScale={1.025}>
                <View style={{ opacity: isActive ? 0.96 : 1 }}>
                  <StopCard
                    order={idx + 1}
                    stop={item}
                    destination={destination}
                    archived={shownArchived}
                    drag={
                      !shownArchived && (shownGroup?.stops.length ?? 0) > 1 ? drag : undefined
                    }
                    isDragging={isActive}
                    onEdit={() => setEditingStop(item)}
                    onRemove={() => remove(item.id)}
                    onToggleVisited={() => setVisited(item.id, !item.visited)}
                    onShare={() => setSharingStop(item)}
                  />
                  {nextDest ? (
                    <LegConnector fromDest={destination} toDest={nextDest} />
                  ) : (
                    <View style={{ height: 14 }} />
                  )}
                </View>
              </ScaleDecorator>
            );
          }}
        />
      )}

      {/* A single floating action dock keeps the common trip actions together. */}
      {stops.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.fabDock, !shownGroup ? styles.fabDockCompact : null]}
        >
          <View style={[styles.fabDockBar, { backgroundColor: colors.surface }]}>
            <DockAction icon="list" label="Plans" onPress={() => setShowPlanList(true)} />
            <DockAction icon="add" label="Add" onPress={() => setShowPicker(true)} />
            {shownGroup ? (
              <>
                <DockAction
                  icon="savings"
                  label="Budget"
                  onPress={() => setDetailsGroup(shownGroup)}
                />
                <DockAction
                  icon="map"
                  label="Map"
                  onPress={() => setMapView({ key: shownGroup.key, withUser: false })}
                />
              </>
            ) : null}
            {shownGroup && !shownArchived ? (
              <Pressable
                onPress={handleStart}
                style={({ pressed }) => [
                  styles.startFab,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <MaterialIcons name="navigation" size={20} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 13 }}>
                  Start
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Nothing on today's page — Chirpy peeks in over the dock to explain. */}
      {stops.length > 0 && !shownGroup ? (
        <ChirpyPeek
          message={
            activeGroups.length > 0
              ? 'Your other plans are still here — tap Plans to open one.'
              : 'Nothing on today. Tap Add to start a new plan!'
          }
        />
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
          onConfirm={(selectedIds, scope, range, baseDate, details) => {
            // A stop's own date must sit inside its plan's range; each stop can
            // then be moved to another day in that range from the stop editor.
            const date = stopDateFor(range, baseDate);
            selectedIds.forEach((id) => add(id, scope, range, date, 9, 0, null));
            const planKey = planKeyOf(scope, range);
            const current = getMeta(planKey);
            setMeta(planKey, {
              title: current.title ?? details.title,
              origin: current.origin ?? details.origin,
              departureAt: current.departureAt ?? details.departureAt,
              destinationName: current.destinationName ?? details.destinationName,
            });
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
          title={tripTitle(getMeta(mapGroup.key))}
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

      {sharingStop ? (
        <ShareStopModal
          destinationId={sharingStop.destinationId}
          date={sharingStop.date}
          visited={sharingStop.visited}
          onClose={() => setSharingStop(null)}
        />
      ) : null}

      {detailsGroup ? (
        <PlanDetailsModal
          planKey={detailsGroup.key}
          label={tripTitle(getMeta(detailsGroup.key))}
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
function DockAction({
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
      style={({ pressed }) => [styles.dockAction, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={[styles.dockActionIcon, { backgroundColor: withAlpha(colors.primary, 0.11) }]}>
        <MaterialIcons name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant }}>{label}</Text>
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

// The page's one title block. It used to be two: a page heading with its own
// counts, and a plan heading underneath repeating the stop count and the plan's
// state — which the journey card below then said a third time.
function PlanHeader({
  planKey,
  dateLabel,
  scope,
  count,
  completed,
  archived,
  archivedReason,
  isCurrent,
  canShare,
  onOpenDetails,
  onShare,
}: {
  planKey: string;
  dateLabel: string;
  scope: PlanScope;
  count: number;
  completed: boolean;
  archived?: boolean;
  archivedReason?: 'completed' | 'missed';
  isCurrent?: boolean;
  canShare?: boolean;
  onOpenDetails: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const { getMeta } = usePlans();
  const title = tripTitle(getMeta(planKey));
  const scopeLabel = SCOPE_META[scope].label;
  const live = !!isCurrent && !archived;

  // Exactly one badge. A scope pill, a state badge and a status pill used to sit
  // within a few pixels of each other saying overlapping things; scope moved
  // down into the meta line, where it costs one word instead of a chip.
  const badge = archived
    ? archivedReason === 'completed'
      ? {
          label: 'Completed',
          icon: 'check-circle' as const,
          fg: VISITED_GREEN,
          bg: withAlpha(VISITED_GREEN, 0.16),
        }
      : {
          label: 'Past',
          icon: 'history' as const,
          fg: colors.error,
          bg: withAlpha(colors.error, 0.14),
        }
    : live
      ? {
          label: CURRENT_BADGE[scope],
          icon: 'bolt' as const,
          fg: colors.onSecondary,
          bg: colors.secondary,
        }
      : null;

  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.pageTitle,
              {
                color: colors.onBackground,
                textDecorationLine: completed ? 'line-through' : 'none',
              },
            ]}
          >
            {live ? 'Today' : title}
          </Text>
          {badge ? (
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <MaterialIcons name={badge.icon} size={11} color={badge.fg} />
              <Text style={[styles.statusBadgeText, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onOpenDetails} hitSlop={6}>
          <Text numberOfLines={1} style={[styles.pageMeta, { color: colors.onSurfaceVariant }]}>
            {/* Today's plan puts its name here, since the title says the day. */}
            {live ? `${title} · ` : ''}
            {scopeLabel} · {dateLabel} · {count} {count === 1 ? 'stop' : 'stops'}
          </Text>
        </Pressable>
      </View>

      {/* Sharing a trip nobody has been on yet would be a lie, so the chip only
          appears once at least one stop in the plan is marked visited. */}
      {canShare ? <HeaderChip icon="share" onPress={onShare} /> : null}
    </View>
  );
}

function firstStopDate(stops: TripStop[]): Date | null {
  let first: Date | null = null;
  for (const stop of stops) {
    const date = new Date(
      `${stop.date}T${String(stop.hour).padStart(2, '0')}:${String(stop.minute).padStart(2, '0')}:00`
    );
    if (!Number.isNaN(date.getTime()) && (!first || date < first)) first = date;
  }
  return first;
}

function travelTimeLabel(departureAt: string | null, stops: TripStop[]): string | null {
  if (!departureAt) return null;
  const departure = new Date(departureAt);
  const arrival = firstStopDate(stops);
  if (!arrival || Number.isNaN(departure.getTime())) return null;
  const totalHours = Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / 3_600_000));
  if (totalHours === 0) return 'Arrives around the first stop time';
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `${hours} hr${hours === 1 ? '' : 's'} to Bohol`;
  return `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours} hr` : ''} to Bohol`;
}

function departureLabelShort(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Everything about the plan that isn't a stop, in one card: where it goes, when
// it leaves, what it costs, what you wrote down.
//
// This was two stacked cards — a journey card and a budget/notes snapshot — each
// a prominent surface, each with its own chevron, and both opening the very same
// details screen. Two focal points next to each other is what made the page read
// as crowded; there is one now.
function TripOverviewCard({
  group,
  onOpenDetails,
}: {
  group: StopGroup;
  onOpenDetails: () => void;
}) {
  const { colors } = useTheme();
  const { getMeta } = usePlans();
  const meta = getMeta(group.key);
  const origin = meta.origin?.trim() || 'Add origin';
  const destination = meta.destinationName?.trim() || 'Bohol';
  const duration = travelTimeLabel(meta.departureAt, group.stops);
  const notes = meta.notes?.trim() ?? '';

  const spent = budgetSpent(meta);
  const target = meta.targetBudget;
  const hasTarget = target != null && target > 0;
  const remaining = hasTarget ? target - spent : null;
  const overBudget = remaining != null && remaining < 0;
  const progress = hasTarget ? Math.min(1, spent / target) : 0;
  const statusText = hasTarget
    ? overBudget
      ? `${pesoShort(Math.abs(remaining ?? 0))} over`
      : remaining === 0
        ? 'Fully used'
        : `${pesoShort(remaining ?? 0)} left`
    : 'Set budget';

  return (
    <View style={styles.overviewWrap}>
      <Image source={CHIRPY_GUIDE} resizeMode="contain" style={styles.overviewMascot} />
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel="Open trip details, budget and notes"
        style={({ pressed }) => [
          styles.overview,
          { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.overviewOrb, { backgroundColor: withAlpha(colors.secondary, 0.2) }]}
        />

        <View style={styles.overviewHeader}>
          <Text style={[styles.overviewEyebrow, { color: withAlpha(colors.onPrimary, 0.68) }]}>
            TRIP OVERVIEW
          </Text>
          <View style={[styles.overviewLink, { backgroundColor: withAlpha(colors.onPrimary, 0.12) }]}>
            <Text style={[styles.overviewLinkText, { color: colors.onPrimary }]}>View details</Text>
            <MaterialIcons name="arrow-forward" size={13} color={colors.onPrimary} />
          </View>
        </View>

        <View style={styles.overviewRow}>
          <View style={[styles.overviewIcon, { backgroundColor: withAlpha(colors.onPrimary, 0.12) }]}>
            <MaterialIcons name="flight" size={18} color={colors.secondaryContainer} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.overviewValue, { color: colors.onPrimary }]}>
              {origin} → {destination}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.overviewMeta, { color: withAlpha(colors.onPrimary, 0.72) }]}
            >
              {meta.departureAt
                ? `Departs ${departureLabelShort(meta.departureAt)}`
                : 'Add your departure'}
              {duration ? ` · ${duration.replace('Bohol', destination)}` : ''}
            </Text>
          </View>
        </View>

        <View
          style={[styles.overviewDivider, { backgroundColor: withAlpha(colors.onPrimary, 0.16) }]}
        />

        <View style={styles.overviewRow}>
          <View style={[styles.overviewIcon, { backgroundColor: withAlpha(colors.onPrimary, 0.12) }]}>
            <MaterialIcons name="savings" size={18} color={colors.secondaryContainer} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.overviewValue, { color: colors.onPrimary }]}>
              {hasTarget || spent > 0 ? `${pesoShort(spent)} spent` : 'No budget yet'}
              {hasTarget ? (
                <Text style={[styles.overviewOf, { color: withAlpha(colors.onPrimary, 0.7) }]}>
                  {'  of '}
                  {pesoShort(target)}
                </Text>
              ) : null}
            </Text>
            {hasTarget ? (
              <View
                style={[styles.overviewTrack, { backgroundColor: withAlpha(colors.onPrimary, 0.18) }]}
              >
                <View
                  style={[
                    styles.overviewFill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: overBudget ? colors.errorContainer : colors.secondary,
                    },
                  ]}
                />
              </View>
            ) : (
              <Text
                numberOfLines={1}
                style={[styles.overviewMeta, { color: withAlpha(colors.onPrimary, 0.72) }]}
              >
                Set a target for this trip
              </Text>
            )}
          </View>
          <View
            style={[
              styles.overviewStatus,
              {
                backgroundColor: overBudget
                  ? colors.errorContainer
                  : withAlpha(colors.onPrimary, 0.13),
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.overviewStatusText,
                { color: overBudget ? colors.onErrorContainer : colors.onPrimary },
              ]}
            >
              {statusText}
            </Text>
          </View>
        </View>

        {/* Notes earn their row only when there are some. A permanently visible
            empty slot inviting you to fill it is most of what a crowded page is
            made of; the card still opens the screen where notes are written. */}
        {notes ? (
          <>
            <View
              style={[
                styles.overviewDivider,
                { backgroundColor: withAlpha(colors.onPrimary, 0.16) },
              ]}
            />
            <View style={styles.overviewRow}>
              <View
                style={[styles.overviewIcon, { backgroundColor: withAlpha(colors.onPrimary, 0.12) }]}
              >
                <MaterialIcons name="sticky-note-2" size={18} color={colors.secondaryContainer} />
              </View>
              <Text
                numberOfLines={2}
                style={[styles.overviewNotes, { color: withAlpha(colors.onPrimary, 0.92) }]}
              >
                {notes}
              </Text>
            </View>
          </>
        ) : null}
      </Pressable>
    </View>
  );
}

// The missing step between the page's chrome and the itinerary itself. It also
// carries the reorder hint, which was a full-width banner of its own.
function RouteHeading({ canReorder }: { canReorder: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.routeHeading}>
      <Text style={[styles.routeHeadingText, { color: colors.onBackground }]}>Route</Text>
      {canReorder ? (
        <View style={styles.reorderHint}>
          <MaterialIcons name="drag-indicator" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.reorderHintText, { color: colors.onSurfaceVariant }]}>
            Hold to reorder
          </Text>
        </View>
      ) : null}
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
  drag,
  isDragging,
  onEdit,
  onRemove,
  onToggleVisited,
  onShare,
}: {
  order: number;
  stop: TripStop;
  destination: Destination;
  archived?: boolean;
  drag?: () => void;
  isDragging?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onToggleVisited: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const visited = stop.visited;
  // Constant border width avoids a layout shift (and the gray shadow artifact it
  // exposed) when toggling visited; colour is solid, never a translucent tint.
  const borderColor = isDragging ? colors.primary : visited ? VISITED_GREEN : 'transparent';
  return (
    <View
      style={[
        styles.stopCard,
        {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor,
          elevation: isDragging ? 8 : 1,
          shadowOpacity: isDragging ? 0.18 : 0.08,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {!archived && drag ? (
          <Pressable
            onLongPress={drag}
            delayLongPress={130}
            disabled={isDragging}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Drag to reorder stop"
            accessibilityHint="Press and hold, then move this stop up or down"
            style={[
              styles.dragHandle,
              { backgroundColor: withAlpha(colors.primary, isDragging ? 0.2 : 0.1) },
            ]}
          >
            <MaterialIcons name="drag-indicator" size={22} color={colors.primary} />
          </Pressable>
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
          <Text
            numberOfLines={2}
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.onSurface,
              textDecorationLine: visited ? 'line-through' : 'none',
            }}
          >
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
        {visited ? (
          <Pressable
            onPress={onShare}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Share visit to ${destination.name}`}
            style={[styles.stopShareButton, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
          >
            <MaterialIcons name="ios-share" size={17} color={colors.primary} />
          </Pressable>
        ) : null}
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
type NewTripDetails = {
  title: string;
  origin: string | null;
  departureAt: string | null;
  destinationName: string;
};

function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  onConfirm: (
    ids: number[],
    scope: PlanScope,
    range: PlanRange,
    baseDate: string,
    details: NewTripDetails
  ) => void;
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
  const [tripName, setTripName] = useState('');
  const [origin, setOrigin] = useState('');
  const [departureAt, setDepartureAt] = useState<string | null>(null);
  const [departurePicker, setDeparturePicker] = useState<'date' | 'time' | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualArea, setManualArea] = useState('');
  const [manualCategory, setManualCategory] = useState('Place');
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [manualDestinationName, setManualDestinationName] = useState<string | null>(null);
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

  const addManualPlace = async () => {
    const latitude = Number(manualLatitude.trim());
    const longitude = Number(manualLongitude.trim());
    if (!manualName.trim() || !manualArea.trim()) {
      showToast('Add the place name and city or area');
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      showToast('Enter valid latitude and longitude coordinates');
      return;
    }
    try {
      const place = await addPlace(
        {
          name: manualName.trim(),
          municipality: manualArea.trim(),
          category: manualCategory.trim() || 'Place',
          latitude,
          longitude,
        },
        { ...region, name: manualArea.trim() }
      );
      setSelected((prev) => (prev.includes(place.id) ? prev : [...prev, place.id]));
      setManualDestinationName(manualArea.trim());
      setShowManual(false);
      setManualName('');
      setManualArea('');
      setManualLatitude('');
      setManualLongitude('');
      showToast(`${place.name} added to this trip`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't add that place");
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

      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <View
          style={[
            styles.tripSetupCard,
            {
              backgroundColor: colors.surface,
              borderColor: withAlpha(colors.outlineVariant, 0.45),
            },
          ]}
        >
          <View style={styles.tripSetupTitleRow}>
            <View style={[styles.tripSetupIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
              <MaterialIcons name="flight-takeoff" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tripSetupTitle, { color: colors.onSurface }]}>Journey details</Text>
              <Text style={[styles.tripSetupHint, { color: colors.onSurfaceVariant }]}>Optional — you can edit these later</Text>
            </View>
          </View>
          <View style={styles.tripSetupInputs}>
            <TextInput
              value={tripName}
              onChangeText={setTripName}
              placeholder={`${region.name} Trip`}
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="words"
              style={[styles.tripSetupInput, { color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
            />
            <TextInput
              value={origin}
              onChangeText={setOrigin}
              placeholder="Coming from (e.g. America)"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="words"
              style={[styles.tripSetupInput, { color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
            />
          </View>
          <Pressable
            onPress={() => setDeparturePicker('date')}
            style={[styles.departureSetupButton, { backgroundColor: withAlpha(colors.primary, 0.09) }]}
          >
            <MaterialIcons name="schedule" size={16} color={colors.primary} />
            <Text numberOfLines={1} style={{ flex: 1, color: departureAt ? colors.onSurface : colors.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>
              {departureAt ? departureLabelShort(departureAt) : 'Set plane departure'}
            </Text>
            {departureAt ? (
              <Pressable
                onPress={() => setDepartureAt(null)}
                hitSlop={6}
                style={{ padding: 2 }}
              >
                <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            ) : (
              <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
            )}
          </Pressable>
          {departurePicker ? (
            <DateTimePicker
              value={departureAt ? new Date(departureAt) : new Date(`${draft.baseDate}T08:00:00`)}
              mode={departurePicker}
              onChange={(_, selectedDate) => {
                if (!selectedDate) {
                  setDeparturePicker(null);
                  return;
                }
                const current = departureAt ? new Date(departureAt) : new Date(`${draft.baseDate}T08:00:00`);
                const next = new Date(current);
                if (departurePicker === 'date') {
                  next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                  setDepartureAt(localDateTimeValue(next));
                  setDeparturePicker('time');
                } else {
                  next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                  setDepartureAt(localDateTimeValue(next));
                  setDeparturePicker(null);
                }
              }}
            />
          ) : null}
        </View>
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

      <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
        <Pressable
          onPress={() => setShowManual((value) => !value)}
          style={[
            styles.experimentalButton,
            {
              backgroundColor: withAlpha(colors.secondary, 0.09),
              borderColor: withAlpha(colors.secondary, 0.3),
            },
          ]}
        >
          <MaterialIcons name="add-location-alt" size={18} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.experimentalTitle, { color: colors.onSurface }]}>Add a place yourself</Text>
            <Text style={[styles.experimentalHint, { color: colors.onSurfaceVariant }]}>Experimental · useful for travel outside Bohol</Text>
          </View>
          <MaterialIcons name={showManual ? 'expand-less' : 'expand-more'} size={20} color={colors.secondary} />
        </Pressable>
        {showManual ? (
          <View style={[styles.manualForm, { backgroundColor: colors.surface, borderColor: withAlpha(colors.outlineVariant, 0.45) }]}>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Place name"
              placeholderTextColor={colors.onSurfaceVariant}
              style={[styles.manualInput, { color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={manualArea}
                onChangeText={setManualArea}
                placeholder="City / country"
                placeholderTextColor={colors.onSurfaceVariant}
                style={[styles.manualInput, { flex: 1, color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
              />
              <TextInput
                value={manualCategory}
                onChangeText={setManualCategory}
                placeholder="Category"
                placeholderTextColor={colors.onSurfaceVariant}
                style={[styles.manualInput, { flex: 1, color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={manualLatitude}
                onChangeText={setManualLatitude}
                keyboardType="numbers-and-punctuation"
                placeholder="Latitude"
                placeholderTextColor={colors.onSurfaceVariant}
                style={[styles.manualInput, { flex: 1, color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
              />
              <TextInput
                value={manualLongitude}
                onChangeText={setManualLongitude}
                keyboardType="numbers-and-punctuation"
                placeholder="Longitude"
                placeholderTextColor={colors.onSurfaceVariant}
                style={[styles.manualInput, { flex: 1, color: colors.onSurface, backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}
              />
            </View>
            <Text style={{ fontSize: 10, lineHeight: 14, color: colors.onSurfaceVariant }}>
              Coordinates keep your custom place accurate on the route map.
            </Text>
            <Pressable onPress={addManualPlace} style={[styles.manualAddButton, { backgroundColor: colors.secondary }]}>
              <MaterialIcons name="add" size={16} color={colors.onSecondary} />
              <Text style={{ color: colors.onSecondary, fontSize: 12, fontWeight: '800' }}>Add custom place</Text>
            </Pressable>
          </View>
        ) : null}
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
        style={{ flex: 1 }}
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
            selected.length > 0 &&
            onConfirm(selected, draft.scope, range, draft.baseDate, {
              title: tripName.trim() || `${region.name} Trip`,
              origin: origin.trim() || null,
              departureAt,
              destinationName: manualDestinationName || region.name,
            })
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
  // Transparent positioning frame; the bar inside it carries the surface.
  fabDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: 'center',
  },
  // With no plan on the page there is no Start button and Chirpy peeks up from
  // the bottom-right, so the dock takes the strip beside him and centres its
  // buttons in it rather than staying pinned to the middle of the screen.
  fabDockCompact: {
    right: CHIRPY_PEEK_LANE,
  },
  // Solid surface so the actions stay legible over whatever has scrolled
  // underneath them.
  fabDockBar: {
    height: 56,
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dockAction: {
    width: 42,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dockActionIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startFab: {
    // Sized to its label rather than flex:1 — the bar now hugs however many
    // actions the current plan calls for.
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    flexShrink: 1,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pageMeta: {
    marginTop: 3,
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  overviewWrap: {
    position: 'relative',
    // Room above for the mascot to lean over the card's top edge.
    marginTop: 34,
    marginBottom: 14,
  },
  overviewMascot: {
    position: 'absolute',
    zIndex: 0,
    top: -56,
    right: 14,
    width: 86,
    height: 86,
    transform: [{ rotate: '-3deg' }],
  },
  overview: {
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    borderRadius: 20,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.045,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  overviewOrb: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    right: -43,
    top: -58,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  overviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  overviewLinkText: {
    fontSize: 9,
    fontWeight: '800',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewValue: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  overviewOf: {
    fontSize: 11,
    fontWeight: '600',
  },
  overviewMeta: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: '500',
  },
  overviewDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  overviewTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 99,
    marginTop: 7,
  },
  overviewFill: {
    height: '100%',
    borderRadius: 99,
  },
  overviewStatus: {
    maxWidth: 88,
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  overviewStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  overviewNotes: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  routeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
  },
  routeHeadingText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  reorderHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderHintText: {
    fontSize: 11,
    fontWeight: '600',
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
  dragHandle: {
    width: 34,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -3,
  },
  stopShareButton: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripSetupCard: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 11,
  },
  tripSetupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  tripSetupIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripSetupTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  tripSetupHint: {
    marginTop: 1,
    fontSize: 9,
  },
  tripSetupInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  tripSetupInput: {
    flex: 1,
    height: 39,
    borderRadius: 11,
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: '600',
  },
  departureSetupButton: {
    height: 38,
    marginTop: 8,
    borderRadius: 11,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
  experimentalButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  experimentalTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  experimentalHint: {
    marginTop: 1,
    fontSize: 9,
  },
  manualForm: {
    gap: 8,
    marginTop: 7,
    padding: 11,
    borderWidth: 1,
    borderRadius: 15,
  },
  manualInput: {
    height: 40,
    borderRadius: 11,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  manualAddButton: {
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
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
