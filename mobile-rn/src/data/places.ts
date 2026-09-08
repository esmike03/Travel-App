// Searching the map for a place to add as a stop. This is what makes the app
// usable outside Bohol: no curated list exists there, so the traveller names the
// places themselves.
//
// Nominatim (OpenStreetMap), keyless like the rest of the stack. Searches are
// bounded to the province in play, so "beach" means beaches where you are.
import { CUSTOM_ID_BASE, Destination } from './destinations';
import { Region, kmFromRegion, withPolygon } from './region';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'chirpy-travel-companion/0.1 (Expo)';

export interface PlaceHit {
  name: string;
  municipality: string;
  category: string;
  latitude: number;
  longitude: number;
}

// OSM's `category` (jsonv2's field — NOT `class`, which is undefined there)
// mapped to the kind of label the curated set uses.
const CATEGORY_LABEL: Record<string, string> = {
  waterfall: 'Waterfall',
  beach: 'Beach',
  beach_resort: 'Beach',
  lake: 'Lake',
  cave_entrance: 'Cave',
  peak: 'Peak',
  volcano: 'Volcano',
  hot_spring: 'Hot spring',
  spring: 'Spring',
  bay: 'Bay',
  island: 'Island',
  viewpoint: 'Viewpoint',
  attraction: 'Attraction',
  museum: 'Museum',
  zoo: 'Zoo',
  theme_park: 'Theme park',
  memorial: 'Landmark',
  monument: 'Landmark',
  castle: 'Landmark',
  ruins: 'Landmark',
  church: 'Church',
  place_of_worship: 'Church',
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  hotel: 'Hotel',
  resort: 'Resort',
  park: 'Park',
  nature_reserve: 'Nature reserve',
  marina: 'Marina',
  pier: 'Pier',
};

// Whole OSM categories that are never a trip stop. Without this, searching
// "Magellan" in Cebu returns Ferdinand Magellan *Street* twice.
const SKIP_CATEGORIES = new Set(['highway', 'building', 'boundary', 'landuse', 'railway', 'office']);

/**
 * The province a result sits in, or null when OSM doesn't say.
 *
 * Deliberately not `region`: that's the wider grouping (Cebu, Bohol and Negros
 * Oriental are all "Central Visayas"), so matching on it would let neighbours in.
 */
function provinceOf(address: any): string | null {
  return address?.province || address?.state || null;
}

// How far outside the province an independent city may sit and still count as
// "in" it. Mactan is about a kilometre off Cebu across a channel; Cebu City is
// flush against it. Cebu City is ~40km from Bohol across the strait, so this
// separates them cleanly.
const HUC_TOLERANCE_KM = 15;

/**
 * Is this result actually in the province the traveller picked?
 *
 * Two traps, both found the hard way:
 *
 * 1. A bounding box is not a province. Cebu's box is 2.3° x 1.4° and swallows
 *    parts of Negros, Bohol and Leyte, so `bounded=1` alone leaks neighbours.
 * 2. But demanding a matching province name fails too: the Philippines' highly
 *    urbanised cities (Lapu-Lapu, Cebu City, Mandaue) are administratively
 *    outside their province, so OSM gives them NO province — and their polygons
 *    sit outside the province outline. Requiring a match, or a plain
 *    point-in-polygon test, throws away every beach on Mactan.
 *
 * So: a result naming a different province is out. One naming none is an
 * independent city, kept only if it actually borders the province — which keeps
 * Mactan in a Cebu search and drops Cebu City from a Bohol one.
 */
function inRegion(address: any, region: Region, lng: number, lat: number): boolean {
  const province = provinceOf(address);
  if (province) return province.toLowerCase() === region.name.toLowerCase();
  // No polygon yet (offline, or an older saved region): fall back to the box,
  // which is where bounded=1 already put it.
  if (!region.polygon) return true;
  return kmFromRegion(region, lng, lat) <= HUC_TOLERANCE_KM;
}

function labelFor(category: string, type: string): string {
  return (
    CATEGORY_LABEL[type] ??
    CATEGORY_LABEL[category] ??
    // Fall back to the OSM type, tidied: "nature_reserve" -> "Nature reserve".
    (type ? type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Place')
  );
}

/** Places matching a query, restricted to the province currently in play. */
export async function searchPlaces(query: string, regionIn: Region): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // The outline is what makes the filter honest; fetch it once if missing.
  const region = await withPolygon(regionIn).catch(() => regionIn);
  const [south, north, west, east] = region.bbox;
  const url =
    `${NOMINATIM}/search?format=jsonv2&addressdetails=1&countrycodes=ph&limit=12` +
    // viewbox is west,north,east,south; bounded=1 makes it a hard restriction.
    `&viewbox=${west},${north},${east},${south}&bounded=1` +
    `&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json
    .filter(
      (h: any) =>
        h.name &&
        !SKIP_CATEGORIES.has(h.category) &&
        inRegion(h.address, region, Number(h.lon), Number(h.lat))
    )
    .map((h: any): PlaceHit => {
      const a = h.address ?? {};
      return {
        name: h.name,
        municipality:
          a.city || a.town || a.municipality || a.village || a.county || region.name,
        category: labelFor(h.category, h.type),
        latitude: Number(h.lat),
        longitude: Number(h.lon),
      };
    })
    .filter((p: PlaceHit) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}

/**
 * A searched place as a Destination the rest of the app can use. The curated
 * fields it cannot have (a hand-picked photo, a rating, a best time to visit)
 * are left empty rather than invented — the UI shows what is real.
 */
export function placeToDestination(hit: PlaceHit, id: number, region: Region): Destination {
  return {
    id,
    name: hit.name,
    municipality: hit.municipality,
    location: `${hit.municipality}, ${region.name}`,
    category: hit.category,
    imageUrl: '', // no photo — callers fall back to an icon
    rating: '',
    latitude: hit.latitude,
    longitude: hit.longitude,
    shortDescription: '',
    bestTimeToVisit: '',
    sourceUrl: `https://www.openstreetmap.org/#map=17/${hit.latitude}/${hit.longitude}`,
  };
}

export function nextCustomId(existing: Destination[]): number {
  return existing.reduce((max, p) => Math.max(max, p.id), CUSTOM_ID_BASE - 1) + 1;
}
