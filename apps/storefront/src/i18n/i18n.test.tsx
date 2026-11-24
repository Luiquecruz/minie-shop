import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProductRepositoryProvider } from '../context/ProductRepositoryProvider';
import { MockProductRepository } from '../infrastructure/repositories/MockProductRepository';
import { createAppStore } from '../store';
import { addToCart, openCart } from '../store/slices/cartSlice';
import { FIXTURE_PRODUCTS_DETAIL } from '../test/fixtures/catalogFixture';
import Navbar from '../components/Navbar/Navbar';
import MiniCart from '../components/MiniCart/MiniCart';
import CartPage from '../pages/CartPage/CartPage';
import { enMessages } from './en';
import { ptBRMessages } from './pt-BR';
import { I18nProvider, LOCALE_STORAGE_KEY } from './index';

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

describe('Storefront i18n (en & pt-BR) and independent Navbar selectors', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('maintains 100% translation key parity between en and pt-BR', () => {
    const enKeys = Object.keys(enMessages).sort();
    const ptKeys = Object.keys(ptBRMessages).sort();
    expect(ptKeys).toEqual(enKeys);
    for (const key of ptKeys) {
      expect(ptBRMessages[key as keyof typeof ptBRMessages].trim().length).toBeGreaterThan(0);
    }
  });

  it('switches UI language independently of currency, updates <html lang>, persists minieshop_locale, and formats prices', async () => {
    const product = FIXTURE_PRODUCTS_DETAIL[0];
    const repository = new MockProductRepository();
    const store = createAppStore();
    store.dispatch(addToCart({ product, quantity: 1 }));
    store.dispatch(openCart());

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const user = userEvent.setup();

    const { unmount } = render(
      <I18nProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ProductRepositoryProvider repository={repository}>
              <MemoryRouter initialEntries={['/cart']}>
                <Navbar />
                <MiniCart />
                <CartPage />
              </MemoryRouter>
            </ProductRepositoryProvider>
          </QueryClientProvider>
        </Provider>
      </I18nProvider>,
    );

    // Default state: en + BRL
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('heading', { name: 'Shopping Cart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Cart' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Select display currency/i })).toHaveValue('BRL');

    // Switch language to pt-BR -> UI switches to Portuguese, currency stays BRL, <html lang="pt-BR">
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Select interface language/i }),
      'pt-BR',
    );

    expect(document.documentElement.lang).toBe('pt-BR');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR');
    expect(store.getState().currency.currentCurrency).toBe('BRL');
    expect(screen.getByRole('heading', { name: 'Carrinho de Compras' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seu Carrinho' })).toBeInTheDocument();
    expect(screen.getByText('Entrega Padrão')).toBeInTheDocument();
    expect(screen.getByText('Cupom Promocional')).toBeInTheDocument();

    // Verify Intl.NumberFormat in pt-BR renders Brazilian formatting (R$ 499,90 or comma decimal)
    const totalsText = normalizeSpaces(
      screen.getByRole('heading', { name: 'Resumo do Pedido' }).closest('aside')?.textContent ?? '',
    );
    expect(totalsText).toMatch(/,\d{2}/);

    // Switch currency to USD -> language stays pt-BR
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Selecionar moeda de exibição/i }),
      'USD',
    );
    expect(store.getState().currency.currentCurrency).toBe('USD');
    expect(document.documentElement.lang).toBe('pt-BR');

    // Remount -> reads persisted minieshop_locale === 'pt-BR'
    unmount();
    render(
      <I18nProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ProductRepositoryProvider repository={repository}>
              <MemoryRouter initialEntries={['/cart']}>
                <Navbar />
                <CartPage />
              </MemoryRouter>
            </ProductRepositoryProvider>
          </QueryClientProvider>
        </Provider>
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(screen.getByRole('heading', { name: 'Carrinho de Compras' })).toBeInTheDocument();
  });
});
