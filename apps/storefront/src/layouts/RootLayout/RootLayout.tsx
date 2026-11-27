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
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-content">
        <ErrorBoundary resetKey={location.key}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="app-footer">
        <div className="app-footer__inner">
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
