// Ported from ui/screens/ItineraryScreen.kt, then extended into a day/week/month
// trip planner: stops are grouped by date granularity, each leg shows the ETA to
// the next stop, every group opens a route map, a "Start" flow routes from the
// user's location and marks nearby stops visited.
import React, { useMemo, useState } from 'react';
import {
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
import {
  useTrips,
  TripStop,
  todayIso,
  formatDate,
  formatTime,
  isoToDate,
} from '../context/TripsContext';
import { useUserLocation, Coords } from '../hooks/useUserLocation';
import { estimateEtaMinutes, formatDistance, formatEta, formatKm } from '../utils/format';
import { showToast } from '../utils/toast';
import TripDayMap from './TripDayMap';

const VISITED_GREEN = '#16A34A';

type Granularity = 'day' | 'week' | 'month';

interface StopGroup {
  key: string;
  label: string;
  stops: TripStop[];
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function byDateTime(a: TripStop, b: TripStop): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
}

// Monday-based start of the week containing `iso` (yyyy-mm-dd).
function weekStartIso(iso: string): string {
  const d = isoToDate(iso);
  const offset = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

function groupKeyLabel(iso: string, g: Granularity): { key: string; label: string } {
  if (g === 'day') return { key: iso, label: formatDate(iso) };
  if (g === 'week') {
    const ws = weekStartIso(iso);
    return { key: ws, label: `Week of ${formatDate(ws)}` };
  }
  const d = isoToDate(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { key, label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` };
}

function groupStops(stops: TripStop[], g: Granularity): StopGroup[] {
  const sorted = [...stops].sort(byDateTime);
  const map = new Map<string, StopGroup>();
  const order: string[] = [];
  for (const s of sorted) {
    const { key, label } = groupKeyLabel(s.date, g);
    let grp = map.get(key);
    if (!grp) {
      grp = { key, label, stops: [] };
      map.set(key, grp);
      order.push(key);
    }
    grp.stops.push(s);
  }
  return order.map((k) => map.get(k)!);
}

export default function ItineraryScreen() {
  const { colors } = useTheme();
  const { stops, add, update, remove, setVisited } = useTrips();
  const { location, hasPermission, request } = useUserLocation();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [showPicker, setShowPicker] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [mapGroup, setMapGroup] = useState<
    { title: string; stops: TripStop[]; withUser: boolean } | null
  >(null);

  const groups = useMemo(() => groupStops(stops, granularity), [stops, granularity]);
  const unitLabel =
    granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';

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

  const handleStart = async () => {
    const first = groups[0];
    if (!first) return;
    if (!location && !hasPermission) {
      await request();
      showToast('Turn on location, then tap Start to route from where you are');
    }
    if (location) {
      const n = markNearbyVisited(location);
      if (n > 0) showToast(`${n} nearby stop${n === 1 ? '' : 's'} marked as visited`);
    }
    setMapGroup({ title: first.label, stops: first.stops, withUser: !!location });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {stops.length === 0 ? (
        <EmptyTripsState onAdd={() => setShowPicker(true)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 150 }}
        >
          <Text style={{ fontSize: 32, fontWeight: '700', color: colors.onBackground }}>
            My trip
          </Text>
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 }}>
            {stops.length} stops · {groups.length} {groups.length === 1 ? unitLabel : `${unitLabel}s`}
          </Text>

          {/* Day / Week / Month selector */}
          <View style={[styles.segment, { backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}>
            {(['day', 'week', 'month'] as Granularity[]).map((g) => {
              const active = granularity === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGranularity(g)}
                  style={[styles.segmentItem, active && { backgroundColor: colors.primary }]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      color: active ? colors.onPrimary : colors.onSurfaceVariant,
                    }}
                  >
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {groups.map((group) => (
            <View key={group.key} style={{ marginTop: 22 }}>
              <GroupHeader
                label={group.label}
                count={group.stops.length}
                onOpenMap={() =>
                  setMapGroup({ title: group.label, stops: group.stops, withUser: false })
                }
              />
              <View style={{ height: 12 }} />
              {group.stops.map((stop, idx) => {
                const destination = destinationById(stop.destinationId);
                if (!destination) return null;
                const next = group.stops[idx + 1];
                const nextDest = next ? destinationById(next.destinationId) : undefined;
                return (
                  <React.Fragment key={stop.id}>
                    <StopCard
                      order={idx + 1}
                      stop={stop}
                      destination={destination}
                      onEdit={() => setEditingStop(stop)}
                      onRemove={() => remove(stop.id)}
                      onToggleVisited={() => setVisited(stop.id, !stop.visited)}
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
          ))}
        </ScrollView>
      )}

      {stops.length > 0 ? (
        <>
          <Pressable
            onPress={handleStart}
            style={[styles.fab, { bottom: 88, backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="navigation" size={20} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Start</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={[
              styles.fab,
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant },
            ]}
          >
            <MaterialIcons name="add" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Add stops</Text>
          </Pressable>
        </>
      ) : null}

      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <DestinationPicker
          existingIds={new Set(stops.map((s) => s.destinationId))}
          onDismiss={() => setShowPicker(false)}
          onConfirm={(selectedIds) => {
            selectedIds.forEach((id) => add(id, todayIso(), 9, 0, null));
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

      {mapGroup ? (
        <TripDayMap
          title={mapGroup.title}
          stops={mapGroup.stops}
          userLocation={mapGroup.withUser ? location : null}
          onClose={() => setMapGroup(null)}
        />
      ) : null}
    </View>
  );
}

function GroupHeader({
  label,
  count,
  onOpenMap,
}: {
  label: string;
  count: number;
  onOpenMap: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface }}>{label}</Text>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          {count} {count === 1 ? 'stop' : 'stops'}
        </Text>
      </View>
      <Pressable
        onPress={onOpenMap}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          height: 34,
          borderRadius: 50,
          backgroundColor: withAlpha(colors.primary, 0.14),
        }}
      >
        <MaterialIcons name="map" size={16} color={colors.primary} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Map</Text>
      </Pressable>
    </View>
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
  onEdit,
  onRemove,
  onToggleVisited,
}: {
  order: number;
  stop: TripStop;
  destination: Destination;
  onEdit: () => void;
  onRemove: () => void;
  onToggleVisited: () => void;
}) {
  const { colors } = useTheme();
  const visited = stop.visited;
  return (
    <View
      style={[
        styles.stopCard,
        { backgroundColor: colors.surface },
        visited && { borderWidth: 1.5, borderColor: withAlpha(VISITED_GREEN, 0.55) },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.indexBadge, { backgroundColor: visited ? VISITED_GREEN : colors.primary }]}>
          {visited ? (
            <MaterialIcons name="check" size={20} color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onPrimary }}>
              {order}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
            {destination.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="location-on" size={14} color={colors.onSurfaceVariant} />
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              {destination.municipality}
            </Text>
          </View>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 4 }}>
          <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <InfoPill icon="calendar-month" text={formatDate(stop.date)} />
        <InfoPill icon="schedule" text={formatTime(stop.hour, stop.minute)} />
        {visited ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderRadius: 50,
              backgroundColor: withAlpha(VISITED_GREEN, 0.16),
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <MaterialIcons name="check-circle" size={14} color={VISITED_GREEN} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: VISITED_GREEN }}>Visited</Text>
          </View>
        ) : null}
      </View>

      {stop.notes ? (
        <Text style={{ fontSize: 14, color: colors.onSurfaceVariant, marginTop: 10 }}>
          {stop.notes}
        </Text>
      ) : null}

      <View style={{ height: 12 }} />
      <View style={{ height: 1, backgroundColor: withAlpha(colors.outlineVariant, 0.4) }} />
      <View style={{ flexDirection: 'row' }}>
        <Pressable
          onPress={onToggleVisited}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            marginTop: 4,
          }}
        >
          <MaterialIcons
            name={visited ? 'undo' : 'check-circle'}
            size={16}
            color={visited ? colors.onSurfaceVariant : VISITED_GREEN}
          />
          <Text
            style={{
              color: visited ? colors.onSurfaceVariant : VISITED_GREEN,
              fontWeight: '500',
            }}
          >
            {visited ? 'Not visited' : 'Mark visited'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            marginTop: 4,
          }}
        >
          <MaterialIcons name="edit" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '500' }}>Edit</Text>
        </Pressable>
      </View>
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
  onConfirm: (ids: number[]) => void;
}) {
  const { colors } = useTheme();
  const { location } = useUserLocation();
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<PickerTabKey>('POPULAR');

  const filtered = useMemo(() => {
    let base: Destination[];
    if (tab === 'NEAR') {
      base = location
        ? [...destinations].sort((a, b) => distanceKm(location, a) - distanceKm(location, b))
        : [...destinations];
    } else if (tab === 'POPULAR') {
      base = [...destinations].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    } else {
      base = [...destinations].sort((a, b) => a.name.localeCompare(b.name));
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.municipality.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [query, tab, location]);

  const toggleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

      {/* Search */}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, place, or category"
            placeholderTextColor={colors.onSurfaceVariant}
            style={{ flex: 1, color: colors.onSurface, fontSize: 15 }}
          />
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 10 }}>
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
      </ScrollView>

      {/* Bottom bar */}
      <View style={{ padding: 16, backgroundColor: colors.surface }}>
        <Pressable
          disabled={selected.length === 0}
          onPress={() => selected.length > 0 && onConfirm(selected)}
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
              : `Add ${selected.length} ${selected.length === 1 ? 'stop' : 'stops'}`}
          </Text>
        </Pressable>
      </View>
    </View>
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
      <Image source={{ uri: destination.imageUrl }} style={{ width: 64, height: 64, borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface }}>
          {destination.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>
            ★ {destination.rating}
          </Text>
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
            · {destination.category}
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
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
  segment: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 14,
    padding: 4,
    borderRadius: 12,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
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
