import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCartHasItems, useCartItemIds, useCartPageMeta } from '../../hooks/useCart';
import { useCartQuoteSync } from '../../hooks/useCartQuoteSync';
import { useI18n } from '../../i18n';
import CartHeader from './components/CartHeader';
import CartItemRow from './components/CartItemRow';
import CartPromoBox from './components/CartPromoBox';
import CartShippingSelector from './components/CartShippingSelector';
import CartOrderNote from './components/CartOrderNote';
import CartOrderSummary from './components/CartOrderSummary';
import CartCrossSellSection from './components/CartCrossSellSection';

const CartPageTitle = memo(function CartPageTitle() {
  const { totalUnits } = useCartPageMeta();
  const { t } = useI18n();
  const pageTitle =
    totalUnits > 0
      ? t('cart.metaTitleWithCount', { count: totalUnits })
      : t('cart.metaTitle');

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={t('cart.metaDescription')} />
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
  const { t } = useI18n();
  const {
    hasCurrencyMismatch,
    isTotalsLoading,
    quoteError,
    retryQuote,
  } = useCartQuoteSync(hasItems);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <CartPageTitle />
      <CartHeader />

      {!hasItems ? (
        <section
          className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-6 py-16 text-center shadow-card-sm"
          aria-label={t('cart.emptySectionAria')}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-chip text-fg-muted"
            aria-hidden="true"
          >
            <svg
              width="40"
              height="40"
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
          <h2 className="m-0 text-xl font-bold text-fg-heading">
            {t('cart.emptyTitle')}
          </h2>
          <p className="max-w-md text-sm text-fg-muted">{t('cart.emptyDesc')}</p>
          <Link
            to="/"
            className="mt-2 inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white no-underline shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t('cart.exploreCatalog')}
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            {quoteError && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm font-medium text-warning"
                role="alert"
              >
                <span>{quoteError}</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-warning-border bg-surface px-3 py-1.5 text-xs font-bold text-warning hover:opacity-90"
                  onClick={retryQuote}
                >
                  {t('cart.retry')}
                </button>
              </div>
            )}

            <section aria-label={t('cart.itemsSectionAria')}>
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {itemIds.map((id) => (
                  <CartItemRow
                    key={id}
                    itemId={id}
                    isCurrencyRepricing={isTotalsLoading}
                  />
                ))}
              </ul>
            </section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <CartPromoBox />
              <CartShippingSelector
                isPriceLoading={isTotalsLoading}
                hasCurrencyMismatch={hasCurrencyMismatch}
              />
            </div>

            <CartOrderNote />
          </div>

          <div className="w-full">
            <CartOrderSummary
              isTotalsLoading={isTotalsLoading}
              hasCurrencyMismatch={hasCurrencyMismatch}
              quoteError={quoteError}
            />
          </div>
        </div>
      )}
      {hasItems && <CartCrossSellSection />}
    </div>
  );
}

export default CartPage;
