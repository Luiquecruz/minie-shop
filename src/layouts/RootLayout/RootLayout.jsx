import { Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar.jsx';
import MiniCart from '../../components/MiniCart/MiniCart.jsx';

const CURRENT_YEAR = new Date().getFullYear();

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
    </div>
  );
}

export default RootLayout;
