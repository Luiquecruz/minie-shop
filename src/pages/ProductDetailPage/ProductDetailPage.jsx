import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../../hooks/useCart.js';
import { productsApi } from '../../services/api.js';
import PriceBox from '../../components/PriceBox/PriceBox.jsx';
import ProductCard from '../../components/ProductCard/ProductCard.jsx';
import './ProductDetailPage.css';

const TABS = [
  { id: 'description', label: 'Description' },
  { id: 'manufacturer', label: 'Manufacturer' },
  { id: 'specs', label: 'Technical Specs' },
];

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('description');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedNotice, setAddedNotice] = useState('');

  // Scroll to top and fetch product on id change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    let ignore = false;

    productsApi
      .getProductById(id, 200)
      .then((data) => {
        if (!ignore) {
          setProduct(data);
          setError(null);
          setIsLoading(false);
          setActiveTab('description');

          // Fetch related products based on category
          productsApi
            .getRelatedProducts(data.id, data.category, 4, 150)
            .then((related) => {
              if (!ignore) {
                setRelatedProducts(related);
              }
            })
            .catch((err) => {
              console.error('Failed to load related products:', err);
            });
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || 'Product not found');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product);
      setAddedNotice(`"${product.name}" added to cart!`);
      setTimeout(() => setAddedNotice(''), 3000);
    }
  };

  const handleBuyNow = () => {
    if (product) {
      addToCart(product);
      setAddedNotice(`Proceeding to checkout with "${product.name}"!`);
      setTimeout(() => setAddedNotice(''), 3000);
    }
  };

  if (isLoading) {
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

  if (error || !product) {
    return (
      <div className="pdp-container pdp-error-state">
        <Helmet>
          <title>Product Not Found | Minie Shop</title>
          <meta name="description" content="The requested product could not be found." />
        </Helmet>
        <div className="pdp-error-content">
          <div className="pdp-error-icon">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2>Product Not Found</h2>
          <p>{error || 'We could not find the product you were looking for.'}</p>
          <button type="button" className="pdp-btn pdp-btn--primary" onClick={() => navigate('/')}>
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  const {
    name,
    category,
    price,
    description,
    images = [product.image],
    rating = { rate: 0, count: 0 },
    stock = 0,
    specs = [],
    manufacturer = {},
  } = product;

  return (
    <div className="pdp-wrapper">
      <Helmet>
        <title>{`${name} | Minie Shop`}</title>
        <meta name="description" content={description || `Buy ${name} at Minie Shop with best price and fast delivery.`} />
      </Helmet>

      {/* Floating alert notification */}
      {addedNotice && (
        <div className="pdp-toast" role="alert">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span>{addedNotice}</span>
        </div>
      )}

      <main className="pdp-container">
        {/* Breadcrumb */}
        <nav className="pdp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/" className="pdp-breadcrumb__link">Catalog</Link>
          <span className="pdp-breadcrumb__separator">/</span>
          <span className="pdp-breadcrumb__category">{category}</span>
          <span className="pdp-breadcrumb__separator">/</span>
          <span className="pdp-breadcrumb__current" aria-current="page">{name}</span>
        </nav>

        {/* Main Product Layout: Left Gallery + Right Details */}
        <div className="pdp-grid">
          {/* Left Column: Open Image Masonry Scroll (Desktop) & Swipe Peek (Mobile) */}
          <section className="pdp-gallery" aria-label="Product Image Gallery">
            <div className="pdp-gallery__masonry">
              {images.map((imgUrl, index) => (
                <div key={index} className="pdp-gallery__item" data-index={index}>
                  <img
                    src={imgUrl}
                    alt={`${name} - View ${index + 1}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="pdp-gallery__image"
                  />
                  <span className="pdp-gallery__badge">
                    {index + 1} / {images.length}
                  </span>
                </div>
              ))}
            </div>
            {/* Visual swipe hint indicator for mobile */}
            <div className="pdp-gallery__swipe-hint" aria-hidden="true">
              <span>Swipe to explore views</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </section>

          {/* Right Column: Product Information & Interactive Tabs */}
          <section className="pdp-info" aria-label="Product Details">
            <div className="pdp-info__header">
              <span className="pdp-info__category">{category}</span>
              <h1 className="pdp-info__title">{name}</h1>

              {/* Rating & Stock row */}
              <div className="pdp-info__meta">
                <div className="pdp-info__rating" aria-label={`Rating ${rating.rate} out of 5 stars`}>
                  <div className="pdp-info__stars" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <span className="pdp-info__rating-value">{rating.rate?.toFixed(1)}</span>
                  <span className="pdp-info__rating-count">({rating.count} reviews)</span>
                </div>

                <div className="pdp-info__stock">
                  {stock > 0 ? (
                    <span className="pdp-stock-badge pdp-stock-badge--available">
                      <span className="pdp-stock-dot" />
                      In Stock ({stock} available)
                    </span>
                  ) : (
                    <span className="pdp-stock-badge pdp-stock-badge--out">
                      <span className="pdp-stock-dot" />
                      Out of Stock
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Price Box Section */}
            <div className="pdp-info__pricebox">
              <PriceBox price={price} size="lg" />
            </div>

            {/* Quick Benefits / Assurance */}
            <div className="pdp-assurance">
              <div className="pdp-assurance__item">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V3.75m0 3.75h3.75m-3.75 0a2.25 2.25 0 00-2.25 2.25v7.5" />
                </svg>
                <span>Fast express shipping</span>
              </div>
              <div className="pdp-assurance__item">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span>12-Month Official Warranty</span>
              </div>
              <div className="pdp-assurance__item">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>30-Day Free Return Policy</span>
              </div>
            </div>

            {/* Desktop Action Buttons in Sidebar */}
            <div className="pdp-actions-inline">
              <button
                type="button"
                className="pdp-btn pdp-btn--secondary"
                onClick={handleAddToCart}
                disabled={stock <= 0}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.144a.75.75 0 00-.712-.981H5.106m2.394 8.125L5.106 5.25m2.394 9l-1.026 3.078M16.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                Add to Cart
              </button>
              <button
                type="button"
                className="pdp-btn pdp-btn--primary"
                onClick={handleBuyNow}
                disabled={stock <= 0}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                Buy Now
              </button>
            </div>

            {/* Content Tabs (Description, Manufacturer Info, Technical Specs) */}
            <div className="pdp-tabs">
              <div className="pdp-tabs__nav" role="tablist">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls={`panel-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    className={`pdp-tabs__tab ${activeTab === tab.id ? 'pdp-tabs__tab--active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="pdp-tabs__content">
                {/* Tab 1: Description */}
                {activeTab === 'description' && (
                  <div
                    id="panel-description"
                    role="tabpanel"
                    aria-labelledby="tab-description"
                    className="pdp-tab-panel"
                  >
                    <p className="pdp-description-text">{description}</p>
                    <div className="pdp-highlights">
                      <h4 className="pdp-highlights__title">Product Highlights</h4>
                      <ul className="pdp-highlights__list">
                        <li>Crafted from durable, premium materials engineered for longevity.</li>
                        <li>Seamless integration with modern lifestyle and tech ecosystems.</li>
                        <li>Factory inspected and verified to satisfy high international benchmarks.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tab 2: Manufacturer Info */}
                {activeTab === 'manufacturer' && (
                  <div
                    id="panel-manufacturer"
                    role="tabpanel"
                    aria-labelledby="tab-manufacturer"
                    className="pdp-tab-panel"
                  >
                    <div className="pdp-manufacturer-card">
                      <div className="pdp-manufacturer-item">
                        <span className="pdp-manufacturer-label">Brand & Authorization</span>
                        <span className="pdp-manufacturer-value">{manufacturer.brand || 'Minie Certified Partner'}</span>
                      </div>
                      <div className="pdp-manufacturer-item">
                        <span className="pdp-manufacturer-label">Distribution & Origin</span>
                        <span className="pdp-manufacturer-value">{manufacturer.origin || 'Global standard distribution'}</span>
                      </div>
                      <div className="pdp-manufacturer-item">
                        <span className="pdp-manufacturer-label">Warranty Details</span>
                        <span className="pdp-manufacturer-value">{manufacturer.warrantyText || '12-Month Official Warranty'}</span>
                      </div>
                      <div className="pdp-manufacturer-item">
                        <span className="pdp-manufacturer-label">Sustainability & Eco-Commitment</span>
                        <span className="pdp-manufacturer-value">{manufacturer.sustainability || 'Eco-compliant production processes'}</span>
                      </div>
                      <div className="pdp-manufacturer-item">
                        <span className="pdp-manufacturer-label">Support Channels</span>
                        <span className="pdp-manufacturer-value">{manufacturer.support || '24/7 online technical support'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Technical Specs (Two-Column Grid) */}
                {activeTab === 'specs' && (
                  <div
                    id="panel-specs"
                    role="tabpanel"
                    aria-labelledby="tab-specs"
                    className="pdp-tab-panel"
                  >
                    <div className="pdp-specs-grid">
                      {specs.map((item, idx) => (
                        <div key={idx} className="pdp-specs-item">
                          <dt className="pdp-specs-label">{item.label}</dt>
                          <dd className="pdp-specs-value">{item.value}</dd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="pdp-related" aria-label="Related Products">
            <div className="pdp-related__header">
              <span className="pdp-related__badge">Discover More</span>
              <h2 className="pdp-related__title">Related Products</h2>
              <p className="pdp-related__subtitle">
                Explore handpicked alternatives from the {category} category.
              </p>
            </div>
            <div className="pdp-related__grid">
              {relatedProducts.map((related) => (
                <ProductCard
                  key={related.id}
                  product={related}
                  onAddToCart={(p) => {
                    addToCart(p);
                    setAddedNotice(`"${p.name}" added to cart!`);
                    setTimeout(() => setAddedNotice(''), 3000);
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating Bottom Action Bar that sticks & follows navigation */}
      <aside className="pdp-floating-bar" aria-label="Floating Quick Actions">
        <div className="pdp-floating-bar__inner">
          <div className="pdp-floating-bar__product">
            <img
              src={images[0] || product.image}
              alt=""
              aria-hidden="true"
              className="pdp-floating-bar__thumb"
            />
            <div className="pdp-floating-bar__meta">
              <span className="pdp-floating-bar__title" title={name}>{name}</span>
              <span className="pdp-floating-bar__category">{category}</span>
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
              disabled={stock <= 0}
              aria-label={`Add ${name} to cart`}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.144a.75.75 0 00-.712-.981H5.106m2.394 8.125L5.106 5.25m2.394 9l-1.026 3.078M16.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              <span>Add to Cart</span>
            </button>
            <button
              type="button"
              className="pdp-btn pdp-btn--primary pdp-floating-bar__btn"
              onClick={handleBuyNow}
              disabled={stock <= 0}
              aria-label={`Buy ${name} now`}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span>Buy Now</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default ProductDetailPage;
