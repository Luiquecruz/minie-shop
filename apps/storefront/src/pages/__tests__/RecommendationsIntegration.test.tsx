import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ProductRepositoryProvider } from '../../context/ProductRepositoryProvider';
import { I18nProvider } from '../../i18n';
import { ApiError } from '../../infrastructure/http/errors';
import { MockProductRepository } from '../../infrastructure/repositories/MockProductRepository';
import { createStorefrontQueryClient } from '../../query/queryClient';
import { createAppStore } from '../../store';
import { addToCart } from '../../store/slices/cartSlice';
import { setCurrency } from '../../store/slices/currencySlice';
import {
  getActiveIntersectionObserverCount,
  triggerAllIntersections,
} from '../../test/intersectionObserverMock';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';
import ProductDetailPage from '../ProductDetailPage/ProductDetailPage';
import CartPage from '../CartPage/CartPage';

function renderPdpRoute(
  repository: MockProductRepository,
  initialEntry: string,
  options?: { disableRetry?: boolean },
) {
  const queryClient = options?.disableRetry
    ? new QueryClient({ defaultOptions: { queries: { retry: false } } })
    : createStorefrontQueryClient();
  const store = createAppStore();

  return render(
    <HelmetProvider>
      <I18nProvider initialLocale="pt-BR">
        <ProductRepositoryProvider repository={repository}>
          <QueryClientProvider client={queryClient}>
            <Provider store={store}>
              <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                  <Route path="/:category/:slug" element={<ProductDetailPage />} />
                </Routes>
              </MemoryRouter>
            </Provider>
          </QueryClientProvider>
        </ProductRepositoryProvider>
      </I18nProvider>
    </HelmetProvider>,
  );
}

function renderCartRoute(
  repository: MockProductRepository,
  preloadedProducts = [FIXTURE_PRODUCTS_DETAIL[0]],
) {
  const queryClient = createStorefrontQueryClient();
  const store = createAppStore();
  for (const product of preloadedProducts) {
    store.dispatch(addToCart({ product, quantity: 1 }));
  }

  const result = render(
    <HelmetProvider>
      <I18nProvider initialLocale="pt-BR">
        <ProductRepositoryProvider repository={repository}>
          <QueryClientProvider client={queryClient}>
            <Provider store={store}>
              <MemoryRouter initialEntries={['/cart']}>
                <main>
                  <Routes>
                    <Route path="/cart" element={<CartPage />} />
                  </Routes>
                </main>
              </MemoryRouter>
            </Provider>
          </QueryClientProvider>
        </ProductRepositoryProvider>
      </I18nProvider>
    </HelmetProvider>,
  );

  return { ...result, store };
}

describe('Recommendations Integration R05.2, R05.3 & R05.5', () => {
  it('PDP delays recommendations until IntersectionObserver triggers and fetches related + upsell in one request', async () => {
    const repository = new MockProductRepository();
    const recsSpy = vi.spyOn(repository, 'getProductRecommendations');

    const { container } = renderPdpRoute(
      repository,
      '/audio/fone-de-ouvido-bluetooth-over-ear-pro',
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: FIXTURE_PRODUCTS_DETAIL[0].name,
      }),
    ).toBeInTheDocument();

    // Must not call API before scrolling near the section
    expect(getActiveIntersectionObserverCount()).toBeGreaterThanOrEqual(1);
    expect(recsSpy).not.toHaveBeenCalled();

    // Enter viewport
    act(() => {
      triggerAllIntersections(true);
    });

    await waitFor(() => {
      expect(recsSpy).toHaveBeenCalledTimes(1);
    });
    expect(recsSpy).toHaveBeenCalledWith(
      {
        slug: FIXTURE_PRODUCTS_DETAIL[0].slug,
        types: ['related', 'upsell'],
        limit: undefined,
        currency: 'BRL',
      },
      expect.any(AbortSignal),
    );

    const relatedCarousel = await screen.findByTestId('pdp-related-carousel');
    const upsellCarousel = await screen.findByTestId('pdp-upsell-carousel');

    expect(
      within(relatedCarousel).getByRole('heading', {
        level: 2,
        name: 'Você também pode gostar',
      }),
    ).toBeInTheDocument();
    expect(
      within(upsellCarousel).getByRole('heading', {
        level: 2,
        name: 'Alternativas para considerar',
      }),
    ).toBeInTheDocument();
    expect(
      within(relatedCarousel).getByText(FIXTURE_PRODUCTS_DETAIL[1].name),
    ).toBeInTheDocument();
    expect(
      within(upsellCarousel).getByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).toBeInTheDocument();

    const axeResults = await axe(container);
    expect(axeResults).toHaveNoViolations();
  });

  it('PDP collapses empty recommendation lists silently and tolerates API errors cleanly', async () => {
    const repository = new MockProductRepository();
    const { unmount } = renderPdpRoute(
      repository,
      '/bem-estar/vela-aromatica-soja-e-baunilha',
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: FIXTURE_PRODUCTS_DETAIL[5].name,
      }),
    ).toBeInTheDocument();

    act(() => {
      triggerAllIntersections(true);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('pdp-recommendations-section'),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('pdp-related-carousel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdp-upsell-carousel')).not.toBeInTheDocument();
    unmount();

    // Simulate recommendations error on another product -> PDP stays usable
    const errorRepo = new MockProductRepository();
    errorRepo.setErrorOn({
      recommendations: new ApiError({
        status: 503,
        code: 'CHAOS_FAILURE',
        message: 'Recommendations failed',
        requestId: 'req-rec-err',
      }),
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderPdpRoute(errorRepo, '/audio/fone-de-ouvido-bluetooth-over-ear-pro', {
      disableRetry: true,
    });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: FIXTURE_PRODUCTS_DETAIL[0].name,
      }),
    ).toBeInTheDocument();

    act(() => {
      triggerAllIntersections(true);
    });

    expect(
      await screen.findByTestId('pdp-related-carousel-dev-error'),
    ).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalled();
    expect(
      screen.getAllByRole('button', { name: /Adicionar ao carrinho/i })[0],
    ).toBeEnabled();
  });

  it('Cart hides cross-sell when empty, deduplicates immediately on inline add without opening MiniCart, and reacts to item removal', async () => {
    const repository = new MockProductRepository();
    const crossSellSpy = vi.spyOn(repository, 'getCrossSell');
    const user = userEvent.setup();

    // Empty cart -> 0 requests and block hidden
    const { unmount } = renderCartRoute(repository, []);
    expect(
      await screen.findByText('Seu carrinho de compras está vazio'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cart-cross-sell-section'),
    ).not.toBeInTheDocument();
    expect(crossSellSpy).not.toHaveBeenCalled();
    unmount();

    // Cart with Fone -> cross-sell loads Organizador & Vela
    const { container, store } = renderCartRoute(repository, [
      FIXTURE_PRODUCTS_DETAIL[0],
    ]);

    const carousel = await screen.findByTestId('cart-cross-sell-carousel');
    expect(
      within(carousel).getByRole('heading', {
        level: 2,
        name: 'Combine com o seu pedido',
      }),
    ).toBeInTheDocument();

    const organizadorName = FIXTURE_PRODUCTS_DETAIL[4].name;
    expect(
      await within(carousel).findByText(organizadorName),
    ).toBeInTheDocument();

    // Inline add-to-cart adds item cleanly without opening MiniCart
    const addButton = within(carousel).getByRole('button', {
      name: new RegExp(`Adicionar ${organizadorName} ao carrinho`, 'i'),
    });
    await user.click(addButton);

    expect(store.getState().cart.isOpen).toBe(false);
    expect(
      store.getState().cart.items.some(
        (item) => item.id === FIXTURE_PRODUCTS_DETAIL[4].id,
      ),
    ).toBe(true);

    // Client-side filtering removes newly added item immediately without duplicate display
    await waitFor(() => {
      expect(within(carousel).queryByText(organizadorName)).not.toBeInTheDocument();
    });

    // Latest cross-sell call included both Fone and Organizador
    const latestCall = crossSellSpy.mock.calls.at(-1)?.[0];
    expect(latestCall?.productIds).toContain(FIXTURE_PRODUCTS_DETAIL[0].id);
    expect(latestCall?.productIds).toContain(FIXTURE_PRODUCTS_DETAIL[4].id);

    const axeResults = await axe(container);
    expect(axeResults).toHaveNoViolations();

    // Removing Fone triggers cross-sell update for remaining Organizador
    const callCountBeforeRemove = crossSellSpy.mock.calls.length;
    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`Remover ${FIXTURE_PRODUCTS_DETAIL[0].name} do carrinho`, 'i'),
      }),
    );
    await waitFor(() => {
      expect(crossSellSpy.mock.calls.length).toBeGreaterThan(callCountBeforeRemove);
    });
    expect(crossSellSpy.mock.calls.at(-1)?.[0].productIds).toEqual([
      FIXTURE_PRODUCTS_DETAIL[4].id,
    ]);
  });

  it('Cart caps cross-sell request to at most 20 most recent distinct productIds', async () => {
    const repository = new MockProductRepository();
    const crossSellSpy = vi.spyOn(repository, 'getCrossSell');

    const manyProducts = Array.from({ length: 24 }, (_, idx) => ({
      ...FIXTURE_PRODUCTS_DETAIL[idx % FIXTURE_PRODUCTS_DETAIL.length],
      inStock: true,
      id: `80000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
      slug: `item-${idx + 1}`,
      name: `Item ${idx + 1}`,
    }));

    renderCartRoute(repository, manyProducts);

    await waitFor(() => {
      expect(crossSellSpy).toHaveBeenCalledTimes(1);
    });

    const calledIds = crossSellSpy.mock.calls[0][0].productIds;
    expect(calledIds).toHaveLength(20);
    expect(calledIds[0]).toBe('80000000-0000-4000-8000-000000000024');
    expect(calledIds[19]).toBe('80000000-0000-4000-8000-000000000005');
  });

  it('propagates selected currency to PDP recommendations and Cart cross-sell queries', async () => {
    const repository = new MockProductRepository();
    const crossSellSpy = vi.spyOn(repository, 'getCrossSell');

    const { store } = renderCartRoute(repository, [FIXTURE_PRODUCTS_DETAIL[0]]);
    await screen.findByTestId('cart-cross-sell-carousel');

    act(() => {
      store.dispatch(setCurrency('USD'));
    });

    await waitFor(() => {
      expect(crossSellSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ currency: 'USD' }),
        expect.any(AbortSignal),
      );
    });
  });
});
