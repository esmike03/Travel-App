// Ported from ui/navigation/TravsApp.kt.
// Session gating (auth stack vs main tabs) + a stack that hosts the tabs and the
// pushed destination-detail screen.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useTrips } from '../context/TripsContext';
import { todayIso } from '../utils/planDates';

import { LoginScreen, RegisterScreen } from '../screens/auth/AuthScreens';
import NicknameScreen from '../screens/onboarding/NicknameScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import MapScreen from '../screens/MapScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DestinationDetailScreen from '../screens/DestinationDetailScreen';
import NavigationScreen from '../screens/NavigationScreen';

// Keep the full account flow compiled and ready to restore later. For now,
// first-time users only create a local nickname profile.
const ACCOUNT_AUTH_ENABLED = false;

/* ---------------- Auth stack ---------------- */

type AuthStackParams = {
  Login: undefined;
  Register: undefined;
};
const AuthStack = createNativeStackNavigator<AuthStackParams>();

function AuthNavigator() {
  const { colors } = useTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Theme the screen container so the slide animation doesn't flash white.
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AuthStack.Screen name="Login">
        {({ navigation }: NativeStackScreenProps<AuthStackParams, 'Login'>) => (
          <LoginScreen onNavigateToRegister={() => navigation.navigate('Register')} />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation }: NativeStackScreenProps<AuthStackParams, 'Register'>) => (
          <RegisterScreen onNavigateToLogin={() => navigation.goBack()} />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

/* ---------------- Main tabs ---------------- */

export type MainTabsParams = {
  Discover: undefined;
  Map: undefined;
  Itinerary: undefined;
  Favorites: undefined;
  Profile: undefined;
};
const Tabs = createBottomTabNavigator<MainTabsParams>();

const TAB_ICONS: Record<keyof MainTabsParams, keyof typeof MaterialIcons.glyphMap> = {
  Discover: 'explore',
  Map: 'map',
  Itinerary: 'route',
  Favorites: 'bookmark',
  Profile: 'person',
};
const TAB_LABELS: Record<keyof MainTabsParams, string> = {
  Discover: 'Explore',
  Map: 'Map',
  Itinerary: 'Trips',
  Favorites: 'Saved',
  Profile: 'Me',
};

/* ---------------- Tab bar ---------------- */

// A floating pill with the Trips button cradled in a notch cut out of its top
// edge. The notch is a real hole in the bar's shape, not a ring drawn over it,
// so the gap around the circle shows the page behind rather than a painted
// approximation of it — which is what lets the bar float clear of the edges.
const BAR_MARGIN = 16;
const BAR_HEIGHT = 64;
const BAR_RADIUS = 28;

// The notch is a raised cosine rather than a circular arc: it comes to zero
// *horizontally* at both ends, so it meets the bar's flat top edge with no seam
// and no corner needing a fillet. An arc would join at a visible angle.
const FAB_SIZE = 52;
// Centre of the circle relative to the bar's top edge — negative is above it.
const FAB_CENTER_Y = -2;

// The notch is a circle CONCENTRIC with the button, one gap-width larger. That
// is what makes the cradle follow the button's own roundness: the two share a
// centre, so the space between them is the same NOTCH_GAP at every angle,
// rather than a curve that merely resembles it and drifts at the edges.
const NOTCH_GAP = 8;
const NOTCH_RADIUS = FAB_SIZE / 2 + NOTCH_GAP;
// How far around the button the cradle wraps. Past ~75° the wall is steeper
// than vertical and starts to undercut, which reads as a bite, not a cradle.
const NOTCH_SWEEP = (70 * Math.PI) / 180;
// A circular arc cannot meet the bar's flat edge tangentially — only its very
// top could, and that has no depth — so each end gets a shoulder that curves
// from horizontal into the arc's own direction.
const NOTCH_SHOULDER = 16;
const NOTCH_DEPTH = FAB_CENTER_Y + NOTCH_RADIUS;

// Clearance the container needs above the bar for the circle to sit in.
const FAB_TOP_SPACE = 34;
const FAB_TOP = FAB_TOP_SPACE + FAB_CENTER_Y - FAB_SIZE / 2;

const CENTER_ROUTE: keyof MainTabsParams = 'Itinerary';

/** The bar's outline: a rounded pill with the notch taken out of its top. */
function barPath(width: number, height: number): string {
  const r = BAR_RADIUS;
  const cx = width / 2;
  const steps = 30;

  // Where the arc stops and each shoulder takes over. Angles run from the
  // bottom of the circle, so +/-NOTCH_SWEEP are the two ends of the cradle.
  const endX = NOTCH_RADIUS * Math.sin(NOTCH_SWEEP);
  const endY = FAB_CENTER_Y + NOTCH_RADIUS * Math.cos(NOTCH_SWEEP);
  // The arc's own direction where the shoulder meets it, travelling rightward:
  // into the notch on the left, back out of it on the right.
  const tx = Math.cos(NOTCH_SWEEP);
  const ty = Math.sin(NOTCH_SWEEP);
  // Kept short enough that the handle never lifts the curve above the bar's
  // top edge, which the viewBox would clip.
  const grip = Math.min(NOTCH_SHOULDER * 0.7, endY / ty);

  const pt = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;

  let d = `M${r},0L${pt(cx - endX - NOTCH_SHOULDER, 0)}`;
  // Shoulder down into the cradle.
  d += `C${pt(cx - endX - NOTCH_SHOULDER + grip, 0)} ${pt(
    cx - endX - tx * grip,
    endY - ty * grip
  )} ${pt(cx - endX, endY)}`;
  // The cradle itself — sampled rather than an SVG arc command, so there is no
  // large-arc/sweep flag to get backwards.
  for (let i = 1; i <= steps; i += 1) {
    const a = -NOTCH_SWEEP + (2 * NOTCH_SWEEP * i) / steps;
    d += `L${pt(cx + NOTCH_RADIUS * Math.sin(a), FAB_CENTER_Y + NOTCH_RADIUS * Math.cos(a))}`;
  }
  // Shoulder back up to the flat edge.
  d += `C${pt(cx + endX + tx * grip, endY - ty * grip)} ${pt(
    cx + endX + NOTCH_SHOULDER - grip,
    0
  )} ${pt(cx + endX + NOTCH_SHOULDER, 0)}`;
  d += `L${(width - r).toFixed(2)},0`;
  d += `A${r},${r} 0 0 1 ${width},${r}`;
  d += `L${width},${height - r}`;
  d += `A${r},${r} 0 0 1 ${width - r},${height}`;
  d += `L${r},${height}`;
  d += `A${r},${r} 0 0 1 0,${height - r}`;
  d += `L0,${r}`;
  d += `A${r},${r} 0 0 1 ${r},0`;
  return `${d}Z`;
}

function MainTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  // Float clear of the gesture bar, and off the screen edge on button-nav
  // devices that report no bottom inset at all.
  const bottomGap = Math.max(insets.bottom, 12);
  const barWidth = screenW - BAR_MARGIN * 2;
  const d = barPath(barWidth, BAR_HEIGHT);

  const press = (route: BottomTabBarProps['state']['routes'][number], focused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
  };

  const centerIndex = state.routes.findIndex((r) => r.name === CENTER_ROUTE);
  const centerRoute = centerIndex >= 0 ? state.routes[centerIndex] : undefined;
  const centerFocused = state.index === centerIndex;
  const badge = centerRoute ? descriptors[centerRoute.key].options.tabBarBadge : undefined;

  return (
    <View
      pointerEvents="box-none"
      style={{ height: FAB_TOP_SPACE + BAR_HEIGHT + bottomGap }}
    >
      <View
        pointerEvents="none"
        style={[styles.barShape, { bottom: bottomGap, left: BAR_MARGIN }]}
      >
        <Svg width={barWidth} height={BAR_HEIGHT}>
          <Path
            d={d}
            fill={colors.surface}
            // A hairline instead of a shadow: an elevation shadow is cast from
            // the view's rectangular outline, which would print a rectangle
            // behind a notched pill.
            stroke={withAlpha(colors.outlineVariant, 0.55)}
            strokeWidth={1}
          />
        </Svg>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.row,
          { bottom: bottomGap, left: BAR_MARGIN, right: BAR_MARGIN, height: BAR_HEIGHT },
        ]}
      >
        {state.routes.map((route, index) => {
          const name = route.name as keyof MainTabsParams;
          // The centre button is placed over the notch further down; this only
          // holds its slot so the other four stay evenly spaced around it.
          if (name === CENTER_ROUTE) return <View key={route.key} style={styles.slot} />;
          const focused = state.index === index;
          const color = focused ? colors.primary : colors.onSurfaceVariant;
          return (
            <Pressable
              key={route.key}
              onPress={() => press(route, focused)}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={TAB_LABELS[name]}
              style={styles.slot}
            >
              <MaterialIcons name={TAB_ICONS[name]} size={22} color={color} />
              <Text
                style={[styles.label, { color, fontWeight: focused ? '800' : '600' }]}
              >
                {TAB_LABELS[name]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {centerRoute ? (
        <View pointerEvents="box-none" style={[styles.centerWrap, { top: FAB_TOP }]}>
          <Pressable
            onPress={() => press(centerRoute, centerFocused)}
            accessibilityRole="button"
            accessibilityState={{ selected: centerFocused }}
            accessibilityLabel={TAB_LABELS[CENTER_ROUTE]}
          >
            <View
              style={[
                styles.fab,
                {
                  backgroundColor: centerFocused ? colors.primary : colors.surface,
                  borderColor: withAlpha(colors.outlineVariant, 0.55),
                },
              ]}
            >
              <MaterialIcons
                name={TAB_ICONS[CENTER_ROUTE]}
                size={25}
                color={centerFocused ? colors.onPrimary : colors.primary}
              />
            </View>
            {badge != null && badge !== '' ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.secondary, borderColor: colors.background },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.onSecondary }]}>{badge}</Text>
              </View>
            ) : null}
            {/* Named like every other tab. The margin clears the notch: the
                label belongs on the bar below the scoop, not floating in it. */}
            <Text
              style={[
                styles.label,
                styles.centerLabel,
                {
                  color: centerFocused ? colors.primary : colors.onSurfaceVariant,
                  fontWeight: centerFocused ? '800' : '600',
                },
              ]}
            >
              {TAB_LABELS[CENTER_ROUTE]}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { stops } = useTrips();
  const insets = useSafeAreaInsets();
  const today = todayIso();
  const todayStopCount = stops.filter((stop) => stop.date === today).length;
  return (
    <Tabs.Navigator
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // A straight cross-fade rather than 'shift': shifting slides the whole
        // scene sideways, which reads as a jump on the heavier tabs (the map
        // carries a WebView). Fading has nothing to keep up with.
        animation: 'fade',
        // Pause offscreen tabs so they don't do work behind the active one.
        freezeOnBlur: true,
        // Reserve the status-bar height so each screen's heading clears it.
        sceneStyle: { paddingTop: insets.top, backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="Discover">
        {({ navigation }: BottomTabScreenProps<MainTabsParams, 'Discover'>) => (
          <DiscoverScreen
            onDestinationClick={(id) =>
              navigation.getParent()?.navigate('Detail', { destinationId: id })
            }
            onOpenTrips={() => navigation.navigate('Itinerary')}
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen name="Map">
        {({ navigation }: BottomTabScreenProps<MainTabsParams, 'Map'>) => (
          <MapScreen
            onDestinationClick={(id) =>
              navigation.getParent()?.navigate('Detail', { destinationId: id })
            }
            onNavigate={(id) =>
              navigation.getParent()?.navigate('Navigate', { destinationId: id })
            }
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen
        name="Itinerary"
        component={ItineraryScreen}
        options={{
          tabBarBadge:
            todayStopCount > 0 ? (todayStopCount > 9 ? '9+' : todayStopCount) : undefined,
        }}
      />
      <Tabs.Screen name="Favorites">
        {({ navigation }: BottomTabScreenProps<MainTabsParams, 'Favorites'>) => (
          <FavoritesScreen
            onDestinationClick={(id) =>
              navigation.getParent()?.navigate('Detail', { destinationId: id })
            }
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

/* ---------------- Root stack (tabs + detail) ---------------- */

export type RootStackParams = {
  Tabs: undefined;
  Detail: { destinationId: number };
  Navigate: { destinationId: number };
};
const RootStack = createNativeStackNavigator<RootStackParams>();

function MainNavigator() {
  const { colors } = useTheme();
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        freezeOnBlur: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <RootStack.Screen name="Tabs" component={MainTabs} />
      <RootStack.Screen name="Detail">
        {({ route, navigation }: NativeStackScreenProps<RootStackParams, 'Detail'>) => (
          <DestinationDetailScreen
            destinationId={route.params.destinationId}
            onBack={() => navigation.goBack()}
            onNavigate={() =>
              navigation.navigate('Navigate', { destinationId: route.params.destinationId })
            }
          />
        )}
      </RootStack.Screen>
      <RootStack.Screen name="Navigate">
        {({ route, navigation }: NativeStackScreenProps<RootStackParams, 'Navigate'>) => (
          <NavigationScreen
            destinationId={route.params.destinationId}
            onBack={() => navigation.goBack()}
          />
        )}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

/* ---------------- Root ---------------- */

export default function RootNavigator() {
  const { colors, isDark } = useTheme();
  const { session, ready } = useAuth();

  const navTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.onSurface,
      border: colors.outlineVariant,
    },
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session && !ACCOUNT_AUTH_ENABLED) {
    return <NicknameScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  barShape: {
    position: 'absolute',
  },
  row: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { fontSize: 10 },
  // Spans the full width so the circle centres on the notch, and starts at the
  // container's own top so the circle stays inside its parent's bounds — a
  // child overflowing its parent receives no touches on Android.
  centerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Clears NOTCH_DEPTH measured from the circle's bottom edge, so the label
  // lands on solid bar rather than in the hole above it.
  centerLabel: {
    marginTop: NOTCH_DEPTH - (FAB_CENTER_Y + FAB_SIZE / 2) + 4,
    textAlign: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // The circle is a plain rounded View, so an elevation shadow follows its
    // real shape here — unlike the SVG bar behind it.
    shadowColor: '#082521',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '900' },
});
