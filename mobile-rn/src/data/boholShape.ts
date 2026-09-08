// Bohol's silhouette for the share card: the outlines of Bohol island and
// Panglao (where several destinations sit) traced from OpenStreetMap's coastline
// (relations 3625899 and 3625900), then simplified with Douglas-Peucker — 9894
// points down to ~109. The aim is a clean, poster-like shape rather than an
// accurate coastline.
//
// The tolerance is a balance, not a free choice: simplify harder and the real
// road route (which hugs the coast) visibly strays outside the outline. At this
// tolerance the worst excursion is ~0.4 units against a 1.4-unit-wide route
// stroke, so the line always reads as sitting on the coast. Loosening it to 43
// points pushed that to ~1.0 units — a line clearly out at sea.
//
// GENERATED — do not hand-edit. Both islands share one projection so their real
// positions relative to each other hold, and projectToShape maps a destination's
// coordinates into the same space, so pins land where they belong.

// The square viewBox the paths are drawn in.
export const SHAPE_VIEW = 100;

// One path per island (Bohol, then Panglao), for <Path d={...} />.
export const BOHOL_PATHS: string[] = [
  "M7.24,59.67L8.26,64.38L13.74,63.47L15.86,65.45L14.87,65.98L16.43,66.65L16.50,68.35L15.63,68.41L14.40,74.09L17.47,76.86L22.71,77.47L28.61,79.84L32.02,79.42L32.30,80.48L35.96,80.07L40.61,81.31L52.98,78.79L58.95,80.25L64.25,79.42L67.78,77.36L72.81,76.55L73.67,74.27L77.48,73.87L78.50,67.23L82.94,65.93L87.16,61.36L88.65,61.24L89.47,64.49L91.28,65.87L97.03,64.66L99.47,61.93L99.98,56.27L95.71,55.00L95.07,53.32L93.84,53.70L94.16,52.49L91.29,52.48L92.05,51.87L90.52,51.22L96.89,46.95L96.57,44.68L97.57,43.70L93.15,42.76L95.14,41.97L93.90,36.68L95.41,35.13L95.63,36.97L96.68,36.82L96.81,34.20L94.90,32.32L95.65,30.98L94.26,29.06L91.98,28.60L89.47,24.99L88.33,27.10L86.84,27.39L79.43,22.14L76.17,22.14L76.61,18.83L74.12,16.09L73.38,18.14L71.33,19.55L69.46,16.73L69.77,15.67L68.98,16.10L65.11,13.79L63.59,16.04L60.21,14.89L55.70,15.21L53.99,16.78L49.80,15.91L45.65,23.79L42.79,25.43L43.61,26.18L41.97,26.71L41.14,24.97L39.25,25.87L37.03,35.22L35.19,37.56L27.55,38.85L26.66,40.37L22.04,41.58L19.80,44.04L19.73,42.14L18.52,42.03L18.84,42.92L16.50,44.57L18.03,45.52L17.43,46.69L13.82,47.33L13.44,49.76L9.58,52.00L10.13,53.05L8.33,55.37L7.24,59.67Z",
  "M0.00,81.34L3.46,82.87L4.00,84.69L3.61,83.78L2.95,85.34L3.91,86.05L9.08,85.53L13.64,81.62L16.52,80.52L17.46,76.90L13.10,74.87L6.12,77.96L3.23,81.04L0.00,81.34Z"
];

// Equirectangular projection with a cos(lat) correction, so Bohol isn't stretched
// sideways. Must stay in sync with the constants the paths were generated from.
const MIN_LNG = 123.7177335;
const MAX_LAT = 10.1734079;
const KX = 0.9852307087805091;
const SCALE = 115.38978379870855;
const OFF_X = 0;
const OFF_Y = 13.774404345471247;

export function projectToShape(longitude: number, latitude: number): { x: number; y: number } {
  return {
    x: (longitude - MIN_LNG) * KX * SCALE + OFF_X,
    y: (MAX_LAT - latitude) * SCALE + OFF_Y, // SVG y grows downward
  };
}

// The curated Bohol shape as the same Silhouette shape the share card uses for
// every other province — so home and away render through one code path.
import type { Silhouette } from './silhouette';

export const BOHOL_SILHOUETTE: Silhouette = {
  view: SHAPE_VIEW,
  paths: BOHOL_PATHS,
  project: projectToShape,
};
