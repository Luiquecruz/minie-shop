import { memo } from 'react';
import { useCartActions, useCartShippingState } from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';
import { useI18n } from '../../../i18n';
import type { ShippingMethodId } from '../../../types';

export interface CartShippingSelectorProps {
  isPriceLoading?: boolean;
}

/**
 * Memoized shipping method selector subscribed only to shipping method
 * and memoized free-shipping eligibility booleans.
 */
export const CartShippingSelector = memo(function CartShippingSelector({
  isPriceLoading = false,
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
    <section className="cart-panel" aria-labelledby="cart-shipping-heading">
      <div className="cart-panel__header">
        <h2 id="cart-shipping-heading" className="cart-panel__title">
          {t('cart.shippingHeading')}
        </h2>
      </div>

      <div
        className="cart-shipping__list"
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
              className={`cart-shipping__option ${
                isSelected ? 'cart-shipping__option--selected' : ''
              }`}
            >
              <input
                type="radio"
                name="cart-shipping-method"
                value={option.id}
                checked={isSelected}
                onChange={() => setShippingMethod(option.id)}
                className="cart-shipping__radio"
              />
              <div className="cart-shipping__details">
                <span className="cart-shipping__name">{copy.name}</span>
                <span className="cart-shipping__eta">{copy.eta}</span>
              </div>
              <span
                className={`cart-shipping__price ${
                  isFree ? 'cart-shipping__price--free' : ''
                }`}
              >
                {isPriceLoading && option.basePriceCents > 0 ? (
                  <span
                    className="cart-shimmer cart-shimmer--shipping"
                    aria-label={t('cart.updatingShippingPrice')}
                  />
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
