import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCartHasItems, useCartItemIds, useCartPageMeta } from '../../hooks/useCart';
import CartHeader from './components/CartHeader';
import CartItemRow from './components/CartItemRow';
import CartPromoBox from './components/CartPromoBox';
import CartShippingSelector from './components/CartShippingSelector';
import CartOrderNote from './components/CartOrderNote';
import CartOrderSummary from './components/CartOrderSummary';
import './CartPage.css';

const CartPageTitle = memo(function CartPageTitle() {
  const { totalUnits } = useCartPageMeta();
  const pageTitle =
    totalUnits > 0
      ? `Shopping Cart (${totalUnits}) | Minie Shop`
      : 'Shopping Cart | Minie Shop';

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta
        name="description"
        content="Review your shopping cart, adjust quantities, apply promo codes, and choose your shipping method at Minie Shop."
      />
    </Helmet>
  );
});

/**
 * Dedicated Cart Page (/cart) backed by pure Redux Toolkit slice reducers,
 * memoized createSelector selectors, and granular hook subscriptions.
 */
export function CartPage() {
  const hasItems = useCartHasItems();
  const itemIds = useCartItemIds();

  return (
    <div className="cart-page">
      <CartPageTitle />
      <CartHeader />

      {!hasItems ? (
        <section className="cart-empty" aria-label="Empty shopping cart">
          <div className="cart-empty__icon" aria-hidden="true">
            <svg
              width="52"
              height="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <h2 className="cart-empty__title">Your shopping cart is empty</h2>
          <p className="cart-empty__desc">
            Add products from the catalog to test quantity guardrails, promo
            codes, shipping rates, and Redux selector memoization.
          </p>
          <Link to="/" className="cart-btn cart-btn--primary cart-empty__cta">
            Explore Catalog
          </Link>
        </section>
      ) : (
        <div className="cart-layout">
          <div className="cart-main">
            <section className="cart-items-section" aria-label="Cart items">
              <ul className="cart-items-list">
                {itemIds.map((id) => (
                  <CartItemRow key={id} itemId={id} />
                ))}
              </ul>
            </section>

            <div className="cart-config-grid">
              <CartPromoBox />
              <CartShippingSelector />
            </div>

            <CartOrderNote />
          </div>

          <div className="cart-sidebar">
            <CartOrderSummary />
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;
