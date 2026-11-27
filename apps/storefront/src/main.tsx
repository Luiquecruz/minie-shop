import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getStorefrontEnv } from './config/env';
import { ProductRepositoryProvider } from './context/ProductRepositoryProvider';
import { HttpProductRepository } from './infrastructure/repositories/HttpProductRepository';
import { I18nProvider } from './i18n';
import store from './store';
import { queryClient } from './query/queryClient';
import './index.css';
import App from './App';

// Fail fast on boot if frontend environment configuration is invalid.
getStorefrontEnv();

const productRepository = new HttpProductRepository();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <ProductRepositoryProvider repository={productRepository}>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <App />
          </Provider>
          {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
          )}
        </QueryClientProvider>
      </ProductRepositoryProvider>
    </I18nProvider>
  </StrictMode>,
);
