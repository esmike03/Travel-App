// Ported from location/UserLocationProvider.kt using expo-location.
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

interface UserLocationState {
  hasPermission: boolean;
  location: Coords | null;
  /** Asks for permission and returns the fix, so a caller can act on it at once
   *  rather than waiting for `location` to arrive on a later render. */
  request: () => Promise<Coords | null>;
}

export function useUserLocation(autoFetch = true): UserLocationState {
  const [hasPermission, setHasPermission] = useState(false);
  const [location, setLocation] = useState<Coords | null>(null);

  const fetchLocation = useCallback(async (): Promise<Coords | null> => {
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setLocation(coords);
      return coords;
    } catch {
      // Location may be momentarily unavailable; leave as null.
      return null;
    }
  }, []);

  const request = useCallback(async (): Promise<Coords | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted ? fetchLocation() : null;
  }, [fetchLocation]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      const granted = status === 'granted';
      setHasPermission(granted);
      if (granted && autoFetch) await fetchLocation();
    })();
    return () => {
      active = false;
    };
  }, [autoFetch, fetchLocation]);

  return { hasPermission, location, request };
}
