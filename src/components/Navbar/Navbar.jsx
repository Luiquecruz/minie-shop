import { useCurrency } from '../../hooks/useCurrency.js';
import Dropdown from '../Dropdown/Dropdown.jsx';
import './Navbar.css';

export function Navbar({ cartCount = 0 }) {
  const { currentCurrency, changeCurrency, supportedCurrencies } = useCurrency();

  const currencyOptions = Object.values(supportedCurrencies).map((curr) => ({
    value: curr.code,
    label: curr.label,
  }));

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <a href="/" className="navbar__brand" aria-label="Minie Shop Home">
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
        </a>

        <div className="navbar__actions">
          {/* Custom Multi-Currency Dropdown */}
          <Dropdown
            options={currencyOptions}
            value={currentCurrency}
            onChange={changeCurrency}
            ariaLabel="Select store currency"
            align="right"
          />

          <button
            type="button"
            className="navbar__cart-btn"
            aria-label="Shopping cart"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>Cart</span>
            <span className="navbar__cart-count">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
