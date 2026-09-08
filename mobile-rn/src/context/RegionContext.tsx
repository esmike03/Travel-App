// The province the app is pointed at, and the setting that controls it.
//
// Off (the default) means Bohol: the curated experience the app was built for,
// with no network call needed to know where it is. On means "follow me" — the
// traveller's own province, resolved from GPS or picked by hand, so weather,
// the map and their plans work wherever they are.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadSetting, saveSetting } from '../data/db';
import { BOHOL_REGION, Region, isBohol, provinceAt, withPolygon } from '../data/region';
import { useUserLocation } from '../hooks/useUserLocation';

const SETTING_KEY = 'region';

interface StoredRegion {
  enabled: boolean;
  region: Region | null; // null = follow GPS, resolved on demand
}

interface RegionContextValue {
  /** The province in play. Bohol whenever the setting is off. */
  region: Region;
  /** Whether the app is following a location other than its home province. */
  enabled: boolean;
  /** True while a province is being resolved from GPS. */
  locating: boolean;
  error: string | null;
  /** True when `region` is the curated home province. */
  isHome: boolean;
  /** Turn the setting off and go back to Bohol. */
  useBohol: () => void;
  /** Resolve the province from the device's location. */
  useMyLocation: () => Promise<void>;
  /** Point the app at a province chosen by hand. */
  useRegion: (region: Region) => void;
}

const RegionContext = createContext<RegionContextValue | undefined>(undefined);

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const { location, request } = useUserLocation();
  const [enabled, setEnabled] = useState(false);
  const [region, setRegion] = useState<Region>(BOHOL_REGION);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the choice. Bohol needs no network, so the app always starts usable.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await loadSetting(SETTING_KEY);
        if (!raw || !active) return;
        const stored: StoredRegion = JSON.parse(raw);
        const savedRegion = stored.region;
        if (stored.enabled && savedRegion) {
          setEnabled(true);
          setRegion(savedRegion);
          // A region saved before outlines existed has no polygon; backfill it
          // so the map framing and the share-card silhouette are correct.
          if (!savedRegion.polygon) {
            const filled = await withPolygon(savedRegion).catch(() => savedRegion);
            if (active && filled.polygon) {
              setRegion(filled);
              saveSetting(SETTING_KEY, JSON.stringify({ enabled: true, region: filled })).catch(() => {});
            }
          }
        }
      } catch {
        // Unreadable setting just means "stay home".
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: StoredRegion) => {
    saveSetting(SETTING_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const useBohol = useCallback(() => {
    setEnabled(false);
    setRegion(BOHOL_REGION);
    setError(null);
    persist({ enabled: false, region: null });
  }, [persist]);

  const useRegion = useCallback(
    (next: Region) => {
      setEnabled(true);
      setRegion(next);
      setError(null);
      persist({ enabled: true, region: next });
      // The pickers usually supply a polygon, but a GPS fallback might not;
      // fetch it in the background so the silhouette isn't left as Bohol.
      if (!next.polygon) {
        withPolygon(next)
          .then((filled) => {
            if (filled.polygon) {
              setRegion((cur) => (cur.name === filled.name ? filled : cur));
              persist({ enabled: true, region: filled });
            }
          })
          .catch(() => {});
      }
    },
    [persist]
  );

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      // The fix may not have arrived yet on first use.
      const fix = location ?? (await request());
      if (!fix) {
        setError('Turn on location to find your province.');
        return;
      }
      const found = await provinceAt(fix);
      if (!found) {
        setError("Couldn't work out which province you're in.");
        return;
      }
      useRegion(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find your province.');
    } finally {
      setLocating(false);
    }
  }, [location, request, useRegion]);

  const value = useMemo<RegionContextValue>(
    () => ({
      region,
      enabled,
      locating,
      error,
      isHome: isBohol(region),
      useBohol,
      useMyLocation,
      useRegion,
    }),
    [region, enabled, locating, error, useBohol, useMyLocation, useRegion]
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegionSetting(): RegionContextValue {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error('useRegionSetting must be used within RegionProvider');
  return ctx;
}
