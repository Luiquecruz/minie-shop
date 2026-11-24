import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useCartActions, useCartPageMeta } from '../../../hooks/useCart';
import { useI18n } from '../../../i18n';

/**
 * Top header bar for CartPage subscribed only to total unit count and item presence.
 */
export const CartHeader = memo(function CartHeader() {
  const { totalUnits, hasItems } = useCartPageMeta();
  const { clearCart } = useCartActions();
  const { t } = useI18n();

  return (
    <header className="cart-header">
      <div className="cart-header__top">
        <nav className="cart-breadcrumb" aria-label={t('cart.breadcrumbAria')}>
          <Link to="/" className="cart-breadcrumb__link">
            {t('cart.breadcrumbCatalog')}
          </Link>
          <span className="cart-breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <span className="cart-breadcrumb__current" aria-current="page">
            {t('cart.title')}
          </span>
        </nav>
      </div>

      <div className="cart-header__main">
        <div className="cart-header__title-group">
          <h1 className="cart-header__title">{t('cart.title')}</h1>
          <span className="cart-header__count-pill">
            {totalUnits}{' '}
            {totalUnits === 1 ? t('cart.unitSingular') : t('cart.unitPlural')}
          </span>
        </div>

        <div className="cart-header__actions">
          {hasItems && (
            <button
              type="button"
              className="cart-header__clear-btn"
              onClick={clearCart}
            >
              <svg
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
              <span>{t('cart.clearCart')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
});

export default CartHeader;
