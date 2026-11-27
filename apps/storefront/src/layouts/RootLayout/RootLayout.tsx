import { lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import Navbar from '../../components/Navbar/Navbar';
import MiniCart from '../../components/MiniCart/MiniCart';
import { useI18n } from '../../i18n';

const CURRENT_YEAR = new Date().getFullYear();

const DevChaosFab = import.meta.env.DEV
  ? lazy(() => import('../../components/ApiDebugFab/ApiDebugFab'))
  : null;

/**
 * RootLayout component
 * Implements React Router's canonical Layout Route pattern with a single `<main>`
 * landmark, an accessible Skip Link, and a route-scoped React ErrorBoundary.
 */
export function RootLayout() {
  const { t } = useI18n();
  const location = useLocation();

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <a
        href="#main-content"
        className="fixed -top-24 left-4 z-[var(--z-skip-link)] rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-card-lg transition-[top] duration-150 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-fg-heading"
      >
        {t('a11y.skipToContent')}
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <ErrorBoundary resetKey={location.key}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="mt-auto border-t border-border bg-surface px-4 py-6 text-center sm:px-6 md:py-8">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 text-sm text-fg-muted">
          <p>© {CURRENT_YEAR} Minie Shop</p>
        </div>
      </footer>
      <MiniCart />
      {DevChaosFab && (
        <Suspense fallback={null}>
          <DevChaosFab />
        </Suspense>
      )}
    </div>
  );
}

export default RootLayout;
