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
} from '../data/db';

export interface TripStop {
  id: number;
  destinationId: number;
  date: string; // ISO yyyy-mm-dd (local calendar day)
  hour: number; // 0-23
  minute: number; // 0-59
  notes: string | null;
  visited: boolean;
}

interface TripsContextValue {
  stops: TripStop[];
  add: (
    destinationId: number,
    date: string,
    hour: number,
    minute: number,
    notes: string | null
  ) => void;
  update: (stop: TripStop) => void;
  remove: (id: number) => void;
  move: (from: number, to: number) => void;
  isInTrip: (destinationId: number) => boolean;
  // Quick add/remove by destination (defaults to today at 9:00). Returns whether
  // the destination is in the trip afterwards.
  toggleTrip: (destinationId: number) => boolean;
  setVisited: (id: number, visited: boolean) => void;
}

const TripsContext = createContext<TripsContextValue | undefined>(undefined);

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function toRow(s: TripStop): TripStopRow {
  return {
    id: s.id,
    destinationId: s.destinationId,
    date: s.date,
    hour: s.hour,
    minute: s.minute,
    notes: s.notes,
    visited: s.visited ? 1 : 0,
  };
}

export function TripsProvider({ children }: { children: React.ReactNode }) {
  const [stops, setStops] = useState<TripStop[]>([]);
  const nextId = useRef(1);

  // Hydrate from SQLite on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await loadTripStops();
        if (!active) return;
        const loaded: TripStop[] = rows.map((r) => ({
          id: r.id,
          destinationId: r.destinationId,
          date: r.date,
          hour: r.hour,
          minute: r.minute,
          notes: r.notes,
          visited: r.visited === 1,
        }));
        setStops(loaded);
        nextId.current = loaded.reduce((max, s) => Math.max(max, s.id), 0) + 1;
      } catch {
        // DB unavailable — continue in-memory only.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const add = useCallback(
    (
      destinationId: number,
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
      };
      setStops((prev) => [...prev, stop]);
      upsertTripStop(toRow(stop)).catch(() => {});
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
      const stop: TripStop = {
        id: nextId.current++,
        destinationId,
        date: todayIso(),
        hour: 9,
        minute: 0,
        notes: null,
        visited: false,
      };
      setStops((prev) => [...prev, stop]);
      upsertTripStop(toRow(stop)).catch(() => {});
      return true;
    },
    [stops]
  );

  const setVisited = useCallback((id: number, visited: boolean) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, visited } : s)));
    setTripStopVisited(id, visited).catch(() => {});
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
      add,
      update,
      remove,
      move,
      isInTrip: (destinationId: number) =>
        stops.some((s) => s.destinationId === destinationId),
      toggleTrip,
      setVisited,
    }),
    [stops, add, update, remove, move, toggleTrip, setVisited]
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsContextValue {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used within TripsProvider');
  return ctx;
}

/* ---------------- date/time formatting (mirrors DateTimeFormatter patterns) ---------------- */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "EEE, MMM d"
export function formatDate(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// "h:mm a"
export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:${String(minute).padStart(2, '0')} ${period}`;
}
