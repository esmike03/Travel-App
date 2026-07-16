// Stop-order optimisation, shared by the itinerary list and the trip map.
// Distances are straight-line (see distanceKm) rather than road distance: it is
// good enough to spot an obviously bad order, and needs no routing round-trip.
import { destinationById, distanceKm } from '../data/destinations';
import { TripStop } from '../context/TripsContext';

// Total straight-line travel distance (km) of a stop order.
export function pathLengthKm(stops: TripStop[]): number {
  let sum = 0;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = destinationById(stops[i].destinationId);
    const b = destinationById(stops[i + 1].destinationId);
    if (a && b) sum += distanceKm(a, b);
  }
  return sum;
}

// Nearest-neighbour reorder that keeps the first stop as the starting point and
// always heads to the closest remaining stop next (a shorter, more sensible run).
export function optimizeOrder(stops: TripStop[]): TripStop[] {
  if (stops.length <= 2) return stops;
  const remaining = [...stops];
  const result: TripStop[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = destinationById(result[result.length - 1].destinationId);
    if (!last) {
      result.push(remaining.shift()!);
      continue;
    }
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = destinationById(s.destinationId);
      const dist = d ? distanceKm(last, d) : Infinity;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    result.push(remaining.splice(bestIdx, 1)[0]);
  }
  return result;
}

// A reorder is worth suggesting only if it saves a meaningful distance (>300 m)
// and actually changes the order.
export function routeSuggestion(
  stops: TripStop[]
): { optimized: TripStop[]; savedKm: number } | null {
  if (stops.length < 3) return null;
  const optimized = optimizeOrder(stops);
  const savedKm = pathLengthKm(stops) - pathLengthKm(optimized);
  if (savedKm <= 0.3) return null;
  const changed = optimized.some((s, i) => s.id !== stops[i].id);
  return changed ? { optimized, savedKm } : null;
}
