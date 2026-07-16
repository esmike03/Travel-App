// Live turn-by-turn style navigation to a single destination.
// Renders OSM through MapLibre GL JS in a WebView (same stack as MapScreen /
// TripDayMap). The user's position is streamed via useLiveLocation and pushed
// into the map, which:
//   - draws the road route (OSRM) from the user to the destination,
//   - follows the user and rotates the map to their heading (Google-Maps feel),
//   - recomputes remaining distance + ETA on every move,
//   - automatically reroutes when the user strays off the current route, and
//   - supports a 2D/3D tilt (drag with two fingers, or the 3D button), where 3D
//     drapes the map over real elevation data so Bohol's hills have relief and
//     extrudes OSM building footprints.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { destinationById, destinations } from '../data/destinations';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { DEM_SOURCE, OFM_SOURCE, MAP3D_SCRIPT } from '../utils/map3d';

interface Progress {
  remainingKm: number;
  etaMin: number | null;
  arrived: boolean;
}

function buildHtml(destLng: number, destLat: number, primary: string): string {
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

    /* User — Google-style heading puck: soft accuracy halo with a single
       white-outlined chevron that rotates to the heading. When no heading is
       available we fall back to a plain dot (an arrow pointing nowhere lies).
       Only .me-rot rotates (maplibre owns .me's transform for positioning). */
    .me { width: 44px; height: 44px; position: relative; }
    .me-halo { position: absolute; left: 0; top: 0; width: 44px; height: 44px;
      border-radius: 50%; background: rgba(21,101,192,0.16); }
    .me-rot { position: absolute; left: 0; top: 0; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      transform-origin: 22px 22px; transition: transform 0.3s ease-out; }
    .me-arrow { width: 26px; height: 26px; display: block;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4)); }
    .me-dot { position: absolute; left: 14px; top: 14px; width: 16px; height: 16px;
      border-radius: 50%; background: #1565C0; border: 3px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35); box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var DEST = [${destLng}, ${destLat}];
    var PRIMARY = ${JSON.stringify(primary)};

    function post(o){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

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
          },
          dem: ${JSON.stringify(DEM_SOURCE)},
          ofm: ${JSON.stringify(OFM_SOURCE)}
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: DEST, zoom: 13, pitch: 0, bearing: 0,
      maxPitch: 75, attributionControl: { compact: true }
    });

    // Two-finger vertical drag tilts the map into a 3D perspective.
    if (map.touchPitch) map.touchPitch.enable();
    if (map.dragRotate) map.dragRotate.enable();
${MAP3D_SCRIPT}

    var routeCoords = null;
    var avgSpeedKmh = 40;
    var fetching = false;
    var lastRouteAt = 0;
    var followMode = true;
    var userLngLat = null;
    var destMarker = null;
    var meMarker = null;
    var meRot = null;
    var meDot = null;
    var headingDeg = null; // last known true heading
    var headingAcc = null; // unwrapped on-screen angle

    function toXY(lng, lat, lat0){
      return [lng * 111320 * Math.cos(lat0 * Math.PI / 180), lat * 110540];
    }

    // Nearest point on the route to pos: deviation (m) and remaining distance (m).
    function routeProgress(pos){
      var pts = routeCoords, lat0 = pos[1];
      var P = toXY(pos[0], pos[1], lat0);
      var best = { d: Infinity, seg: 0, t: 0 };
      for (var i = 0; i < pts.length - 1; i++){
        var A = toXY(pts[i][0], pts[i][1], lat0);
        var B = toXY(pts[i+1][0], pts[i+1][1], lat0);
        var abx = B[0]-A[0], aby = B[1]-A[1];
        var len2 = abx*abx + aby*aby;
        var t = len2 > 0 ? ((P[0]-A[0])*abx + (P[1]-A[1])*aby) / len2 : 0;
        if (t < 0) t = 0; if (t > 1) t = 1;
        var px = A[0] + t*abx, py = A[1] + t*aby;
        var d = Math.sqrt((P[0]-px)*(P[0]-px) + (P[1]-py)*(P[1]-py));
        if (d < best.d){ best.d = d; best.seg = i; best.t = t; }
      }
      var A0 = toXY(pts[best.seg][0], pts[best.seg][1], lat0);
      var B0 = toXY(pts[best.seg+1][0], pts[best.seg+1][1], lat0);
      var segLen = Math.sqrt(Math.pow(B0[0]-A0[0],2) + Math.pow(B0[1]-A0[1],2));
      var remaining = segLen * (1 - best.t);
      for (var j = best.seg + 1; j < pts.length - 1; j++){
        var C = toXY(pts[j][0], pts[j][1], lat0);
        var D = toXY(pts[j+1][0], pts[j+1][1], lat0);
        remaining += Math.sqrt(Math.pow(D[0]-C[0],2) + Math.pow(D[1]-C[1],2));
      }
      return { deviation: best.d, remaining: remaining };
    }

    function ensureRouteLayers(){
      if (map.getSource('route')) return;
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0B3D2E', 'line-width': 10, 'line-opacity': 0.5 } });
      map.addLayer({ id: 'route', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': PRIMARY, 'line-width': 6 } });
    }

    function reportProgress(){
      if (!routeCoords || !userLngLat) return;
      var p = routeProgress(userLngLat);
      var remKm = p.remaining / 1000;
      var etaMin = avgSpeedKmh > 0 ? (remKm / avgSpeedKmh) * 60 : null;
      post({ type: 'progress', remainingKm: remKm, etaMin: etaMin, arrived: p.remaining < 30 });
      // Off the drawn route: reroute, but no more than once every 8s.
      if (p.deviation > 55 && !fetching && (Date.now() - lastRouteAt) > 8000)
        computeRoute(userLngLat[0], userLngLat[1]);
    }

    function computeRoute(fromLng, fromLat){
      if (fetching) return;
      fetching = true;
      lastRouteAt = Date.now();
      post({ type: 'routing' });
      var url = 'https://router.project-osrm.org/route/v1/driving/' +
        fromLng + ',' + fromLat + ';' + DEST[0] + ',' + DEST[1] +
        '?overview=full&geometries=geojson';
      fetch(url).then(function(r){ return r.json(); }).then(function(data){
        fetching = false;
        if (data && data.routes && data.routes[0] && data.routes[0].geometry){
          var route = data.routes[0];
          routeCoords = route.geometry.coordinates;
          if (route.distance > 0 && route.duration > 0)
            avgSpeedKmh = (route.distance / 1000) / (route.duration / 3600);
          ensureRouteLayers();
          map.getSource('route').setData({ type: 'Feature', geometry: route.geometry });
          reportProgress();
        } else {
          post({ type: 'routeError' });
        }
      }).catch(function(){ fetching = false; post({ type: 'routeError' }); });
    }

    function makeDest(){
      // MapLibre's built-in pin anchors its tip exactly on the coordinate.
      destMarker = new maplibregl.Marker({ color: PRIMARY }).setLngLat(DEST).addTo(map);
    }
    function makeMe(lng, lat){
      var el = document.createElement('div'); el.className = 'me';
      el.innerHTML =
        '<div class="me-halo"></div>' +
        '<div class="me-rot" style="display:none">' +
          '<svg class="me-arrow" viewBox="0 0 24 24">' +
            '<path d="M12 2.5 L19.5 20 L12 15.8 L4.5 20 Z" fill="#1565C0" ' +
              'stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" />' +
          '</svg>' +
        '</div>' +
        '<div class="me-dot"></div>';
      meRot = el.querySelector('.me-rot');
      meDot = el.querySelector('.me-dot');
      // pitchAlignment 'map' lays the puck flat on the road once tilted (in 2D
      // it looks the same), which is what sells the third-person view. Rotation
      // stays viewport-aligned — applyHeading does the bearing maths itself.
      meMarker = new maplibregl.Marker({
        element: el, anchor: 'center', pitchAlignment: 'map', rotationAlignment: 'viewport'
      }).setLngLat([lng, lat]).addTo(map);
    }

    // Point the chevron at the user's heading. The marker element is aligned to
    // the viewport, not the map, so the on-screen angle is the heading minus the
    // map's bearing (in follow mode those cancel out and it points straight up,
    // like Google). Unwrapping across the 359->0 seam keeps the CSS transition
    // taking the short way round instead of spinning backwards.
    function applyHeading(){
      if (!meRot || headingDeg == null) return;
      var target = headingDeg - map.getBearing();
      if (headingAcc == null) headingAcc = target;
      else headingAcc += ((target - headingAcc + 540) % 360) - 180;
      meRot.style.transform = 'rotate(' + headingAcc + 'deg)';
    }

    // Chase camera. In 3D we sit behind and above the puck: the offset drops
    // the user toward the bottom of the screen so most of the view is the road
    // ahead rather than the road already driven. In 2D the user stays centred.
    function followCam(bearing, duration){
      if (!userLngLat) return;
      var h = map.getContainer().clientHeight || 0;
      map.easeTo({
        center: userLngLat,
        zoom: Math.max(map.getZoom(), is3DMode ? 17 : 16),
        bearing: bearing,
        pitch: map.getPitch(),
        offset: is3DMode ? [0, h * 0.22] : [0, 0],
        duration: duration
      });
    }

    // Called from React Native on every GPS fix.
    window.setUser = function(lng, lat, heading){
      userLngLat = [lng, lat];
      if (!meMarker) makeMe(lng, lat); else meMarker.setLngLat([lng, lat]);
      var hasHeading = heading != null && heading >= 0;
      if (hasHeading){ headingDeg = heading; applyHeading(); }
      if (meRot) meRot.style.display = hasHeading ? 'flex' : 'none';
      if (meDot) meDot.style.display = hasHeading ? 'none' : 'block';
      if (!routeCoords && !fetching) computeRoute(lng, lat); else reportProgress();
      if (followMode) followCam(hasHeading ? heading : map.getBearing(), 900);
    };

    // Elevation and building massing are only worth paying for once the camera
    // is tilted enough to see them. Driven by pitch rather than the button so a
    // two-finger tilt gets the same 3D, with the state posted back to keep the
    // button in sync.
    function sync3D(){
      var want = map.getPitch() > 15;
      if (want === is3DMode) return;
      apply3D(want);
      post({ type: '3d', on: want });
      if (followMode) followCam(map.getBearing(), 400);
    }
    map.on('pitchend', sync3D);

    window.set3D = function(on){
      apply3D(on);
      // Pitch and the chase framing have to move together, or the camera swings
      // twice: once to tilt, then again to re-centre on the puck.
      var h = map.getContainer().clientHeight || 0;
      var cam = { pitch: on ? 65 : 0, duration: 600 };
      if (followMode && userLngLat){
        cam.center = userLngLat;
        cam.offset = on ? [0, h * 0.22] : [0, 0];
        cam.zoom = Math.max(map.getZoom(), on ? 17 : 16);
        if (headingDeg != null) cam.bearing = headingDeg;
      }
      map.easeTo(cam);
    };
    window.recenter = function(){
      followMode = true; post({ type: 'follow', follow: true });
      followCam(headingDeg != null ? headingDeg : map.getBearing(), 700);
    };
    window.overview = function(){
      followMode = false; post({ type: 'follow', follow: false });
      // Fitting the route flattens the camera, so drop 3D with it rather than
      // leaving terrain and extrusions being paid for at pitch 0.
      if (is3DMode){ apply3D(false); post({ type: '3d', on: false }); }
      if (!userLngLat){ map.easeTo({ center: DEST, zoom: 13, pitch: 0, duration: 500 }); return; }
      var b = new maplibregl.LngLatBounds(userLngLat, userLngLat);
      b.extend(DEST);
      if (routeCoords) routeCoords.forEach(function(c){ b.extend(c); });
      map.fitBounds(b, { padding: 80, pitch: 0, bearing: 0, maxZoom: 15, duration: 600 });
    };

    // The chevron is viewport-aligned, so any bearing change re-aims it.
    map.on('rotate', applyHeading);

    // A manual drag means the user is exploring — stop auto-following.
    map.on('dragstart', function(){
      if (followMode){ followMode = false; post({ type: 'follow', follow: false }); }
    });

    map.on('load', function(){ addBuildings(); makeDest(); post({ type: 'ready' }); });
    map.on('error', function(e){ post({ type: 'error', message: (e && e.error && e.error.message) || 'map error' }); });
  </script>
</body>
</html>`;
}

export default function NavigationScreen({
  destinationId,
  onBack,
}: {
  destinationId: number;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const destination = destinationById(destinationId) ?? destinations[0];

  const { fix, error, hasPermission, request } = useLiveLocation(true);
  const [mapReady, setMapReady] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [routing, setRouting] = useState(false);
  const [following, setFollowing] = useState(true);
  const [is3D, setIs3D] = useState(false);

  const html = useMemo(
    () => buildHtml(destination.longitude, destination.latitude, colors.primary),
    [destination.longitude, destination.latitude, colors.primary]
  );

  // Push each new GPS fix into the map once it has loaded.
  useEffect(() => {
    if (!mapReady || !fix) return;
    const heading = fix.heading ?? -1;
    webRef.current?.injectJavaScript(
      `window.setUser(${fix.longitude}, ${fix.latitude}, ${heading}); true;`
    );
  }, [mapReady, fix]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') setMapReady(true);
      else if (msg.type === 'routing') setRouting(true);
      else if (msg.type === 'routeError') setRouting(false);
      else if (msg.type === 'follow') setFollowing(!!msg.follow);
      else if (msg.type === '3d') setIs3D(!!msg.on);
      else if (msg.type === 'progress') {
        setRouting(false);
        setProgress({
          remainingKm: msg.remainingKm,
          etaMin: msg.etaMin,
          arrived: !!msg.arrived,
        });
      }
    } catch {
      // ignore malformed messages
    }
  };

  const toggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    webRef.current?.injectJavaScript(`window.set3D(${next}); true;`);
  };
  const recenter = () => webRef.current?.injectJavaScript('window.recenter(); true;');
  const overview = () => webRef.current?.injectJavaScript('window.overview(); true;');

  const openInGoogleMaps = () => {
    const url =
      `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=` +
      `${destination.latitude},${destination.longitude}` +
      (fix ? `&origin=${fix.latitude},${fix.longitude}` : '');
    Linking.openURL(url);
  };

  const etaText =
    progress?.arrived
      ? 'Arrived'
      : progress?.etaMin != null
      ? formatDuration(progress.etaMin)
      : '—';
  const distText =
    progress != null ? formatKmShort(progress.remainingKm) : '—';

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
        mixedContentMode="always"
      />

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 8, backgroundColor: colors.surface }]}>
        <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Navigating to</Text>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>
            {destination.name}
          </Text>
        </View>
        {routing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="sync" size={16} color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>Routing…</Text>
          </View>
        ) : null}
      </View>

      {/* Right-side controls */}
      <View style={[styles.controls, { top: insets.top + 96 }]}>
        <RoundButton
          icon="view-in-ar"
          active={is3D}
          onPress={toggle3D}
          label={is3D ? '2D' : '3D'}
        />
        <RoundButton icon="zoom-out-map" onPress={overview} label="Fit" />
        <RoundButton
          icon={following ? 'gps-fixed' : 'gps-not-fixed'}
          active={following}
          onPress={recenter}
          label="Center"
        />
      </View>

      {/* Permission / error notice */}
      {!hasPermission || error ? (
        <View style={[styles.notice, { bottom: insets.bottom + 140, backgroundColor: colors.surface }]}>
          <MaterialIcons name="location-off" size={18} color={colors.error} />
          <Text style={{ flex: 1, fontSize: 12, color: colors.onSurface }}>
            {error ?? 'Location is off. Enable it to see live directions.'}
          </Text>
          <Pressable onPress={request} hitSlop={8}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Enable</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Bottom ETA card */}
      <View style={[styles.card, { bottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: progress?.arrived ? '#16A34A' : colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons
              name={progress?.arrived ? 'flag' : 'navigation'}
              size={24}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.onSurface }}>
              {etaText}
            </Text>
            <Text style={{ fontSize: 13, color: colors.onSurfaceVariant }}>
              {progress?.arrived
                ? "You've reached your destination"
                : progress != null
                ? `${distText} remaining`
                : mapReady
                ? 'Finding the best route…'
                : 'Loading map…'}
            </Text>
          </View>
          <Pressable
            onPress={openInGoogleMaps}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.secondaryContainer,
            }}
          >
            <MaterialIcons name="directions" size={18} color={colors.onSecondaryContainer} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer }}>
              Maps
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  onPress,
  active,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  active?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.round, { backgroundColor: active ? colors.primary : colors.surface }]}
    >
      <MaterialIcons name={icon} size={22} color={active ? colors.onPrimary : colors.primary} />
      {label ? (
        <Text
          style={{
            fontSize: 8,
            fontWeight: '700',
            color: active ? colors.onPrimary : colors.primary,
            marginTop: -2,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

function formatKmShort(km: number): string {
  if (km < 1) return `${Math.max(0, Math.round(km * 1000))} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
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
  controls: {
    position: 'absolute',
    right: 14,
    gap: 10,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
