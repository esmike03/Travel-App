// Turns a province outline (rings of [lng, lat], as Region.polygon holds) into
// the SVG paths and projection the share card draws — the same shape the map
// frames, so a shared card of a trip in Palawan shows Palawan.
//
// Bohol is the one province this is NOT used for: its OSM admin boundary is a
// territorial-waters blob, not a coastline (see the bohol-silhouette-source
// note), so home keeps the hand-made boholShape.ts instead. Every other province
// tested renders as a recognisable island from its polygon.

export interface Silhouette {
  /** Square viewBox the paths and projected points live in. */
  view: number;
  /** One path per ring (island), for <Path d={...} />. */
  paths: string[];
  /** Maps lng/lat into the same viewBox, so pins land on the shape. */
  project: (longitude: number, latitude: number) => { x: number; y: number };
}

// Douglas-Peucker — Region.polygon is already simplified, but a big archipelago
// (Palawan is thousands of points) is still worth thinning for a thumbnail.
function simplify(points: [number, number][], tol: number): [number, number][] {
  if (points.length < 4) return points;
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

// min/max over a flat coordinate list without spreading a huge array into
// Math.min (which overflows the stack for archipelagos).
function extent(rings: [number, number][][]): { minx: number; maxx: number; miny: number; maxy: number } {
  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minx) minx = lng;
      if (lng > maxx) maxx = lng;
      if (lat < miny) miny = lat;
      if (lat > maxy) maxy = lat;
    }
  }
  return { minx, maxx, miny, maxy };
}

/**
 * Build a silhouette from province rings. Returns null when there's nothing
 * usable to draw (no polygon, or degenerate geometry), so the caller can simply
 * omit the map rather than render a dot.
 */
export function buildSilhouette(
  rings: [number, number][][] | undefined,
  view = 100
): Silhouette | null {
  if (!rings || rings.length === 0) return null;

  // Drop specks (small offshore islets) that would only add noise, but always
  // keep the largest ring even if a province is tiny.
  const bySize = [...rings].sort((a, b) => b.length - a.length);
  const kept = bySize.filter((r, i) => i === 0 || r.length >= 8);

  const { minx, maxx, miny, maxy } = extent(kept);
  if (!Number.isFinite(minx) || maxx <= minx || maxy <= miny) return null;

  // Equirectangular with a cos(lat) correction, so the shape isn't stretched
  // sideways — the same projection boholShape.ts was generated with.
  const latMid = (miny + maxy) / 2;
  const kx = Math.cos((latMid * Math.PI) / 180);
  const spanX = (maxx - minx) * kx;
  const spanY = maxy - miny;
  const scale = view / Math.max(spanX, spanY);
  const offX = (view - spanX * scale) / 2;
  const offY = (view - spanY * scale) / 2;

  const project = (lng: number, lat: number) => ({
    x: (lng - minx) * kx * scale + offX,
    y: (maxy - lat) * scale + offY, // SVG y grows downward
  });

  // ~1 viewBox unit of tolerance: invisible at card size, big saving on points.
  const tol = (maxx - minx) / view;
  const paths = kept
    .map((ring) => simplify(ring, tol))
    .filter((ring) => ring.length >= 4)
    .map(
      (ring) =>
        'M' +
        ring
          .map((c) => {
            const p = project(c[0], c[1]);
            return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          })
          .join('L') +
        'Z'
    );
  if (paths.length === 0) return null;

  return { view, paths, project };
}
