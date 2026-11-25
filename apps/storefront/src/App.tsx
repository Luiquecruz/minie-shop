import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import RootLayout from './layouts/RootLayout/RootLayout';
import ProductListingPage from './pages/ProductListingPage/ProductListingPage';
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage';
import CartPage from './pages/CartPage/CartPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import { useI18n } from './i18n';
import { resolveLegacyProductPath } from './routes/legacyProductRedirects';
import './App.css';

const SearchResultsPage = lazy(
  () => import('./pages/SearchResultsPage/SearchResultsPage'),
);

function SearchRouteFallback() {
  const { t } = useI18n();
  return (
    <div
      className="search-route-fallback"
      role="status"
      aria-live="polite"
      style={{
        maxWidth: 'var(--container-max-width, 1280px)',
        margin: '48px auto',
        padding: '0 var(--container-padding, 24px)',
        color: 'var(--text-muted, #6b7280)',
      }}
    >
      {t('searchPage.loadingRoute')}
    </div>
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
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<ProductListingPage />} />
        <Route
          path="search"
          element={
            <Suspense fallback={<SearchRouteFallback />}>
              <SearchResultsPage />
            </Suspense>
          }
        />
        <Route path="cart" element={<CartPage />} />
        <Route path="product/:id" element={<LegacyProductRedirect />} />
        <Route path=":category/:slug" element={<ProductDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
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
