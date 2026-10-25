import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar/Navbar.jsx';
import ProductListingPage from './pages/ProductListingPage/ProductListingPage.jsx';
import './App.css';

const CURRENT_YEAR = new Date().getFullYear();

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Navbar cartCount={0} />
          <div className="app-content">
            <Routes>
              <Route path="/" element={<ProductListingPage />} />
              <Route path="*" element={<ProductListingPage />} />
            </Routes>
          </div>
          <footer className="app-footer">
            <div className="app-footer__inner">
              <p>© {CURRENT_YEAR} Minie Shop</p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
