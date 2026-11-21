import {
  PROMO_COUPONS,
  useCartPageContext,
} from '../../../context/cartPageState';

const SUGGESTED_CODES = Object.keys(PROMO_COUPONS);

/**
 * Promo coupon panel wired to CartPageContext.
 * Typing or applying a coupon dispatches into the monolithic reducer.
 */
export function CartPromoBox() {
  const { state, setCouponInput, applyCoupon, removeCoupon } =
    useCartPageContext();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    applyCoupon();
  };

  return (
    <section className="cart-panel" aria-labelledby="cart-promo-heading">
      <div className="cart-panel__header">
        <h2 id="cart-promo-heading" className="cart-panel__title">
          Promo Code
        </h2>
      </div>

      <form className="cart-promo__form" onSubmit={handleSubmit}>
        <label htmlFor="cart-coupon-input" className="cart-sr-only">
          Promo code
        </label>
        <input
          id="cart-coupon-input"
          type="text"
          value={state.couponInput}
          onChange={(e) => setCouponInput(e.target.value)}
          placeholder="Enter MINIE10, MINIE20, or FREESHIP"
          className="cart-promo__input"
        />
        <button type="submit" className="cart-promo__apply-btn">
          Apply
        </button>
      </form>

      <div className="cart-promo__chips" aria-label="Available promo codes">
        {SUGGESTED_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className={`cart-promo__chip ${
              state.appliedCoupon?.code === code
                ? 'cart-promo__chip--active'
                : ''
            }`}
            onClick={() => applyCoupon(code)}
          >
            {code}
          </button>
        ))}
      </div>

      {state.appliedCoupon && (
        <div className="cart-promo__applied" role="status">
          <div className="cart-promo__applied-info">
            <span className="cart-promo__applied-code">
              {state.appliedCoupon.code}
            </span>
            <span className="cart-promo__applied-desc">
              {state.appliedCoupon.label}
            </span>
          </div>
          <button
            type="button"
            className="cart-promo__remove-btn"
            onClick={removeCoupon}
            aria-label={`Remove promo code ${state.appliedCoupon.code}`}
          >
            Remove
          </button>
        </div>
      )}

      {state.couponError && (
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
          <span>{state.couponError}</span>
        </div>
      )}
    </section>
  );
}

export default CartPromoBox;
