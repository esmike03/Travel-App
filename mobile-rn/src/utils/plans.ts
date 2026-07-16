// Plans are not stored: they are derived by grouping trip stops on the plan
// scope + date range each stop carries. Shared by the itinerary screen and the
// add-to-trip flow, which both need the same notion of "the user's plans".
import { TripStop } from '../context/TripsContext';
import {
  PlanScope,
  PlanRange,
  planKeyOf,
  planLabelOf,
  rangeIncludesToday,
  rangeIsPast,
} from './planDates';

export interface StopGroup {
  key: string;
  scope: PlanScope;
  label: string;
  range: PlanRange;
  stops: TripStop[];
  isCurrent: boolean; // the plan's date range includes today
  isPast: boolean; // the plan's date range ended before today
}

// Order within a group: manual drag position first, then time, then id (stable).
export function byPosition(a: TripStop, b: TripStop): number {
  if (a.position !== b.position) return a.position - b.position;
  const am = a.hour * 60 + a.minute;
  const bm = b.hour * 60 + b.minute;
  if (am !== bm) return am - bm;
  return a.id - b.id;
}

// Group stops into the plans the user created (one group per scope + range).
export function groupPlans(stops: TripStop[]): StopGroup[] {
  const map = new Map<string, StopGroup>();
  for (const s of stops) {
    const range: PlanRange = { start: s.planStart, end: s.planEnd };
    const key = planKeyOf(s.scope, range);
    let grp = map.get(key);
    if (!grp) {
      grp = {
        key,
        scope: s.scope,
        label: planLabelOf(s.scope, range),
        range,
        stops: [],
        isCurrent: rangeIncludesToday(range),
        isPast: rangeIsPast(range),
      };
      map.set(key, grp);
    }
    grp.stops.push(s);
  }
  // Plans covering today come first; the rest follow in chronological order.
  return [...map.values()]
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return a.range.start < b.range.start ? -1 : a.range.start > b.range.start ? 1 : 0;
    })
    .map((g) => ({ ...g, stops: [...g.stops].sort(byPosition) }));
}

// A plan lands in the archive once every stop is visited OR its dates have passed
// (a missed plan). Past plans keep their unvisited stops as-is (not visited).
export function isArchived(group: StopGroup): boolean {
  if (group.stops.length === 0) return false;
  return group.isPast || group.stops.every((s) => s.visited);
}
