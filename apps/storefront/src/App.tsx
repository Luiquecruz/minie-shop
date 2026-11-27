import { lazy, Suspense, useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import RootLayout from './layouts/RootLayout/RootLayout';
import ProductListingPage from './pages/ProductListingPage/ProductListingPage';
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage';
import CartPage from './pages/CartPage/CartPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import { useI18n } from './i18n';
import { resolveLegacyProductPath } from './routes/legacyProductRedirects';

const loadSearchResultsPage = () =>
  import('./pages/SearchResultsPage/SearchResultsPage');

const InitialSearchResultsPage = lazy(loadSearchResultsPage);

function SearchRouteFallback() {
  const { t } = useI18n();
  return (
    <div
      className="mx-auto my-12 max-w-[1280px] px-4 text-sm text-fg-muted sm:px-6"
      role="status"
      aria-live="polite"
    >
      {t('searchPage.loadingRoute')}
    </div>
  );
}

/**
 * Wraps the lazy-loaded SearchResultsPage so retrying after a transient chunk-load
 * failure creates a fresh `React.lazy` wrapper instead of re-throwing a cached rejection.
 */
function LazySearchRoute({ resetKey }: { resetKey: string }) {
  const [LazyPage, setLazyPage] = useState(() => InitialSearchResultsPage);

  const handleRetryChunk = useCallback(() => {
    setLazyPage(() => lazy(loadSearchResultsPage));
  }, []);

  return (
    <ErrorBoundary resetKey={resetKey} onReset={handleRetryChunk}>
      <Suspense fallback={<SearchRouteFallback />}>
        <LazyPage />
      </Suspense>
    </ErrorBoundary>
  );
}

function LegacyProductRedirect() {
  const { id } = useParams<{ id: string }>();
  const target = resolveLegacyProductPath(id);
  if (target) {
    return <Navigate to={target} replace />;
  }
  return <NotFoundPage />;
}

export function AppRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.key}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<ProductListingPage />} />
          <Route
            path="search"
            element={<LazySearchRoute resetKey={location.key} />}
          />
          <Route path="cart" element={<CartPage />} />
          <Route path="product/:id" element={<LegacyProductRedirect />} />
          <Route path=":category/:slug" element={<ProductDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
