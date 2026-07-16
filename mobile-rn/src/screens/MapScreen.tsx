// Ported from MapScreen in ui/screens/Screens.kt.
// The original app renders OpenStreetMap natively via osmdroid. react-native-maps'
// UrlTile overlay is unreliable under Expo Go's New Architecture (SDK 54), so this
// port renders pure OSM tiles with MapLibre GL JS inside a WebView instead — no
// Google Maps, no API key, and it works in Expo Go.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinations, Destination } from '../data/destinations';
import { Region } from '../data/region';
import { useRegionSetting } from '../context/RegionContext';
import { useFavorites } from '../context/FavoritesContext';
import { AddToTripButton } from '../components/common';
import { showToast } from '../utils/toast';
import { DEM_SOURCE, OFM_SOURCE, MAP3D_SCRIPT } from '../utils/map3d';

const SELECTED_ZOOM = 12;
// Buildings only exist from z14, so in 3D a selected place is worth flying
// closer to — at z12 you'd tilt into an empty landscape and see nothing.
const SELECTED_ZOOM_3D = 15.5;

// Standalone HTML document hosting a MapLibre GL JS map with an OpenStreetMap
// raster source. Markers are injected from the `destinations` list; tapping one
// posts its id back to React Native. `window.flyTo` is called from RN to recenter.
//
// The map frames whichever province the app is pointed at, by its bounding box
// rather than a fixed zoom — Palawan is some fifteen times the size of Siquijor,
// so one zoom level cannot fit both.
function buildHtml(markerColor: string, region: Region, spots: Destination[]): string {
  const markers = spots.map((d) => ({
    id: d.id,
    name: d.name,
    latitude: d.latitude,
    longitude: d.longitude,
  }));
  const [south, north, west, east] = region.bbox;

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
    /* A bookmark badge overlaid on MapLibre's built-in pin when the place is saved.
       Using the built-in marker keeps the tip anchored exactly on the coordinate. */
    .bm { position: absolute; top: -2px; right: -5px; width: 15px; height: 15px;
      border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.35);
      display: none; z-index: 2; }
    .saved .bm { display: block; }
    .bm i { position: absolute; left: 4px; top: 2.5px; width: 7px; height: 9px;
      background: ${markerColor}; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PRIMARY = ${JSON.stringify(markerColor)};
    var DESTINATIONS = ${JSON.stringify(markers)};
    // [[west, south], [east, north]] — the province the app is pointed at.
    var REGION_BOUNDS = [[${west}, ${south}], [${east}, ${north}]];

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
          },
          dem: ${JSON.stringify(DEM_SOURCE)},
          ofm: ${JSON.stringify(OFM_SOURCE)}
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [${region.longitude}, ${region.latitude}],
      zoom: 8,
      maxPitch: 75,
      attributionControl: { compact: true }
    });

    // Frame the whole province, whatever its size.
    function resetView(duration) {
      map.fitBounds(REGION_BOUNDS, { padding: 40, duration: duration, pitch: 0, bearing: 0 });
    }
    window.resetView = function () { resetView(600); };

    // Two-finger vertical drag tilts the map, same gesture as the nav screen.
    if (map.touchPitch) map.touchPitch.enable();
    if (map.dragRotate) map.dragRotate.enable();
${MAP3D_SCRIPT}

    var markerEls = {};
    DESTINATIONS.forEach(function (d) {
      var marker = new maplibregl.Marker({ color: PRIMARY })
        .setLngLat([d.longitude, d.latitude]).addTo(map);
      var el = marker.getElement();
      el.style.cursor = 'pointer';
      el.style.overflow = 'visible';
      el.addEventListener('click', function () { post({ type: 'select', id: d.id }); });
      var bm = document.createElement('div'); bm.className = 'bm';
      var ribbon = document.createElement('i'); bm.appendChild(ribbon);
      el.appendChild(bm);
      markerEls[d.id] = el;
    });

    // Terrain and buildings follow the pitch rather than the button, so a
    // two-finger tilt gets the same 3D; the state is posted back to keep the
    // button label honest.
    function sync3D(){
      var want = map.getPitch() > 15;
      if (want === is3DMode) return;
      apply3D(want);
      post({ type: '3d', on: want });
    }
    map.on('pitchend', sync3D);

    window.set3D = function (on) {
      apply3D(on);
      map.easeTo({ pitch: on ? 60 : 0, duration: 600 });
    };

    // Called from React Native via injectJavaScript.
    window.flyTo = function (lng, lat, zoom) {
      map.flyTo({ center: [lng, lat], zoom: zoom, duration: 600 });
    };

    // Toggle the saved badge on markers (ids of saved destinations).
    window.setSaved = function (ids) {
      var set = {};
      ids.forEach(function (x) { set[x] = true; });
      Object.keys(markerEls).forEach(function (id) {
        if (set[id]) markerEls[id].classList.add('saved');
        else markerEls[id].classList.remove('saved');
      });
    };

    map.on('load', function () { addBuildings(); resetView(0); post({ type: 'ready' }); });
    map.on('error', function (e) {
      post({ type: 'error', message: (e && e.error && e.error.message) || 'map error' });
    });
  </script>
</body>
</html>`;
}

export default function MapScreen({
  onDestinationClick,
  onNavigate,
}: {
  onDestinationClick: (id: number) => void;
  onNavigate: (id: number) => void;
}) {
  const { colors } = useTheme();
  const { ids: savedIds } = useFavorites();
  const { region, isHome } = useRegionSetting();
  const webRef = useRef<WebView>(null);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [ready, setReady] = useState(false);
  const [is3D, setIs3D] = useState(false);

  // Curated spots exist for Bohol only; elsewhere the map is the province plus
  // whatever the traveller adds themselves.
  const spots = useMemo(() => (isHome ? destinations : []), [isHome]);
  const html = useMemo(
    () => buildHtml(colors.primary, region, spots),
    [colors.primary, region, spots]
  );

  const flyTo = (lng: number, lat: number, zoom: number) => {
    webRef.current?.injectJavaScript(`window.flyTo(${lng}, ${lat}, ${zoom}); true;`);
  };

  // Keep the saved-badge on markers in sync with the favorites list, live.
  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setSaved(${JSON.stringify(savedIds)}); true;`);
  }, [ready, savedIds]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setReady(true);
      } else if (msg.type === '3d') {
        setIs3D(!!msg.on);
      } else if (msg.type === 'select') {
        const d = destinations.find((x) => x.id === msg.id);
        if (d) {
          setSelected(d);
          flyTo(d.longitude, d.latitude, is3D ? SELECTED_ZOOM_3D : SELECTED_ZOOM);
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
          {region.name}
          {spots.length > 0 ? ` · ${spots.length} spots` : ''}
        </Text>
        {savedIds.length > 0 ? (
          <>
            <Text style={{ color: colors.onSurfaceVariant }}>·</Text>
            <MaterialIcons name="bookmark" size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
              {savedIds.length} saved
            </Text>
          </>
        ) : null}
      </View>

      {/* Reset view button */}
      <Pressable
        style={[styles.resetFab, { backgroundColor: colors.surface }]}
        onPress={() => {
          setSelected(null);
          setIs3D(false);
          webRef.current?.injectJavaScript('window.set3D(false); window.resetView(); true;');
        }}
      >
        <MaterialIcons name="layers" size={24} color={colors.primary} />
      </Pressable>

      {/* 3D toggle: tilts the map, adds terrain relief and building massing */}
      <Pressable
        style={[
          styles.threeDFab,
          { backgroundColor: is3D ? colors.primary : colors.surface },
        ]}
        onPress={() => {
          const next = !is3D;
          setIs3D(next);
          webRef.current?.injectJavaScript(`window.set3D(${next}); true;`);
        }}
      >
        <MaterialIcons
          name="view-in-ar"
          size={20}
          color={is3D ? colors.onPrimary : colors.primary}
        />
        <Text
          style={{
            fontSize: 8,
            fontWeight: '700',
            color: is3D ? colors.onPrimary : colors.primary,
            marginTop: -2,
          }}
        >
          {is3D ? '2D' : '3D'}
        </Text>
      </Pressable>

      {/* Bottom info card */}
      {selected ? (
        <MapDestinationCard
          destination={selected}
          onClose={() => setSelected(null)}
          onViewDetails={() => onDestinationClick(selected.id)}
          onNavigate={() => onNavigate(selected.id)}
        />
      ) : null}
    </View>
  );
}

function MapDestinationCard({
  destination,
  onClose,
  onViewDetails,
  onNavigate,
}: {
  destination: Destination;
  onClose: () => void;
  onViewDetails: () => void;
  onNavigate: () => void;
}) {
  const { colors } = useTheme();
  const { isFavorite, toggle } = useFavorites();
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
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="location-on" size={12} color={colors.onSurfaceVariant} />
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {destination.municipality}
            </Text>
          </View>
          {/* Saved-state indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons
              name={saved ? 'bookmark' : 'bookmark-border'}
              size={13}
              color={saved ? colors.primary : colors.onSurfaceVariant}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: saved ? colors.primary : colors.onSurfaceVariant,
              }}
            >
              {saved ? 'Saved' : 'Not saved'}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={onNavigate}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.primary,
          }}
        >
          <MaterialIcons name="navigation" size={16} color={colors.onPrimary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onPrimary }}>Navigate</Text>
        </Pressable>
        <Pressable
          onPress={onViewDetails}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.secondaryContainer,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer }}>
            Details
          </Text>
          <MaterialIcons name="arrow-forward" size={14} color={colors.onSecondaryContainer} />
        </Pressable>
        <Pressable
          onPress={() => {
            const nowSaved = toggle(destination.id);
            if (nowSaved) showToast(`${destination.name} saved for offline trip planning`);
          }}
          hitSlop={6}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: saved ? colors.primary : withAlpha(colors.surfaceVariant, 0.6),
          }}
        >
          <MaterialIcons
            name={saved ? 'bookmark' : 'bookmark-border'}
            size={20}
            color={saved ? colors.onPrimary : colors.primary}
          />
        </Pressable>
        <AddToTripButton destinationId={destination.id} compact />
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
  threeDFab: {
    position: 'absolute',
    top: 68,
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
