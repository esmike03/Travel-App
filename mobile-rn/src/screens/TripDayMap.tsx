// Full-screen route map for a single group of trip stops (a day/week/month).
// Renders OSM via MapLibre GL JS in a WebView (same approach as MapScreen), draws
// the stops as numbered markers connected by a route line, optionally shows the
// user's current location as the start, and offers real turn-by-turn directions
// through Google Maps. Tapping a numbered pin opens that stop's details, and a
// plainly better stop order is offered as a one-tap reorder.
import React, { useMemo, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinationById, Destination } from '../data/destinations';
import { TripStop, formatDate, formatTime } from '../context/TripsContext';
import { Coords } from '../hooks/useUserLocation';
import { routeSuggestion } from '../utils/route';
import { formatKm } from '../utils/format';

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
      font-size: 13px; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      cursor: pointer; transition: transform 0.15s ease-out; }
    /* The tapped pin lifts slightly so it stays findable behind the details card. */
    .pin.active { transform: scale(1.25); border-width: 3px; }
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
    var pinEls = {};

    function post(o){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

    // Highlight the selected pin and bring it into view above the details card.
    window.selectStop = function (n) {
      Object.keys(pinEls).forEach(function (k) {
        pinEls[k].classList.toggle('active', String(n) === k);
      });
      var m = MARKERS.filter(function (x) { return x.n === n; })[0];
      if (!m) return;
      var h = map.getContainer().clientHeight || 0;
      map.easeTo({ center: [m.lng, m.lat], offset: [0, -h * 0.15], duration: 400 });
    };

    window.clearStop = function () {
      Object.keys(pinEls).forEach(function (k) { pinEls[k].classList.remove('active'); });
    };

    var map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          voyager: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256, maxzoom: 19,
            attribution: '© OpenStreetMap contributors · © CARTO'
          }
        },
        layers: [{ id: 'voyager', type: 'raster', source: 'voyager' }]
      },
      center: LINE.length ? LINE[0] : [124.1435, 9.85],
      zoom: 10,
      attributionControl: { compact: true }
    });

    // Fetch an actual road route (OSRM) that follows the streets between the
    // ordered stops. Falls back to the straight connecting line if the routing
    // service is unreachable or returns nothing.
    function loadRoute() {
      if (LINE.length < 2) return;
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: LINE } }
      });
      // Straight-line fallback drawn first (dashed, faint) so there is always a path.
      map.addLayer({
        id: 'route-fallback', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': PRIMARY, 'line-width': 3, 'line-opacity': 0.35, 'line-dasharray': [1.5, 1.2] }
      });
      map.addLayer({
        id: 'route', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': PRIMARY, 'line-width': 5, 'line-opacity': 0 }
      });

      var coordStr = LINE.map(function (c) { return c[0] + ',' + c[1]; }).join(';');
      var url = 'https://router.project-osrm.org/route/v1/driving/' + coordStr +
        '?overview=full&geometries=geojson';
      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
            map.getSource('route').setData({
              type: 'Feature', geometry: data.routes[0].geometry
            });
            // Real road route found — show it solid and hide the straight fallback.
            map.setPaintProperty('route', 'line-opacity', 1);
            map.setPaintProperty('route-fallback', 'line-opacity', 0);
            var g = data.routes[0].geometry.coordinates;
            if (g && g.length) {
              var rb = g.reduce(function (bounds, c) { return bounds.extend(c); },
                new maplibregl.LngLatBounds(g[0], g[0]));
              map.fitBounds(rb, { padding: 70, maxZoom: 15, duration: 300 });
            }
          } else {
            map.setPaintProperty('route', 'line-opacity', 1);
          }
        })
        .catch(function () {
          // Keep the dashed straight-line fallback visible.
        });
    }

    map.on('load', function () {
      loadRoute();

      MARKERS.forEach(function (m) {
        // maplibre owns the marker element's inline transform (it positions it),
        // so the pin lives one level in — otherwise .pin.active's scale would be
        // overridden by that inline style and silently do nothing.
        var wrap = document.createElement('div');
        var el = document.createElement('div');
        el.className = 'pin';
        el.style.background = m.visited ? VISITED : PRIMARY;
        el.textContent = m.visited ? '✓' : String(m.n);
        el.addEventListener('click', function () { post({ type: 'select', n: m.n }); });
        wrap.appendChild(el);
        pinEls[m.n] = el;
        new maplibregl.Marker({ element: wrap }).setLngLat([m.lng, m.lat]).addTo(map);
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
  onReorder,
  onClose,
}: {
  title: string;
  stops: TripStop[];
  userLocation: Coords | null;
  // Omitted for read-only (archived) plans, which hides the reorder banner.
  onReorder?: (stops: TripStop[], savedKm: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);
  const [selectedN, setSelectedN] = useState<number | null>(null);
  const points = useMemo(() => resolve(stops), [stops]);
  const html = useMemo(
    () => buildHtml(points, userLocation, colors.primary),
    [points, userLocation, colors.primary]
  );
  const suggestion = useMemo(
    () => (onReorder ? routeSuggestion(stops) : null),
    [onReorder, stops]
  );
  const selectedPoint = selectedN != null ? points[selectedN - 1] ?? null : null;

  const clearSelection = () => {
    setSelectedN(null);
    webRef.current?.injectJavaScript('window.clearStop(); true;');
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'select') {
        setSelectedN(msg.n);
        webRef.current?.injectJavaScript(`window.selectStop(${msg.n}); true;`);
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <WebView
          ref={webRef}
          style={StyleSheet.absoluteFill}
          originWhitelist={['*']}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
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
              {points.length > 1 ? ' · tap a number for details' : ''}
            </Text>
          </View>
        </View>

        {/* Reorder suggestion — same rule as the itinerary list: only offered
            when a nearest-first order saves a meaningful amount of travel. */}
        {suggestion && onReorder ? (
          <View style={[styles.banner, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onSurface }}>
                Shorter route available
              </Text>
              <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
                Reordering saves about {formatKm(suggestion.savedKm)} of travel.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                clearSelection();
                onReorder(suggestion.optimized, suggestion.savedKm);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: colors.secondary,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onSecondary }}>
                Reorder
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Tapped stop */}
        {selectedPoint ? (
          <StopDetailsCard
            order={selectedN ?? 0}
            point={selectedPoint}
            onClose={clearSelection}
          />
        ) : null}

        {/* Directions */}
        <Pressable
          onPress={() => openTripDirections(stops, userLocation)}
          style={[
            styles.directions,
            { backgroundColor: colors.primary, bottom: selectedPoint ? 150 : 28 },
          ]}
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

// Details for the pin the user tapped: enough to know which stop it is and when
// it is planned, without leaving the map.
function StopDetailsCard({
  order,
  point,
  onClose,
}: {
  order: number;
  point: DayMapStop;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { stop, destination } = point;
  const visited = stop.visited;
  return (
    <View style={[styles.stopCard, { backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: 'row', gap: 12, paddingRight: 28 }}>
        {/* Places the traveller searched for have no photo — show an icon tile
            rather than a broken image frame. */}
        {destination.imageUrl ? (
          <Image source={{ uri: destination.imageUrl }} style={styles.thumb} />
        ) : (
          <View
            style={[
              styles.thumb,
              {
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: withAlpha(colors.primary, 0.12),
              },
            ]}
          >
            <MaterialIcons name="place" size={26} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={[
                styles.badge,
                { backgroundColor: visited ? VISITED_COLOR : colors.primary },
              ]}
            >
              {visited ? (
                <MaterialIcons name="check" size={14} color="#fff" />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onPrimary }}>
                  {order}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.onSurface }}
            >
              {destination.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="location-on" size={12} color={colors.onSurfaceVariant} />
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {destination.municipality} · {destination.category}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Pill icon="calendar-month" text={formatDate(stop.date)} />
            <Pill icon="schedule" text={formatTime(stop.hour, stop.minute)} />
            {visited ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  borderRadius: 50,
                  backgroundColor: withAlpha(VISITED_COLOR, 0.16),
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <MaterialIcons name="check-circle" size={11} color={VISITED_COLOR} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: VISITED_COLOR }}>
                  Visited
                </Text>
              </View>
            ) : null}
          </View>
          {stop.notes ? (
            <Text numberOfLines={2} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {stop.notes}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
        <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
      </Pressable>
    </View>
  );
}

function Pill({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: 50,
        backgroundColor: withAlpha(colors.surfaceVariant, 0.6),
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <MaterialIcons name={icon} size={11} color={colors.primary} />
      <Text style={{ fontSize: 10, color: colors.onSurface }}>{text}</Text>
    </View>
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
  banner: {
    position: 'absolute',
    top: 112,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stopCard: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    borderRadius: 18,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directions: {
    position: 'absolute',
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
