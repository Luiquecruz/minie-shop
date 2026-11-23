import { memo } from 'react';
import { SHIPPING_OPTIONS } from '../../../store/slices/cartSlice';
import { useCartActions, useCartShippingState } from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';

/**
 * Memoized shipping method selector subscribed only to shipping method
 * and memoized free-shipping eligibility booleans.
 */
export const CartShippingSelector = memo(function CartShippingSelector() {
  const { shippingMethod, qualifiesForFreeStandard, hasFreeShippingCoupon } =
    useCartShippingState();
  const { setShippingMethod } = useCartActions();
  const { formatPrice } = useCurrency();

  return (
    <section className="cart-panel" aria-labelledby="cart-shipping-heading">
      <div className="cart-panel__header">
        <h2 id="cart-shipping-heading" className="cart-panel__title">
          Shipping Method
        </h2>
      </div>

      <div
        className="cart-shipping__list"
        role="radiogroup"
        aria-labelledby="cart-shipping-heading"
      >
        {SHIPPING_OPTIONS.map((option) => {
          const isSelected = shippingMethod === option.id;
          const isFree =
            option.basePriceBrl === 0 ||
            hasFreeShippingCoupon ||
            (option.id === 'standard' && qualifiesForFreeStandard);

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
                <span className="cart-shipping__name">{option.name}</span>
                <span className="cart-shipping__eta">{option.eta}</span>
              </div>
              <span
                className={`cart-shipping__price ${
                  isFree ? 'cart-shipping__price--free' : ''
                }`}
              >
                {isFree ? 'Free' : formatPrice(option.basePriceBrl)}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
});

export default CartShippingSelector;
