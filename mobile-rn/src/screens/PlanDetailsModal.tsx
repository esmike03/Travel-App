// Plan details + budget planner. Opened by tapping a plan on the Trips screen.
// Shows a summary of the plan (stops, distance, drive time), an editable budget
// (target + line items with a live remaining/over indicator) and free-form notes.
// Everything is written through PlansContext, which persists to SQLite.
import React, { useMemo, useState } from 'react';
import {
  Modal,
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
import { destinationById, distanceKm } from '../data/destinations';
import { TripStop, PlanScope, formatDate, formatTime } from '../context/TripsContext';
import { usePlans, budgetSpent, BudgetItem } from '../context/PlansContext';
import { estimateEtaMinutes, formatDistance, formatEta } from '../utils/format';

const SCOPE_ICON: Record<PlanScope, keyof typeof MaterialIcons.glyphMap> = {
  day: 'today',
  week: 'date-range',
  month: 'calendar-month',
};
const SCOPE_LABEL: Record<PlanScope, string> = { day: 'Day', week: 'Week', month: 'Month' };

// Suggested budget categories with a matching icon for quick-add.
const CATEGORIES: { label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
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
  const { getMeta, setMeta } = usePlans();
  const initial = useMemo(() => getMeta(planKey), [getMeta, planKey]);

  const [targetText, setTargetText] = useState(
    initial.targetBudget != null ? String(initial.targetBudget) : ''
  );
  const [items, setItems] = useState<BudgetItem[]>(initial.items);
  const [notes, setNotes] = useState(initial.notes ?? '');

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
    commitItems([...items, { id: newId(), label: labelText, amount: 0 }]);
  const updateItem = (id: string, patch: Partial<BudgetItem>) =>
    commitItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => commitItems(items.filter((it) => it.id !== id));

  // Summary stats.
  const municipalities = useMemo(() => {
    const set = new Set<string>();
    stops.forEach((s) => {
      const d = destinationById(s.destinationId);
      if (d) set.add(d.municipality);
    });
    return set.size;
  }, [stops]);
  const totalKm = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < stops.length - 1; i += 1) {
      const a = destinationById(stops[i].destinationId);
      const b = destinationById(stops[i + 1].destinationId);
      if (a && b) sum += distanceKm(a, b);
    }
    return sum;
  }, [stops]);
  const visitedCount = stops.filter((s) => s.visited).length;

  const spent = budgetSpent({ ...initial, items });
  const target = targetText.trim() === '' ? null : parseAmount(targetText);
  const remaining = target != null ? target - spent : null;
  const over = remaining != null && remaining < 0;
  const pct = target && target > 0 ? Math.min(1, spent / target) : 0;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 48, paddingBottom: 10 }}>
          <Pressable onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                <MaterialIcons name={SCOPE_ICON[scope]} size={12} color={colors.primary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                  {SCOPE_LABEL[scope]} plan
                </Text>
              </View>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface }}>
              {label}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* Summary stats */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile icon="place" value={String(stops.length)} label={stops.length === 1 ? 'stop' : 'stops'} />
            <StatTile icon="map" value={formatDistance(totalKm)} label="total route" />
            <StatTile icon="schedule" value={formatEta(estimateEtaMinutes(totalKm))} label="drive time" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <StatTile icon="location-city" value={String(municipalities)} label={municipalities === 1 ? 'town' : 'towns'} />
            <StatTile icon="check-circle" value={`${visitedCount}/${stops.length}`} label="visited" />
            <StatTile
              icon="account-balance-wallet"
              value={target != null ? formatPeso(target) : '—'}
              label="budget"
            />
          </View>

          {/* Budget */}
          <SectionHeader icon="account-balance-wallet" title="Budget" />

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 6 }}>
              Total budget for this plan
            </Text>
            <View style={[styles.amountField, { borderColor: colors.outlineVariant }]}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.onSurfaceVariant }}>₱</Text>
              <TextInput
                value={targetText}
                onChangeText={commitTarget}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.onSurfaceVariant}
                style={{ flex: 1, fontSize: 18, fontWeight: '700', color: colors.onSurface, paddingVertical: 8 }}
              />
            </View>

            {/* Progress + remaining */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                  Spent {formatPeso(spent)}
                </Text>
                {remaining != null ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: over ? colors.error : colors.primary }}>
                    {over ? `${formatPeso(-remaining)} over` : `${formatPeso(remaining)} left`}
                  </Text>
                ) : null}
              </View>
              <View style={{ height: 8, borderRadius: 50, backgroundColor: withAlpha(colors.onSurfaceVariant, 0.18), overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.round(pct * 100)}%`,
                    height: '100%',
                    borderRadius: 50,
                    backgroundColor: over ? colors.error : colors.primary,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Quick-add categories */}
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 14, marginBottom: 8 }}>
            Add an expense
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.label}
                onPress={() => addItem(c.label)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 50,
                  backgroundColor: withAlpha(colors.surfaceVariant, 0.6),
                }}
              >
                <MaterialIcons name={c.icon} size={15} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.onSurface }}>{c.label}</Text>
                <MaterialIcons name="add" size={14} color={colors.onSurfaceVariant} />
              </Pressable>
            ))}
          </View>

          {/* Line items */}
          {items.length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface, marginTop: 14, padding: 8 }]}>
              {items.map((item, i) => (
                <View key={item.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6 }}>
                    <TextInput
                      value={item.label}
                      onChangeText={(t) => updateItem(item.id, { label: t })}
                      placeholder="Expense"
                      placeholderTextColor={colors.onSurfaceVariant}
                      style={{ flex: 1, fontSize: 14, color: colors.onSurface }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 14, color: colors.onSurfaceVariant }}>₱</Text>
                      <TextInput
                        value={item.amount ? String(item.amount) : ''}
                        onChangeText={(t) => updateItem(item.id, { amount: parseAmount(t) })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.onSurfaceVariant}
                        style={{ minWidth: 64, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.onSurface }}
                      />
                    </View>
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={8} style={{ padding: 2 }}>
                      <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                    </Pressable>
                  </View>
                  {i < items.length - 1 ? (
                    <View style={{ height: 1, backgroundColor: withAlpha(colors.outlineVariant, 0.4), marginHorizontal: 6 }} />
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
              No expenses yet. Tap a category above to start budgeting.
            </Text>
          )}

          {/* Notes */}
          <SectionHeader icon="sticky-note-2" title="Notes" />
          <TextInput
            value={notes}
            onChangeText={commitNotes}
            placeholder="Reminders, packing list, meeting point…"
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            style={{
              minHeight: 90,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              borderRadius: 14,
              padding: 14,
              color: colors.onSurface,
              textAlignVertical: 'top',
              fontSize: 14,
            }}
          />

          {/* Stops */}
          <SectionHeader icon="format-list-numbered" title="Stops" />
          <View style={[styles.card, { backgroundColor: colors.surface, padding: 4 }]}>
            {stops.map((s, i) => {
              const d = destinationById(s.destinationId);
              if (!d) return null;
              return (
                <View
                  key={s.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: s.visited ? '#16A34A' : colors.primary,
                    }}
                  >
                    {s.visited ? (
                      <MaterialIcons name="check" size={16} color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onPrimary }}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.onSurface }}>
                      {d.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
                      {formatDate(s.date)} · {formatTime(s.hour, s.minute)} · {d.municipality}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StatTile({
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
    <View style={{ flex: 1, borderRadius: 16, backgroundColor: withAlpha(colors.surfaceVariant, 0.5), padding: 12, gap: 4 }}>
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.onSurface }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, color: colors.onSurfaceVariant }}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 10 }}>
      <MaterialIcons name={icon} size={18} color={colors.onSurface} />
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
});
