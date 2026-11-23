import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getStorefrontEnv } from './config/env';
import { ProductRepositoryProvider } from './context/ProductRepositoryProvider';
import store from './store';
import { queryClient } from './query/queryClient';
import './index.css';
import App from './App';

// Fail fast on boot if frontend environment configuration is invalid.
getStorefrontEnv();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ProductRepositoryProvider>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <App />
        </Provider>
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        )}
      </QueryClientProvider>
    </ProductRepositoryProvider>
  </StrictMode>,
);
