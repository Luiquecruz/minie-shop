import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import RootLayout from './layouts/RootLayout/RootLayout';
import ProductListingPage from './pages/ProductListingPage/ProductListingPage';
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage';
import CartPage from './pages/CartPage/CartPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import { resolveLegacyProductPath } from './routes/legacyProductRedirects';
import './App.css';

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
