import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar';
import MiniCart from '../../components/MiniCart/MiniCart';

const CURRENT_YEAR = new Date().getFullYear();

const DevChaosFab = import.meta.env.DEV
  ? lazy(() => import('../../components/ApiDebugFab/ApiDebugFab'))
  : null;

/**
 * RootLayout component
 * Implements React Router's canonical Layout Route pattern with <Outlet />.
 */
export function RootLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-content">
        <Outlet />
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
