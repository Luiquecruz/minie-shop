import { Link, useMatch } from 'react-router-dom';
import { useCartBadge } from '../../hooks/useCart';
import { useCurrency } from '../../hooks/useCurrency';
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  useI18n,
} from '../../i18n';
import {
  isCurrencyCode,
  SUPPORTED_CURRENCY_LIST,
} from '../../utils/currency';
import SearchBar from '../SearchBar/SearchBar';
import './Navbar.css';

export function Navbar() {
  const { cartCount, toggleCart } = useCartBadge();
  const { currentCurrency, setCurrency } = useCurrency();
  const { locale, setLocale, t } = useI18n();
  const isSearchResultsRoute = useMatch('/search') !== null;

  const handleCurrencyChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const nextValue = event.target.value;
    if (isCurrencyCode(nextValue)) {
      setCurrency(nextValue);
    }
  };

  const handleLocaleChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const nextValue = event.target.value;
    if (isSupportedLocale(nextValue)) {
      setLocale(nextValue);
    }
  };

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

        {/* Global Autocomplete Combobox hidden on /search (page owns its SearchBox) */}
        {!isSearchResultsRoute && (
          <div className="navbar__search">
            <SearchBar />
          </div>
        )}

        <div className="navbar__actions">
          <div className="navbar__select-group">
            <div className="navbar__currency-wrapper">
              <label htmlFor="navbar-language-select" className="visually-hidden">
                {t('nav.languageLabel')}
              </label>
              <select
                id="navbar-language-select"
                className="navbar__currency-select navbar__language-select"
                value={locale}
                onChange={handleLocaleChange}
                aria-label={t('nav.languageAria')}
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="navbar__currency-wrapper">
              <label htmlFor="navbar-currency-select" className="visually-hidden">
                {t('nav.currencyLabel')}
              </label>
              <select
                id="navbar-currency-select"
                className="navbar__currency-select"
                value={currentCurrency}
                onChange={handleCurrencyChange}
                aria-label={t('nav.currencyAria')}
              >
                {SUPPORTED_CURRENCY_LIST.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
