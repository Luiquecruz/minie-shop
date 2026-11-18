import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import RootLayout from './layouts/RootLayout/RootLayout';
import ProductListingPage from './pages/ProductListingPage/ProductListingPage';
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<ProductListingPage />} />
            <Route path="product/:id" element={<ProductDetailPage />} />
            <Route path="*" element={<ProductListingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
