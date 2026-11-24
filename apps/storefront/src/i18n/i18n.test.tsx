import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

function formatExpectedMoney(
  cents: number,
  currency: 'BRL' | 'USD',
  intlLocale: 'en-US' | 'pt-BR',
): string {
  return normalizeSpaces(
    new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency,
    }).format(cents / 100),
  );
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

    const englishSummaryText = normalizeSpaces(
      screen.getByRole('heading', { name: 'Order Summary' }).closest('aside')?.textContent ?? '',
    );
    expect(englishSummaryText).toContain(formatExpectedMoney(29_990, 'BRL', 'en-US'));
    expect(englishSummaryText).toContain(formatExpectedMoney(1_990, 'BRL', 'en-US'));
    expect(englishSummaryText).toContain(formatExpectedMoney(31_980, 'BRL', 'en-US'));

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

    // Verify Intl.NumberFormat in pt-BR + BRL renders expected formatted amounts
    const ptBrlTotalsText = normalizeSpaces(
      screen.getByRole('heading', { name: 'Resumo do Pedido' }).closest('aside')?.textContent ?? '',
    );
    expect(ptBrlTotalsText).toContain(formatExpectedMoney(29_990, 'BRL', 'pt-BR'));
    expect(ptBrlTotalsText).toContain(formatExpectedMoney(1_990, 'BRL', 'pt-BR'));
    expect(ptBrlTotalsText).toContain(formatExpectedMoney(31_980, 'BRL', 'pt-BR'));

    // Switch currency to USD -> language stays pt-BR and totals reprice to Intl pt-BR + USD amounts
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Selecionar moeda de exibição/i }),
      'USD',
    );
    expect(store.getState().currency.currentCurrency).toBe('USD');
    expect(document.documentElement.lang).toBe('pt-BR');

    await waitFor(() => {
      const ptUsdTotalsText = normalizeSpaces(
        screen.getByRole('heading', { name: 'Resumo do Pedido' }).closest('aside')?.textContent ?? '',
      );
      expect(ptUsdTotalsText).toContain(formatExpectedMoney(5_998, 'USD', 'pt-BR'));
      expect(ptUsdTotalsText).toContain(formatExpectedMoney(490, 'USD', 'pt-BR'));
      expect(ptUsdTotalsText).toContain(formatExpectedMoney(6_488, 'USD', 'pt-BR'));
    });

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

  it('localizes invalid/empty promo errors and unavailable stock warnings in pt-BR', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    const product = { ...FIXTURE_PRODUCTS_DETAIL[0], inStock: false };
    const repository = new MockProductRepository({ products: [product] });
    const store = createAppStore();
    store.dispatch(addToCart({ product: FIXTURE_PRODUCTS_DETAIL[0], quantity: 1 }));
    store.dispatch(openCart());

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ProductRepositoryProvider repository={repository}>
              <MemoryRouter initialEntries={['/cart']}>
                <MiniCart />
                <CartPage />
              </MemoryRouter>
            </ProductRepositoryProvider>
          </QueryClientProvider>
        </Provider>
      </I18nProvider>,
    );

    const promoInput = screen.getByLabelText('Código promocional');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(
      screen.getByText('Informe um código promocional para aplicar.'),
    ).toBeInTheDocument();

    await user.type(promoInput, 'nope');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(
      screen.getByText(
        'O código promocional "NOPE" é inválido. Tente MINIE10, MINIE20 ou FREESHIP.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    await user.click(
      screen.getByRole('button', {
        name: `Aumentar quantidade de ${product.name}`,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('Este produto está indisponível no momento.'),
      ).toHaveLength(2);
    });
  });
});
