import { memo } from 'react';
import {
  EMPTY_COUPON_ERROR,
  extractInvalidCouponCode,
  PROMO_COUPONS,
} from '../../../store/slices/cartSlice';
import { useCartActions, useCartPromoState } from '../../../hooks/useCart';
import { useI18n } from '../../../i18n';

const SUGGESTED_CODES = Object.keys(PROMO_COUPONS);

/**
 * Memoized promo coupon panel subscribed only to promo coupon slice fields.
 */
export const CartPromoBox = memo(function CartPromoBox() {
  const { couponInput, appliedCoupon, couponError } = useCartPromoState();
  const { setCouponInput, applyCoupon, removeCoupon } = useCartActions();
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    applyCoupon();
  };

  const getCouponLabel = (code: string, fallback: string): string => {
    if (code === 'MINIE10') return t('cart.promo.MINIE10');
    if (code === 'MINIE20') return t('cart.promo.MINIE20');
    if (code === 'FREESHIP') return t('cart.promo.FREESHIP');
    return fallback;
  };

  const invalidCouponCode = extractInvalidCouponCode(couponError);
  const displayCouponError =
    couponError === EMPTY_COUPON_ERROR
      ? t('cart.promo.emptyError')
      : invalidCouponCode
        ? t('cart.promo.invalidError', { code: invalidCouponCode })
        : couponError;

  return (
    <section className="cart-panel" aria-labelledby="cart-promo-heading">
      <div className="cart-panel__header">
        <h2 id="cart-promo-heading" className="cart-panel__title">
          {t('cart.promoHeading')}
        </h2>
      </div>

      <form className="cart-promo__form" onSubmit={handleSubmit}>
        <label htmlFor="cart-coupon-input" className="cart-sr-only">
          {t('cart.promoInputLabel')}
        </label>
        <input
          id="cart-coupon-input"
          type="text"
          value={couponInput}
          onChange={(e) => setCouponInput(e.target.value)}
          placeholder={t('cart.promoPlaceholder')}
          className="cart-promo__input"
        />
        <button type="submit" className="cart-promo__apply-btn">
          {t('cart.promoApply')}
        </button>
      </form>

      <div className="cart-promo__chips" aria-label={t('cart.promoChipsAria')}>
        {SUGGESTED_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className={`cart-promo__chip ${
              appliedCoupon?.code === code ? 'cart-promo__chip--active' : ''
            }`}
            onClick={() => applyCoupon(code)}
          >
            {code}
          </button>
        ))}
      </div>

      {appliedCoupon && (
        <div className="cart-promo__applied" role="status">
          <div className="cart-promo__applied-info">
            <span className="cart-promo__applied-code">
              {appliedCoupon.code}
            </span>
            <span className="cart-promo__applied-desc">
              {getCouponLabel(appliedCoupon.code, appliedCoupon.label)}
            </span>
          </div>
          <button
            type="button"
            className="cart-promo__remove-btn"
            onClick={removeCoupon}
            aria-label={t('cart.promoRemoveAria', { code: appliedCoupon.code })}
          >
            {t('cart.promoRemove')}
          </button>
        </div>
      )}

      {displayCouponError && (
        <div className="cart-alert cart-alert--error" role="alert">
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
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{displayCouponError}</span>
        </div>
      )}
    </section>
  );
});

export default CartPromoBox;
