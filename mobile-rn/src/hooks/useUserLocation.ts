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
  request: () => Promise<void>;
}

export function useUserLocation(autoFetch = true): UserLocationState {
  const [hasPermission, setHasPermission] = useState(false);
  const [location, setLocation] = useState<Coords | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch {
      // Location may be momentarily unavailable; leave as null.
    }
  }, []);

  const request = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    if (granted) await fetchLocation();
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
