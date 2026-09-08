// Ported from MapScreen in ui/screens/Screens.kt.
// The original app renders OpenStreetMap natively via osmdroid. react-native-maps'
// UrlTile overlay is unreliable under Expo Go's New Architecture (SDK 54), so this
// port renders pure OSM tiles with MapLibre GL JS inside a WebView instead — no
// Google Maps, no API key, and it works in Expo Go.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { destinations, Destination, destinationById } from '../data/destinations';
import { Region } from '../data/region';
import { PlaceHit, searchPlaces } from '../data/places';
import { useRegionSetting } from '../context/RegionContext';
import { usePlaces } from '../context/PlacesContext';
import { useFavorites } from '../context/FavoritesContext';
import { useTrips } from '../context/TripsContext';
import { AddToTripButton } from '../components/common';
import { groupPlans, isArchived } from '../utils/plans';
import { showToast } from '../utils/toast';
import { DEM_SOURCE, OFM_SOURCE, MAP3D_SCRIPT } from '../utils/map3d';

const SELECTED_ZOOM = 12;
// Buildings only exist from z14, so in 3D a selected place is worth flying
// closer to — at z12 you'd tilt into an empty landscape and see nothing.
const SELECTED_ZOOM_3D = 15.5;

// Standalone HTML document hosting a MapLibre GL JS map with CARTO Voyager's
// modern OpenStreetMap-based tiles. Markers are injected from the destination list; tapping one
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
    /* Stops on today's plan carry their order, so the map reads as the day's
       running order rather than an unlabelled scatter of pins. */
    .ord { position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
      min-width: 17px; height: 17px; padding: 0 4px; box-sizing: border-box;
      border-radius: 9px; background: #fff; color: #14312A; font-weight: 800;
      font-size: 11px; line-height: 17px; text-align: center;
      font-family: -apple-system, Roboto, sans-serif;
      box-shadow: 0 1px 3px rgba(0,0,0,0.35); display: none; z-index: 3; }
    .plan .ord { display: block; }
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
          voyager: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors · © CARTO'
          },
          dem: ${JSON.stringify(DEM_SOURCE)},
          ofm: ${JSON.stringify(OFM_SOURCE)}
        },
        layers: [{ id: 'voyager', type: 'raster', source: 'voyager' }]
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
      decorate(el);
      markerEls[d.id] = el;
    });

    // The badges every marker carries: a saved bookmark and a plan order number,
    // each hidden until its class is set.
    function decorate(el) {
      var bm = document.createElement('div'); bm.className = 'bm';
      bm.appendChild(document.createElement('i'));
      el.appendChild(bm);
      var ord = document.createElement('div'); ord.className = 'ord';
      el.appendChild(ord);
    }

    // Pins stay hidden until the traveller looks somewhere up: only the place
    // they just searched is shown, so the map otherwise reads as a clean
    // basemap. The exception is the plan being followed — those stops stay
    // pinned the whole time, since that is the map's whole job that day.
    var visibleMarkerId = null;
    var planOrder = {};
    function applyMarkerVisibility() {
      Object.keys(markerEls).forEach(function (id) {
        var el = markerEls[id];
        var order = planOrder[id];
        var onPlan = order !== undefined;
        var show = onPlan || (visibleMarkerId !== null && String(id) === String(visibleMarkerId));
        el.style.display = show ? '' : 'none';
        if (onPlan) {
          el.classList.add('plan');
          el.querySelector('.ord').textContent = String(order);
        } else {
          el.classList.remove('plan');
        }
      });
    }
    window.setVisibleMarker = function (id) {
      visibleMarkerId = (id === null || id === undefined) ? null : id;
      applyMarkerVisibility();
    };
    // ids in itinerary order; [] clears the plan back to a bare map.
    window.setPlanMarkers = function (ids) {
      planOrder = {};
      ids.forEach(function (id, i) { planOrder[id] = i + 1; });
      applyMarkerVisibility();
    };
    applyMarkerVisibility();

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

    // Drop a marker from React Native without rebuilding the map — used for
    // places the traveller searches for and adds (curated ones are baked in
    // above). Idempotent: adding the same id twice just re-centres it.
    window.addMarker = function (id, lng, lat) {
      if (markerEls[id]) return;
      var marker = new maplibregl.Marker({ color: PRIMARY }).setLngLat([lng, lat]).addTo(map);
      var el = marker.getElement();
      el.style.cursor = 'pointer';
      el.style.overflow = 'visible';
      el.addEventListener('click', function () { post({ type: 'select', id: id }); });
      decorate(el);
      markerEls[id] = el;
      applyMarkerVisibility();
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
  const { places, addPlace } = usePlaces();
  const { stops } = useTrips();
  const webRef = useRef<WebView>(null);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [ready, setReady] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The single pin currently on the map, or null for a clean basemap.
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  // Height of the selected-place card, so the button column can clear it.
  const [cardHeight, setCardHeight] = useState(0);
  const seq = useRef(0);

  // Collapsing drops the query too, so reopening starts clean rather than
  // showing stale results for something typed a while ago.
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    setHits([]);
  };

  // One element morphs between the icon in the FAB column and the full-width
  // bar, so the two never visibly swap. Width and radius rule out the native
  // driver, but it is a single 44px-tall view either way.
  const searchAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: searchOpen ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [searchOpen, searchAnim]);
  const searchStyle = {
    width: searchAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [44, Dimensions.get('window').width - 32],
    }),
    borderRadius: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 14] }),
  };
  // The field only fades in over the back half, so it never looks squashed
  // while the bar is still narrow.
  const searchFieldOpacity = searchAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });

  // Curated spots (Bohol only) are baked into the map's HTML. Custom places the
  // traveller has saved are injected after load instead, so adding one doesn't
  // reload the whole map — see the injection effect below.
  const curatedSpots = useMemo(() => (isHome ? destinations : []), [isHome]);
  const customInRegion = useMemo(
    () =>
      places.filter(
        (p) =>
          p.latitude >= region.bbox[0] &&
          p.latitude <= region.bbox[1] &&
          p.longitude >= region.bbox[2] &&
          p.longitude <= region.bbox[3]
      ),
    [places, region]
  );
  // Rebuild HTML only on things that change the base map — not on adding a place.
  const html = useMemo(
    () => buildHtml(colors.primary, region, curatedSpots),
    [colors.primary, region, curatedSpots]
  );

  // Which ids are already on the map. Reset whenever the HTML reloads (region or
  // theme change), so custom markers get re-injected onto the fresh map.
  const injectedIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    injectedIds.current = new Set();
    // The new document has its own map that has not loaded yet, so anything
    // waiting on `ready` must wait again rather than see a stale true.
    setReady(false);
  }, [html]);

  const flyTo = (lng: number, lat: number, zoom: number) => {
    webRef.current?.injectJavaScript(`window.flyTo(${lng}, ${lat}, ${zoom}); true;`);
  };

  // Inject any saved custom place in the region that isn't on the map yet.
  useEffect(() => {
    if (!ready) return;
    const fresh = customInRegion.filter((p) => !injectedIds.current.has(p.id));
    if (fresh.length === 0) return;
    const js = fresh
      .map((p) => `window.addMarker(${p.id}, ${p.longitude}, ${p.latitude});`)
      .join('');
    webRef.current?.injectJavaScript(`${js} true;`);
    fresh.forEach((p) => injectedIds.current.add(p.id));
  }, [ready, customInRegion]);

  // Keep the saved-badge on markers in sync with the favorites list, live.
  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setSaved(${JSON.stringify(savedIds)}); true;`);
  }, [ready, savedIds]);

  // Today's plan, in itinerary order. Its stops are the one thing that stays
  // pinned without being searched for — on the day of a trip the map's job is to
  // show that trip.
  const todayStopIds = useMemo(() => {
    const today = groupPlans(stops).find((g) => g.isCurrent && !isArchived(g));
    return today ? today.stops.map((s) => s.destinationId) : [];
  }, [stops]);

  // Stops can point at custom places, which are only on the map once injected —
  // so this runs after the injection effect's dependency, `customInRegion`.
  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(
      `window.setPlanMarkers(${JSON.stringify(todayStopIds)}); true;`
    );
  }, [ready, todayStopIds, customInRegion]);

  // The button column runs up from the bottom-right, so it has to step over the
  // selected-place card when one is showing.
  const fabLift = selected ? cardHeight + 12 : 0;

  // Everything here is anchored to the bottom, and under edge-to-edge Android
  // the window does not resize for the keyboard — so the search bar has to step
  // over it. The tab bar already occupies part of that height.
  const tabBarHeight = useBottomTabBarHeight();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const keyboardLift = Math.max(0, keyboardHeight - tabBarHeight);
  const searchBottom = searchOpen && keyboardLift > 0 ? keyboardLift + 16 : 68 + fabLift;
  // Results sit directly above the 44px bar.
  const resultsBottom = searchBottom + 50;

  // Read by the ready handler, which fires outside this render's closure.
  const pinnedIdRef = useRef(pinnedId);
  pinnedIdRef.current = pinnedId;

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setVisibleMarker(${pinnedId ?? 'null'}); true;`);
  }, [ready, pinnedId]);

  // Search the map for places to pin, bounded to the region. Debounced for
  // Nominatim's one-request-a-second policy.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(q, region);
        if (mine === seq.current) setHits(found);
      } catch {
        if (mine === seq.current) setHits([]);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [query, region]);

  const focus = (d: Destination) => {
    setSelected(d);
    flyTo(d.longitude, d.latitude, is3D ? SELECTED_ZOOM_3D : SELECTED_ZOOM);
  };

  // A searched place becomes a saved custom place (which the injection effect
  // then pins), and the map flies to it. It is also the one pin on show — any
  // previously searched pin is hidden again.
  const addSearched = async (hit: PlaceHit) => {
    try {
      const place = await addPlace(hit, region);
      setQuery('');
      setHits([]);
      focus(place);
      setPinnedId(place.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't add that place");
    }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setReady(true);
        // A fresh document starts with no pin, so restore the current one
        // straight away — the effect above only fires when `ready` changes.
        webRef.current?.injectJavaScript(
          `window.setVisibleMarker(${pinnedIdRef.current ?? 'null'}); true;`
        );
      } else if (msg.type === '3d') {
        setIs3D(!!msg.on);
      } else if (msg.type === 'select') {
        const d = destinationById(msg.id);
        if (d) focus(d);
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
          {curatedSpots.length + customInRegion.length > 0
            ? ` · ${curatedSpots.length + customInRegion.length} spots`
            : ''}
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

      {/* Search + pin a place. Collapsed it is just an icon in the FAB column,
          so it keeps the map clear; tapping grows it into a full-width bar. */}
      <Animated.View
        style={[
          styles.searchMorph,
          searchStyle,
          { bottom: searchBottom, backgroundColor: colors.surface },
        ]}
      >
        <Pressable
          onPress={() => setSearchOpen(true)}
          disabled={searchOpen}
          accessibilityRole="button"
          accessibilityLabel={`Search a place in ${region.name}`}
          style={styles.searchIconSlot}
        >
          <MaterialIcons
            name="search"
            size={22}
            color={searchOpen ? colors.onSurfaceVariant : colors.primary}
          />
        </Pressable>
        {searchOpen ? (
          <Animated.View style={[styles.searchField, { opacity: searchFieldOpacity }]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search a place in ${region.name}`}
              placeholderTextColor={colors.onSurfaceVariant}
              autoCorrect={false}
              autoFocus
              style={{ flex: 1, color: colors.onSurface, fontSize: 14 }}
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              // With text typed the X clears it; empty, it closes the search.
              <Pressable
                onPress={() => (query.length > 0 ? setQuery('') : closeSearch())}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={query.length > 0 ? 'Clear search' : 'Close search'}
              >
                <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
              </Pressable>
            )}
          </Animated.View>
        ) : null}
      </Animated.View>

      {searchOpen ? (
        <View style={[styles.searchWrap, { bottom: resultsBottom }]} pointerEvents="box-none">
          {hits.length > 0 ? (
            <View style={[styles.searchResults, { backgroundColor: colors.surface }]}>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
                {hits.map((h) => (
                  <Pressable
                    key={`${h.name}-${h.latitude}-${h.longitude}`}
                    onPress={() => addSearched(h)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                    }}
                  >
                    <MaterialIcons name="place" size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.onSurface }}>
                        {h.name}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
                        {h.category} · {h.municipality}
                      </Text>
                    </View>
                    <MaterialIcons name="add-location-alt" size={20} color={colors.primary} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : query.trim().length >= 2 && !searching ? (
            <View style={[styles.searchResults, { backgroundColor: colors.surface }]}>
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, padding: 8 }}>
                Nothing found for “{query.trim()}” in {region.name}.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Reset view button */}
      <Pressable
        style={[styles.resetFab, { bottom: 16 + fabLift, backgroundColor: colors.surface }]}
        onPress={() => {
          setSelected(null);
          setIs3D(false);
          // Reset clears the searched pin too, back to a bare basemap.
          setPinnedId(null);
          webRef.current?.injectJavaScript('window.set3D(false); window.resetView(); true;');
        }}
      >
        <MaterialIcons name="layers" size={24} color={colors.primary} />
      </Pressable>

      {/* 3D toggle: tilts the map, adds terrain relief and building massing.
          Hidden while searching, since the results list sits over it. */}
      {!searchOpen ? (
      <Pressable
        style={[
          styles.threeDFab,
          { bottom: 120 + fabLift, backgroundColor: is3D ? colors.primary : colors.surface },
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
      ) : null}

      {/* Bottom info card */}
      {selected ? (
        <MapDestinationCard
          destination={selected}
          onHeight={setCardHeight}
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
  onHeight,
}: {
  destination: Destination;
  onClose: () => void;
  onViewDetails: () => void;
  onNavigate: () => void;
  /** Reported so the FAB column can sit above the card instead of under it. */
  onHeight: (height: number) => void;
}) {
  const { colors } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const saved = isFavorite(destination.id);
  return (
    <View
      style={[styles.bottomCard, { backgroundColor: colors.surface }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View style={{ flexDirection: 'row', gap: 12, paddingRight: 32 }}>
        {/* Searched places have no photo — an icon tile stands in. */}
        {destination.imageUrl ? (
          <Image source={{ uri: destination.imageUrl }} style={styles.cardThumb} />
        ) : (
          <View
            style={[
              styles.cardThumb,
              { alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.primary, 0.12) },
            ]}
          >
            <MaterialIcons name="place" size={28} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: colors.onSurface }}>
            {destination.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {destination.rating ? (
              <>
                <MaterialIcons name="star" size={14} color="#FFC107" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.onSurface }}>
                  {destination.rating}
                </Text>
                <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>·</Text>
              </>
            ) : null}
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              {destination.category}
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
  // Collapsed it is a 44px circle in the FAB column, directly above the 3D
  // toggle; expanded it spans the width. Same element, animated between.
  searchMorph: {
    position: 'absolute',
    bottom: 68,
    right: 16,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // 11 + the 22px icon + 11 centres the icon exactly when collapsed.
    paddingHorizontal: 11,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIconSlot: { width: 22, alignItems: 'center', justifyContent: 'center' },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Results stack above the expanded bar, which now sits near the bottom.
  searchWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  searchResults: {
    marginTop: 6,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // Button column runs up from the bottom-right: reset, search, 3D.
  resetFab: {
    position: 'absolute',
    bottom: 16,
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
    bottom: 120,
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
