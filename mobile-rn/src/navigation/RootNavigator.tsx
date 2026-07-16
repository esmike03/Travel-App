// Ported from ui/navigation/TravsApp.kt.
// Session gating (auth stack vs main tabs) + a stack that hosts the tabs and the
// pushed destination-detail screen.
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
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
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';

import { LoginScreen, RegisterScreen } from '../screens/auth/AuthScreens';
import DiscoverScreen from '../screens/DiscoverScreen';
import MapScreen from '../screens/MapScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DestinationDetailScreen from '../screens/DestinationDetailScreen';
import NavigationScreen from '../screens/NavigationScreen';

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

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // At least 16px below the labels so the bar has margin from the screen edge.
  const tabBarBottom = Math.max(insets.bottom, 16);
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Smooth cross-fade + slide when switching tabs (default is an instant cut).
        animation: 'shift',
        // Pause offscreen tabs so they don't do work behind the active one.
        freezeOnBlur: true,
        // Reserve the status-bar height so each screen's heading clears it.
        sceneStyle: { paddingTop: insets.top, backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
          // Guarantee breathing room below the labels even when the device
          // reports no bottom inset (button-nav), so the bar isn't glued to the edge.
          height: 64 + tabBarBottom,
          paddingTop: 10,
          paddingBottom: tabBarBottom,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 11, marginTop: 3 },
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: ({ color }: { color: string }) => (
          <MaterialIcons name={TAB_ICONS[route.name]} size={22} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="Discover">
        {({ navigation }: BottomTabScreenProps<MainTabsParams, 'Discover'>) => (
          <DiscoverScreen
            onDestinationClick={(id) =>
              navigation.getParent()?.navigate('Detail', { destinationId: id })
            }
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
      <Tabs.Screen name="Itinerary" component={ItineraryScreen} />
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

  return (
    <NavigationContainer theme={navTheme}>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
