import { memo } from 'react';
import { useCartActions, useCartShippingState } from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';
import { useI18n } from '../../../i18n';
import type { ShippingMethodId } from '../../../types';
import { cn } from '@minieshop/ui/tokens';

export interface CartShippingSelectorProps {
  isPriceLoading?: boolean;
  hasCurrencyMismatch?: boolean;
}

/**
 * Memoized shipping method selector subscribed only to shipping method
 * and memoized free-shipping eligibility booleans.
 */
export const CartShippingSelector = memo(function CartShippingSelector({
  isPriceLoading = false,
  hasCurrencyMismatch = false,
}: CartShippingSelectorProps) {
  const {
    shippingMethod,
    shippingOptions,
    qualifiesForFreeStandard,
    hasFreeShippingCoupon,
  } = useCartShippingState();
  const { setShippingMethod } = useCartActions();
  const { formatPrice } = useCurrency();
  const { t } = useI18n();

  const getShippingCopy = (
    id: ShippingMethodId,
    fallbackName: string,
    fallbackEta: string,
  ): { name: string; eta: string } => {
    switch (id) {
      case 'standard':
        return {
          name: t('cart.shipping.standard.name'),
          eta: t('cart.shipping.standard.eta'),
        };
      case 'express':
        return {
          name: t('cart.shipping.express.name'),
          eta: t('cart.shipping.express.eta'),
        };
      case 'pickup':
        return {
          name: t('cart.shipping.pickup.name'),
          eta: t('cart.shipping.pickup.eta'),
        };
      default:
        return { name: fallbackName, eta: fallbackEta };
    }
  };

  return (
    <section
      className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5 shadow-card-sm"
      aria-labelledby="cart-shipping-heading"
    >
      <div className="flex items-center justify-between">
        <h2
          id="cart-shipping-heading"
          className="m-0 text-base font-bold text-fg-heading"
        >
          {t('cart.shippingHeading')}
        </h2>
      </div>

      <div
        className="flex flex-col gap-2.5"
        role="radiogroup"
        aria-labelledby="cart-shipping-heading"
        aria-busy={isPriceLoading}
      >
        {shippingOptions.map((option) => {
          const isSelected = shippingMethod === option.id;
          const isFree =
            option.basePriceCents === 0 ||
            hasFreeShippingCoupon ||
            (option.id === 'standard' && qualifiesForFreeStandard);
          const copy = getShippingCopy(option.id, option.name, option.eta);

          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                isSelected
                  ? 'border-brand-border bg-brand-subtle'
                  : 'border-border bg-surface-subtle hover:bg-surface-chip',
              )}
            >
              <input
                type="radio"
                name="cart-shipping-method"
                value={option.id}
                checked={isSelected}
                onChange={() => setShippingMethod(option.id)}
                className="h-4 w-4 cursor-pointer accent-brand"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold text-fg-heading">
                  {copy.name}
                </span>
                <span className="text-xs text-fg-muted">{copy.eta}</span>
              </div>
              <span
                className={cn(
                  'shrink-0 text-sm font-bold tabular-nums',
                  isFree ? 'text-success' : 'text-fg-heading',
                )}
              >
                {isPriceLoading && option.basePriceCents > 0 ? (
                  <span
                    className="skeleton-shimmer inline-block h-4 w-16 rounded-md"
                    aria-label={t('cart.updatingShippingPrice')}
                  />
                ) : hasCurrencyMismatch &&
                  option.basePriceCents > 0 &&
                  !hasFreeShippingCoupon ? (
                  '—'
                ) : isFree ? (
                  t('cart.shippingFree')
                ) : (
                  formatPrice(option.basePriceCents)
                )}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
});

export default CartShippingSelector;
