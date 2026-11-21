import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { PRODUCTS_MOCK } from '../../../data/products';
import { productsApi } from '../../../services/api';
import { createAppStore } from '../../../store';
import { addToCart } from '../../../store/slices/cartSlice';
import { useCartItemIds } from '../../../hooks/useCart';
import CartHeader from '../components/CartHeader';
import CartItemRow from '../components/CartItemRow';
import CartPromoBox from '../components/CartPromoBox';
import CartShippingSelector from '../components/CartShippingSelector';
import CartOrderNote from '../components/CartOrderNote';
import CartOrderSummary from '../components/CartOrderSummary';
import CartPage from '../CartPage';

interface RenderCounts {
  CartHeader: number;
  CartItem1: number;
  CartItem2: number;
  CartPromoBox: number;
  CartShippingSelector: number;
  CartOrderNote: number;
  CartOrderSummary: number;
}

function createZeroCounts(): RenderCounts {
  return {
    CartHeader: 0,
    CartItem1: 0,
    CartItem2: 0,
    CartPromoBox: 0,
    CartShippingSelector: 0,
    CartOrderNote: 0,
    CartOrderSummary: 0,
  };
}

function ProfiledReduxCartHarness({
  onRenderCounts,
}: {
  onRenderCounts: RenderCounts;
}) {
  const itemIds = useCartItemIds();

  const makeOnRender =
    (key: keyof RenderCounts): ProfilerOnRenderCallback =>
    (_id, phase) => {
      if (phase === 'update' || phase === 'nested-update') {
        onRenderCounts[key] += 1;
      }
    };

  return (
    <div>
      <Profiler id="CartHeader" onRender={makeOnRender('CartHeader')}>
        <CartHeader />
      </Profiler>
      <ul>
        {itemIds.map((id, idx) => (
          <Profiler
            key={id}
            id={idx === 0 ? 'CartItem1' : 'CartItem2'}
            onRender={makeOnRender(idx === 0 ? 'CartItem1' : 'CartItem2')}
          >
            <CartItemRow itemId={id} />
          </Profiler>
        ))}
      </ul>
      <Profiler id="CartPromoBox" onRender={makeOnRender('CartPromoBox')}>
        <CartPromoBox />
      </Profiler>
      <Profiler
        id="CartShippingSelector"
        onRender={makeOnRender('CartShippingSelector')}
      >
        <CartShippingSelector />
      </Profiler>
      <Profiler id="CartOrderNote" onRender={makeOnRender('CartOrderNote')}>
        <CartOrderNote />
      </Profiler>
      <Profiler
        id="CartOrderSummary"
        onRender={makeOnRender('CartOrderSummary')}
      >
        <CartOrderSummary />
      </Profiler>
    </div>
  );
}

describe('AFTER Migration: CartPage with Redux Toolkit + createSelector + React.memo (React Profiler)', () => {
  it('isolates re-renders strictly to affected components across every interaction', async () => {
    const validateSpy = vi
      .spyOn(productsApi, 'validateStock')
      .mockResolvedValue({ available: true, maxStock: 99, message: 'OK' });

    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(addToCart({ product: PRODUCTS_MOCK[0], quantity: 1 }));
    store.dispatch(addToCart({ product: PRODUCTS_MOCK[1], quantity: 1 }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const counts = createZeroCounts();
    const resetCounts = (): void => {
      (Object.keys(counts) as (keyof RenderCounts)[]).forEach((key) => {
        counts[key] = 0;
      });
    };

    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <MemoryRouter>
              <ProfiledReduxCartHarness onRenderCounts={counts} />
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </HelmetProvider>,
    );

    // 1. Typing "Gift" (4 chars) in CartOrderNote
    resetCounts();
    await user.type(screen.getByLabelText(/add gift instructions/i), 'Gift');
    const noteTypingCounts = { ...counts };

    expect(noteTypingCounts).toEqual({
      CartHeader: 0,
      CartItem1: 0,
      CartItem2: 0,
      CartPromoBox: 0,
      CartShippingSelector: 0,
      CartOrderNote: 4,
      CartOrderSummary: 4,
    });

    // 2. Typing "MIN" (3 chars) in CartPromoBox
    resetCounts();
    await user.type(screen.getByPlaceholderText(/enter minie10/i), 'MIN');
    const promoTypingCounts = { ...counts };

    expect(promoTypingCounts).toEqual({
      CartHeader: 0,
      CartItem1: 0,
      CartItem2: 0,
      CartPromoBox: 3,
      CartShippingSelector: 0,
      CartOrderNote: 0,
      CartOrderSummary: 0,
    });

    // 3. Switching Shipping Method (standard -> express)
    resetCounts();
    await user.click(screen.getByRole('radio', { name: /express courier/i }));
    const shippingChangeCounts = { ...counts };

    expect(shippingChangeCounts).toEqual({
      CartHeader: 0,
      CartItem1: 0,
      CartItem2: 0,
      CartPromoBox: 0,
      CartShippingSelector: 1,
      CartOrderNote: 0,
      CartOrderSummary: 1,
    });

    // 4. Incrementing Item #1 quantity (wait for mocked stock validation query to settle cleanly)
    resetCounts();
    const incrementButtons = screen.getAllByRole('button', {
      name: /increase quantity/i,
    });
    await user.click(incrementButtons[0]);
    await vi.waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });
    const item1QtyCounts = { ...counts };

    // CartItem1 renders on qty change + stock validation cycle, while CartItem2 and sibling panels stay at 0
    expect(item1QtyCounts.CartItem2).toBe(0);
    expect(item1QtyCounts.CartPromoBox).toBe(0);
    expect(item1QtyCounts.CartShippingSelector).toBe(0);
    expect(item1QtyCounts.CartOrderNote).toBe(0);
    expect(item1QtyCounts.CartHeader).toBe(1);
    expect(item1QtyCounts.CartOrderSummary).toBe(1);
    expect(item1QtyCounts.CartItem1).toBeGreaterThanOrEqual(1);
    expect(item1QtyCounts.CartItem1).toBeLessThanOrEqual(3);

    validateSpy.mockRestore();
  });

  it('allows clearing quantity draft and committing on Enter/blur, plus coupons, removal, and clear cart', async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(addToCart({ product: PRODUCTS_MOCK[0], quantity: 1 }));
    store.dispatch(addToCart({ product: PRODUCTS_MOCK[1], quantity: 1 }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <MemoryRouter>
              <CartPage />
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </HelmetProvider>,
    );

    const qtyInput = screen.getByLabelText(
      `Quantity for ${PRODUCTS_MOCK[0].name}`,
    );
    await user.clear(qtyInput);
    expect(qtyInput).toHaveValue(null);
    await user.type(qtyInput, '3{Enter}');
    expect(qtyInput).toHaveValue(3);
    expect(screen.getByText('4 units')).toBeInTheDocument();

    const promoInput = screen.getByPlaceholderText(/enter minie10/i);
    await user.type(promoInput, 'INVALID');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/INVALID/i);

    await user.click(screen.getByRole('button', { name: 'MINIE10' }));
    expect(screen.getByText('Promo (MINIE10)')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: `Remove ${PRODUCTS_MOCK[0].name} from cart`,
      }),
    );
    expect(screen.queryByText(PRODUCTS_MOCK[0].name)).not.toBeInTheDocument();
    expect(screen.getByText('1 unit')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear cart/i }));
    expect(
      screen.getByText('Your shopping cart is empty'),
    ).toBeInTheDocument();
  });
});
