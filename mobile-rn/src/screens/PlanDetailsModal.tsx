// Plan details + budget planner. Opened by tapping a plan on the Trips screen.
// Everything is written through PlansContext, which persists to SQLite.
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinationById, distanceKm } from '../data/destinations';
import { TripStop, PlanScope, formatDate, formatTime } from '../context/TripsContext';
import {
  usePlans,
  budgetSpent,
  budgetPersonalShare,
  budgetSplit,
  BudgetItem,
  PlanMeta,
} from '../context/PlansContext';
import BudgetReceiptModal from '../components/BudgetReceipt';
import { estimateEtaMinutes, formatDistance, formatEta } from '../utils/format';

const SCOPE_ICON: Record<PlanScope, keyof typeof MaterialIcons.glyphMap> = {
  day: 'today',
  week: 'date-range',
  month: 'calendar-month',
};

const SCOPE_LABEL: Record<PlanScope, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

const CATEGORIES: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { label: 'Transport', icon: 'directions-car' },
  { label: 'Food', icon: 'restaurant' },
  { label: 'Entrance fees', icon: 'confirmation-number' },
  { label: 'Stay', icon: 'hotel' },
  { label: 'Misc', icon: 'shopping-bag' },
];

function formatPeso(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₱${Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function parseAmount(text: string): number {
  const n = parseFloat(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function departureLabel(value: string | null): string {
  if (!value) return 'Add departure date and time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Add departure date and time';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function iconForExpense(label: string): keyof typeof MaterialIcons.glyphMap {
  const normalized = label.trim().toLowerCase();
  const exact = CATEGORIES.find((category) => category.label.toLowerCase() === normalized);
  if (exact) return exact.icon;
  if (normalized.includes('food') || normalized.includes('meal')) return 'restaurant';
  if (normalized.includes('fare') || normalized.includes('transport')) return 'directions-car';
  if (normalized.includes('hotel') || normalized.includes('stay')) return 'hotel';
  if (normalized.includes('ticket') || normalized.includes('entrance')) return 'confirmation-number';
  return 'receipt-long';
}

export default function PlanDetailsModal({
  planKey,
  label,
  scope,
  stops,
  onClose,
}: {
  planKey: string;
  label: string;
  scope: PlanScope;
  stops: TripStop[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getMeta, setMeta } = usePlans();
  const initial = useMemo(() => getMeta(planKey), [getMeta, planKey]);

  const [targetText, setTargetText] = useState(
    initial.targetBudget != null ? String(initial.targetBudget) : ''
  );
  const [items, setItems] = useState<BudgetItem[]>(initial.items);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [title, setTitle] = useState(initial.title ?? '');
  const [origin, setOrigin] = useState(initial.origin ?? '');
  const [destinationName, setDestinationName] = useState(initial.destinationName ?? 'Bohol');
  const [departureAt, setDepartureAt] = useState<string | null>(initial.departureAt);
  const [departurePicker, setDeparturePicker] = useState<'date' | 'time' | null>(null);
  const [travelerCount, setTravelerCount] = useState(Math.max(1, initial.travelerCount));
  // Padded to the people count up front, so every row has a name to edit even
  // for a plan saved before people could be named.
  const [travelerNames, setTravelerNames] = useState<string[]>(() => {
    const count = Math.max(1, initial.travelerCount);
    const names = (initial.travelerNames ?? []).slice(0, count);
    while (names.length < count) names.push(names.length === 0 ? 'You' : `Traveller ${names.length + 1}`);
    return names;
  });
  const [showReceipt, setShowReceipt] = useState(false);

  const commitItems = (next: BudgetItem[]) => {
    setItems(next);
    setMeta(planKey, { items: next });
  };

  const commitTarget = (text: string) => {
    setTargetText(text);
    const trimmed = text.trim();
    setMeta(planKey, { targetBudget: trimmed === '' ? null : parseAmount(trimmed) });
  };

  const commitNotes = (text: string) => {
    setNotes(text);
    setMeta(planKey, { notes: text.trim() ? text : null });
  };

  const addItem = (labelText: string) =>
    commitItems([...items, { id: newId(), label: labelText, amount: 0, shared: false }]);
  const updateItem = (id: string, patch: Partial<BudgetItem>) =>
    commitItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const removeItem = (id: string) => commitItems(items.filter((item) => item.id !== id));

  const commitTripText = (
    field: 'title' | 'origin' | 'destinationName',
    value: string
  ) => {
    if (field === 'title') setTitle(value);
    if (field === 'origin') setOrigin(value);
    if (field === 'destinationName') setDestinationName(value);
    setMeta(planKey, { [field]: value.trim() ? value : null });
  };

  // Names are the source of truth for who is splitting; the count follows them,
  // so the two can never disagree about how many people there are.
  const commitTravelers = (names: string[]) => {
    // Never empty: someone is always paying, and a zero count would divide the
    // shared lines by nothing.
    const next = (names.length ? names : ['You']).slice(0, 20);
    setTravelerNames(next);
    setTravelerCount(next.length);
    setMeta(planKey, { travelerNames: next, travelerCount: next.length });
  };

  // "Splitting" is simply having more than one person on the plan — no extra
  // stored flag to fall out of step with the count.
  const splitting = travelerCount > 1;
  const toggleSplitting = (on: boolean) =>
    commitTravelers(on ? [travelerNames[0] ?? 'You', 'Traveller 2'] : [travelerNames[0] ?? 'You']);

  const addTraveler = () =>
    commitTravelers([...travelerNames, `Traveller ${travelerNames.length + 1}`]);
  const removeTraveler = (index: number) => {
    if (travelerNames.length <= 1) return;
    commitTravelers(travelerNames.filter((_, i) => i !== index));
  };
  const renameTraveler = (index: number, value: string) =>
    commitTravelers(travelerNames.map((name, i) => (i === index ? value : name)));

  const setDeparture = (date: Date) => {
    const value = toLocalDateTime(date);
    setDepartureAt(value);
    setMeta(planKey, { departureAt: value });
  };

  const municipalities = useMemo(() => {
    const towns = new Set<string>();
    stops.forEach((stop) => {
      const destination = destinationById(stop.destinationId);
      if (destination) towns.add(destination.municipality);
    });
    return towns.size;
  }, [stops]);

  const totalKm = useMemo(() => {
    let sum = 0;
    for (let index = 0; index < stops.length - 1; index += 1) {
      const from = destinationById(stops[index].destinationId);
      const to = destinationById(stops[index + 1].destinationId);
      if (from && to) sum += distanceKm(from, to);
    }
    return sum;
  }, [stops]);

  const visitedCount = stops.filter((stop) => stop.visited).length;
  // The live meta: what is saved, plus whatever is still being edited on screen.
  const liveMeta = useMemo<PlanMeta>(
    () => ({ ...initial, items, travelerCount, travelerNames, title: title.trim() ? title : null }),
    [initial, items, travelerCount, travelerNames, title]
  );
  const spent = budgetSpent(liveMeta);
  const personalShare = budgetPersonalShare(liveMeta);
  const split = budgetSplit(liveMeta);
  const target = targetText.trim() === '' ? null : parseAmount(targetText);
  const remaining = target != null ? target - spent : null;
  const isOverBudget = remaining != null && remaining < 0;
  const progress = target && target > 0 ? Math.min(1, spent / target) : 0;
  const progressPercent = target && target > 0 ? Math.round((spent / target) * 100) : 0;

  const budgetStatus =
    target == null || target === 0
      ? 'Set your target'
      : isOverBudget
        ? 'Over budget'
        : progress >= 0.8
          ? 'Nearly reached'
          : 'On track';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 16) + 6,
              backgroundColor: colors.background,
              borderBottomColor: withAlpha(colors.outlineVariant, 0.36),
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close plan details"
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: pressed
                  ? withAlpha(colors.surfaceVariant, 0.9)
                  : withAlpha(colors.surfaceVariant, 0.58),
              },
            ]}
          >
            <MaterialIcons name="arrow-back" size={21} color={colors.onSurface} />
          </Pressable>

          <View style={styles.headerCopy}>
            <View style={styles.headerEyebrowRow}>
              <View style={[styles.scopePill, { backgroundColor: withAlpha(colors.primary, 0.13) }]}>
                <MaterialIcons name={SCOPE_ICON[scope]} size={12} color={colors.primary} />
                <Text style={[styles.scopeText, { color: colors.primary }]}>
                  {SCOPE_LABEL[scope]} plan
                </Text>
              </View>
              <Text style={[styles.headerHint, { color: colors.onSurfaceVariant }]}>Trip planner</Text>
            </View>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>
              {title.trim() || 'Bohol Trip'}
            </Text>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 28 }]}
        >
          <SectionHeader icon="flight-takeoff" title="Trip details" subtitle="Name the journey and tell Chirpy where it begins" />
          <View
            style={[
              styles.tripDetailsCard,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(colors.outlineVariant, 0.45),
              },
            ]}
          >
            <LabeledInput
              icon="luggage"
              label="TRIP NAME"
              value={title}
              onChangeText={(value) => commitTripText('title', value)}
              placeholder="Bohol Trip"
            />
            <View style={[styles.detailDivider, { backgroundColor: withAlpha(colors.outlineVariant, 0.4) }]} />
            <View style={styles.routeInputRow}>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  icon="flight-takeoff"
                  label="FROM"
                  value={origin}
                  onChangeText={(value) => commitTripText('origin', value)}
                  placeholder="America"
                />
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <LabeledInput
                  icon="flight-land"
                  label="TO"
                  value={destinationName}
                  onChangeText={(value) => commitTripText('destinationName', value)}
                  placeholder="Bohol"
                />
              </View>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: withAlpha(colors.outlineVariant, 0.4) }]} />
            <View style={styles.departureRow}>
              <View style={[styles.departureIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <MaterialIcons name="schedule" size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>PLANE DEPARTURE</Text>
                <Text style={[styles.departureValue, { color: colors.onSurface }]}>
                  {departureLabel(departureAt)}
                </Text>
              </View>
              <Pressable
                onPress={() => setDeparturePicker('date')}
                style={[styles.changeDateButton, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>Set</Text>
              </Pressable>
            </View>
            {departurePicker ? (
              <DateTimePicker
                value={departureAt ? new Date(departureAt) : new Date()}
                mode={departurePicker}
                onChange={(_, selected) => {
                  if (!selected) {
                    setDeparturePicker(null);
                    return;
                  }
                  const current = departureAt ? new Date(departureAt) : new Date();
                  const next = new Date(current);
                  if (departurePicker === 'date') {
                    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                    setDeparture(next);
                    setDeparturePicker('time');
                  } else {
                    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                    setDeparture(next);
                    setDeparturePicker(null);
                  }
                }}
              />
            ) : null}
          </View>

          <View style={[styles.routeCard, { backgroundColor: colors.surface }]}>
            <View style={styles.routeCardHeader}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>TRIP OVERVIEW</Text>
                <Text style={[styles.routeTitle, { color: colors.onSurface }]}>Your route at a glance</Text>
              </View>
              <View style={[styles.visitedPill, { backgroundColor: withAlpha('#16A34A', 0.12) }]}>
                <MaterialIcons name="check-circle" size={14} color="#16A34A" />
                <Text style={styles.visitedText}>{visitedCount}/{stops.length} visited</Text>
              </View>
            </View>

            <View style={styles.routeMetrics}>
              <RouteMetric icon="place" value={String(stops.length)} label={stops.length === 1 ? 'Stop' : 'Stops'} />
              <View style={[styles.metricDivider, { backgroundColor: withAlpha(colors.outlineVariant, 0.48) }]} />
              <RouteMetric icon="map" value={formatDistance(totalKm)} label="Distance" />
              <View style={[styles.metricDivider, { backgroundColor: withAlpha(colors.outlineVariant, 0.48) }]} />
              <RouteMetric icon="schedule" value={formatEta(estimateEtaMinutes(totalKm))} label="Drive time" />
            </View>

            <View style={[styles.townsRow, { backgroundColor: withAlpha(colors.primary, 0.07) }]}>
              <MaterialIcons name="location-city" size={16} color={colors.primary} />
              <Text style={[styles.townsText, { color: colors.onSurfaceVariant }]}>
                Exploring {municipalities} {municipalities === 1 ? 'town' : 'towns'} across Bohol
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.splitCard,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(colors.outlineVariant, 0.45),
              },
            ]}
          >
            <View style={styles.splitHeader}>
              <View style={[styles.splitIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <MaterialIcons name={splitting ? 'groups' : 'person'} size={21} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.splitTitle, { color: colors.onSurface }]}>Shared costs</Text>
                <Text style={[styles.splitSubtitle, { color: colors.onSurfaceVariant }]}>
                  {splitting
                    ? `Your current share is ${formatPeso(personalShare)}`
                    : 'Off — the whole trip is on you'}
                </Text>
              </View>
              {/* Splitting is opt-in: with it off the totals are simply what the
                  trip costs, and nothing is divided behind the traveller's back. */}
              <Switch
                value={splitting}
                onValueChange={toggleSplitting}
                accessibilityLabel="Split costs with other people"
                trackColor={{ true: withAlpha(colors.primary, 0.5), false: colors.surfaceVariant }}
                thumbColor={splitting ? colors.primary : colors.outline}
              />
            </View>

            {/* Naming everyone turns the split from a number into an answer to
                "who owes what", which is what the receipt prints. */}
            {splitting ? (
              <>
            <View style={styles.travelerList}>
              {split.map((share, index) => (
                <View
                  key={index}
                  style={[
                    styles.travelerRow,
                    {
                      backgroundColor: withAlpha(colors.surfaceVariant, 0.42),
                      borderColor: withAlpha(colors.outlineVariant, 0.42),
                    },
                  ]}
                >
                  <View style={[styles.travelerAvatar, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
                    <Text style={[styles.travelerInitial, { color: colors.primary }]}>
                      {share.name.trim().charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <TextInput
                    value={travelerNames[index] ?? ''}
                    onChangeText={(text) => renameTraveler(index, text)}
                    placeholder={index === 0 ? 'You' : `Traveller ${index + 1}`}
                    placeholderTextColor={colors.onSurfaceVariant}
                    maxLength={24}
                    accessibilityLabel={`Name of traveller ${index + 1}`}
                    style={[styles.travelerName, { color: colors.onSurface }]}
                  />
                  <Text style={[styles.travelerAmount, { color: colors.onSurfaceVariant }]}>
                    {formatPeso(share.amount)}
                  </Text>
                  {travelerCount > 1 ? (
                    <Pressable
                      onPress={() => removeTraveler(index)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${share.name}`}
                      style={({ pressed }) => [
                        styles.travelerRemove,
                        { backgroundColor: withAlpha(colors.error, pressed ? 0.16 : 0.07) },
                      ]}
                    >
                      <MaterialIcons name="close" size={13} color={colors.error} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            <Pressable
              onPress={addTraveler}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.splitButton,
                {
                  borderWidth: 1,
                  borderColor: withAlpha(colors.outlineVariant, 0.7),
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialIcons name="person-add-alt" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                Add person
              </Text>
            </Pressable>
              </>
            ) : null}

            {/* The receipt is not part of the split — it is the trip's bill, and
                is worth having whether or not anyone else is chipping in. */}
            <View style={styles.splitActions}>
              <Pressable
                onPress={() => setShowReceipt(true)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.splitButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialIcons name="receipt-long" size={15} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '700' }}>
                  Share receipt
                </Text>
              </Pressable>
            </View>
          </View>

          <SectionHeader icon="savings" title="Trip budget" subtitle="Keep every peso in view" />

          <View style={[styles.budgetHero, { backgroundColor: colors.primary }]}>
            <View style={[styles.heroOrbLarge, { backgroundColor: withAlpha(colors.onPrimary, 0.08) }]} />
            <View style={[styles.heroOrbSmall, { backgroundColor: withAlpha(colors.onPrimary, 0.09) }]} />

            <View style={styles.budgetTopRow}>
              <Text style={[styles.heroEyebrow, { color: withAlpha(colors.onPrimary, 0.75) }]}>TOTAL BUDGET</Text>
              <View style={[styles.statusPill, { backgroundColor: withAlpha(colors.onPrimary, 0.14) }]}>
                <Text style={[styles.statusText, { color: colors.onPrimary }]}>{budgetStatus}</Text>
              </View>
            </View>

            <View style={styles.targetRow}>
              <Text style={[styles.targetCurrency, { color: withAlpha(colors.onPrimary, 0.78) }]}>₱</Text>
              <TextInput
                value={targetText}
                onChangeText={commitTarget}
                keyboardType="decimal-pad"
                placeholder="Set amount"
                placeholderTextColor={withAlpha(colors.onPrimary, 0.54)}
                selectTextOnFocus
                maxLength={12}
                accessibilityLabel="Total trip budget"
                style={[styles.targetInput, { color: colors.onPrimary }]}
              />
              <View style={[styles.editBudgetButton, { backgroundColor: withAlpha(colors.onPrimary, 0.14) }]}>
                <MaterialIcons name="edit" size={15} color={colors.onPrimary} />
              </View>
            </View>

            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: withAlpha(colors.onPrimary, 0.74) }]}>Budget used</Text>
              <Text style={[styles.progressValue, { color: colors.onPrimary }]}> {progressPercent}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.onPrimary, 0.2) }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: isOverBudget ? '#FCA5A5' : colors.onPrimary,
                  },
                ]}
              />
            </View>

            <View style={styles.budgetMetrics}>
              <View style={[styles.budgetMetric, { backgroundColor: withAlpha(colors.onPrimary, 0.11) }]}>
                <Text style={[styles.budgetMetricLabel, { color: withAlpha(colors.onPrimary, 0.68) }]}>SPENT</Text>
                <Text style={[styles.budgetMetricValue, { color: colors.onPrimary }]}>{formatPeso(spent)}</Text>
              </View>
              <View style={[styles.budgetMetric, { backgroundColor: withAlpha(colors.onPrimary, 0.11) }]}>
                <Text style={[styles.budgetMetricLabel, { color: withAlpha(colors.onPrimary, 0.68) }]}>
                  {isOverBudget ? 'OVER BY' : 'REMAINING'}
                </Text>
                <Text style={[styles.budgetMetricValue, { color: isOverBudget ? '#FECACA' : colors.onPrimary }]}>
                  {remaining == null ? '—' : formatPeso(Math.abs(remaining))}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.expenseHeader}>
            <View>
              <View style={styles.expenseTitleRow}>
                <Text style={[styles.expenseTitle, { color: colors.onSurface }]}>Expenses</Text>
                <View style={[styles.countPill, { backgroundColor: withAlpha(colors.primary, 0.11) }]}>
                  <Text style={[styles.countText, { color: colors.primary }]}>{items.length}</Text>
                </View>
              </View>
              <Text style={[styles.expenseSubtitle, { color: colors.onSurfaceVariant }]}>Tap a category to add it</Text>
            </View>
            <View style={styles.expenseTotalCopy}>
              <Text style={[styles.expenseTotalLabel, { color: colors.onSurfaceVariant }]}>TOTAL</Text>
              <Text style={[styles.expenseTotal, { color: colors.onSurface }]}>{formatPeso(spent)}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAddContent}
          >
            {CATEGORIES.map((category) => (
              <Pressable
                key={category.label}
                onPress={() => addItem(category.label)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${category.label} expense`}
                style={({ pressed }) => [
                  styles.categoryTile,
                  {
                    backgroundColor: pressed
                      ? withAlpha(colors.primary, 0.12)
                      : colors.surface,
                    borderColor: withAlpha(colors.outlineVariant, 0.55),
                  },
                ]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <MaterialIcons name={category.icon} size={19} color={colors.primary} />
                </View>
                <Text numberOfLines={1} style={[styles.categoryLabel, { color: colors.onSurface }]}>
                  {category.label}
                </Text>
                <View style={[styles.categoryAdd, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <MaterialIcons name="add" size={13} color={colors.primary} />
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {items.length > 0 ? (
            <View style={styles.expenseList}>
              {items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.expenseCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: withAlpha(colors.outlineVariant, 0.42),
                    },
                  ]}
                >
                  <View style={[styles.expenseIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                    <MaterialIcons name={iconForExpense(item.label)} size={20} color={colors.primary} />
                  </View>

                  <View style={styles.expenseNameWrap}>
                    <TextInput
                      value={item.label}
                      onChangeText={(text) => updateItem(item.id, { label: text })}
                      placeholder="Expense name"
                      placeholderTextColor={colors.onSurfaceVariant}
                      selectTextOnFocus
                      style={[styles.expenseName, { color: colors.onSurface }]}
                    />
                    {/* Marking a line as shared only means anything once there
                        is somebody to share it with. */}
                    {splitting ? (
                      <Pressable
                        onPress={() => updateItem(item.id, { shared: !item.shared })}
                        style={styles.sharedToggle}
                      >
                        <MaterialIcons
                          name={item.shared ? 'groups' : 'person'}
                          size={12}
                          color={item.shared ? colors.primary : colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.expenseHelper,
                            { color: item.shared ? colors.primary : colors.onSurfaceVariant },
                          ]}
                        >
                          {item.shared
                            ? `${formatPeso(item.amount / travelerCount)} each · shared`
                            : 'Personal · tap to share'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.expenseAmountField,
                      {
                        backgroundColor: withAlpha(colors.surfaceVariant, 0.54),
                        borderColor: withAlpha(colors.outlineVariant, 0.48),
                      },
                    ]}
                  >
                    <Text style={[styles.expenseCurrency, { color: colors.onSurfaceVariant }]}>₱</Text>
                    <TextInput
                      value={item.amount ? String(item.amount) : ''}
                      onChangeText={(text) => updateItem(item.id, { amount: parseAmount(text) })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.onSurfaceVariant}
                      selectTextOnFocus
                      maxLength={10}
                      accessibilityLabel={`${item.label || 'Expense'} amount`}
                      style={[styles.expenseAmount, { color: colors.onSurface }]}
                    />
                  </View>

                  <Pressable
                    onPress={() => removeItem(item.id)}
                    hitSlop={7}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.label || 'expense'}`}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      { backgroundColor: withAlpha(colors.error, pressed ? 0.16 : 0.08) },
                    ]}
                  >
                    <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyExpenses,
                {
                  backgroundColor: withAlpha(colors.surfaceVariant, 0.38),
                  borderColor: withAlpha(colors.outlineVariant, 0.48),
                },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <MaterialIcons name="receipt-long" size={23} color={colors.primary} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No expenses yet</Text>
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>Choose a category above to start planning.</Text>
              </View>
            </View>
          )}

          <SectionHeader icon="sticky-note-2" title="Trip notes" subtitle="Keep the little details together" />
          <View
            style={[
              styles.notesCard,
              {
                backgroundColor: withAlpha(colors.surfaceVariant, 0.42),
                borderColor: withAlpha(colors.outlineVariant, 0.48),
              },
            ]}
          >
            <View style={[styles.notesIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
              <MaterialIcons name="edit-note" size={21} color={colors.primary} />
            </View>
            <TextInput
              value={notes}
              onChangeText={commitNotes}
              placeholder="Reminders, packing list, meeting point…"
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              style={[styles.notesInput, { color: colors.onSurface }]}
            />
          </View>

          <SectionHeader icon="format-list-numbered" title="Itinerary" subtitle={`${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} planned`} />
          <View style={[styles.stopsCard, { backgroundColor: colors.surface }]}>
            {stops.map((stop, index) => {
              const destination = destinationById(stop.destinationId);
              if (!destination) return null;
              return (
                <View key={stop.id}>
                  <View style={styles.stopRow}>
                    <View
                      style={[
                        styles.stopNumber,
                        { backgroundColor: stop.visited ? '#16A34A' : withAlpha(colors.primary, 0.12) },
                      ]}
                    >
                      {stop.visited ? (
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.stopNumberText, { color: colors.primary }]}>{index + 1}</Text>
                      )}
                    </View>
                    <View style={styles.stopCopy}>
                      <Text numberOfLines={1} style={[styles.stopName, { color: colors.onSurface }]}>
                        {destination.name}
                      </Text>
                      <View style={styles.stopMetaRow}>
                        <MaterialIcons name="schedule" size={12} color={colors.onSurfaceVariant} />
                        <Text style={[styles.stopMeta, { color: colors.onSurfaceVariant }]}>
                          {formatDate(stop.date)} · {formatTime(stop.hour, stop.minute)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.townPill, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                      <Text numberOfLines={1} style={[styles.townPillText, { color: colors.primary }]}>
                        {destination.municipality}
                      </Text>
                    </View>
                  </View>
                  {index < stops.length - 1 ? (
                    <View style={[styles.stopDivider, { backgroundColor: withAlpha(colors.outlineVariant, 0.38) }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {showReceipt ? (
          <BudgetReceiptModal
            meta={liveMeta}
            items={items}
            planLabel={label}
            // Not gated on being finished: a half-planned trip's receipt is how
            // a group agrees the split up front. It just says which it is.
            complete={stops.length > 0 && visitedCount === stops.length}
            onClose={() => setShowReceipt(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function LabeledInput({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.labeledInput}>
      <View style={styles.detailLabelRow}>
        <MaterialIcons name={icon} size={13} color={colors.primary} />
        <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="words"
        maxLength={60}
        style={[styles.detailInput, { color: colors.onSurface }]}
      />
    </View>
  );
}

function RouteMetric({
  icon,
  value,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.routeMetric}>
      <View style={[styles.routeMetricIcon, { backgroundColor: withAlpha(colors.primary, 0.09) }]}>
        <MaterialIcons name={icon} size={16} color={colors.primary} />
      </View>
      <Text numberOfLines={1} style={[styles.routeMetricValue, { color: colors.onSurface }]}>
        {value}
      </Text>
      <Text style={[styles.routeMetricLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
        <MaterialIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scopeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerHint: {
    fontSize: 10,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  tripDetailsCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  labeledInput: {
    flex: 1,
    minWidth: 0,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detailInput: {
    paddingHorizontal: 0,
    paddingTop: 5,
    paddingBottom: 2,
    fontSize: 15,
    fontWeight: '700',
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  routeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  departureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  departureIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  departureValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
  },
  changeDateButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  routeCard: {
    borderRadius: 22,
    padding: 16,
    elevation: 2,
    shadowColor: '#102A23',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  routeTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  visitedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
  },
  visitedText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  routeMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  routeMetric: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  routeMetricIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  routeMetricValue: {
    width: '100%',
    paddingHorizontal: 2,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  routeMetricLabel: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '500',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 43,
  },
  townsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 15,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  townsText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 11,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '500',
  },
  budgetHero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#0B6B53',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroOrbLarge: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -74,
    right: -44,
  },
  heroOrbSmall: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    bottom: -30,
    left: -22,
  },
  budgetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  targetCurrency: {
    fontSize: 29,
    fontWeight: '700',
    marginRight: 5,
  },
  targetInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 3,
    fontSize: 33,
    lineHeight: 41,
    fontWeight: '800',
    letterSpacing: -1,
  },
  editBudgetButton: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 11,
    marginBottom: 7,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  budgetMetrics: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 15,
  },
  budgetMetric: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  budgetMetricLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  budgetMetricValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '800',
  },
  splitCard: {
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 18,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  travelerList: { gap: 6 },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 8,
    paddingRight: 9,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
  },
  travelerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelerInitial: { fontSize: 12, fontWeight: '800' },
  // The name is an input styled as plain text: tapping it edits in place, with
  // no separate "edit" affordance to hunt for.
  travelerName: { flex: 1, minWidth: 0, padding: 0, fontSize: 13, fontWeight: '600' },
  travelerAmount: { fontSize: 12, fontWeight: '700' },
  travelerRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitActions: { flexDirection: 'row', gap: 8 },
  splitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 12,
  },
  splitIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  splitSubtitle: {
    marginTop: 2,
    fontSize: 10,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 23,
    marginBottom: 10,
  },
  expenseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countPill: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
  },
  expenseSubtitle: {
    marginTop: 2,
    fontSize: 10,
  },
  expenseTotalCopy: {
    alignItems: 'flex-end',
  },
  expenseTotalLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  expenseTotal: {
    marginTop: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  quickAddContent: {
    gap: 9,
    paddingRight: 2,
    paddingBottom: 2,
  },
  categoryTile: {
    width: 101,
    minHeight: 95,
    borderWidth: 1,
    borderRadius: 18,
    padding: 11,
    justifyContent: 'space-between',
    shadowColor: '#102A23',
    shadowOpacity: 0.035,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    marginTop: 7,
    paddingRight: 15,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryAdd: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseList: {
    gap: 9,
    marginTop: 12,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 17,
    padding: 10,
  },
  expenseIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseNameWrap: {
    flex: 1,
    minWidth: 70,
  },
  expenseName: {
    padding: 0,
    fontSize: 13,
    fontWeight: '700',
  },
  expenseHelper: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '500',
  },
  sharedToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  expenseAmountField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expenseCurrency: {
    fontSize: 12,
    fontWeight: '600',
  },
  expenseAmount: {
    width: 58,
    paddingVertical: 3,
    paddingHorizontal: 3,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButton: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyExpenses: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 17,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  notesIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    flex: 1,
    minHeight: 83,
    paddingTop: 6,
    paddingHorizontal: 2,
    textAlignVertical: 'top',
    fontSize: 13,
    lineHeight: 19,
  },
  stopsCard: {
    overflow: 'hidden',
    borderRadius: 19,
    elevation: 1,
    shadowColor: '#102A23',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stopCopy: {
    flex: 1,
    minWidth: 0,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '700',
  },
  stopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  stopMeta: {
    fontSize: 9,
  },
  townPill: {
    maxWidth: 91,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  townPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  stopDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
    marginRight: 12,
  },
});
