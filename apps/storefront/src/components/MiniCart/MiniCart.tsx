import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CartItem as CartItemType } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useCartQuoteSync } from '../../hooks/useCartQuoteSync';
import { useCurrency } from '../../hooks/useCurrency';
import { useDebounce } from '../../hooks/useDebounce';
import {
  translateStockWarning,
  useStockValidationQuery,
} from '../../hooks/useProducts';
import { useI18n } from '../../i18n';
import ProductImage from '../ProductImage/ProductImage';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  warning?: string;
  isPriceLoading?: boolean;
}

/**
 * Individual Cart Item with debounced React Query availability check and guardrails.
 */
function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  warning,
  isPriceLoading = false,
}: CartItemProps) {
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const [localWarning, setLocalWarning] = useState<{
    key: 'cart.maxStockReached' | 'cart.onlyAvailableInStock';
    max: number;
  } | null>(null);
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);

  const debouncedQuantity = useDebounce(item.quantity, 300);
  const shouldValidate = hasEditedQuantity && debouncedQuantity === item.quantity;
  const stockQuery = useStockValidationQuery(
    item.slug,
    debouncedQuantity,
    shouldValidate,
  );

  const apiStockWarning =
    shouldValidate && stockQuery.data && !stockQuery.data.available
      ? translateStockWarning(
          stockQuery.data.message,
          () => t('cart.outOfStockWarning'),
          true,
        )
      : shouldValidate && stockQuery.isError
        ? t('cart.stockValidateError')
        : null;

  const translatedPropWarning = translateStockWarning(
    warning,
    () => t('cart.outOfStockWarning'),
  );

  const translatedLocalWarning = localWarning
    ? t(localWarning.key, { max: localWarning.max })
    : null;

  const activeWarning =
    translatedLocalWarning ?? apiStockWarning ?? translatedPropWarning ?? null;
  const isValidating = shouldValidate && stockQuery.isFetching;

  const maxStock = typeof item.stock === 'number' ? item.stock : 99;
  const productPath = `/${item.categorySlug}/${item.slug}`;

  const handleIncrement = (): void => {
    if (item.quantity >= maxStock) {
      setLocalWarning({ key: 'cart.maxStockReached', max: maxStock });
      return;
    }
    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = (): void => {
    if (item.quantity <= 1) {
      return;
    }
    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, item.quantity - 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value;
    if (rawValue === '') return;

    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      setLocalWarning(null);
      setHasEditedQuantity(true);
      onUpdateQuantity(item.id, 1);
      return;
    }

    if (parsed > maxStock) {
      setHasEditedQuantity(true);
      onUpdateQuantity(item.id, maxStock);
      setLocalWarning({ key: 'cart.onlyAvailableInStock', max: maxStock });
      return;
    }

    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, parsed);
  };

  const itemTotalCents = item.price.amount * item.quantity;

  return (
    <li
      className="flex gap-3.5 rounded-2xl border border-border bg-surface-subtle p-3"
      data-product-id={item.id}
    >
      <ProductImage
        image={item.image}
        productName={item.name}
        aspectRatio="1 / 1"
        sizes="72px"
        decorative
        className="h-18 w-18 shrink-0 rounded-xl border border-border-subtle"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            {item.categorySlug}
          </span>
          <button
            type="button"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => onRemove(item.id)}
            aria-label={t('miniCart.removeItemAria', { name: item.name })}
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <Link
          to={productPath}
          className="line-clamp-2 text-sm font-bold leading-snug text-fg-heading no-underline hover:text-brand"
          title={item.name}
        >
          {item.name}
        </Link>

        <div className="flex flex-wrap items-baseline gap-2" aria-busy={isPriceLoading}>
          {isPriceLoading ? (
            <span
              className="skeleton-shimmer inline-block h-4 w-20 rounded-md"
              aria-label={t('miniCart.updatingItemPrice')}
            />
          ) : (
            <>
              <span className="text-sm font-extrabold tabular-nums text-fg-heading">
                {formatPrice(itemTotalCents, item.price.currency)}
              </span>
              {item.quantity > 1 && (
                <span className="text-xs tabular-nums text-fg-muted">
                  {t('miniCart.unitPriceEach', {
                    price: formatPrice(item.price.amount, item.price.currency),
                  })}
                </span>
              )}
            </>
          )}
        </div>

        {activeWarning && (
          <div
            className="flex items-center gap-1.5 rounded-lg border border-warning-border bg-warning-bg px-2.5 py-1.5 text-xs font-medium text-warning"
            role="alert"
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span>{activeWarning}</span>
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-surface-input">
            <button
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center text-fg-heading transition-colors hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleDecrement}
              disabled={item.quantity <= 1}
              aria-label={t('cart.decreaseQty')}
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 12h-15"
                />
              </svg>
            </button>

            <input
              type="number"
              min="1"
              max={maxStock}
              value={item.quantity}
              onChange={handleInputChange}
              className="h-7 w-10 border-x border-border bg-transparent text-center text-xs font-bold tabular-nums text-fg-heading focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label={t('cart.qtyLabel')}
            />

            <button
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center text-fg-heading transition-colors hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleIncrement}
              disabled={item.quantity >= maxStock}
              aria-label={t('cart.increaseQty')}
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>

          <span className="text-[11px] text-fg-muted">
            {t('miniCart.availableCount', { count: maxStock })}
          </span>

          {isValidating && (
            <span
              className="inline-flex items-center text-brand"
              aria-label={t('cart.validatingStockEllipsis')}
            >
              <svg
                className="h-3.5 w-3.5 animate-spin"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.3"
                />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function MiniCart() {
  const {
    items,
    isOpen,
    cartCount,
    subtotal,
    stockWarnings,
    updateQuantity,
    removeFromCart,
    closeCart,
  } = useCart();

  const { currentCurrency, formatPrice } = useCurrency();
  const { t } = useI18n();
  const {
    hasCurrencyMismatch,
    isTotalsLoading,
    quoteError,
    retryQuote,
    isItemPriceLoading,
  } = useCartQuoteSync(isOpen);
  const navigate = useNavigate();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (!dialog.open && typeof dialog.showModal === 'function') {
      dialog.showModal();
    }

    closeBtnRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCart();
      }
    };
    const handleBackdropMouseDown = (e: MouseEvent): void => {
      if (e.target === dialog) {
        closeCart();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    dialog.addEventListener('mousedown', handleBackdropMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      dialog.removeEventListener('mousedown', handleBackdropMouseDown);
      document.body.style.overflow = '';
      if (dialog.open && typeof dialog.close === 'function') {
        dialog.close();
      }
      const previous = previouslyFocusedRef.current;
      if (previous && previous.isConnected) {
        previous.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [isOpen, closeCart]);

  const handleCheckout = (): void => {
    setFeedbackNotice(t('miniCart.checkoutNotice'));
    setTimeout(() => setFeedbackNotice(''), 3500);
  };

  const handleViewCart = (): void => {
    closeCart();
    navigate('/cart');
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="mini-cart-dialog minicart--open fixed inset-0 z-[var(--z-drawer)] m-0 h-dvh max-h-dvh w-screen max-w-none overflow-visible border-0 bg-transparent p-0 text-inherit open:flex open:justify-end"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        closeCart();
      }}
    >
      <div className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden border-l border-border bg-surface shadow-card-lg animate-slide-in-right">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-5">
          <div className="flex items-center gap-2.5">
            <h2
              id={titleId}
              className="m-0 text-xl font-extrabold tracking-tight text-fg-heading"
            >
              {t('miniCart.title')}
            </h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-brand-border bg-brand-subtle px-1.5 text-xs font-bold text-brand">
              {cartCount}
            </span>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-subtle text-fg-muted transition-colors hover:bg-surface-chip hover:text-fg-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={closeCart}
            aria-label={t('miniCart.closeAria')}
          >
            <svg
              width="20"
              height="20"
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

        {feedbackNotice && (
          <div
            className="flex items-center gap-2 border-b border-brand-border bg-brand-subtle px-5 py-2.5 text-xs font-semibold text-brand"
            role="status"
          >
            <span>{feedbackNotice}</span>
          </div>
        )}

        {quoteError && (
          <div
            className="flex items-center justify-between gap-3 border-b border-warning-border bg-warning-bg px-5 py-3 text-xs font-medium text-warning"
            role="alert"
          >
            <span>{quoteError}</span>
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-lg border border-warning-border bg-surface px-2.5 py-1 text-xs font-semibold text-warning hover:opacity-90"
              onClick={retryQuote}
            >
              {t('cart.retry')}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <h3 className="m-0 text-lg font-bold text-fg-heading">
                {t('miniCart.emptyTitle')}
              </h3>
              <p className="max-w-xs text-sm text-fg-muted">
                {t('miniCart.emptyDesc')}
              </p>
              <button
                type="button"
                className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={closeCart}
              >
                {t('miniCart.exploreCatalog')}
              </button>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeFromCart}
                  warning={stockWarnings[item.id]}
                  isPriceLoading={isItemPriceLoading(item.price.currency)}
                />
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="shrink-0 border-t border-border bg-surface px-6 py-5">
            <div className="mb-4 flex flex-col gap-2" aria-busy={isTotalsLoading}>
              <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {isTotalsLoading
                  ? t('miniCart.liveUpdatingTotals', {
                      currency: currentCurrency,
                    })
                  : quoteError || hasCurrencyMismatch
                    ? ''
                    : t('miniCart.liveSubtotalUpdated', {
                        currency: currentCurrency,
                        amount: formatPrice(subtotal, currentCurrency),
                      })}
              </span>
              <div className="flex items-center justify-between text-sm text-fg">
                <span>{t('miniCart.subtotal')}</span>
                <span className="font-semibold tabular-nums text-fg-heading">
                  {isTotalsLoading ? (
                    <span
                      className="skeleton-shimmer inline-block h-4 w-20 rounded-md"
                      aria-label={t('miniCart.updatingSubtotal')}
                    />
                  ) : hasCurrencyMismatch ? (
                    <span aria-label={t('miniCart.updatingSubtotal')}>—</span>
                  ) : (
                    formatPrice(subtotal, currentCurrency)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                <span className="text-base font-bold text-fg-heading">
                  {t('miniCart.total')}
                </span>
                <span className="text-lg font-extrabold tabular-nums text-fg-heading">
                  {isTotalsLoading ? (
                    <span
                      className="skeleton-shimmer inline-block h-5 w-24 rounded-md"
                      aria-label={t('miniCart.updatingTotal')}
                    />
                  ) : hasCurrencyMismatch ? (
                    <span aria-label={t('miniCart.updatingTotal')}>—</span>
                  ) : (
                    formatPrice(subtotal, currentCurrency)
                  )}
                </span>
              </div>
              <span className="text-xs text-fg-muted">
                {t('miniCart.taxNote')}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleCheckout}
                disabled={isTotalsLoading || hasCurrencyMismatch || quoteError !== null}
              >
                <span>{t('miniCart.proceedToCheckout')}</span>
              </button>

              <button
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-fg-heading transition-colors hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={handleViewCart}
              >
                <span>{t('miniCart.viewFullCart')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

export default MiniCart;
