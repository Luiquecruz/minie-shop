import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  resolveMaxStock,
  useCartActions,
  useCartItemState,
} from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  translateStockWarning,
  useStockValidationQuery,
} from '../../../hooks/useProducts';
import { useI18n } from '../../../i18n';
import ProductImage from '../../../components/ProductImage/ProductImage';

export interface CartItemRowProps {
  itemId: string;
  isCurrencyRepricing?: boolean;
}

/**
 * Memoized CartPage line item subscribed strictly to its own item ID slice
 * so edits to sibling items, promo codes, shipping, or notes cause 0 re-renders here.
 */
export const CartItemRow = memo(function CartItemRow({
  itemId,
  isCurrencyRepricing = false,
}: CartItemRowProps) {
  const { item, stockWarning } = useCartItemState(itemId);
  const { updateQuantity, removeFromCart } = useCartActions();
  const { currentCurrency, formatPrice } = useCurrency();
  const { t } = useI18n();

  const [localWarning, setLocalWarning] = useState<{
    key: 'cart.maxStockReached' | 'cart.onlyAvailableInStock';
    max: number;
  } | null>(null);
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);
  const [draftQty, setDraftQty] = useState<string | null>(null);

  const quantity = item?.quantity ?? 0;
  const slug = item?.slug ?? '';
  const debouncedQuantity = useDebounce(quantity, 300);
  const shouldValidate =
    Boolean(item) && hasEditedQuantity && debouncedQuantity === quantity;
  const stockQuery = useStockValidationQuery(
    slug,
    debouncedQuantity,
    shouldValidate,
  );

  if (!item) return null;

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
    stockWarning,
    () => t('cart.outOfStockWarning'),
  );

  const translatedLocalWarning = localWarning
    ? t(localWarning.key, { max: localWarning.max })
    : null;

  const activeWarning =
    translatedLocalWarning ?? apiStockWarning ?? translatedPropWarning ?? null;
  const isValidating = shouldValidate && stockQuery.isFetching;

  const maxStock = Math.max(1, resolveMaxStock(item.stock, true));
  const unitPriceCents = item.price.amount;
  const lineTotalCents = unitPriceCents * item.quantity;
  const productPath = `/${item.categorySlug}/${item.slug}`;
  const isPriceShimmer =
    isCurrencyRepricing && item.price.currency !== currentCurrency;

  const handleIncrement = (): void => {
    setDraftQty(null);
    if (item.quantity >= maxStock) {
      setLocalWarning({ key: 'cart.maxStockReached', max: maxStock });
      return;
    }
    setLocalWarning(null);
    setHasEditedQuantity(true);
    updateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = (): void => {
    setDraftQty(null);
    if (item.quantity <= 1) return;
    setLocalWarning(null);
    setHasEditedQuantity(true);
    updateQuantity(item.id, item.quantity - 1);
  };

  const commitDraftQuantity = (raw: string): void => {
    setDraftQty(null);
    const trimmed = raw.trim();
    if (trimmed === '') {
      return;
    }

    const parsed = Math.trunc(Number(trimmed));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setLocalWarning(null);
      setHasEditedQuantity(true);
      updateQuantity(item.id, 1);
      return;
    }

    if (parsed > maxStock) {
      setHasEditedQuantity(true);
      updateQuantity(item.id, maxStock);
      setLocalWarning({ key: 'cart.onlyAvailableInStock', max: maxStock });
      return;
    }

    setLocalWarning(null);
    setHasEditedQuantity(true);
    updateQuantity(item.id, parsed);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setDraftQty(e.target.value);
  };

  const handleInputBlur = (): void => {
    if (draftQty !== null) {
      commitDraftQuantity(draftQty);
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (e.key === 'Enter' && draftQty !== null) {
      commitDraftQuantity(draftQty);
    } else if (e.key === 'Escape') {
      setDraftQty(null);
    }
  };

  return (
    <li
      className="cart-item flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card-sm sm:flex-row sm:p-5"
      data-product-id={item.id}
    >
      <Link
        to={productPath}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border-subtle no-underline"
        aria-label={t('cart.viewItemAria', { name: item.name })}
      >
        <ProductImage
          image={item.image}
          productName={item.name}
          aspectRatio="1 / 1"
          sizes="96px"
          className="h-full w-full"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {item.categorySlug}
          </span>

          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-fg-muted transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => removeFromCart(item.id)}
            aria-label={t('cart.removeItemAria', { name: item.name })}
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
            <span>{t('cart.remove')}</span>
          </button>
        </div>

        <Link
          to={productPath}
          className="text-base font-bold leading-snug text-fg-heading no-underline hover:text-brand"
        >
          {item.name}
        </Link>

        <div className="text-xs font-medium text-fg-muted" aria-busy={isPriceShimmer}>
          {isPriceShimmer ? (
            <span
              className="skeleton-shimmer inline-block h-4 w-24 rounded-md"
              aria-label={t('cart.updatingUnitPrice')}
            />
          ) : (
            <span className="tabular-nums">
              {t('cart.eachPrice', {
                price: formatPrice(unitPriceCents, item.price.currency),
              })}
            </span>
          )}
        </div>

        {activeWarning && (
          <div
            className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-bg px-3 py-2 text-xs font-medium text-warning"
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

        <div className="mt-1 flex flex-wrap items-end justify-between gap-4 border-t border-border-subtle pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface-input">
              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center text-fg-heading transition-colors hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleDecrement}
                disabled={item.quantity <= 1}
                aria-label={t('cart.decreaseQtyFor', { name: item.name })}
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
                min={1}
                max={maxStock}
                value={draftQty !== null ? draftQty : String(item.quantity)}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                className="h-9 w-12 border-x border-border bg-transparent text-center text-sm font-bold tabular-nums text-fg-heading focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label={t('cart.qtyLabelFor', { name: item.name })}
              />

              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center text-fg-heading transition-colors hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleIncrement}
                disabled={item.quantity >= maxStock}
                aria-label={t('cart.increaseQtyFor', { name: item.name })}
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

            <span className="text-xs text-fg-muted">
              {t('cart.inStockCount', { count: maxStock })}
            </span>

            {isValidating && (
              <span
                className="inline-flex items-center text-brand"
                aria-label={t('cart.validatingStock')}
              >
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  width="14"
                  height="14"
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

          <div
            className="flex flex-col items-end gap-0.5"
            aria-busy={isPriceShimmer}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              {t('cart.lineTotal')}
            </span>
            {isPriceShimmer ? (
              <span
                className="skeleton-shimmer inline-block h-5 w-24 rounded-md"
                aria-label={t('cart.updatingLineTotal')}
              />
            ) : (
              <span className="text-base font-extrabold tabular-nums text-fg-heading">
                {formatPrice(lineTotalCents, item.price.currency)}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
});

export default CartItemRow;
