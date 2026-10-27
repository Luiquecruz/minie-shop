import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch.js';
import { productsApi } from '../../services/api.js';
import PriceBox from '../PriceBox/PriceBox.jsx';
import './SearchBar.css';

/**
 * Highlights matching substring within product title.
 */
function HighlightMatch({ text, query }) {
  if (!query || !query.trim()) return <span>{text}</span>;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={index} className="search-bar__highlight">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export function SearchBar({ placeholder = 'Search products by name or category...' }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Stable fetcher with AbortSignal passed to API
  const searchFetcher = useCallback(
    (searchQuery, { signal }) =>
      productsApi.searchProducts({ query: searchQuery, limit: 6, signal, delayMs: 220 }),
    [],
  );

  // useFetch hook with AbortController, debounce, and effect cleanup
  const { data: results, isLoading } = useFetch(searchFetcher, query, {
    debounceMs: 300,
    minQueryLength: 1,
    initialData: [],
  });

  const hasQuery = query.trim().length > 0;
  const showDropdown = isOpen && hasQuery;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectProduct = (productId) => {
    setIsOpen(false);
    setQuery('');
    navigate(`/product/${productId}`);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' && hasQuery) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelectProduct(results[activeIndex].id);
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="search-bar" role="search">
      <div className="search-bar__input-wrapper">
        {/* Search Icon */}
        <span className="search-bar__icon" aria-hidden="true">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>

        {/* Search Input with ARIA combobox pattern */}
        <input
          ref={inputRef}
          type="text"
          className="search-bar__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (hasQuery) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-label="Search products"
        />

        {/* Loading Spinner */}
        {isLoading && (
          <span className="search-bar__spinner" aria-label="Searching...">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle className="search-bar__spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="search-bar__spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </span>
        )}

        {/* Clear Button */}
        {hasQuery && (
          <button
            type="button"
            className="search-bar__clear-btn"
            onClick={handleClear}
            aria-label="Clear search input"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown Panel */}
      {showDropdown && (
        <div
          className="search-bar__dropdown"
          role="listbox"
          aria-label="Search suggestions"
        >
          {isLoading && results.length === 0 ? (
            <div className="search-bar__status">
              <div className="search-bar__skeleton-item">
                <div className="search-bar__skeleton-thumb" />
                <div className="search-bar__skeleton-lines">
                  <div className="search-bar__skeleton-line search-bar__skeleton-line--title" />
                  <div className="search-bar__skeleton-line search-bar__skeleton-line--sub" />
                </div>
              </div>
              <div className="search-bar__skeleton-item">
                <div className="search-bar__skeleton-thumb" />
                <div className="search-bar__skeleton-lines">
                  <div className="search-bar__skeleton-line search-bar__skeleton-line--title" />
                  <div className="search-bar__skeleton-line search-bar__skeleton-line--sub" />
                </div>
              </div>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="search-bar__header">
                <span className="search-bar__header-title">
                  {results.length} product{results.length > 1 ? 's' : ''} found
                </span>
                <span className="search-bar__header-hint">Press Enter to view</span>
              </div>
              <ul className="search-bar__results" role="none">
                {results.map((product, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={product.id}
                      role="option"
                      aria-selected={isActive}
                      className={`search-bar__item ${isActive ? 'search-bar__item--active' : ''}`}
                      onClick={() => handleSelectProduct(product.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <img
                        src={product.image}
                        alt=""
                        aria-hidden="true"
                        className="search-bar__item-image"
                        loading="lazy"
                      />
                      <div className="search-bar__item-details">
                        <div className="search-bar__item-meta">
                          <span className="search-bar__item-category">{product.category}</span>
                          {product.stock > 0 ? (
                            <span className="search-bar__item-stock">In stock</span>
                          ) : (
                            <span className="search-bar__item-stock search-bar__item-stock--out">Out of stock</span>
                          )}
                        </div>
                        <h4 className="search-bar__item-title">
                          <HighlightMatch text={product.name} query={query} />
                        </h4>
                      </div>
                      <div className="search-bar__item-price">
                        <PriceBox price={product.price} size="sm" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="search-bar__empty">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm6 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z" />
              </svg>
              <p>No products found for &ldquo;<strong>{query}</strong>&rdquo;</p>
              <span>Try checking for typos or searching by category name</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
