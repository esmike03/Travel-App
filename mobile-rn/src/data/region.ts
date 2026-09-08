// Where the app is pointed. By default that's Bohol — the province it was built
// around and the only one with curated destinations. Turning the location
// setting on lets it follow the traveller instead: another province's weather,
// map and plans, with stops they search for themselves.
//
// Provinces are resolved through Nominatim (OpenStreetMap), keyless like the
// rest of the stack. Requests are one-shot and user-initiated, which keeps us
// inside Nominatim's usage policy; a UA identifying the app is required by it.
import { Coords } from '../hooks/useUserLocation';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'chirpy-travel-companion/0.1 (Expo)';

export interface Region {
  /** Province name as OSM knows it, e.g. "Bohol", "Palawan", "Metro Manila". */
  name: string;
  latitude: number;
  longitude: number;
  /** [south, north, west, east] — used to frame the map on the province. */
  bbox: [number, number, number, number];
  /**
   * The province's actual outline, as rings of [lng, lat]. A bounding box is a
   * poor stand-in for a province — Cebu's box swallows parts of Negros, Bohol
   * and Leyte — so searches test against this instead. Simplified, and optional
   * because a region stored before this existed won't have one.
   */
  polygon?: [number, number][][];
}

// The app's home. Coordinates and bbox match the curated destination set, so
// nothing about Bohol depends on a network call. The polygon is fetched lazily
// the first time it's needed (see regionPolygon).
export const BOHOL_REGION: Region = {
  name: 'Bohol',
  latitude: 9.85,
  longitude: 124.1435,
  bbox: [9.35, 10.39, 123.55, 124.74],
};

/* ---------------- geometry ---------------- */

// Douglas-Peucker, so a province outline costs a few KB rather than tens.
function simplify(points: [number, number][], tol: number): [number, number][] {
  if (points.length < 3) return points;
  const sqSegDist = (p: number[], a: number[], b: number[]) => {
    let [x, y] = a;
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) [x, y] = b;
      else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Set<number>([0, points.length - 1]);
  const step = (first: number, last: number) => {
    let maxSq = tol * tol;
    let idx = -1;
    for (let i = first + 1; i < last; i += 1) {
      const sq = sqSegDist(points[i], points[first], points[last]);
      if (sq > maxSq) {
        idx = i;
        maxSq = sq;
      }
    }
    if (idx === -1) return;
    keep.add(idx);
    if (idx - first > 1) step(first, idx);
    if (last - idx > 1) step(idx, last);
  };
  step(0, points.length - 1);
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}

function ringsFrom(geojson: any): [number, number][][] | undefined {
  if (!geojson) return undefined;
  const raw: [number, number][][] =
    geojson.type === 'Polygon' ? geojson.coordinates : geojson.coordinates?.flat();
  if (!Array.isArray(raw)) return undefined;
  // ~330m: far finer than the 15km test it feeds, at a fraction of the size.
  return raw.map((ring) => simplify(ring, 0.003)).filter((ring) => ring.length >= 4);
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a point lies inside the province itself. */
export function pointInRegion(region: Region, lng: number, lat: number): boolean {
  return !!region.polygon?.some((ring) => pointInRing(lng, lat, ring));
}

/** Straight-line distance (km) from a point to the province's edge; 0 if inside. */
export function kmFromRegion(region: Region, lng: number, lat: number): number {
  if (!region.polygon) return Infinity;
  if (pointInRegion(region, lng, lat)) return 0;
  const k = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const ring of region.polygon) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[i + 1];
      let x = ax;
      let y = ay;
      let dx = bx - ax;
      let dy = by - ay;
      if (dx || dy) {
        const t = ((lng - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = bx;
          y = by;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }
      best = Math.min(best, Math.hypot((lng - x) * k, lat - y));
    }
  }
  return best * 111.32;
}

export function isBohol(region: Region): boolean {
  return region.name.toLowerCase() === 'bohol';
}

function toRegion(hit: any): Region | null {
  if (!hit?.boundingbox) return null;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  if (![s, n, w, e].every(Number.isFinite)) return null;
  return {
    name: hit.name || hit.display_name?.split(',')[0] || 'Unknown',
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    bbox: [s, n, w, e],
    polygon: ringsFrom(hit.geojson),
  };
}

/**
 * The province's outline, fetched on demand. Bohol's home region ships without
 * one (so the app needs no network to start), and older stored regions predate
 * it — either way, the first search that needs it fills it in.
 */
export async function withPolygon(region: Region): Promise<Region> {
  if (region.polygon) return region;
  const [found] = await searchProvinces(region.name);
  return found?.polygon ? { ...region, polygon: found.polygon } : region;
}

/**
 * Provinces matching a typed query, for the manual picker.
 *
 * Note the filter: OSM returns Philippine provinces with `addresstype: "state"`
 * (place_rank 8), NOT "province" — filtering on the obvious word finds nothing.
 */
export async function searchProvinces(query: string): Promise<Region[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `${NOMINATIM}/search?format=jsonv2&countrycodes=ph&limit=8&featureType=state` +
    // The outline, so searches can tell a province from its bounding box.
    `&polygon_geojson=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Province search failed (${res.status})`);
  const json = await res.json();
  return (Array.isArray(json) ? json : [])
    .filter((h: any) => h.place_rank <= 10) // province level, not towns
    .map(toRegion)
    .filter((r: Region | null): r is Region => r !== null);
}

/**
 * The province containing a GPS fix. Cities like Baguio and Makati sit outside
 * any province, so this falls back to the region they belong to rather than
 * failing — "Metro Manila" is what people would call it anyway.
 */
export async function provinceAt(coords: Coords): Promise<Region | null> {
  // zoom=8 asks Nominatim for province-level detail.
  const url =
    `${NOMINATIM}/reverse?format=jsonv2&zoom=8&addressdetails=1` +
    `&lat=${coords.latitude}&lon=${coords.longitude}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Could not find your province (${res.status})`);
  const json = await res.json();
  const a = json?.address ?? {};
  const name: string | undefined = a.province || a.state || a.region || a.county;
  if (!name) return null;
  const region = toRegion(json);
  // The reverse hit's own name can be a town; prefer the province name, and use
  // a province search to get the true centre + bbox when they disagree.
  if (region && region.name.toLowerCase() === String(name).toLowerCase()) return region;
  const [found] = await searchProvinces(name);
  return found ?? (region ? { ...region, name } : null);
}
