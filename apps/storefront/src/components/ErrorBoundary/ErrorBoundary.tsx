import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../../i18n';

export interface ErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  onReset?: () => void;
  fallback?: (props: ErrorBoundaryFallbackProps) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryInnerProps extends ErrorBoundaryProps {
  defaultTitle: string;
  defaultDescription: string;
  defaultRetryLabel: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  lastResetKey: string | undefined;
}

class ErrorBoundaryInner extends Component<
  ErrorBoundaryInnerProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    error: null,
    lastResetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryInnerProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.lastResetKey) {
      return {
        error: null,
        lastResetKey: props.resetKey,
      };
    }
    return null;
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private readonly handleReset = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      if (this.props.fallback) {
        return this.props.fallback({ error, reset: this.handleReset });
      }

      return (
        <section
          className="mx-auto my-16 max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-card-sm"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="mb-2 text-xl font-bold text-fg-heading">
            {this.props.defaultTitle}
          </h2>
          <p className="mb-5 text-sm text-fg-muted">
            {this.props.defaultDescription}
          </p>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={this.handleReset}
          >
            {this.props.defaultRetryLabel}
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

/**
 * Recoverable React Error Boundary with localized fallback copy and automatic
 * reset whenever `resetKey` (e.g., route key) changes.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  const { t } = useI18n();

  return (
    <ErrorBoundaryInner
      {...props}
      defaultTitle={t('errorBoundary.title')}
      defaultDescription={t('errorBoundary.description')}
      defaultRetryLabel={t('errorBoundary.retry')}
    />
  );
}

export default ErrorBoundary;
