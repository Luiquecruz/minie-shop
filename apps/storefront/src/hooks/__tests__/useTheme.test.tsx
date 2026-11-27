import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar';
import { ProductRepositoryProvider } from '../../context/ProductRepositoryProvider';
import { I18nProvider } from '../../i18n';
import { MockProductRepository } from '../../infrastructure/repositories/MockProductRepository';
import { createAppStore } from '../../store';
import {
  syncThemeFromStorage,
  THEME_STORAGE_KEY,
  useTheme,
} from '../useTheme';

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return {
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

describe('useTheme & Navbar System / Light / Dark toggle', () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    delete document.documentElement.dataset.theme;
    syncThemeFromStorage();
  });

  it('follows OS prefers-color-scheme in system mode and reacts to live OS changes', () => {
    const media = mockMatchMedia(false);
    try {
      syncThemeFromStorage();
      const { result } = renderHook(() => useTheme());

      expect(result.current.preference).toBe('system');
      expect(result.current.resolvedTheme).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');

      act(() => {
        media.setMatches(true);
      });

      expect(result.current.resolvedTheme).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    } finally {
      media.restore();
    }
  });

  it('persists explicit light/dark choices and removes storage key when switching back to system', () => {
    const media = mockMatchMedia(true);
    try {
      syncThemeFromStorage();
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');

      act(() => {
        result.current.setTheme('dark');
      });
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');

      act(() => {
        result.current.setTheme('system');
      });
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement.dataset.theme).toBe('dark');
    } finally {
      media.restore();
    }
  });

  it('renders accessible System / Light / Dark controls in Navbar and updates data-theme', async () => {
    const media = mockMatchMedia(false);
    try {
      syncThemeFromStorage();
      const user = userEvent.setup();
      const repository = new MockProductRepository();
      const queryClient = new QueryClient();
      const store = createAppStore();

      render(
        <I18nProvider initialLocale="en">
          <ProductRepositoryProvider repository={repository}>
            <QueryClientProvider client={queryClient}>
              <Provider store={store}>
                <MemoryRouter>
                  <Navbar />
                </MemoryRouter>
              </Provider>
            </QueryClientProvider>
          </ProductRepositoryProvider>
        </I18nProvider>,
      );

      const darkBtn = screen.getByRole('button', { name: 'Dark' });
      const lightBtn = screen.getByRole('button', { name: 'Light' });
      const systemBtn = screen.getByRole('button', { name: 'System' });

      expect(systemBtn).toHaveAttribute('aria-pressed', 'true');
      expect(document.documentElement.dataset.theme).toBe('light');

      await user.click(darkBtn);
      expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
      expect(document.documentElement.dataset.theme).toBe('dark');

      await user.click(lightBtn);
      expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
      expect(document.documentElement.dataset.theme).toBe('light');
    } finally {
      media.restore();
    }
  });
});
