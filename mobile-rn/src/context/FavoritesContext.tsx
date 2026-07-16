// Ported from FavoritesStore (ui/screens/Screens.kt), now persisted to SQLite
// via ../data/db so saved places survive app restarts.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadFavorites, addFavorite, removeFavorite } from '../data/db';

interface FavoritesContextValue {
  ids: number[];
  isFavorite: (id: number) => boolean;
  toggle: (id: number) => boolean; // returns the new saved state
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(
  undefined
);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<number[]>([]);

  // Hydrate saved places from SQLite on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await loadFavorites();
        if (active) setIds(saved);
      } catch {
        // DB unavailable — continue in-memory only.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback((id: number) => {
    let nowSaved = false;
    setIds((prev) => {
      if (prev.includes(id)) {
        nowSaved = false;
        removeFavorite(id).catch(() => {});
        return prev.filter((x) => x !== id);
      }
      nowSaved = true;
      addFavorite(id).catch(() => {});
      return [...prev, id];
    });
    return nowSaved;
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      isFavorite: (id: number) => ids.includes(id),
      toggle,
    }),
    [ids, toggle]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
