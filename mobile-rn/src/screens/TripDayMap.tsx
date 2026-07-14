// Full-screen route map for a single group of trip stops (a day/week/month).
// Renders OSM via MapLibre GL JS in a WebView (same approach as MapScreen), draws
// the stops as numbered markers connected by a route line, optionally shows the
// user's current location as the start, and offers real turn-by-turn directions
// through Google Maps.
import React, { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { destinationById, Destination } from '../data/destinations';
import { TripStop } from '../context/TripsContext';
import { Coords } from '../hooks/useUserLocation';

const VISITED_COLOR = '#16A34A';

export interface DayMapStop {
  stop: TripStop;
  destination: Destination;
}

function resolve(stops: TripStop[]): DayMapStop[] {
  return stops
    .map((stop) => {
      const destination = destinationById(stop.destinationId);
      return destination ? { stop, destination } : null;
    })
    .filter((x): x is DayMapStop => x !== null);
}

// Build a Google Maps directions URL that chains every stop (real road routing).
export function openTripDirections(stops: TripStop[], userLocation: Coords | null) {
  const points = resolve(stops).map((p) => ({
    lat: p.destination.latitude,
    lng: p.destination.longitude,
  }));
  if (points.length === 0) return;
  const coords = points.map((p) => `${p.lat},${p.lng}`);
  const destination = coords[coords.length - 1];

  const params = ['api=1', `destination=${destination}`, 'travelmode=driving'];
  let waypoints: string[] = [];
  if (userLocation) {
    params.push(`origin=${userLocation.latitude},${userLocation.longitude}`);
    waypoints = coords.slice(0, coords.length - 1);
  } else if (coords.length > 1) {
    params.push(`origin=${coords[0]}`);
    waypoints = coords.slice(1, coords.length - 1);
  }
  if (waypoints.length > 0) {
    params.push(`waypoints=${waypoints.map(encodeURIComponent).join('|')}`);
  }
  Linking.openURL(`https://www.google.com/maps/dir/?${params.join('&')}`);
}

function buildHtml(
  points: DayMapStop[],
  userLocation: Coords | null,
  primary: string
): string {
  const markers = points.map((p, i) => ({
    n: i + 1,
    name: p.destination.name,
    lat: p.destination.latitude,
    lng: p.destination.longitude,
    visited: p.stop.visited,
  }));
  const line = [
    ...(userLocation ? [[userLocation.longitude, userLocation.latitude]] : []),
    ...points.map((p) => [p.destination.longitude, p.destination.latitude]),
  ];
  const user = userLocation ? [userLocation.longitude, userLocation.latitude] : null;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .maplibregl-ctrl-attrib { font-size: 10px; }
    .pin { width: 30px; height: 30px; border-radius: 15px; display: flex;
      align-items: center; justify-content: center; color: #fff; font-weight: 700;
      font-size: 13px; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
    .you { width: 18px; height: 18px; border-radius: 9px; background: #1565C0;
      border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PRIMARY = ${JSON.stringify(primary)};
    var VISITED = ${JSON.stringify(VISITED_COLOR)};
    var MARKERS = ${JSON.stringify(markers)};
    var LINE = ${JSON.stringify(line)};
    var USER = ${JSON.stringify(user)};

    var map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256, maxzoom: 19,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: LINE.length ? LINE[0] : [124.1435, 9.85],
      zoom: 10,
      attributionControl: { compact: true }
    });

    map.on('load', function () {
      if (LINE.length >= 2) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: LINE } }
        });
        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': PRIMARY, 'line-width': 4, 'line-dasharray': [1.5, 1] }
        });
      }

      MARKERS.forEach(function (m) {
        var el = document.createElement('div');
        el.className = 'pin';
        el.style.background = m.visited ? VISITED : PRIMARY;
        el.textContent = m.visited ? '✓' : String(m.n);
        new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
      });

      if (USER) {
        var uel = document.createElement('div');
        uel.className = 'you';
        new maplibregl.Marker({ element: uel }).setLngLat(USER).addTo(map);
      }

      var pts = LINE.slice();
      if (pts.length === 1) {
        map.setCenter(pts[0]); map.setZoom(13);
      } else if (pts.length >= 2) {
        var b = pts.reduce(function (bounds, c) { return bounds.extend(c); },
          new maplibregl.LngLatBounds(pts[0], pts[0]));
        map.fitBounds(b, { padding: 70, maxZoom: 14, duration: 0 });
      }
    });
  </script>
</body>
</html>`;
}

export default function TripDayMap({
  title,
  stops,
  userLocation,
  onClose,
}: {
  title: string;
  stops: TripStop[];
  userLocation: Coords | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const points = useMemo(() => resolve(stops), [stops]);
  const html = useMemo(
    () => buildHtml(points, userLocation, colors.primary),
    [points, userLocation, colors.primary]
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <WebView
          style={StyleSheet.absoluteFill}
          originWhitelist={['*']}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
        />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>
              {title}
            </Text>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              {points.length} {points.length === 1 ? 'stop' : 'stops'}
              {userLocation ? ' · starting from you' : ''}
            </Text>
          </View>
        </View>

        {/* Directions */}
        <Pressable
          onPress={() => openTripDirections(stops, userLocation)}
          style={[styles.directions, { backgroundColor: colors.primary }]}
        >
          <MaterialIcons name="directions" size={20} color={colors.onPrimary} />
          <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 15 }}>
            Open in Google Maps
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  directions: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
