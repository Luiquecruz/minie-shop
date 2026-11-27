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
    <header className="mb-8 flex flex-col gap-3">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs font-medium text-fg-muted sm:text-sm"
        aria-label={t('cart.breadcrumbAria')}
      >
        <Link
          to="/"
          className="text-fg-muted no-underline transition-colors hover:text-brand"
        >
          {t('cart.breadcrumbCatalog')}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-fg-heading" aria-current="page">
          {t('cart.title')}
        </span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-fg-heading sm:text-3xl">
            {t('cart.title')}
          </h1>
          <span className="inline-flex items-center rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-xs font-bold text-brand">
            {totalUnits}{' '}
            {totalUnits === 1 ? t('cart.unitSingular') : t('cart.unitPlural')}
          </span>
        </div>

        <div>
          {hasItems && (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger-border bg-danger-bg px-3.5 py-2 text-xs font-semibold text-danger transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
