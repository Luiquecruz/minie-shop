import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useMatch } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiErrorSimulator } from '../../services/api';
import './ApiDebugFab.css';

/**
 * Discreet bottom-left floating debug control for simulating API failures
 * (queries and optimistic favorite mutations) and invalidating React Query cache.
 */
export function ApiDebugFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const isPdpRoute = Boolean(useMatch('/product/:id'));
  const queryClient = useQueryClient();

  const simState = useSyncExternalStore(
    apiErrorSimulator.subscribe,
    apiErrorSimulator.getSnapshot,
    apiErrorSimulator.getSnapshot,
  );

  const hasActiveSimulation =
    simState.failQueries || simState.failFavoritesMutation;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent): void => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const showNotice = (message: string): void => {
    setNotice(message);
    setTimeout(() => setNotice(''), 2500);
  };

  const handleInvalidateAll = (): void => {
    void queryClient.invalidateQueries();
    showNotice('Cache invalidated');
  };

  return (
    <div
      ref={containerRef}
      className={`api-debug-fab ${isPdpRoute ? 'api-debug-fab--pdp' : ''}`}
    >
      {isOpen && (
        <section
          id={popoverId}
          className="api-debug-fab__popover"
          aria-label="API Error Simulation Controls"
        >
          <header className="api-debug-fab__header">
            <span className="api-debug-fab__title">API Debug Simulator</span>
            <button
              type="button"
              className="api-debug-fab__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close API simulator"
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
          </header>

          <div className="api-debug-fab__body">
            <label className="api-debug-fab__toggle">
              <div className="api-debug-fab__toggle-text">
                <span className="api-debug-fab__toggle-label">
                  Simulate Query Error
                </span>
                <span className="api-debug-fab__toggle-hint">
                  Fails catalog, PDP &amp; search fetches
                </span>
              </div>
              <input
                type="checkbox"
                checked={simState.failQueries}
                onChange={(e) => apiErrorSimulator.setFailQueries(e.target.checked)}
                className="api-debug-fab__checkbox"
              />
            </label>

            <label className="api-debug-fab__toggle">
              <div className="api-debug-fab__toggle-text">
                <span className="api-debug-fab__toggle-label">
                  Simulate Favorite Error
                </span>
                <span className="api-debug-fab__toggle-hint">
                  Triggers optimistic rollback on heart click
                </span>
              </div>
              <input
                type="checkbox"
                checked={simState.failFavoritesMutation}
                onChange={(e) =>
                  apiErrorSimulator.setFailFavoritesMutation(e.target.checked)
                }
                className="api-debug-fab__checkbox"
              />
            </label>
          </div>

          <footer className="api-debug-fab__footer">
            <button
              type="button"
              className="api-debug-fab__action-btn"
              onClick={handleInvalidateAll}
            >
              Invalidate Cache
            </button>
            {hasActiveSimulation && (
              <button
                type="button"
                className="api-debug-fab__reset-btn"
                onClick={() => {
                  apiErrorSimulator.reset();
                  showNotice('Simulations reset');
                }}
              >
                Reset
              </button>
            )}
          </footer>

          {notice && (
            <p className="api-debug-fab__notice" role="status">
              {notice}
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        className={`api-debug-fab__trigger ${
          hasActiveSimulation ? 'api-debug-fab__trigger--active' : ''
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label="Open API error simulator"
        title="API Debug Simulator"
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
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <span className="api-debug-fab__trigger-label">API Sim</span>
        {hasActiveSimulation && (
          <span className="api-debug-fab__status-dot" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default ApiDebugFab;
