import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { isNotFoundError } from '../../domain/errors';
import { useCartActions } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useProductQuery } from '../../hooks/useProducts';
import { useI18n } from '../../i18n';
import { cn } from '@minieshop/ui/tokens';
import AttributeIcon from '../../components/AttributeIcon/AttributeIcon';
import PriceBox from '../../components/PriceBox/PriceBox';
import ProductImage from '../../components/ProductImage/ProductImage';
import NotFoundPage from '../NotFoundPage/NotFoundPage';
import PdpRecommendationsSection from './components/PdpRecommendationsSection';

type DetailTab = 'description' | 'specs';

export function ProductDetailPage() {
  const { category: categoryParam, slug } = useParams<{
    category: string;
    slug: string;
  }>();
  const navigate = useNavigate();
  const { addToCart } = useCartActions();
  const { t } = useI18n();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const {
    isFavorite,
    toggleFavorite,
    error: favoriteError,
    resetError: resetFavoriteError,
  } = useFavorites();

  const formatAttributeValue = (
    value: string | number | boolean,
    unit?: string,
  ): string => {
    if (typeof value === 'boolean') {
      return value ? t('filters.yes') : t('filters.no');
    }
    return unit ? `${value} ${unit}` : String(value);
  };

  const [tabSelection, setTabSelection] = useState<{
    productSlug: string | undefined;
    tab: DetailTab;
  }>({ productSlug: slug, tab: 'description' });
  const [addedNotice, setAddedNotice] = useState<string>('');

  const activeTab: DetailTab =
    tabSelection.productSlug === slug ? tabSelection.tab : 'description';

  const productQuery = useProductQuery(slug);
  const product = productQuery.data;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  useEffect(() => {
    if (!favoriteError) return;
    const timer = setTimeout(() => {
      resetFavoriteError();
    }, 4000);
    return () => clearTimeout(timer);
  }, [favoriteError, resetFavoriteError]);

  if (!slug) {
    return <NotFoundPage />;
  }

  if (productQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <div className="skeleton-shimmer aspect-[4/3] w-full rounded-2xl" />
            <div className="skeleton-shimmer h-40 w-full rounded-2xl" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="skeleton-shimmer h-5 w-1/3 rounded-lg" />
            <div className="skeleton-shimmer h-10 w-4/5 rounded-lg" />
            <div className="skeleton-shimmer h-8 w-1/2 rounded-lg" />
            <div className="skeleton-shimmer h-28 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (productQuery.isError || !product) {
    const isNotFound = isNotFoundError(productQuery.error);

    if (isNotFound) {
      return <NotFoundPage />;
    }

    const errorMessage =
      productQuery.error instanceof Error
        ? productQuery.error.message
        : t('pdp.errorFallback');

    return (
      <div
        className="mx-auto flex min-h-[55vh] w-full max-w-[1280px] items-center justify-center px-4 py-12 sm:px-6"
        role="alert"
      >
        <Helmet>
          <title>{`${t('pdp.errorTitle')} | Minie Shop`}</title>
          <meta name="description" content={t('pdp.errorFallback')} />
        </Helmet>
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-danger-border bg-surface p-8 text-center shadow-card-sm">
          <div className="text-danger">
            <svg
              width="48"
              height="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="m-0 text-xl font-bold text-fg-heading">
            {t('pdp.errorTitle')}
          </h2>
          <p className="text-sm text-fg-muted">{errorMessage}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
              onClick={() => {
                void productQuery.refetch();
              }}
              disabled={productQuery.isFetching}
            >
              {productQuery.isFetching ? t('plp.retrying') : t('plp.retry')}
            </button>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-subtle px-5 py-2.5 text-sm font-semibold text-fg-heading transition-colors hover:bg-surface-chip"
              onClick={() => navigate('/')}
            >
              {t('pdp.backToCatalog')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Canonicalize category segment for SEO / structured data consistency
  if (categoryParam && categoryParam !== product.category.slug) {
    return (
      <Navigate to={`/${product.category.slug}/${product.slug}`} replace />
    );
  }

  const {
    id,
    name,
    category,
    breadcrumbs,
    price,
    description,
    images,
    inStock,
    attributes,
  } = product;

  const favorited = isFavorite(id);
  const primaryImage = images[0] ?? null;

  const handleAddToCart = (): void => {
    addToCart(product);
    setAddedNotice(t('pdp.addedToCart', { name }));
    setTimeout(() => setAddedNotice(''), 3000);
  };

  const handleBuyNow = (): void => {
    addToCart(product);
    setAddedNotice(t('pdp.proceedingToCheckout', { name }));
    setTimeout(() => setAddedNotice(''), 3000);
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'description', label: t('pdp.tabDescription') },
    { id: 'specs', label: t('pdp.tabSpecs') },
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        setTabSelection({ productSlug: slug, tab: nextTab.id });
        tabRefs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <div className="pb-28">
      <Helmet>
        <title>{`${name} | Minie Shop`}</title>
        <meta
          name="description"
          content={
            description || t('pdp.metaDescriptionFallback', { name })
          }
        />
      </Helmet>

      {/* Floating alert notifications */}
      {addedNotice && (
        <div
          className="fixed right-6 top-20 z-[var(--z-toast)] flex max-w-md items-center gap-2.5 rounded-xl border border-success-border bg-surface px-4 py-3 text-sm font-semibold text-success shadow-card-lg animate-fade-in"
          role="alert"
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          <span>{addedNotice}</span>
        </div>
      )}

      {favoriteError && (
        <div
          className="fixed right-6 top-20 z-[var(--z-toast)] flex max-w-md items-center gap-2.5 rounded-xl border border-danger-border bg-surface px-4 py-3 text-sm font-semibold text-danger shadow-card-lg animate-fade-in"
          role="alert"
        >
          <svg
            width="20"
            height="20"
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
          <span>{favoriteError.message}</span>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:py-8">
        {/* API Breadcrumbs */}
        <nav
          className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium text-fg-muted sm:text-sm"
          aria-label={t('pdp.breadcrumbAria')}
        >
          <Link
            to="/"
            className="text-fg-muted no-underline transition-colors hover:text-brand"
          >
            {t('pdp.breadcrumbCatalog')}
          </Link>
          {breadcrumbs.map((crumb) => (
            <Fragment key={crumb.slug}>
              <span aria-hidden="true">/</span>
              <Link
                to={`/?category=${encodeURIComponent(crumb.slug)}`}
                className="text-fg-muted no-underline transition-colors hover:text-brand"
              >
                {crumb.name}
              </Link>
            </Fragment>
          ))}
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-fg-heading" aria-current="page">
            {name}
          </span>
        </nav>

        {/* Main Product Layout: Left Gallery + Right Details */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <section className="flex flex-col gap-3" aria-label={t('pdp.galleryAria')}>
            <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto lg:grid lg:grid-cols-1 lg:overflow-visible">
              {images.length > 0 ? (
                images.map((img, index) => (
                  <div
                    key={img.id}
                    className="relative w-full shrink-0 snap-center overflow-hidden rounded-2xl border border-border bg-surface shadow-card-sm"
                    data-index={index}
                  >
                    <ProductImage
                      image={img}
                      productName={name}
                      aspectRatio="4 / 3"
                      sizes="(max-width: 900px) 100vw, 50vw"
                      priority={index === 0}
                    />
                    {images.length > 1 && (
                      <span className="absolute bottom-3 right-3 rounded-full border border-border bg-surface/90 px-2.5 py-0.5 text-xs font-bold tabular-nums text-fg-heading backdrop-blur-sm">
                        {index + 1} / {images.length}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div
                  className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-card-sm"
                  data-index={0}
                >
                  <ProductImage
                    image={null}
                    productName={name}
                    aspectRatio="4 / 3"
                    priority
                  />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-fg-muted lg:hidden"
                aria-hidden="true"
              >
                <span>{t('pdp.swipeHint')}</span>
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </div>
            )}
          </section>

          <section
            className="flex flex-col gap-6 lg:sticky lg:top-20"
            aria-label={t('pdp.detailsAria')}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
                  {category.name}
                </span>
                <button
                  type="button"
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    favorited
                      ? 'border-danger-border bg-danger-bg text-danger'
                      : 'border-border bg-surface text-fg-heading hover:border-danger-border hover:text-danger',
                  )}
                  onClick={() => toggleFavorite(id)}
                  aria-pressed={favorited}
                  aria-label={
                    favorited
                      ? t('card.removeFavoriteAria', { name })
                      : t('card.addFavoriteAria', { name })
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={favorited ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                    />
                  </svg>
                  <span>{favorited ? t('pdp.saved') : t('pdp.save')}</span>
                </button>
              </div>

              <h1 className="pdp-info__title m-0 text-2xl font-extrabold leading-tight tracking-tight text-fg-heading sm:text-3xl">
                {name}
              </h1>

              <div>
                {inStock ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-bg px-3 py-1 text-xs font-bold text-success">
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                    {t('pdp.inStock')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-danger-border bg-danger-bg px-3 py-1 text-xs font-bold text-danger">
                    <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
                    {t('pdp.outOfStock')}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card-sm">
              <PriceBox price={price} size="lg" />
            </div>

            <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-border bg-surface-subtle p-4 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-xs font-medium text-fg">
                <svg
                  className="shrink-0 text-brand"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V3.75m0 3.75h3.75m-3.75 0a2.25 2.25 0 00-2.25 2.25v7.5"
                  />
                </svg>
                <span>{t('pdp.assuranceShipping')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-fg">
                <svg
                  className="shrink-0 text-brand"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span>{t('pdp.assuranceWarranty')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-fg">
                <svg
                  className="shrink-0 text-brand"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <span>{t('pdp.assuranceReturn')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold text-fg-heading shadow-card-sm transition-colors hover:border-brand-border hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleAddToCart}
                disabled={!inStock}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.144a.75.75 0 00-.712-.981H5.106m2.394 8.125L5.106 5.25m2.394 9l-1.026 3.078M16.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
                  />
                </svg>
                {t('pdp.addToCart')}
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleBuyNow}
                disabled={!inStock}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
                {t('pdp.buyNow')}
              </button>
            </div>

            {/* Content Tabs */}
            <div className="rounded-2xl border border-border bg-surface shadow-card-sm">
              <div
                className="flex border-b border-border px-2 pt-2"
                role="tablist"
                aria-label={t('pdp.tabsAria')}
              >
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls={`panel-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    className={cn(
                      'relative -mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                      activeTab === tab.id
                        ? 'border-brand text-brand'
                        : 'border-transparent text-fg-muted hover:text-fg-heading',
                    )}
                    onClick={() =>
                      setTabSelection({ productSlug: slug, tab: tab.id })
                    }
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {activeTab === 'description' && (
                  <div
                    id="panel-description"
                    role="tabpanel"
                    aria-labelledby="tab-description"
                    tabIndex={0}
                    className="flex flex-col gap-5 focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <p className="text-sm leading-relaxed text-fg">{description}</p>
                    {attributes.length > 0 && (
                      <dl className="m-0 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {attributes.map((attr) => (
                          <div
                            key={attr.code}
                            className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5"
                          >
                            <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                              <AttributeIcon iconKey={attr.icon} size={15} />
                              <span>{attr.label}</span>
                            </dt>
                            <dd className="m-0 text-sm font-bold text-fg-heading">
                              {formatAttributeValue(attr.value, attr.unit)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}

                {activeTab === 'specs' && (
                  <div
                    id="panel-specs"
                    role="tabpanel"
                    aria-labelledby="tab-specs"
                    tabIndex={0}
                    className="focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {attributes.length > 0 ? (
                      <dl className="m-0 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {attributes.map((attr) => (
                          <div
                            key={attr.code}
                            className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5"
                          >
                            <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                              <AttributeIcon iconKey={attr.icon} size={15} />
                              <span>{attr.label}</span>
                            </dt>
                            <dd className="m-0 text-sm font-bold text-fg-heading">
                              {formatAttributeValue(attr.value, attr.unit)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-fg-muted">{t('pdp.noSpecs')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Full-width recommendation carousels cleanly below the 2-column PDP grid */}
        <PdpRecommendationsSection key={product.slug} slug={product.slug} />
      </div>

      {/* Floating Bottom Action Bar */}
      <aside
        className="pdp-floating-bar fixed inset-x-0 bottom-0 z-[var(--z-floating-bar)] border-t border-border bg-surface-nav shadow-floating backdrop-blur-md"
        aria-label={t('pdp.floatingBarAria')}
      >
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <ProductImage
              image={primaryImage}
              productName={name}
              aspectRatio="1 / 1"
              sizes="48px"
              decorative
              className="h-12 w-12 shrink-0 rounded-xl border border-border"
            />
            <div className="flex min-w-0 flex-col">
              <span
                className="truncate text-sm font-bold text-fg-heading"
                title={name}
              >
                {name}
              </span>
              <span className="truncate text-xs text-fg-muted">
                {category.name}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <PriceBox price={price} size="sm" />
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              className="pdp-btn--secondary inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-fg-heading transition-colors hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              onClick={handleAddToCart}
              disabled={!inStock}
              aria-label={t('card.addToCartAria', { name })}
            >
              <span>{t('pdp.addToCart')}</span>
            </button>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-card-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              onClick={handleBuyNow}
              disabled={!inStock}
              aria-label={t('pdp.buyNowAria', { name })}
            >
              <span>{t('pdp.buyNow')}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default ProductDetailPage;
