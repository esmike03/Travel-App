// Forecast for every destination, fetched once for the whole app and cached to
// SQLite. Weather is a nice-to-have layer over the trip: it must never block a
// screen or throw, so every failure degrades to "no forecast" (or to the last
// cached one) rather than an error state.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { loadWeatherCache, saveWeatherCache } from '../data/db';
import {
  DayForecast,
  DestinationWeather,
  REGION_POINT_ID,
  WeatherByDestination,
  WeatherPoint,
  fetchWeather,
} from '../data/weather';
import { destinations } from '../data/destinations';
import { useRegionSetting } from './RegionContext';
import { usePlaces } from './PlacesContext';

// The forecast barely moves within an hour, and a traveller on mobile data
// shouldn't pay for more than that.
const STALE_MS = 60 * 60 * 1000;

// One request covers many coordinates, but not unlimited ones — 16 curated spots
// already cost ~18KB, so cap what a long trip can add on top.
const MAX_CUSTOM_POINTS = 40;

interface WeatherContextValue {
  byDestination: WeatherByDestination;
  loading: boolean;
  /** Last successful fetch (epoch ms), from this session or the cache. */
  fetchedAt: number | null;
  /** True when showing cached data after a failed refresh. */
  offline: boolean;
  refresh: () => void;
}

const WeatherContext = createContext<WeatherContextValue | undefined>(undefined);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const { region, isHome } = useRegionSetting();
  const { places: customPlaces } = usePlaces();
  const [byDestination, setByDestination] = useState<WeatherByDestination>({});
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const inFlight = useRef(false);

  // What to forecast: the curated spots at home, every place the traveller added
  // themselves (their stops need a forecast too), and the province centre as a
  // fallback for anything else. Capped so a big trip can't build a huge request.
  const points = useMemo<WeatherPoint[]>(() => {
    const curated = isHome
      ? destinations.map((d) => ({ id: d.id, latitude: d.latitude, longitude: d.longitude }))
      : [];
    const mine = customPlaces
      .slice(0, MAX_CUSTOM_POINTS)
      .map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude }));
    const centre = { id: REGION_POINT_ID, latitude: region.latitude, longitude: region.longitude };
    return [...curated, ...mine, centre];
  }, [isHome, region, customPlaces]);

  const load = useCallback(async (force = false) => {
    if (inFlight.current) return;
    // Skip the network entirely while the current data is still fresh.
    if (!force && fetchedAt != null && Date.now() - fetchedAt < STALE_MS) return;
    inFlight.current = true;
    try {
      const data = await fetchWeather(points);
      const now = Date.now();
      setByDestination(data);
      setFetchedAt(now);
      setOffline(false);
      saveWeatherCache({ fetchedAt: now, payload: JSON.stringify(data) }).catch(() => {});
    } catch {
      // No signal, or the service is down: keep whatever we already have.
      setOffline(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [fetchedAt, points]);

  // Moving the app to another province invalidates the forecast entirely — the
  // cached one describes somewhere else.
  const regionKey = `${region.name}:${isHome}`;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setByDestination({});
    setFetchedAt(null);
    setLoading(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKey]);

  // Paint from cache first so the forecast is there instantly (and offline),
  // then refresh in the background if it has gone stale.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = await loadWeatherCache();
        if (active && cached) {
          setByDestination(JSON.parse(cached.payload));
          setFetchedAt(cached.fetchedAt);
          setLoading(false);
        }
      } catch {
        // Unreadable cache is not worth surfacing — just fetch fresh.
      }
      if (active) load();
    })();
    return () => {
      active = false;
    };
    // Deliberately once on mount: `load` re-checks staleness itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back to the app after a while should show today's weather, not
  // yesterday's.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const value = useMemo<WeatherContextValue>(
    () => ({ byDestination, loading, fetchedAt, offline, refresh: () => load(true) }),
    [byDestination, loading, fetchedAt, offline, load]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used within WeatherProvider');
  return ctx;
}

/**
 * The forecast for one destination. Falls back to the province's own forecast
 * when the app is pointed away from home, where no per-spot forecast exists —
 * a province-wide reading is still true, just less precise.
 */
export function useDestinationWeather(destinationId: number): DestinationWeather | null {
  const { byDestination } = useWeather();
  return byDestination[destinationId] ?? byDestination[REGION_POINT_ID] ?? null;
}

/**
 * The forecast for a destination on a given date. Null when that date is outside
 * Open-Meteo's 16-day horizon — a trip planned for next month has no forecast,
 * and saying so is better than showing today's weather as if it were then.
 */
export function useForecastFor(destinationId: number, date: string): DayForecast | null {
  const { byDestination } = useWeather();
  const daily = (byDestination[destinationId] ?? byDestination[REGION_POINT_ID])?.daily;
  return daily?.find((d) => d.date === date) ?? null;
}
