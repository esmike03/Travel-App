// Continuous, high-accuracy location tracking for the turn-by-turn navigation
// screen. Unlike useUserLocation (a one-shot fix), this streams updates as the
// user moves so the map can follow them and recompute the route/ETA live.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export interface LiveFix {
  latitude: number;
  longitude: number;
  heading: number | null; // degrees, 0 = north; null when unknown
  speed: number | null; // m/s
  accuracy: number | null; // meters
}

interface LiveLocationState {
  hasPermission: boolean;
  fix: LiveFix | null;
  error: string | null;
  request: () => Promise<void>;
}

// `active` gates the watcher so tracking only runs while the nav screen is open.
export function useLiveLocation(active: boolean): LiveLocationState {
  const [hasPermission, setHasPermission] = useState(false);
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      if (!granted) {
        setError('Location permission is needed to navigate.');
        return;
      }
      setError(null);
      stop();
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5, // meters
          timeInterval: 2000, // ms
        },
        (loc) => {
          setFix({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading ?? null,
            speed: loc.coords.speed ?? null,
            accuracy: loc.coords.accuracy ?? null,
          });
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start location tracking.');
    }
  }, [stop]);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    let cancelled = false;
    (async () => {
      if (!cancelled) await start();
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, start, stop]);

  return { hasPermission, fix, error, request: start };
}
