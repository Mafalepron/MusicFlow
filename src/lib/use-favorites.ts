'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * Favorites / quick-access hook.
 *
 * Favorites are stored in localStorage under `soundflow-quick-access` as a
 * string array of project IDs. This is the same store the quick-access panel
 * in the header reads from, so starring a project on a card instantly adds it
 * to the quick-access carousel (on next open of the panel / next mount of the
 * home view).
 *
 * Max 7 favorites (matches the quick-access panel limit).
 */
const STORAGE_KEY = 'soundflow-quick-access';
const MAX_FAVORITES = 7;

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Read from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      }
      // Adding — silently enforce the max limit (no toast here; the header
      // panel handles the warning UX when the user opens it).
      if (prev.length >= MAX_FAVORITES) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite, MAX_FAVORITES };
}
