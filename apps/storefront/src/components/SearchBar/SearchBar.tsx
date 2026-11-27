import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import type { SearchSuggestionDTO } from '@minieshop/contracts';
import { useCombobox } from '../../hooks/useCombobox';
import { useDebounce } from '../../hooks/useDebounce';
import { MIN_SUGGEST_QUERY_LENGTH, useSearchSuggestQuery } from '../../hooks/useSearch';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';
import { MAX_SEARCH_QUERY_LENGTH, parseSearchUrlQuery } from '../../utils/searchUrlParams';

export interface SearchBarProps {
  placeholder?: string;
}

type ComboboxOption =
  | { kind: 'suggestion'; suggestion: SearchSuggestionDTO }
  | { kind: 'seeAll'; query: string };

/**
 * Accessible global search combobox (WAI-ARIA APG) backed by GET /search/suggest
 * with 200ms debounce, React Query cancellation, and navigation to PDP or /search.
 */
export function SearchBar({ placeholder }: SearchBarProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('search.placeholder');
  const navigate = useNavigate();
  const location = useLocation();
  const isSearchRoute = useMatch('/search') !== null;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const urlSearchQuery = isSearchRoute
    ? parseSearchUrlQuery(new URLSearchParams(location.search))
    : null;

  const [inputValue, setInputValue] = useState<string>(() => urlSearchQuery ?? '');
  const [prevUrlSearchQuery, setPrevUrlSearchQuery] = useState<string | null>(
    urlSearchQuery,
  );
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [prevPathKey, setPrevPathKey] = useState<string>(
    `${location.pathname}${location.search}`,
  );

  if (prevUrlSearchQuery !== urlSearchQuery) {
    setPrevUrlSearchQuery(urlSearchQuery);
    if (urlSearchQuery !== null) {
      setInputValue(urlSearchQuery);
    }
  }

  const pathKey = `${location.pathname}${location.search}`;
  if (prevPathKey !== pathKey) {
    setPrevPathKey(pathKey);
    setIsOpen(false);
  }

  const trimmedInput = inputValue.trim();
  const debouncedQuery = useDebounce(trimmedInput, 200);
  const meetsMinChars = trimmedInput.length >= MIN_SUGGEST_QUERY_LENGTH;
  const isWaitingDebounce = meetsMinChars && debouncedQuery !== trimmedInput;

  const suggestQuery = useSearchSuggestQuery(
    debouncedQuery,
    isOpen && meetsMinChars,
  );

  const suggestions = useMemo(
    () =>
      meetsMinChars &&
      !isWaitingDebounce &&
      !suggestQuery.isPlaceholderData &&
      !suggestQuery.isError
        ? (suggestQuery.data?.suggestions ?? [])
        : [],
    [
      meetsMinChars,
      isWaitingDebounce,
      suggestQuery.isPlaceholderData,
      suggestQuery.isError,
      suggestQuery.data,
    ],
  );

  const options = useMemo<ComboboxOption[]>(() => {
    if (!meetsMinChars || suggestQuery.isError || suggestions.length === 0) {
      return [];
    }
    return [
      ...suggestions.map((suggestion) => ({
        kind: 'suggestion' as const,
        suggestion,
      })),
      { kind: 'seeAll' as const, query: trimmedInput },
    ];
  }, [meetsMinChars, suggestQuery.isError, suggestions, trimmedInput]);

  const navigateToSearchResults = useCallback(
    (rawQuery: string): void => {
      const normalized = rawQuery.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
      if (normalized.length === 0) {
        return;
      }
      setInputValue(normalized);
      setPrevUrlSearchQuery(normalized);
      setIsOpen(false);
      navigate(`/search?q=${encodeURIComponent(normalized)}`);
    },
    [navigate],
  );

  const handleSelectOption = useCallback(
    (index: number): void => {
      const selected = options[index];
      if (!selected) return;

      if (selected.kind === 'seeAll') {
        navigateToSearchResults(selected.query);
        return;
      }

      const categorySlug =
        selected.suggestion.categorySlug.trim() || 'catalog';
      setInputValue(selected.suggestion.name);
      setIsOpen(false);
      navigate(
        `/${encodeURIComponent(categorySlug)}/${encodeURIComponent(selected.suggestion.slug)}`,
      );
    },
    [options, navigateToSearchResults, navigate],
  );

  const {
    containerRef,
    inputId,
    listboxId,
    highlightedIndex,
    setHighlightedIndex,
    registerOptionRef,
    handleContainerBlur,
    getInputProps,
    getListboxProps,
    getOptionProps,
  } = useCombobox({
    itemsCount: options.length,
    isOpen,
    canOpenOnArrow: meetsMinChars,
    onOpenChange: setIsOpen,
    onSelectIndex: handleSelectOption,
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const nextValue = event.target.value;
    setHighlightedIndex(-1);
    setInputValue(nextValue);
    setIsOpen(nextValue.trim().length >= MIN_SUGGEST_QUERY_LENGTH);
  };

  const handleInputFocus = (): void => {
    if (meetsMinChars) {
      setIsOpen(true);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (trimmedInput.length === 0) {
      return;
    }
    navigateToSearchResults(trimmedInput);
  };

  const handleClear = (): void => {
    setHighlightedIndex(-1);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const isFetching = suggestQuery.isFetching || isWaitingDebounce;
  const hasOptions = options.length > 0;
  const showDropdown = isOpen && meetsMinChars;
  const showInitialLoading =
    showDropdown && !suggestQuery.isError && !hasOptions && (suggestQuery.isPending || isFetching);
  const showEmpty =
    showDropdown && !suggestQuery.isError && !hasOptions && !showInitialLoading;
  const showError = showDropdown && suggestQuery.isError;

  const isSettledForCurrentTerm =
    showDropdown && debouncedQuery === trimmedInput && !suggestQuery.isFetching;

  const liveAnnouncement = !isSettledForCurrentTerm
    ? ''
    : suggestQuery.isError
      ? t('search.suggestionsError')
      : suggestions.length === 0
        ? t('search.noSuggestions')
        : suggestions.length === 1
          ? t('search.suggestionsAvailableSingular')
          : t('search.suggestionsAvailable', { count: suggestions.length });

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onBlur={handleContainerBlur}
    >
      <form role="search" onSubmit={handleSubmit}>
        <label htmlFor={inputId} className="sr-only">
          {t('search.ariaLabel')}
        </label>

        <div className="relative flex items-center">
          <span
            className="pointer-events-none absolute left-3.5 flex items-center text-fg-muted"
            aria-hidden="true"
          >
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
            maxLength={MAX_SEARCH_QUERY_LENGTH}
            className="h-10 w-full rounded-xl border border-border bg-surface-input pl-10 pr-10 text-sm text-fg-heading placeholder:text-fg-muted shadow-card-sm transition-colors hover:border-brand-border focus:border-brand focus:ring-2 focus:ring-brand-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            placeholder={resolvedPlaceholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            {...getInputProps(hasOptions)}
          />

          {showDropdown && isFetching && (
            <span
              className="pointer-events-none absolute right-9 flex items-center text-brand"
              aria-hidden="true"
            >
              <svg
                className="h-4 w-4 animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          )}

          {inputValue.length > 0 && (
            <button
              type="button"
              className="absolute right-2.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-chip hover:text-fg-heading focus-visible:outline-2 focus-visible:outline-brand"
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

      <div
        className="absolute inset-x-0 top-[calc(100%+6px)] z-[var(--z-dropdown)] overflow-hidden rounded-xl border border-border bg-surface shadow-card-lg animate-fade-in"
        hidden={!showDropdown}
      >
        <ul
          {...getListboxProps()}
          id={listboxId}
          aria-label={t('search.suggestionsListboxAria')}
          className="m-0 max-h-96 list-none overflow-y-auto p-1.5"
          hidden={!showDropdown || !hasOptions}
        >
          {showDropdown &&
            options.map((option, index) => {
              const isActive = highlightedIndex === index;
              const optionProps = getOptionProps(index);

              if (option.kind === 'seeAll') {
                return (
                  <li
                    key="__see_all__"
                    ref={registerOptionRef(index)}
                    {...optionProps}
                    className={cn(
                      'mt-1 flex cursor-pointer items-center gap-2.5 rounded-lg border-t border-border-subtle px-3 py-2.5 text-sm font-medium text-brand transition-colors',
                      isActive
                        ? 'bg-brand-subtle text-brand'
                        : 'hover:bg-surface-chip',
                    )}
                  >
                    <span className="flex shrink-0 items-center" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
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
                    <span className="truncate">
                      {t('search.seeAllResults')} <strong className="font-bold">{option.query}</strong>
                    </span>
                  </li>
                );
              }

              return (
                <li
                  key={option.suggestion.slug}
                  ref={registerOptionRef(index)}
                  {...optionProps}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors',
                    isActive
                      ? 'bg-brand-subtle text-brand'
                      : 'text-fg-heading hover:bg-surface-chip',
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">
                      {option.suggestion.name}
                    </span>
                    {option.suggestion.categoryName && (
                      <span className="truncate text-xs text-fg-muted">
                        {option.suggestion.categoryName}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>

        {showInitialLoading && (
          <div className="px-4 py-3 text-center text-sm text-fg-muted" aria-busy="true">
            <span>{t('search.suggestionsLoading')}</span>
          </div>
        )}

        {showEmpty && (
          <div className="px-4 py-4 text-center text-sm text-fg-muted">
            <p>{t('search.noSuggestions')}</p>
          </div>
        )}

        {showError && (
          <div className="px-4 py-3 text-center text-sm text-danger">
            <p className="font-medium">{t('search.suggestionsError')}</p>
          </div>
        )}
      </div>

      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="search-suggestions-live"
      >
        {liveAnnouncement}
      </div>
    </div>
  );
}

export default SearchBar;
