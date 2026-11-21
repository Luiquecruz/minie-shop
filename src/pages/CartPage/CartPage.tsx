import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CartPageProvider } from '../../context/CartPageProvider';
import { useCartPageContext } from '../../context/cartPageState';
import CartHeader from './components/CartHeader';
import CartItemRow from './components/CartItemRow';
import CartPromoBox from './components/CartPromoBox';
import CartShippingSelector from './components/CartShippingSelector';
import CartOrderNote from './components/CartOrderNote';
import CartOrderSummary from './components/CartOrderSummary';
import './CartPage.css';

function CartPageContent() {
  const { state, totalUnits } = useCartPageContext();

  const pageTitle =
    totalUnits > 0
      ? `Shopping Cart (${totalUnits}) | Minie Shop`
      : 'Shopping Cart | Minie Shop';

  return (
    <div className="cart-page">
      <Helmet>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="Review your shopping cart, adjust quantities, apply promo codes, and choose your shipping method at Minie Shop."
        />
      </Helmet>

      <CartHeader />

      {state.items.length === 0 ? (
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
            codes, shipping rates, and Context re-render behavior.
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
                {state.items.map((item) => (
                  <CartItemRow key={item.id} item={item} />
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

/**
 * Dedicated Cart Page (/cart) powered in Increment 1 by a monolithic
 * React Context + useReducer provider.
 */
export function CartPage() {
  return (
    <CartPageProvider>
      <CartPageContent />
    </CartPageProvider>
  );
}

export default CartPage;
