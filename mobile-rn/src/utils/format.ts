// Ported distance/ETA helpers from ui/screens/Screens.kt.

export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh = 40): number {
  const roadFactor = 1.25;
  const hours = (distanceKm * roadFactor) / avgSpeedKmh;
  return Math.round(hours * 60);
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Shorter variant used by the itinerary picker (formatKm in ItineraryScreen.kt).
export function formatKm(km: number): string {
  if (km < 1) return `${Math.trunc(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.trunc(km)} km`;
}
