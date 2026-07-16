// Places the traveller added themselves. Trip stops reference them by id just
// like curated destinations, so these must be persisted and loaded before any
// stop that points at one can render.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CustomPlaceRow, loadCustomPlaces, upsertCustomPlace } from '../data/db';
import { Destination, setCustomPlaces } from '../data/destinations';
import { PlaceHit, nextCustomId, placeToDestination } from '../data/places';
import { Region } from '../data/region';

interface PlacesContextValue {
  /** Every place the traveller has added, across all regions. */
  places: Destination[];
  /** True until the stored places are in memory — stops can't resolve before. */
  ready: boolean;
  /** Save a searched place and return it as a usable Destination. */
  addPlace: (hit: PlaceHit, region: Region) => Promise<Destination>;
}

const PlacesContext = createContext<PlacesContextValue | undefined>(undefined);

function toRow(d: Destination): CustomPlaceRow {
  return {
    id: d.id,
    name: d.name,
    municipality: d.municipality,
    location: d.location,
    category: d.category,
    latitude: d.latitude,
    longitude: d.longitude,
    sourceUrl: d.sourceUrl || null,
  };
}

function fromRow(r: CustomPlaceRow): Destination {
  return {
    id: r.id,
    name: r.name,
    municipality: r.municipality,
    location: r.location,
    category: r.category,
    imageUrl: '', // searched places have no photo
    rating: '',
    latitude: r.latitude,
    longitude: r.longitude,
    shortDescription: '',
    bestTimeToVisit: '',
    sourceUrl: r.sourceUrl ?? '',
  };
}

export function PlacesProvider({ children }: { children: React.ReactNode }) {
  const [places, setPlaces] = useState<Destination[]>([]);
  const [ready, setReady] = useState(false);

  // Keep the module registry in step, so destinationById resolves custom stops
  // for pure helpers (route maths, share totals) as well as components.
  const publish = useCallback((next: Destination[]) => {
    setCustomPlaces(next);
    setPlaces(next);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await loadCustomPlaces();
        if (active) publish(rows.map(fromRow));
      } catch {
        // No custom places is a valid state — the curated set still works.
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [publish]);

  const addPlace = useCallback(
    async (hit: PlaceHit, region: Region): Promise<Destination> => {
      // The same place searched twice should be one place, not a duplicate
      // stop-able entry: match on name + rounded position (~11m).
      const existing = places.find(
        (p) =>
          p.name === hit.name &&
          p.latitude.toFixed(4) === hit.latitude.toFixed(4) &&
          p.longitude.toFixed(4) === hit.longitude.toFixed(4)
      );
      if (existing) return existing;

      const place = placeToDestination(hit, nextCustomId(places), region);
      const next = [...places, place];
      publish(next);
      // Persist before the caller builds a stop on top of it; if this throws the
      // place still works this session, and the stop would dangle on restart.
      await upsertCustomPlace(toRow(place)).catch(() => {});
      return place;
    },
    [places, publish]
  );

  const value = useMemo<PlacesContextValue>(
    () => ({ places, ready, addPlace }),
    [places, ready, addPlace]
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces(): PlacesContextValue {
  const ctx = useContext(PlacesContext);
  if (!ctx) throw new Error('usePlaces must be used within PlacesProvider');
  return ctx;
}
