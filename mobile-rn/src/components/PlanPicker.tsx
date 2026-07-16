// Choosing which plan a stop joins. Used by the itinerary's "Add stops" flow and
// by AddToTripButton everywhere else (explore, details, map, saved), so a place
// added from anywhere lands in a plan the user picked rather than a silent
// default of "today".
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useTrips } from '../context/TripsContext';
import {
  PlanScope,
  PlanRange,
  clampIso,
  daysInRange,
  defaultRange,
  formatDate,
  isoToDate,
  planLabelOf,
  toIso,
  todayIso,
} from '../utils/planDates';
import { groupPlans, isArchived, StopGroup } from '../utils/plans';

export const SCOPE_META: Record<PlanScope, { label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  day: { label: 'Day', icon: 'today' },
  week: { label: 'Week', icon: 'date-range' },
  month: { label: 'Month', icon: 'calendar-month' },
};

/* ---------------- plan draft (scope + dates being chosen) ---------------- */

export interface PlanDraft {
  scope: PlanScope;
  baseDate: string; // the single date behind a day/month plan
  weekRange: PlanRange; // a week plan's user-chosen start/end
}

export function newPlanDraft(): PlanDraft {
  const today = todayIso();
  return { scope: 'day', baseDate: today, weekRange: defaultRange('week', today) };
}

// Week plans carry the range the user picked; day and month imply theirs.
export function draftRange(d: PlanDraft): PlanRange {
  return d.scope === 'week' ? d.weekRange : defaultRange(d.scope, d.baseDate);
}

// The date a stop gets when added to a plan: the chosen day if the plan covers
// it, otherwise the nearest edge, so a stop always sits inside its own plan.
export function stopDateFor(range: PlanRange, preferred: string): string {
  return clampIso(preferred, range.start, range.end);
}

/**
 * Scope selector plus the date field(s) that scope needs — one date for day and
 * month plans, a start/end pair for week plans.
 */
export function PlanDraftFields({
  draft,
  onChange,
}: {
  draft: PlanDraft;
  onChange: (next: PlanDraft) => void;
}) {
  const { colors } = useTheme();
  const [showDate, setShowDate] = useState(false);
  const [showWeekEdge, setShowWeekEdge] = useState<'start' | 'end' | null>(null);
  const range = draftRange(draft);
  const days = daysInRange(range);

  return (
    <View>
      <View style={[styles.segment, { backgroundColor: withAlpha(colors.surfaceVariant, 0.5) }]}>
        {(['day', 'week', 'month'] as PlanScope[]).map((s) => {
          const active = draft.scope === s;
          const meta = SCOPE_META[s];
          return (
            <Pressable
              key={s}
              onPress={() => onChange({ ...draft, scope: s })}
              style={[styles.segmentItem, active && { backgroundColor: colors.primary }]}
            >
              <MaterialIcons
                name={meta.icon}
                size={15}
                color={active ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: active ? colors.onPrimary : colors.onSurfaceVariant,
                }}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {draft.scope === 'week' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <DateField
              label="Start date"
              value={formatDate(draft.weekRange.start)}
              icon="event"
              onPress={() => setShowWeekEdge('start')}
            />
            <DateField
              label="End date"
              value={formatDate(draft.weekRange.end)}
              icon="event-available"
              onPress={() => setShowWeekEdge('end')}
            />
          </View>
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, marginTop: 6 }}>
            {planLabelOf('week', range)} · {days} {days === 1 ? 'day' : 'days'}
          </Text>
        </>
      ) : (
        <Pressable
          onPress={() => setShowDate(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
          }}
        >
          <MaterialIcons name="event" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {draft.scope === 'day' ? 'Date' : 'Any day in the month'}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.onSurface }}>
              {planLabelOf(draft.scope, range)}
            </Text>
          </View>
          <MaterialIcons name="edit" size={16} color={colors.onSurfaceVariant} />
        </Pressable>
      )}

      {showDate ? (
        <DateTimePicker
          value={isoToDate(draft.baseDate)}
          mode="date"
          onChange={(event, selected) => {
            setShowDate(false);
            if (event.type === 'set' && selected) onChange({ ...draft, baseDate: toIso(selected) });
          }}
        />
      ) : null}

      {showWeekEdge ? (
        <DateTimePicker
          value={isoToDate(showWeekEdge === 'start' ? draft.weekRange.start : draft.weekRange.end)}
          mode="date"
          // Keep the range valid at the picker rather than validating after: an
          // end date can't precede its start, and moving the start past the end
          // drags the end along instead of rejecting the choice.
          minimumDate={showWeekEdge === 'end' ? isoToDate(draft.weekRange.start) : undefined}
          onChange={(event, selected) => {
            const edge = showWeekEdge;
            setShowWeekEdge(null);
            if (event.type !== 'set' || !selected || !edge) return;
            const iso = toIso(selected);
            const prev = draft.weekRange;
            onChange({
              ...draft,
              weekRange:
                edge === 'start'
                  ? { start: iso, end: prev.end < iso ? iso : prev.end }
                  : { start: prev.start, end: iso < prev.start ? prev.start : iso },
            });
          }}
        />
      ) : null}
    </View>
  );
}

function DateField({
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
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.onSurface }}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

/* ---------------- the sheet ---------------- */

/**
 * Bottom sheet listing the plans a stop can join, plus a form to create a new
 * one. Archived plans are excluded — adding to a finished trip is never what the
 * user means.
 */
export function PlanPickerSheet({
  title,
  subtitle,
  onPick,
  onDismiss,
}: {
  title: string;
  subtitle?: string;
  onPick: (scope: PlanScope, range: PlanRange, date: string) => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const { stops } = useTrips();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(newPlanDraft);

  const plans = useMemo(
    () => groupPlans(stops).filter((g) => !isArchived(g)),
    [stops]
  );
  // With no plans yet there is nothing to choose between, so open on the form.
  const showForm = creating || plans.length === 0;

  const pickExisting = (g: StopGroup) => {
    onPick(g.scope, g.range, stopDateFor(g.range, todayIso()));
  };

  const createNew = () => {
    const range = draftRange(draft);
    onPick(draft.scope, range, stopDateFor(range, draft.baseDate));
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.grabber} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface }}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {showForm ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 }}>
              New plan
            </Text>
            <PlanDraftFields draft={draft} onChange={setDraft} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {plans.length > 0 ? (
                <Pressable
                  onPress={() => setCreating(false)}
                  style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={createNew}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
                  Create plan & add
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {plans.map((g) => (
                <PlanRow key={g.key} group={g} onPress={() => pickExisting(g)} />
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setCreating(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.primary,
              }}
            >
              <MaterialIcons name="add" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700' }}>New plan</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

function PlanRow({ group, onPress }: { group: StopGroup; onPress: () => void }) {
  const { colors } = useTheme();
  const meta = SCOPE_META[group.scope];
  const count = group.stops.length;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.primary, 0.14),
        }}
      >
        <MaterialIcons name={meta.icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.onSurface }}>
            {group.label}
          </Text>
          {group.isCurrent ? (
            <View
              style={{
                borderRadius: 50,
                backgroundColor: colors.secondary,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.onSecondary }}>NOW</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          {meta.label} plan · {count} {count === 1 ? 'stop' : 'stops'}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    marginBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
});
