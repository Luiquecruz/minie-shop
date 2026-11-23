import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { t } from '../../i18n';
import './SearchBar.css';

export interface SearchBarProps {
  placeholder?: string;
}

/**
 * Debounced catalog search bar synced directly with URL `?q=` parameter
 * (GET /products?q=...). Hybrid search (/search) and autocomplete enter in Phase 7.
 */
export function SearchBar({
  placeholder = t('search.placeholder'),
}: SearchBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const urlQuery = searchParams.get('q') ?? '';
  const [draft, setDraft] = useState<{ baseUrl: string; value: string }>({
    baseUrl: urlQuery,
    value: urlQuery,
  });

  const inputValue = draft.baseUrl === urlQuery ? draft.value : urlQuery;
  const debouncedValue = useDebounce(inputValue, 300);

  // Live typing on catalog route updates `?q=` via replace (does not spam browser history)
  useEffect(() => {
    if (location.pathname !== '/') return;
    const trimmedNext = debouncedValue.trim();
    const trimmedCurrent = urlQuery.trim();
    if (trimmedNext === trimmedCurrent) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (trimmedNext.length === 0) {
          next.delete('q');
          if (next.get('sort') === 'relevance') {
            next.delete('sort');
          }
        } else {
          next.set('q', trimmedNext);
        }
        return next;
      },
      { replace: true },
    );
  }, [debouncedValue, location.pathname, setSearchParams, urlQuery]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
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
      { replace: false },
    );
  };

  const handleClear = (): void => {
    setDraft({ baseUrl: urlQuery, value: '' });
    if (location.pathname === '/') {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('q');
          if (next.get('sort') === 'relevance') {
            next.delete('sort');
          }
          return next;
        },
        { replace: false },
      );
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
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setDraft({ baseUrl: urlQuery, value: e.target.value })}
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
