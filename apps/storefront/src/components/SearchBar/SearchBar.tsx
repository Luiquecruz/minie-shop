import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import './SearchBar.css';

export interface SearchBarProps {
  placeholder?: string;
}

/**
 * Debounced catalog search bar synced directly with URL `?q=` parameter
 * (GET /products?q=...). Hybrid search (/search) and autocomplete enter in Phase 7.
 */
export function SearchBar({ placeholder }: SearchBarProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('search.placeholder');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlQuery = searchParams.get('q') ?? '';
  const [prevUrlQuery, setPrevUrlQuery] = useState<string>(urlQuery);
  const [inputValue, setInputValue] = useState<string>(urlQuery);

  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setInputValue(urlQuery);
  }

  const cancelPendingDebounce = useCallback((): void => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Cancel any pending debounce whenever external URL state changes (Clear all, Back/Forward, route change) or on unmount
  useEffect(() => {
    return () => {
      cancelPendingDebounce();
    };
  }, [urlQuery, location.pathname, cancelPendingDebounce]);

  const applySearchToUrl = useCallback(
    (rawValue: string, replace: boolean): void => {
      const trimmed = rawValue.trim();
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed.length === 0) {
            next.delete('q');
            if (next.get('sort') === 'relevance') {
              next.delete('sort');
            }
          } else {
            next.set('q', trimmed);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const applySearchToUrlRef = useRef(applySearchToUrl);
  const urlQueryRef = useRef(urlQuery);
  useEffect(() => {
    applySearchToUrlRef.current = applySearchToUrl;
    urlQueryRef.current = urlQuery;
  }, [applySearchToUrl, urlQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const nextValue = e.target.value;
    setInputValue(nextValue);

    if (location.pathname !== '/') return;

    cancelPendingDebounce();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (nextValue.trim() === urlQueryRef.current.trim()) return;
      applySearchToUrlRef.current(nextValue, true);
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    cancelPendingDebounce();
    const trimmed = inputValue.trim();

    if (location.pathname !== '/') {
      const nextParams = new URLSearchParams();
      if (trimmed.length > 0) {
        nextParams.set('q', trimmed);
      }
      const queryStr = nextParams.toString();
      navigate(queryStr ? `/?${queryStr}` : '/');
      return;
    }

    applySearchToUrl(trimmed, false);
  };

  const handleClear = (): void => {
    cancelPendingDebounce();
    setInputValue('');
    if (location.pathname === '/') {
      applySearchToUrl('', false);
    }
    inputRef.current?.focus();
  };

  const hasQuery = inputValue.trim().length > 0;

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <div className="search-bar__input-wrapper">
        <span className="search-bar__icon" aria-hidden="true">
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="search"
          name="q"
          className="search-bar__input"
          placeholder={resolvedPlaceholder}
          value={inputValue}
          onChange={handleInputChange}
          aria-label={t('search.ariaLabel')}
        />

        {hasQuery && (
          <button
            type="button"
            className="search-bar__clear-btn"
            onClick={handleClear}
            aria-label={t('search.clearAria')}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}

export default SearchBar;
