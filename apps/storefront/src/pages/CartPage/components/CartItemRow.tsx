import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartActions, useCartItemState } from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';
import { useDebounce } from '../../../hooks/useDebounce';
import { useStockValidationQuery } from '../../../hooks/useProducts';
import { resolveMaxStock } from '../../../store/slices/cartSlice';
import ProductImage from '../../../components/ProductImage/ProductImage';

export interface CartItemRowProps {
  itemId: string;
}

/**
 * Memoized CartPage line item subscribed strictly to its own item ID slice
 * so edits to sibling items, promo codes, shipping, or notes cause 0 re-renders here.
 */
export const CartItemRow = memo(function CartItemRow({
  itemId,
}: CartItemRowProps) {
  const { item, stockWarning } = useCartItemState(itemId);
  const { updateQuantity, removeFromCart } = useCartActions();
  const { formatPrice } = useCurrency();

  const [localWarning, setLocalWarning] = useState<string | null>(null);
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
      ? stockQuery.data.message
      : shouldValidate && stockQuery.isError
        ? 'Could not validate stock right now.'
        : null;

  const activeWarning = localWarning ?? apiStockWarning ?? stockWarning ?? null;
  const isValidating = shouldValidate && stockQuery.isFetching;

  const maxStock = Math.max(1, resolveMaxStock(item.stock, true));
  const unitPriceCents = item.price.amount;
  const lineTotalCents = unitPriceCents * item.quantity;
  const productPath = `/${item.categorySlug}/${item.slug}`;

  const handleIncrement = (): void => {
    setDraftQty(null);
    if (item.quantity >= maxStock) {
      setLocalWarning(`Maximum stock reached (${maxStock} units).`);
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
      setLocalWarning(`Only ${maxStock} units available in stock.`);
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
    <li className="cart-item" data-product-id={item.id}>
      <Link
        to={productPath}
        className="cart-item__image-link"
        aria-label={`View ${item.name}`}
      >
        <ProductImage
          image={item.image}
          productName={item.name}
          aspectRatio="1 / 1"
          sizes="96px"
          className="cart-item__image"
        />
      </Link>

      <div className="cart-item__content">
        <div className="cart-item__meta-row">
          <span className="cart-item__category">{item.categorySlug}</span>

          <div className="cart-item__meta-right">
            <button
              type="button"
              className="cart-item__remove-btn"
              onClick={() => removeFromCart(item.id)}
              aria-label={`Remove ${item.name} from cart`}
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
              <span>Remove</span>
            </button>
          </div>
        </div>

        <Link to={productPath} className="cart-item__title">
          {item.name}
        </Link>

        <div className="cart-item__unit-pricing">
          <span className="cart-item__unit-current">
            {formatPrice(unitPriceCents, item.price.currency)} each
          </span>
        </div>

        {activeWarning && (
          <div className="cart-alert cart-alert--warning" role="alert">
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

        <div className="cart-item__bottom-row">
          <div className="cart-item__qty-group">
            <div className="cart-item__qty-stepper">
              <button
                type="button"
                className="cart-item__qty-btn"
                onClick={handleDecrement}
                disabled={item.quantity <= 1}
                aria-label={`Decrease quantity for ${item.name}`}
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
                className="cart-item__qty-input"
                aria-label={`Quantity for ${item.name}`}
              />

              <button
                type="button"
                className="cart-item__qty-btn"
                onClick={handleIncrement}
                disabled={item.quantity >= maxStock}
                aria-label={`Increase quantity for ${item.name}`}
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

            <span className="cart-item__stock-hint">{maxStock} in stock</span>

            {isValidating && (
              <span
                className="cart-item__validating"
                aria-label="Validating stock"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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

          <div className="cart-item__line-total-group">
            <span className="cart-item__line-total-label">Line Total</span>
            <span className="cart-item__line-total">
              {formatPrice(lineTotalCents, item.price.currency)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
});

export default CartItemRow;
