// Ported from TripsStore (ui/screens/ItineraryScreen.kt), now persisted to SQLite
// via ../data/db so stops + visited state survive app restarts.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loadTripStops,
  upsertTripStop,
  deleteTripStop,
  deleteTripStopsByDestination,
  setTripStopVisited,
  persistPositions,
  TripStopRow,
  VisitHistoryRow,
  loadVisitHistory,
  recordVisit,
} from '../data/db';
import { PlanScope, PlanRange, defaultRange, planKeyOf, todayIso } from '../utils/planDates';

// Date helpers live in utils/planDates; re-exported here so the many existing
// `from '../context/TripsContext'` import sites keep working.
export type { PlanScope, PlanRange } from '../utils/planDates';
export { todayIso, isoToDate, formatDate, formatTime } from '../utils/planDates';

export interface TripStop {
  id: number;
  destinationId: number;
  date: string; // ISO yyyy-mm-dd (local calendar day)
  hour: number; // 0-23
  minute: number; // 0-59
  notes: string | null;
  visited: boolean;
  position: number; // manual drag order
  scope: PlanScope; // the plan (day/week/month) the user created this stop under
  // The plan's date range, carried on the stop because plans are derived by
  // grouping stops rather than stored: a week plan's range is user-chosen and
  // could not otherwise be recovered from `date` alone.
  planStart: string;
  planEnd: string;
}

export type VisitHistory = VisitHistoryRow;

interface TripsContextValue {
  stops: TripStop[];
  /** Permanent on-device visits, kept even if their original stop is removed. */
  visitHistory: VisitHistory[];
  /** True until the first SQLite read finishes, so screens can hold off on
   *  showing an empty state that is about to be replaced by real stops. */
  loading: boolean;
  add: (
    destinationId: number,
    scope: PlanScope,
    range: PlanRange,
    date: string,
    hour: number,
    minute: number,
    notes: string | null
  ) => void;
  update: (stop: TripStop) => void;
  remove: (id: number) => void;
  move: (from: number, to: number) => void;
  // Persist a new manual order (the given ids, in the order they should appear).
  reorder: (idsInOrder: number[]) => void;
  isInTrip: (destinationId: number) => boolean;
  // Quick add/remove by destination (defaults to today at 9:00). Returns whether
  // the destination is in the trip afterwards.
  toggleTrip: (destinationId: number) => boolean;
  setVisited: (id: number, visited: boolean) => void;
}

const TripsContext = createContext<TripsContextValue | undefined>(undefined);

function toRow(s: TripStop): TripStopRow {
  return {
    id: s.id,
    destinationId: s.destinationId,
    date: s.date,
    hour: s.hour,
    minute: s.minute,
    notes: s.notes,
    visited: s.visited ? 1 : 0,
    position: s.position,
    scope: s.scope,
    planStart: s.planStart,
    planEnd: s.planEnd,
  };
}

function historyFromStop(stop: TripStop, visitedAt = Date.now()): VisitHistory {
  const planKey = planKeyOf(stop.scope, { start: stop.planStart, end: stop.planEnd });
  return {
    visitKey: `${planKey}|${stop.id}|${stop.destinationId}`,
    destinationId: stop.destinationId,
    visitedAt,
    visitDate: stop.date,
    planKey,
  };
}

export function TripsProvider({ children }: { children: React.ReactNode }) {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [visitHistory, setVisitHistory] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const nextId = useRef(1);

  // Hydrate from SQLite on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rows, storedHistory] = await Promise.all([loadTripStops(), loadVisitHistory()]);
        if (!active) return;
        const loaded: TripStop[] = rows.map((r) => {
          const scope = (r.scope as PlanScope) ?? 'day';
          // Rows written before ranges existed carry no plan range; deriving it
          // from scope + date reproduces exactly how they used to be grouped.
          const fallback = defaultRange(scope, r.date);
          return {
            id: r.id,
            destinationId: r.destinationId,
            date: r.date,
            hour: r.hour,
            minute: r.minute,
            notes: r.notes,
            visited: r.visited === 1,
            position: r.position ?? 0,
            scope,
            planStart: r.planStart ?? fallback.start,
            planEnd: r.planEnd ?? fallback.end,
          };
        });
        setStops(loaded);
        // Older versions only stored `visited` on the stop. Backfill those
        // check-ins once so existing users immediately get an explored list.
        const known = new Set(storedHistory.map((visit) => visit.visitKey));
        const backfilled = loaded
          .filter((stop) => stop.visited)
          .map((stop) => {
            const scheduled = new Date(
              `${stop.date}T${String(stop.hour).padStart(2, '0')}:${String(stop.minute).padStart(2, '0')}:00`
            ).getTime();
            return historyFromStop(stop, Number.isFinite(scheduled) ? scheduled : Date.now());
          })
          .filter((visit) => !known.has(visit.visitKey));
        backfilled.forEach((visit) => recordVisit(visit).catch(() => {}));
        setVisitHistory(
          [...storedHistory, ...backfilled].sort((a, b) => b.visitedAt - a.visitedAt)
        );
        nextId.current = loaded.reduce((max, s) => Math.max(max, s.id), 0) + 1;
      } catch {
        // DB unavailable — continue in-memory only.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const add = useCallback(
    (
      destinationId: number,
      scope: PlanScope,
      range: PlanRange,
      date: string,
      hour: number,
      minute: number,
      notes: string | null
    ) => {
      const stop: TripStop = {
        id: nextId.current++,
        destinationId,
        date,
        hour,
        minute,
        notes: notes && notes.trim() ? notes : null,
        visited: false,
        position: 0,
        scope,
        planStart: range.start,
        planEnd: range.end,
      };
      setStops((prev) => {
        const stopWithPos = { ...stop, position: prev.length };
        upsertTripStop(toRow(stopWithPos)).catch(() => {});
        return [...prev, stopWithPos];
      });
    },
    []
  );

  const update = useCallback((stop: TripStop) => {
    setStops((prev) => prev.map((s) => (s.id === stop.id ? stop : s)));
    upsertTripStop(toRow(stop)).catch(() => {});
  }, []);

  const remove = useCallback((id: number) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    deleteTripStop(id).catch(() => {});
  }, []);

  const toggleTrip = useCallback(
    (destinationId: number): boolean => {
      const exists = stops.some((s) => s.destinationId === destinationId);
      if (exists) {
        setStops((prev) => prev.filter((s) => s.destinationId !== destinationId));
        deleteTripStopsByDestination(destinationId).catch(() => {});
        return false;
      }
      const today = todayIso();
      const base: TripStop = {
        id: nextId.current++,
        destinationId,
        date: today,
        hour: 9,
        minute: 0,
        notes: null,
        visited: false,
        position: 0,
        scope: 'day',
        planStart: today,
        planEnd: today,
      };
      setStops((prev) => {
        const stop = { ...base, position: prev.length };
        upsertTripStop(toRow(stop)).catch(() => {});
        return [...prev, stop];
      });
      return true;
    },
    [stops]
  );

  const setVisited = useCallback((id: number, visited: boolean) => {
    if (visited) {
      const stop = stops.find((candidate) => candidate.id === id);
      if (stop) {
        const entry = historyFromStop(stop);
        setVisitHistory((prev) =>
          prev.some((visit) => visit.visitKey === entry.visitKey) ? prev : [entry, ...prev]
        );
        recordVisit(entry).catch(() => {});
      }
    }
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, visited } : s)));
    setTripStopVisited(id, visited).catch(() => {});
  }, [stops]);

  // Apply a new manual order: `idsInOrder` lists every reordered id in its new
  // sequence. Positions are rewritten to match and persisted so drag order sticks
  // across restarts.
  const reorder = useCallback((idsInOrder: number[]) => {
    setStops((prev) => {
      const posById = new Map<number, number>();
      idsInOrder.forEach((id, i) => posById.set(id, i));
      return prev.map((s) =>
        posById.has(s.id) ? { ...s, position: posById.get(s.id)! } : s
      );
    });
    persistPositions(idsInOrder).catch(() => {});
  }, []);

  const move = useCallback((from: number, to: number) => {
    setStops((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const value = useMemo<TripsContextValue>(
    () => ({
      stops,
      visitHistory,
      loading,
      add,
      update,
      remove,
      move,
      reorder,
      isInTrip: (destinationId: number) =>
        stops.some((s) => s.destinationId === destinationId),
      toggleTrip,
      setVisited,
    }),
    [stops, visitHistory, loading, add, update, remove, move, reorder, toggleTrip, setVisited]
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsContextValue {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used within TripsProvider');
  return ctx;
}
