import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDevChaos } from '../../hooks/useDevChaos';
import { cn } from '@minieshop/ui/tokens';

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
    <div
      ref={containerRef}
      className="fixed bottom-5 left-5 z-[var(--z-fab)] flex flex-col items-start gap-2.5"
    >
      {isOpen && (
        <section
          id={popoverId}
          className="w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-surface p-4 shadow-card-lg animate-fade-in"
          aria-label="Dev Chaos Controls"
        >
          <div className="mb-3 flex items-center justify-between border-b border-border-subtle pb-2.5">
            <span className="text-sm font-bold text-fg-heading">
              Dev Chaos Controls
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-subtle text-fg-muted transition-colors hover:bg-surface-chip hover:text-fg-heading"
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
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={delayInputId}
                className="text-xs font-semibold text-fg-heading"
              >
                Artificial Delay (ms or min-max)
              </label>
              <input
                id={delayInputId}
                type="text"
                value={config.delay}
                placeholder="e.g. 800 or 200-800"
                onChange={(e) => setChaosValue('delay', e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-2">
              <label
                htmlFor={failInputId}
                className="cursor-pointer text-xs font-semibold text-fg-heading"
              >
                Force Failure (x-chaos-fail=1)
              </label>
              <input
                id={failInputId}
                type="checkbox"
                checked={config.fail === '1'}
                onChange={(e) =>
                  setChaosValue('fail', e.target.checked ? '1' : '')
                }
                className="h-4 w-4 cursor-pointer accent-brand"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={statusInputId}
                className="text-xs font-semibold text-fg-heading"
              >
                Forced HTTP Status (400-599)
              </label>
              <input
                id={statusInputId}
                type="text"
                value={config.status}
                placeholder="e.g. 503 or 429"
                onChange={(e) => setChaosValue('status', e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3">
            <button
              type="button"
              className="flex-1 cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
              onClick={handleInvalidateAll}
            >
              Invalidate Cache
            </button>
            {hasActiveChaos && (
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-danger-border bg-danger-bg px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:opacity-90"
                onClick={() => {
                  resetChaos();
                  showNotice('Chaos cleared');
                }}
              >
                Reset Chaos
              </button>
            )}
          </div>

          {notice && (
            <p
              className="mt-2.5 rounded-lg bg-brand-subtle px-2.5 py-1.5 text-center text-xs font-semibold text-brand"
              role="status"
            >
              {notice}
            </p>
          )}
        </section>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-card-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          hasActiveChaos
            ? 'border-warning-border bg-warning-bg text-warning'
            : 'border-border bg-surface text-fg-heading hover:bg-surface-chip',
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label="Dev Chaos Controls"
        title="Dev Chaos Controls"
      >
        <svg
          width="16"
          height="16"
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
        <span>Chaos Dev</span>
        {hasActiveChaos && (
          <span
            className="h-2 w-2 rounded-full bg-warning"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}

export default ApiDebugFab;
