import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useProductQuery } from '../../hooks/useProducts';
import { ApiError } from '../../infrastructure/http/errors';
import { useI18n } from '../../i18n';
import AttributeIcon from '../../components/AttributeIcon/AttributeIcon';
import PriceBox from '../../components/PriceBox/PriceBox';
import ProductImage from '../../components/ProductImage/ProductImage';
import NotFoundPage from '../NotFoundPage/NotFoundPage';
import './ProductDetailPage.css';

type DetailTab = 'description' | 'specs';

export function ProductDetailPage() {
  const { category: categoryParam, slug } = useParams<{
    category: string;
    slug: string;
  }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { t } = useI18n();
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
      <div className="pdp-container">
        <div className="pdp-skeleton">
          <div className="pdp-skeleton__gallery">
            <div className="pdp-skeleton__box pdp-skeleton__box--tall" />
            <div className="pdp-skeleton__box pdp-skeleton__box--medium" />
          </div>
          <div className="pdp-skeleton__details">
            <div className="pdp-skeleton__line pdp-skeleton__line--sm" />
            <div className="pdp-skeleton__line pdp-skeleton__line--lg" />
            <div className="pdp-skeleton__line pdp-skeleton__line--md" />
            <div className="pdp-skeleton__line pdp-skeleton__line--xl" />
          </div>
        </div>
      </div>
    );
  }

  if (productQuery.isError || !product) {
    const isNotFound =
      productQuery.error instanceof ApiError && productQuery.error.isNotFound;

    if (isNotFound) {
      return <NotFoundPage />;
    }

    const errorMessage =
      productQuery.error instanceof Error
        ? productQuery.error.message
        : t('pdp.errorFallback');

    return (
      <div className="pdp-container pdp-error-state" role="alert">
        <Helmet>
          <title>{`${t('pdp.errorTitle')} | Minie Shop`}</title>
          <meta name="description" content={t('pdp.errorFallback')} />
        </Helmet>
        <div className="pdp-error-content">
          <div className="pdp-error-icon">
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
          <h2>{t('pdp.errorTitle')}</h2>
          <p>{errorMessage}</p>
          <div className="pdp-error-actions">
            <button
              type="button"
              className="pdp-btn pdp-btn--primary"
              onClick={() => {
                void productQuery.refetch();
              }}
              disabled={productQuery.isFetching}
            >
              {productQuery.isFetching ? t('plp.retrying') : t('plp.retry')}
            </button>
            <button
              type="button"
              className="pdp-btn pdp-btn--secondary"
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

  return (
    <div className="pdp-wrapper">
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
        <div className="pdp-toast" role="alert">
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
        <div className="pdp-toast pdp-toast--error" role="alert">
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

      <main className="pdp-container">
        {/* API Breadcrumbs */}
        <nav className="pdp-breadcrumb" aria-label={t('pdp.breadcrumbAria')}>
          <Link to="/" className="pdp-breadcrumb__link">
            {t('pdp.breadcrumbCatalog')}
          </Link>
          {breadcrumbs.map((crumb) => (
            <Fragment key={crumb.slug}>
              <span className="pdp-breadcrumb__separator" aria-hidden="true">
                /
              </span>
              <Link
                to={`/?category=${encodeURIComponent(crumb.slug)}`}
                className="pdp-breadcrumb__link"
              >
                {crumb.name}
              </Link>
            </Fragment>
          ))}
          <span className="pdp-breadcrumb__separator" aria-hidden="true">
            /
          </span>
          <span className="pdp-breadcrumb__current" aria-current="page">
            {name}
          </span>
        </nav>

        {/* Main Product Layout: Left Gallery + Right Details */}
        <div className="pdp-grid">
          <section className="pdp-gallery" aria-label={t('pdp.galleryAria')}>
            <div className="pdp-gallery__masonry">
              {images.length > 0 ? (
                images.map((img, index) => (
                  <div
                    key={img.id}
                    className="pdp-gallery__item"
                    data-index={index}
                  >
                    <ProductImage
                      image={img}
                      productName={name}
                      aspectRatio="4 / 3"
                      sizes="(max-width: 900px) 100vw, 50vw"
                      priority={index === 0}
                      className="pdp-gallery__image"
                    />
                    {images.length > 1 && (
                      <span className="pdp-gallery__badge">
                        {index + 1} / {images.length}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="pdp-gallery__item" data-index={0}>
                  <ProductImage
                    image={null}
                    productName={name}
                    aspectRatio="4 / 3"
                    priority
                    className="pdp-gallery__image"
                  />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="pdp-gallery__swipe-hint" aria-hidden="true">
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

          <section className="pdp-info" aria-label={t('pdp.detailsAria')}>
            <div className="pdp-info__header">
              <div className="pdp-info__header-top">
                <span className="pdp-info__category">{category.name}</span>
                <button
                  type="button"
                  className={`pdp-favorite-btn ${
                    favorited ? 'pdp-favorite-btn--active' : ''
                  }`}
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

              <h1 className="pdp-info__title">{name}</h1>

              <div className="pdp-info__meta">
                <div className="pdp-info__stock">
                  {inStock ? (
                    <span className="pdp-stock-badge pdp-stock-badge--available">
                      <span className="pdp-stock-dot" />
                      {t('pdp.inStock')}
                    </span>
                  ) : (
                    <span className="pdp-stock-badge pdp-stock-badge--out">
                      <span className="pdp-stock-dot" />
                      {t('pdp.outOfStock')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pdp-info__pricebox">
              <PriceBox price={price} size="lg" />
            </div>

            <div className="pdp-assurance">
              <div className="pdp-assurance__item">
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
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V3.75m0 3.75h3.75m-3.75 0a2.25 2.25 0 00-2.25 2.25v7.5"
                  />
                </svg>
                <span>{t('pdp.assuranceShipping')}</span>
              </div>
              <div className="pdp-assurance__item">
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
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span>{t('pdp.assuranceWarranty')}</span>
              </div>
              <div className="pdp-assurance__item">
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
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <span>{t('pdp.assuranceReturn')}</span>
              </div>
            </div>

            <div className="pdp-actions-inline">
              <button
                type="button"
                className="pdp-btn pdp-btn--secondary"
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
                className="pdp-btn pdp-btn--primary"
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
            <div className="pdp-tabs">
              <div className="pdp-tabs__nav" role="tablist">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls={`panel-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    className={`pdp-tabs__tab ${
                      activeTab === tab.id ? 'pdp-tabs__tab--active' : ''
                    }`}
                    onClick={() =>
                      setTabSelection({ productSlug: slug, tab: tab.id })
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="pdp-tabs__content">
                {activeTab === 'description' && (
                  <div
                    id="panel-description"
                    role="tabpanel"
                    aria-labelledby="tab-description"
                    className="pdp-tab-panel"
                  >
                    <p className="pdp-description-text">{description}</p>
                    {attributes.length > 0 && (
                      <dl className="pdp-specs-grid">
                        {attributes.map((attr) => (
                          <div key={attr.code} className="pdp-specs-item">
                            <dt className="pdp-specs-label">
                              <AttributeIcon iconKey={attr.icon} size={15} />
                              <span>{attr.label}</span>
                            </dt>
                            <dd className="pdp-specs-value">
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
                    className="pdp-tab-panel"
                  >
                    {attributes.length > 0 ? (
                      <dl className="pdp-specs-grid">
                        {attributes.map((attr) => (
                          <div key={attr.code} className="pdp-specs-item">
                            <dt className="pdp-specs-label">
                              <AttributeIcon iconKey={attr.icon} size={15} />
                              <span>{attr.label}</span>
                            </dt>
                            <dd className="pdp-specs-value">
                              {formatAttributeValue(attr.value, attr.unit)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="pdp-description-text">{t('pdp.noSpecs')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Floating Bottom Action Bar */}
      <aside className="pdp-floating-bar" aria-label={t('pdp.floatingBarAria')}>
        <div className="pdp-floating-bar__inner">
          <div className="pdp-floating-bar__product">
            <ProductImage
              image={primaryImage}
              productName={name}
              aspectRatio="1 / 1"
              sizes="48px"
              decorative
              className="pdp-floating-bar__thumb"
            />
            <div className="pdp-floating-bar__meta">
              <span className="pdp-floating-bar__title" title={name}>
                {name}
              </span>
              <span className="pdp-floating-bar__category">{category.name}</span>
            </div>
          </div>

          <div className="pdp-floating-bar__price">
            <PriceBox price={price} size="sm" />
          </div>

          <div className="pdp-floating-bar__actions">
            <button
              type="button"
              className="pdp-btn pdp-btn--secondary pdp-floating-bar__btn"
              onClick={handleAddToCart}
              disabled={!inStock}
              aria-label={t('card.addToCartAria', { name })}
            >
              <span>{t('pdp.addToCart')}</span>
            </button>
            <button
              type="button"
              className="pdp-btn pdp-btn--primary pdp-floating-bar__btn"
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
