import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProductRepositoryProvider } from '../../../context/ProductRepositoryProvider';
import { MockProductRepository } from '../../../infrastructure/repositories/MockProductRepository';
import { FIXTURE_PRODUCTS_DETAIL } from '../../../test/fixtures/catalogFixture';
import { createStorefrontQueryClient } from '../../../query/queryClient';
import { createAppStore } from '../../../store';
import { addToCart, closeCart, openCart, removeFromCart } from '../../../store/slices/cartSlice';
import { setCurrency } from '../../../store/slices/currencySlice';
import CartPage from '../../../pages/CartPage/CartPage';
import Navbar from '../../Navbar/Navbar';
import MiniCart from '../MiniCart';

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

describe('MiniCart progressive multi-currency repricing (Phase 6.1)', () => {
  it('keeps Navbar badge instant with 0 quotePricing calls while MiniCart is closed, then reprices progressively on open', async () => {
    const product = FIXTURE_PRODUCTS_DETAIL[0];
    const repository = new MockProductRepository({ delayMs: 60 });
    const quoteSpy = vi.spyOn(repository, 'quotePricing');
    const store = createAppStore();
    store.dispatch(addToCart({ product, quantity: 2 }));
    store.dispatch(closeCart());

    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={repository}>
            <MemoryRouter>
              <Navbar />
              <MiniCart />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    // Badge shows 2 immediately from Redux without calling /pricing/quote
    expect(screen.getByRole('button', { name: /Shopping cart with 2 items/i })).toBeInTheDocument();
    expect(quoteSpy).not.toHaveBeenCalled();

    // Switching currency while MiniCart is closed must NOT trigger quotePricing
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Select display currency/i }),
      'USD',
    );
    expect(store.getState().currency.currentCurrency).toBe('USD');
    expect(quoteSpy).not.toHaveBeenCalled();

    // Opening MiniCart triggers lazy quotePricing while keeping item visible with shimmers
    await user.click(
      screen.getByRole('button', { name: /Shopping cart with 2 items/i }),
    );

    // Item title stays visible immediately; granular price & totals shimmers render
    expect(screen.getByText(product.name)).toBeInTheDocument();
    expect(screen.getByLabelText(/Updating item price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Updating subtotal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeDisabled();

    // Once quote settles, prices update to USD, live region announces update, and Checkout becomes enabled
    await waitFor(() => {
      expect(quoteSpy).toHaveBeenCalledTimes(1);
      expect(store.getState().cart.items[0].price.currency).toBe('USD');
      expect(screen.queryByLabelText(/Updating item price/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Cart subtotal in USD/i);
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeEnabled();
  });

  it('shows inline error + Retry button immediately without automatic retries when quotePricing fails under production QueryClient', async () => {
    const product = FIXTURE_PRODUCTS_DETAIL[0];
    const repository = new MockProductRepository();
    const quoteSpy = vi
      .spyOn(repository, 'quotePricing')
      .mockRejectedValueOnce(new Error('Simulated network error'));

    const store = createAppStore();
    store.dispatch(addToCart({ product, quantity: 1 }));
    store.dispatch(setCurrency('EUR'));
    store.dispatch(openCart());

    const queryClient = createStorefrontQueryClient();
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={repository}>
            <MemoryRouter>
              <MiniCart />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Could not refresh cart prices for the selected currency/i),
      ).toBeInTheDocument();
    });
    expect(quoteSpy).toHaveBeenCalledTimes(1);

    // Item remains visible, Checkout disabled due to currency mismatch,
    // and stale BRL totals remain hidden instead of being formatted as EUR
    expect(screen.getByText(product.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeDisabled();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();

    // Clicking Retry recovers and updates item to EUR
    await user.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(store.getState().cart.items[0].price.currency).toBe('EUR');
      expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeEnabled();
    });
  });

  it('does not let an older cached quote for [A] overwrite newer state after [A,B] -> remove B', async () => {
    const productA = FIXTURE_PRODUCTS_DETAIL[0];
    const productB = FIXTURE_PRODUCTS_DETAIL[1];
    const repository = new MockProductRepository();

    const quoteSpy = vi
      .spyOn(repository, 'quotePricing')
      // 1st quote: [A] in BRL (inStock: true, old price)
      .mockResolvedValueOnce({
        currency: 'BRL',
        items: [
          {
            productId: productA.id,
            price: productA.price,
            inStock: true,
          },
        ],
        freeShippingThresholdCents: 50_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 1_990 },
          { id: 'express', basePriceCents: 4_990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      })
      // 2nd quote: [A, B] where A changed price and stock became false
      .mockResolvedValueOnce({
        currency: 'BRL',
        items: [
          {
            productId: productA.id,
            price: { amount: 44_900, currency: 'BRL' },
            inStock: false,
          },
          {
            productId: productB.id,
            price: productB.price,
            inStock: true,
          },
        ],
        freeShippingThresholdCents: 50_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 1_990 },
          { id: 'express', basePriceCents: 4_990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      })
      // 3rd quote (refetch for [A] instead of stale cache): A remains 44_900 / false
      .mockResolvedValueOnce({
        currency: 'BRL',
        items: [
          {
            productId: productA.id,
            price: { amount: 44_900, currency: 'BRL' },
            inStock: false,
          },
        ],
        freeShippingThresholdCents: 50_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 1_990 },
          { id: 'express', basePriceCents: 4_990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      });

    const store = createAppStore();
    store.dispatch(addToCart({ product: productA, quantity: 1 }));
    store.dispatch(openCart());

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 60_000,
        },
      },
    });

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={repository}>
            <MemoryRouter>
              <MiniCart />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    await waitFor(() => expect(quoteSpy).toHaveBeenCalledTimes(1));

    // Add B -> triggers 2nd quote updating A's price and stock
    store.dispatch(addToCart({ product: productB, quantity: 1 }));
    await waitFor(() => {
      expect(quoteSpy).toHaveBeenCalledTimes(2);
      expect(store.getState().cart.items[0].price.amount).toBe(44_900);
      expect(store.getState().cart.items[0].inStock).toBe(false);
    });

    // Close MiniCart (unmounts), remove B, then reopen MiniCart -> must NOT revert A to 1st cached quote
    store.dispatch(closeCart());
    store.dispatch(removeFromCart(productB.id));
    store.dispatch(openCart());
    await waitFor(() => expect(quoteSpy).toHaveBeenCalledTimes(3));
    expect(store.getState().cart.items[0].price.amount).toBe(44_900);
    expect(store.getState().cart.items[0].inStock).toBe(false);
  });

  it('recovers USD totals cleanly across USD -> BRL -> USD cached round-trip switches', async () => {
    const product = FIXTURE_PRODUCTS_DETAIL[0];
    const repository = new MockProductRepository();
    const quoteSpy = vi.spyOn(repository, 'quotePricing');

    const store = createAppStore();
    store.dispatch(addToCart({ product, quantity: 1 }));
    store.dispatch(setCurrency('USD'));
    store.dispatch(openCart());

    const queryClient = createStorefrontQueryClient();
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={repository}>
            <MemoryRouter>
              <Navbar />
              <MiniCart />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    // 1. Initial USD quote
    await waitFor(() => {
      expect(store.getState().cart.items[0].price.currency).toBe('USD');
    });

    // 2. Switch to BRL -> BRL quote (newer updatedAt)
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Select display currency/i }),
      'BRL',
    );
    await waitFor(() => {
      expect(store.getState().cart.items[0].price.currency).toBe('BRL');
    });

    // 3. Switch back to USD -> even though USD cache entry has older updatedAt,
    // useCartQuoteSync refetches fresh USD quote and recovers USD totals
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Select display currency/i }),
      'USD',
    );
    await waitFor(() => {
      expect(quoteSpy).toHaveBeenCalledTimes(3);
      expect(store.getState().cart.items[0].price.currency).toBe('USD');
    });
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeEnabled();
  });

  it('rejects incomplete quotes with quoteError and keeps CartPage shipping/summary amounts hidden while currency mismatches', async () => {
    const productA = FIXTURE_PRODUCTS_DETAIL[0];
    const productB = FIXTURE_PRODUCTS_DETAIL[1];
    const repository = new MockProductRepository();

    const quoteSpy = vi
      .spyOn(repository, 'quotePricing')
      // 1st quote omits productB -> incomplete quote must NOT update cart
      .mockResolvedValueOnce({
        currency: 'USD',
        items: [
          {
            productId: productA.id,
            price: { amount: 5_998, currency: 'USD' },
            inStock: true,
          },
        ],
        freeShippingThresholdCents: 10_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 490 },
          { id: 'express', basePriceCents: 990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      })
      // Retry returns full items
      .mockResolvedValueOnce({
        currency: 'USD',
        items: [
          {
            productId: productA.id,
            price: { amount: 5_998, currency: 'USD' },
            inStock: true,
          },
          {
            productId: productB.id,
            price: { amount: 3_798, currency: 'USD' },
            inStock: true,
          },
        ],
        freeShippingThresholdCents: 10_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 490 },
          { id: 'express', basePriceCents: 990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      });

    const store = createAppStore();
    store.dispatch(addToCart({ product: productA, quantity: 1 }));
    store.dispatch(addToCart({ product: productB, quantity: 1 }));
    store.dispatch(setCurrency('USD'));

    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={repository}>
            <MemoryRouter initialEntries={['/cart']}>
              <CartPage />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(quoteSpy).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/Could not refresh cart prices for the selected currency/i),
      ).toBeInTheDocument();
    });

    // Incomplete quote was rejected -> cart remains in BRL, shipping/summary/free-shipping remain hidden
    expect(store.getState().cart.items[0].price.currency).toBe('BRL');
    expect(
      screen.queryByText(/more for free Standard Delivery/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /Shipping Method/i }).textContent,
    ).not.toMatch(/R\$|\$|€/);
    expect(
      screen.getByRole('heading', { name: 'Order Summary' }).closest('aside')
        ?.textContent,
    ).not.toMatch(/R\$|\$|€/);
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeDisabled();

    // Retry recovers full USD quote and restores formatted amounts + free-shipping prompt
    await user.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(store.getState().cart.items[0].price.currency).toBe('USD');
      expect(store.getState().cart.items[1].price.currency).toBe('USD');
    });
    expect(screen.getByText(/more for free Standard Delivery/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeEnabled();
  });

  it('batches quotes exceeding 100 distinct items inside useCartQuoteSync', async () => {
    const batchProducts = Array.from({ length: 105 }, (_, idx) => ({
      ...FIXTURE_PRODUCTS_DETAIL[0],
      id: `aaaaaaaa-0000-4000-8000-${String(idx).padStart(12, '0')}`,
      slug: `batch-product-${idx}`,
      name: `Batch Product ${idx}`,
    }));
    const fullRepo = new MockProductRepository({ products: batchProducts });
    const quoteSpy = vi.spyOn(fullRepo, 'quotePricing');

    const store = createAppStore();
    for (const prod of batchProducts) {
      store.dispatch(addToCart({ product: prod, quantity: 1 }));
    }
    store.dispatch(setCurrency('USD'));
    store.dispatch(openCart());

    const queryClient = createTestQueryClient();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={fullRepo}>
            <MemoryRouter>
              <MiniCart />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(quoteSpy).toHaveBeenCalledTimes(2);
      expect(
        store.getState().cart.items.every((item) => item.price.currency === 'USD'),
      ).toBe(true);
    });
    expect(quoteSpy.mock.calls[0]?.[0].productIds).toHaveLength(100);
    expect(quoteSpy.mock.calls[1]?.[0].productIds).toHaveLength(5);
  });

  it('disables checkout in both MiniCart and CartPage when an incomplete quote triggers quoteError even without currency mismatch', async () => {
    const productA = FIXTURE_PRODUCTS_DETAIL[0];
    const productB = FIXTURE_PRODUCTS_DETAIL[1];
    const repository = new MockProductRepository();

    vi.spyOn(repository, 'quotePricing').mockResolvedValueOnce({
      currency: 'BRL',
      items: [
        {
          productId: productA.id,
          price: productA.price,
          inStock: true,
        },
      ],
      freeShippingThresholdCents: 50_000,
      shippingOptions: [
        { id: 'standard', basePriceCents: 1_990 },
        { id: 'express', basePriceCents: 4_990 },
        { id: 'pickup', basePriceCents: 0 },
      ],
    });

    const store = createAppStore();
    store.dispatch(addToCart({ product: productA, quantity: 1 }));
    store.dispatch(addToCart({ product: productB, quantity: 1 }));
    store.dispatch(openCart());

    const queryClient = createTestQueryClient();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ProductRepositoryProvider repository={repository}>
            <MemoryRouter initialEntries={['/cart']}>
              <MiniCart />
              <CartPage />
            </MemoryRouter>
          </ProductRepositoryProvider>
        </QueryClientProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(/Could not refresh cart prices for the selected currency/i),
      ).toHaveLength(2);
    });

    const checkoutButtons = screen.getAllByRole('button', {
      name: /Proceed to Checkout/i,
    });
    expect(checkoutButtons).toHaveLength(2);
    checkoutButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
