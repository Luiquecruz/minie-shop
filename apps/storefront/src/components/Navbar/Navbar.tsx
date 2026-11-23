import { Link } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { t } from '../../i18n';
import SearchBar from '../SearchBar/SearchBar';
import './Navbar.css';

export function Navbar() {
  const { cartCount, toggleCart } = useCart();

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" aria-label={t('nav.brandAria')}>
          <span className="navbar__brand-badge" aria-hidden="true">
            <svg
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </span>
          <span>Minie Shop</span>
          <span className="navbar__tag">V1.0</span>
        </Link>

        {/* Global Catalog Search Bar synced with URL ?q= (Hybrid /search & autocomplete in Phase 7) */}
        <div className="navbar__search">
          <SearchBar />
        </div>

        <div className="navbar__actions">
          <button
            type="button"
            className="navbar__cart-btn"
            onClick={toggleCart}
            aria-label={t('nav.cartAria', { count: cartCount })}
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>{t('nav.cartLabel')}</span>
            <span className="navbar__cart-count">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
