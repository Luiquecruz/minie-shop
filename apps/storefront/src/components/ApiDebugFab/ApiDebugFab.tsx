import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDevChaos } from '../../hooks/useDevChaos';
import './ApiDebugFab.css';

/**
 * Development-only floating control for toggling API Chaos headers
 * (`chaos.delay`, `chaos.fail`, `chaos.status` in localStorage) and invalidating
 * React Query cache. Loaded strictly under `import.meta.env.DEV` so production
 * builds contain zero chaos UI or strings.
 */
export function ApiDebugFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const { config, setChaosValue, resetChaos } = useDevChaos();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const delayInputId = useId();
  const failInputId = useId();
  const statusInputId = useId();
  const queryClient = useQueryClient();

  const hasActiveChaos =
    config.delay.length > 0 ||
    config.fail.length > 0 ||
    config.status.length > 0;

  const closeAndRestoreFocus = (): void => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (containerRef.current?.contains(document.activeElement)) {
          closeAndRestoreFocus();
        } else {
          setIsOpen(false);
        }
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
    <div ref={containerRef} className="api-debug-fab">
      {isOpen && (
        <section
          id={popoverId}
          className="api-debug-fab__popover"
          aria-label="Dev Chaos Controls"
        >
          <header className="api-debug-fab__header">
            <span className="api-debug-fab__title">Dev Chaos Controls</span>
            <button
              ref={closeButtonRef}
              type="button"
              className="api-debug-fab__close"
              onClick={closeAndRestoreFocus}
              aria-label="Close chaos controls"
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
            <div className="api-debug-fab__toggle">
              <div className="api-debug-fab__toggle-text">
                <label htmlFor={delayInputId} className="api-debug-fab__toggle-label">
                  Artificial Delay (ms or min-max)
                </label>
                <input
                  id={delayInputId}
                  type="text"
                  value={config.delay}
                  placeholder="e.g. 800 or 200-800"
                  onChange={(e) => setChaosValue('delay', e.target.value)}
                  className="api-debug-fab__input"
                />
              </div>
            </div>

            <div className="api-debug-fab__toggle">
              <div className="api-debug-fab__toggle-text">
                <label htmlFor={failInputId} className="api-debug-fab__toggle-label">
                  Force Failure (x-chaos-fail=1)
                </label>
              </div>
              <input
                id={failInputId}
                type="checkbox"
                checked={config.fail === '1'}
                onChange={(e) =>
                  setChaosValue('fail', e.target.checked ? '1' : '')
                }
                className="api-debug-fab__checkbox"
              />
            </div>

            <div className="api-debug-fab__toggle">
              <div className="api-debug-fab__toggle-text">
                <label htmlFor={statusInputId} className="api-debug-fab__toggle-label">
                  Forced HTTP Status (400-599)
                </label>
                <input
                  id={statusInputId}
                  type="text"
                  value={config.status}
                  placeholder="e.g. 503 or 429"
                  onChange={(e) => setChaosValue('status', e.target.value)}
                  className="api-debug-fab__input"
                />
              </div>
            </div>
          </div>

          <footer className="api-debug-fab__footer">
            <button
              type="button"
              className="api-debug-fab__action-btn"
              onClick={handleInvalidateAll}
            >
              Invalidate Cache
            </button>
            {hasActiveChaos && (
              <button
                type="button"
                className="api-debug-fab__reset-btn"
                onClick={() => {
                  resetChaos();
                  showNotice('Chaos cleared');
                }}
              >
                Reset Chaos
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
        ref={triggerRef}
        type="button"
        className={`api-debug-fab__trigger ${
          hasActiveChaos ? 'api-debug-fab__trigger--active' : ''
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label="Dev Chaos Controls"
        title="Dev Chaos Controls"
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
        <span className="api-debug-fab__trigger-label">Chaos Dev</span>
        {hasActiveChaos && (
          <span className="api-debug-fab__status-dot" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default ApiDebugFab;
