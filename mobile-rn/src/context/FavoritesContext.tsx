// Ported from FavoritesStore (ui/screens/Screens.kt).
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

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

  const toggle = useCallback((id: number) => {
    let nowSaved = false;
    setIds((prev) => {
      if (prev.includes(id)) {
        nowSaved = false;
        return prev.filter((x) => x !== id);
      }
      nowSaved = true;
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
