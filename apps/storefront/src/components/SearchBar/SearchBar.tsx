import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { CategoriesResponseDTO, CategoryDTO, SearchSuggestionDTO } from '@minieshop/contracts';
import { useCombobox } from '../../hooks/useCombobox';
import { useDebounce } from '../../hooks/useDebounce';
import { MIN_SUGGEST_QUERY_LENGTH, useSearchSuggestQuery } from '../../hooks/useSearch';
import { useI18n } from '../../i18n';
import { queryKeys } from '../../query/queryKeys';
import { MAX_SEARCH_QUERY_LENGTH } from '../../utils/searchUrlParams';
import './SearchBar.css';

export interface SearchBarProps {
  placeholder?: string;
}

type ComboboxOption =
  | { kind: 'suggestion'; suggestion: SearchSuggestionDTO }
  | { kind: 'seeAll'; query: string };

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugifyFallback(value: string): string {
  const slug = normalizeForMatch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'catalog';
}

function resolveCategorySlug(
  categories: CategoriesResponseDTO | undefined,
  categoryName: string,
): string {
  const target = normalizeForMatch(categoryName);
  if (categories && target.length > 0) {
    const queue: CategoryDTO[] = [...categories];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (normalizeForMatch(current.name) === target) {
        return current.slug;
      }
      if (current.children.length > 0) {
        queue.push(...current.children);
      }
    }
  }
  return slugifyFallback(categoryName);
}

/**
 * Accessible global search combobox (WAI-ARIA APG) backed by GET /search/suggest
 * with 200ms debounce, React Query cancellation, and navigation to PDP or /search.
 */
export function SearchBar({ placeholder }: SearchBarProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('search.placeholder');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [inputValue, setInputValue] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [prevPathKey, setPrevPathKey] = useState<string>(
    `${location.pathname}${location.search}`,
  );

  const pathKey = `${location.pathname}${location.search}`;
  if (prevPathKey !== pathKey) {
    setPrevPathKey(pathKey);
    setIsOpen(false);
  }

  const trimmedInput = inputValue.trim();
  const debouncedQuery = useDebounce(trimmedInput, 200);
  const meetsMinChars = trimmedInput.length >= MIN_SUGGEST_QUERY_LENGTH;

  const suggestQuery = useSearchSuggestQuery(
    debouncedQuery,
    isOpen && meetsMinChars,
  );

  const suggestions = useMemo(
    () => (meetsMinChars && !suggestQuery.isError ? (suggestQuery.data?.suggestions ?? []) : []),
    [meetsMinChars, suggestQuery.isError, suggestQuery.data],
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

      const cachedCategories = queryClient.getQueryData<CategoriesResponseDTO>(
        queryKeys.categories.all,
      );
      const categorySlug = resolveCategorySlug(
        cachedCategories,
        selected.suggestion.categoryName,
      );
      setInputValue(selected.suggestion.name);
      setIsOpen(false);
      navigate(`/${categorySlug}/${encodeURIComponent(selected.suggestion.slug)}`);
    },
    [options, navigateToSearchResults, queryClient, navigate],
  );

  const {
    containerRef,
    inputId,
    listboxId,
    highlightedIndex,
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
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const isWaitingDebounce = meetsMinChars && debouncedQuery !== trimmedInput;
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
      className="search-bar"
      onBlur={handleContainerBlur}
    >
      <form role="search" onSubmit={handleSubmit}>
        <label htmlFor={inputId} className="visually-hidden">
          {t('search.ariaLabel')}
        </label>

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
            maxLength={MAX_SEARCH_QUERY_LENGTH}
            className="search-bar__input"
            placeholder={resolvedPlaceholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            {...getInputProps(hasOptions)}
          />

          {showDropdown && isFetching && (
            <span
              className="search-bar__spinner"
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle
                  className="search-bar__spinner-track"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="search-bar__spinner-head"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          )}

          {inputValue.length > 0 && (
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

      <div
        className="search-bar__dropdown"
        hidden={!showDropdown}
      >
        <ul
          {...getListboxProps()}
          id={listboxId}
          aria-label={t('search.suggestionsListboxAria')}
          className="search-bar__results"
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
                    className={`search-bar__item search-bar__item--see-all ${
                      isActive ? 'search-bar__item--active' : ''
                    }`}
                  >
                    <span className="search-bar__see-all-icon" aria-hidden="true">
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
                    <span className="search-bar__see-all-text">
                      {t('search.seeAllResults', { query: option.query })}
                    </span>
                  </li>
                );
              }

              return (
                <li
                  key={option.suggestion.slug}
                  ref={registerOptionRef(index)}
                  {...optionProps}
                  className={`search-bar__item ${
                    isActive ? 'search-bar__item--active' : ''
                  }`}
                >
                  <div className="search-bar__item-details">
                    <span className="search-bar__item-title">
                      {option.suggestion.name}
                    </span>
                    {option.suggestion.categoryName && (
                      <span className="search-bar__item-category">
                        {option.suggestion.categoryName}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>

        {showInitialLoading && (
          <div className="search-bar__status" aria-busy="true">
            <span className="search-bar__status-text">
              {t('search.suggestionsLoading')}
            </span>
          </div>
        )}

        {showEmpty && (
          <div className="search-bar__empty">
            <p>{t('search.noSuggestions')}</p>
          </div>
        )}

        {showError && (
          <div className="search-bar__error">
            <p className="search-bar__error-title">
              {t('search.suggestionsError')}
            </p>
          </div>
        )}
      </div>

      <div
        className="visually-hidden"
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
