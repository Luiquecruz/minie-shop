import { Link } from 'react-router-dom';
import { useCartBadge } from '../../hooks/useCart';
import { useCurrency } from '../../hooks/useCurrency';
import { useTheme, type ThemePreference } from '../../hooks/useTheme';
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  useI18n,
} from '../../i18n';
import { cn } from '@minieshop/ui/tokens';
import {
  isCurrencyCode,
  SUPPORTED_CURRENCY_LIST,
} from '../../utils/currency';
import SearchBar from '../SearchBar/SearchBar';

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  labelKey: 'nav.themeSystem' | 'nav.themeLight' | 'nav.themeDark';
}> = [
  { value: 'system', labelKey: 'nav.themeSystem' },
  { value: 'light', labelKey: 'nav.themeLight' },
  { value: 'dark', labelKey: 'nav.themeDark' },
];

function ThemeIcon({ mode }: { mode: ThemePreference }) {
  if (mode === 'light') {
    return (
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
      />
    </svg>
  );
}

export function Navbar() {
  const { cartCount, toggleCart } = useCartBadge();
  const { currentCurrency, setCurrency } = useCurrency();
  const { preference: themePreference, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();

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
    <header className="sticky top-0 z-[var(--z-sticky-nav)] w-full border-b border-border bg-surface-nav backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:flex-nowrap lg:gap-6 lg:py-3">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-2.5 text-lg font-extrabold tracking-tight text-fg-heading no-underline transition-opacity hover:opacity-90"
          aria-label={t('nav.brandAria')}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-card-sm"
            aria-hidden="true"
          >
            <svg
              className="h-5 w-5"
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
          <span className="hidden rounded-full border border-brand-border bg-brand-subtle px-2 py-0.5 text-[11px] font-bold tracking-wider text-brand sm:inline-flex">
            V1.0
          </span>
        </Link>

        {/* Global Autocomplete Combobox persistent across all routes */}
        <div className="order-3 w-full lg:order-2 lg:max-w-md lg:flex-1">
          <SearchBar />
        </div>

        <div className="order-2 flex shrink-0 items-center gap-2 sm:gap-2.5 lg:order-3">
          {/* Accessible System / Light / Dark Theme Toggle */}
          <div
            role="group"
            aria-label={t('nav.themeGroupAria')}
            className="inline-flex items-center rounded-xl border border-border bg-surface-chip p-0.5"
          >
            {THEME_OPTIONS.map((option) => {
              const isActive = themePreference === option.value;
              const label = t(option.labelKey);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={isActive}
                  aria-label={label}
                  title={label}
                  className={cn(
                    'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
                    isActive
                      ? 'bg-surface text-brand shadow-card-sm'
                      : 'text-fg-muted hover:text-fg-heading',
                  )}
                >
                  <ThemeIcon mode={option.value} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <div>
              <label htmlFor="navbar-language-select" className="sr-only">
                {t('nav.languageLabel')}
              </label>
              <select
                id="navbar-language-select"
                className="h-9 cursor-pointer rounded-xl border border-border bg-surface-input px-2.5 text-xs font-semibold text-fg-heading transition-colors hover:border-brand-border focus-visible:border-brand focus-visible:outline-none"
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

            <div>
              <label htmlFor="navbar-currency-select" className="sr-only">
                {t('nav.currencyLabel')}
              </label>
              <select
                id="navbar-currency-select"
                className="h-9 cursor-pointer rounded-xl border border-border bg-surface-input px-2.5 text-xs font-semibold text-fg-heading transition-colors hover:border-brand-border focus-visible:border-brand focus-visible:outline-none"
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
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-fg-heading shadow-card-sm transition-colors hover:border-brand-border hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={toggleCart}
            aria-label={t('nav.cartAria', { count: cartCount })}
          >
            <svg
              width="18"
              height="18"
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
            <span className="hidden sm:inline">{t('nav.cartLabel')}</span>
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-bold leading-none text-white">
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
