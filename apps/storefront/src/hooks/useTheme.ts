import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'minieshop_theme';

const listeners = new Set<() => void>();

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function readStoredThemePreference(): ThemePreference {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(stored)) {
        return stored;
      }
    }
  } catch {
    // Ignore storage access errors (private browsing / sandboxed contexts)
  }
  return 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }
}

let currentPreference: ThemePreference = readStoredThemePreference();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string {
  return `${currentPreference}:${resolveTheme(currentPreference)}`;
}

function getServerSnapshot(): string {
  return 'system:light';
}

export function setThemePreference(next: ThemePreference): void {
  currentPreference = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (next === 'system') {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    }
  } catch {
    // Ignore storage write errors
  }
  applyResolvedTheme(resolveTheme(next));
  notifyListeners();
}

/**
 * Resets in-memory theme state from storage (intended for test isolation).
 */
export function syncThemeFromStorage(): void {
  currentPreference = readStoredThemePreference();
  applyResolvedTheme(resolveTheme(currentPreference));
  notifyListeners();
}

/**
 * Reactive storefront theme hook supporting `system | light | dark`,
 * syncing `document.documentElement.dataset.theme`, `localStorage`, and
 * live `prefers-color-scheme` OS changes when in `system` mode.
 */
export function useTheme() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [preference, resolvedTheme] = snapshot.split(':') as [
    ThemePreference,
    ResolvedTheme,
  ];

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (
      preference !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      if (currentPreference !== 'system') {
        return;
      }
      applyResolvedTheme(resolveTheme('system'));
      notifyListeners();
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference): void => {
    setThemePreference(next);
  }, []);

  const cycleTheme = useCallback((): void => {
    const order: readonly ThemePreference[] = ['system', 'light', 'dark'];
    const nextIndex = (order.indexOf(currentPreference) + 1) % order.length;
    setThemePreference(order[nextIndex] ?? 'system');
  }, []);

  return {
    preference,
    resolvedTheme,
    setTheme,
    cycleTheme,
  };
}
