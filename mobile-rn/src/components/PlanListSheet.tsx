// The trip screen shows one plan at a time — today's by default. This sheet is
// where every other plan lives, along with the Planned/Archive split and the
// day/week/month filter that used to crowd the page itself.
//
// Each row is the compact form of a plan: type, dates, stop count, and a map
// button — enough to pick from without unfolding it.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { PlanScope } from '../utils/planDates';
import { StopGroup, isArchived } from '../utils/plans';
import { SCOPE_META } from './PlanPicker';
import { tripTitle, usePlans } from '../context/PlansContext';

const VISITED_GREEN = '#16A34A';

export default function PlanListSheet({
  groups,
  activeKey,
  onSelect,
  onOpenMap,
  onAdd,
  onClose,
}: {
  groups: StopGroup[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onOpenMap: (key: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [view, setView] = useState<'active' | 'archive'>('active');
  const [scopeFilter, setScopeFilter] = useState<'all' | PlanScope>('all');

  const activeGroups = useMemo(() => groups.filter((g) => !isArchived(g)), [groups]);
  const archivedGroups = useMemo(() => groups.filter((g) => isArchived(g)), [groups]);
  const baseGroups = view === 'active' ? activeGroups : archivedGroups;
  const visible =
    scopeFilter === 'all' ? baseGroups : baseGroups.filter((g) => g.scope === scopeFilter);

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.grabber} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>
              Your plans
            </Text>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              Pick a plan to open it on your trip page
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {/* Planned / Archive */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <ViewTab
            icon="event"
            label="Planned"
            count={activeGroups.length}
            active={view === 'active'}
            onPress={() => setView('active')}
          />
          <ViewTab
            icon="inventory-2"
            label="Archive"
            count={archivedGroups.length}
            active={view === 'archive'}
            onPress={() => setView('archive')}
          />
        </View>

        {/* Plan-type filter */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {(['all', 'day', 'week', 'month'] as const).map((f) => {
            const active = scopeFilter === f;
            const count =
              f === 'all' ? baseGroups.length : baseGroups.filter((g) => g.scope === f).length;
            return (
              <Pressable
                key={f}
                onPress={() => setScopeFilter(f)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 50,
                  backgroundColor: active ? colors.primary : withAlpha(colors.surfaceVariant, 0.6),
                }}
              >
                {f !== 'all' ? (
                  <MaterialIcons
                    name={SCOPE_META[f].icon}
                    size={13}
                    color={active ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                ) : null}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: active ? colors.onPrimary : colors.onSurfaceVariant,
                  }}
                >
                  {f === 'all' ? 'All' : SCOPE_META[f].label} {count > 0 ? `(${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {view === 'archive' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <MaterialIcons name="lock" size={13} color={colors.onSurfaceVariant} />
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, flex: 1 }}>
              Completed and past plans are kept here. A plan is archived automatically once its
              dates pass.
            </Text>
          </View>
        ) : null}

        <ScrollView
          style={{ maxHeight: 340, marginTop: 12 }}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {visible.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <MaterialIcons
                name={view === 'archive' ? 'inventory-2' : 'event-available'}
                size={34}
                color={colors.onSurfaceVariant}
              />
              <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' }}>
                {scopeFilter !== 'all' && baseGroups.length > 0
                  ? `No ${SCOPE_META[scopeFilter].label.toLowerCase()} plans here.`
                  : view === 'archive'
                  ? 'No archived plans yet.'
                  : 'Nothing planned right now.'}
              </Text>
            </View>
          ) : (
            visible.map((g) => (
              <PlanRow
                key={g.key}
                group={g}
                selected={g.key === activeKey}
                onPress={() => onSelect(g.key)}
                onOpenMap={() => onOpenMap(g.key)}
              />
            ))
          )}
        </ScrollView>

        <Pressable
          onPress={onAdd}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 48,
            borderRadius: 14,
            marginTop: 12,
            backgroundColor: colors.primary,
          }}
        >
          <MaterialIcons name="add" size={18} color={colors.onPrimary} />
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Add stops</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// The compact form of a plan: type, dates, stops, and a way straight to its map.
function PlanRow({
  group,
  selected,
  onPress,
  onOpenMap,
}: {
  group: StopGroup;
  selected: boolean;
  onPress: () => void;
  onOpenMap: () => void;
}) {
  const { colors } = useTheme();
  const { getMeta } = usePlans();
  const meta = SCOPE_META[group.scope];
  const count = group.stops.length;
  const archived = isArchived(group);
  const completed = count > 0 && group.stops.every((s) => s.visited);
  const title = tripTitle(getMeta(group.key));

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: selected
          ? withAlpha(colors.primary, 0.1)
          : withAlpha(colors.surfaceVariant, 0.5),
        borderWidth: selected ? 1.5 : 0,
        borderColor: colors.primary,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.primary, 0.14),
        }}
      >
        <MaterialIcons name={meta.icon} size={18} color={colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: '700',
              color: colors.onSurface,
              textDecorationLine: completed ? 'line-through' : 'none',
            }}
          >
            {title}
          </Text>
          {group.isCurrent && !archived ? <Badge text="TODAY" color={colors.secondary} /> : null}
          {completed ? <Badge text="DONE" color={VISITED_GREEN} /> : null}
          {archived && !completed ? <Badge text="PAST" color={colors.error} /> : null}
        </View>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          {group.label} · {meta.label} plan · {count} {count === 1 ? 'stop' : 'stops'}
        </Text>
      </View>

      <Pressable
        onPress={onOpenMap}
        hitSlop={6}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.primary, 0.14),
        }}
      >
        <MaterialIcons name="map" size={16} color={colors.primary} />
      </Pressable>
    </Pressable>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        borderRadius: 50,
        backgroundColor: withAlpha(color, 0.16),
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: '800', color }}>{text}</Text>
    </View>
  );
}

function ViewTab({
  icon,
  label,
  count,
  active,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  count: number;
  active: boolean;
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
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: active
          ? withAlpha(colors.primary, 0.14)
          : withAlpha(colors.surfaceVariant, 0.5),
        borderWidth: 1,
        borderColor: active ? colors.primary : 'transparent',
      }}
    >
      <MaterialIcons name={icon} size={16} color={active ? colors.primary : colors.onSurfaceVariant} />
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? colors.primary : colors.onSurfaceVariant,
        }}
      >
        {label} ({count})
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The scrim covers the whole modal, including behind the sheet — a flex:1
  // scrim stops where the sheet starts, so the rounded top corners cut straight
  // through to the screen underneath and read as square against a light page.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '100%',
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
});
