# Travs — Bohol Travel Companion (React Native)

Expo (managed) + TypeScript port of the original Jetpack Compose Android app in
`../mobile`. This version runs on Android and iOS from one codebase.

## Requirements

- Node 18+
- The Expo Go app on your phone (quickest), or an Android emulator / iOS simulator

## Run

```bash
cd mobile-rn
npm install
npm start          # then scan the QR with Expo Go, or press a / i
```

- `npm run android` — open on a connected device / emulator
- `npm run ios` — open in the iOS simulator (macOS)
- `npm run typecheck` — `tsc --noEmit`

> The interactive map (`react-native-maps`) needs a real device or emulator; it
> does not render on `expo start --web`.

## Dependency security

The `postcss` and `uuid` entries under `overrides` in `package.json` patch
vulnerable transitive build-tool dependencies while the app remains on Expo SDK
54. Keep these overrides until a later Expo SDK provides patched versions. After
changing dependencies, verify the dependency graph with:

```bash
npm audit
npx expo-doctor
```

Do not use `npm audit fix --force` for this project: npm may replace Expo with an
incompatible SDK version. Upgrade Expo and its SDK-managed packages together.

## What was ported

Feature parity with the current app, which renders from a **static, in-memory
list of Bohol destinations** (`src/data/destinations.ts`, ported verbatim from
`previewDestinations`):

| Area | Original (Compose) | This port |
| --- | --- | --- |
| Navigation | Navigation-Compose (auth vs main + detail) | React Navigation (native-stack + bottom-tabs) |
| Theming | Material 3 light/dark + `ThemePreference` | `ThemeContext` + `AsyncStorage`, same palette |
| Discover | `DiscoverScreen` | `screens/DiscoverScreen.tsx` |
| Map | osmdroid MAPNIK | `react-native-maps` + OpenStreetMap `UrlTile` |
| Trips | `ItineraryScreen` + picker + editor | `screens/ItineraryScreen.tsx` |
| Favorites / Profile | `FavoritesStore` / `ProfileScreen` | `FavoritesContext` / `ProfileScreen.tsx` |
| Detail | `DestinationDetailScreen` | `screens/DestinationDetailScreen.tsx` |
| Location / ETA | `UserLocationProvider` | `expo-location` (`hooks/useUserLocation.ts`) |
| Auth | Laravel REST via Retrofit | local/offline auth (see below) |

## Intentional adaptations

- **Auth is local/offline.** The original authenticates against a Laravel API.
  This standalone port keeps the same validation and session persistence but
  resolves auth locally so the app is runnable without a backend. Any well-formed
  credentials sign you in. To wire a real API, replace the bodies of
  `login`/`register` in `src/context/AuthContext.tsx` with `fetch` calls.
- **Trip reordering** uses up/down controls instead of long-press drag, so it
  runs in Expo Go without the reanimated/gesture drag stack. Same underlying
  `move(from, to)` logic.
- The layer of the original that was scaffold-only and unused by the UI (Room
  DB, Retrofit sync, WorkManager, geofencing) was **not** ported, matching what
  the current app actually exercises.

## Structure

```
App.tsx                     Providers + navigation root
src/
  data/destinations.ts      The 16 Bohol destinations + distance helper
  theme/                    colors.ts, ThemeContext.tsx
  context/                  Auth, Favorites, Trips
  hooks/useUserLocation.ts  expo-location wrapper
  components/common.tsx     RatingPill, StarRow, external-intent helpers
  screens/                  auth/, Discover, Map, Itinerary, Favorites, Profile, DestinationDetail
  navigation/RootNavigator.tsx
```
