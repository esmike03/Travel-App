// Ported from MapScreen in ui/screens/Screens.kt.
// The original app renders OpenStreetMap natively via osmdroid. react-native-maps'
// UrlTile overlay is unreliable under Expo Go's New Architecture (SDK 54), so this
// port renders pure OSM tiles with MapLibre GL JS inside a WebView instead — no
// Google Maps, no API key, and it works in Expo Go.
import React, { useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { destinations, Destination } from '../data/destinations';
import { useFavorites } from '../context/FavoritesContext';
import { AddToTripButton } from '../components/common';

const BOHOL = { longitude: 124.1435, latitude: 9.85, zoom: 8.3 };
const SELECTED_ZOOM = 12;

// Standalone HTML document hosting a MapLibre GL JS map with an OpenStreetMap
// raster source. Markers are injected from the `destinations` list; tapping one
// posts its id back to React Native. `window.flyTo` is called from RN to recenter.
function buildHtml(markerColor: string): string {
  const markers = destinations.map((d) => ({
    id: d.id,
    name: d.name,
    latitude: d.latitude,
    longitude: d.longitude,
  }));

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PRIMARY = ${JSON.stringify(markerColor)};
    var DESTINATIONS = ${JSON.stringify(markers)};

    function post(obj) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

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
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [${BOHOL.longitude}, ${BOHOL.latitude}],
      zoom: ${BOHOL.zoom},
      attributionControl: { compact: true }
    });

    DESTINATIONS.forEach(function (d) {
      var marker = new maplibregl.Marker({ color: PRIMARY })
        .setLngLat([d.longitude, d.latitude])
        .addTo(map);
      marker.getElement().style.cursor = 'pointer';
      marker.getElement().addEventListener('click', function () {
        post({ type: 'select', id: d.id });
      });
    });

    // Called from React Native via injectJavaScript.
    window.flyTo = function (lng, lat, zoom) {
      map.flyTo({ center: [lng, lat], zoom: zoom, duration: 600 });
    };

    map.on('load', function () { post({ type: 'ready' }); });
    map.on('error', function (e) {
      post({ type: 'error', message: (e && e.error && e.error.message) || 'map error' });
    });
  </script>
</body>
</html>`;
}

export default function MapScreen({
  onDestinationClick,
}: {
  onDestinationClick: (id: number) => void;
}) {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);
  const [selected, setSelected] = useState<Destination | null>(null);

  const html = useMemo(() => buildHtml(colors.primary), [colors.primary]);

  const flyTo = (lng: number, lat: number, zoom: number) => {
    webRef.current?.injectJavaScript(`window.flyTo(${lng}, ${lat}, ${zoom}); true;`);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'select') {
        const d = destinations.find((x) => x.id === msg.id);
        if (d) {
          setSelected(d);
          flyTo(d.longitude, d.latitude, SELECTED_ZOOM);
        }
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <WebView
        ref={webRef}
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        // Android: allow the CDN + tile requests to load.
        mixedContentMode="always"
      />

      {/* Top floating chip */}
      <View style={[styles.topChip, { backgroundColor: colors.surface }]}>
        <MaterialIcons name="place" size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.onSurface }}>
          Bohol · {destinations.length} destinations
        </Text>
      </View>

      {/* Reset view button */}
      <Pressable
        style={[styles.resetFab, { backgroundColor: colors.surface }]}
        onPress={() => {
          setSelected(null);
          flyTo(BOHOL.longitude, BOHOL.latitude, BOHOL.zoom);
        }}
      >
        <MaterialIcons name="layers" size={24} color={colors.primary} />
      </Pressable>

      {/* Bottom info card */}
      {selected ? (
        <MapDestinationCard
          destination={selected}
          onClose={() => setSelected(null)}
          onViewDetails={() => onDestinationClick(selected.id)}
        />
      ) : null}
    </View>
  );
}

function MapDestinationCard({
  destination,
  onClose,
  onViewDetails,
}: {
  destination: Destination;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  const { colors } = useTheme();
  const { isFavorite } = useFavorites();
  const saved = isFavorite(destination.id);
  return (
    <View style={[styles.bottomCard, { backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: 'row', gap: 12, paddingRight: 32 }}>
        <Image source={{ uri: destination.imageUrl }} style={styles.cardThumb} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface }}>
            {destination.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="star" size={14} color="#FFC107" />
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.onSurface }}>
              {destination.rating}
            </Text>
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              · {destination.category}
            </Text>
            {saved ? (
              <MaterialIcons name="bookmark" size={14} color={colors.primary} />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="location-on" size={12} color={colors.onSurfaceVariant} />
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {destination.municipality}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Pressable
              onPress={onViewDetails}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 50,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.onPrimary }}>
                View details
              </Text>
              <MaterialIcons name="arrow-forward" size={14} color={colors.onPrimary} />
            </Pressable>
            <AddToTripButton destinationId={destination.id} compact />
          </View>
        </View>
      </View>
      <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
        <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topChip: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  resetFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bottomCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardThumb: { width: 72, height: 72, borderRadius: 14 },
  closeBtn: { position: 'absolute', top: 4, right: 4, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
