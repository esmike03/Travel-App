// The 3D pieces shared by the MapLibre WebViews (MapScreen, NavigationScreen).
// Both maps render OSM raster tiles, which are flat images — height has to come
// from separate sources, and both are free with no API key, matching the app's
// "works in Expo Go, no signup" constraint.
//
// These are only ever attached while 3D is on, so a flat map costs no extra
// tiles: MapLibre skips a source whose layers are all invisible, and terrain is
// torn down with setTerrain(null).

// Terrarium-encoded elevation (Mapzen/AWS). Bohol has real but modest relief —
// the Chocolate Hills rise ~170m across a single tile, the coast is near flat.
export const DEM_SOURCE = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  maxzoom: 15,
  encoding: 'terrarium',
  attribution: '© Mapzen, USGS, NASA',
};

// OpenFreeMap vector tiles (OpenMapTiles schema) — used only for `building`.
export const OFM_SOURCE = {
  type: 'vector',
  url: 'https://tiles.openfreemap.org/planet',
};

// Exaggeration makes that modest relief legible without looking like a cartoon.
export const TERRAIN = { source: 'dem', exaggeration: 1.5 };

// Extruded buildings. OSM's Bohol coverage is thin and most heights are derived
// from floor counts rather than surveyed, so this is massing for orientation,
// not measurement; anything without a height falls back to a single storey.
// Below z14 buildings are noise, and the source tiles stop at z14 anyway.
export const BUILDINGS_LAYER = {
  id: 'buildings-3d',
  type: 'fill-extrusion',
  source: 'ofm',
  'source-layer': 'building',
  minzoom: 14,
  layout: { visibility: 'none' },
  filter: ['!=', ['get', 'hide_3d'], true],
  paint: {
    'fill-extrusion-color': '#c9c2b8',
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 4],
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.85,
  },
};

// Emitted into the WebView. Defines apply3D(on), which turns elevation and
// building massing on together, and is3DMode, which callers read for framing.
// Kept as a string because these maps are built as standalone HTML documents.
export const MAP3D_SCRIPT = `
    var is3DMode = false;
    var TERRAIN = ${JSON.stringify(TERRAIN)};

    function addBuildings(){ map.addLayer(${JSON.stringify(BUILDINGS_LAYER)}); }

    function apply3D(on){
      is3DMode = on;
      if (!!map.getTerrain() !== on) map.setTerrain(on ? TERRAIN : null);
      if (map.getLayer('buildings-3d'))
        map.setLayoutProperty('buildings-3d', 'visibility', on ? 'visible' : 'none');
    }
`;
