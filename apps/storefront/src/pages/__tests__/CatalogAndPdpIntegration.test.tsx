import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AppRoutes } from '../../App';
import { ProductRepositoryProvider } from '../../context/ProductRepositoryProvider';
import { ApiError } from '../../infrastructure/http/errors';
import { MockProductRepository } from '../../infrastructure/repositories/MockProductRepository';
import { createStorefrontQueryClient } from '../../query/queryClient';
import { createAppStore } from '../../store';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';

function renderApp(
  repository: MockProductRepository,
  initialEntries: string[] = ['/'],
) {
  const queryClient = createStorefrontQueryClient();
  const store = createAppStore();

  return render(
    <HelmetProvider>
      <ProductRepositoryProvider repository={repository}>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <MemoryRouter initialEntries={initialEntries}>
              <AppRoutes />
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </ProductRepositoryProvider>
    </HelmetProvider>,
  );
}

describe('Catalog, PDP, Cache staleTime, Redirects, 404, Retry & Optimistic Favorites', () => {
  it('navigates Catalog -> PDP -> Back without re-fetching listProducts within staleTime', async () => {
    const repository = new MockProductRepository();
    const listSpy = vi.spyOn(repository, 'listProducts');
    const user = userEvent.setup();

    renderApp(repository, ['/']);

    const firstProduct = FIXTURE_PRODUCTS_DETAIL[0];
    expect(await screen.findByText(firstProduct.name)).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('link', { name: firstProduct.name }));
    expect(
      await screen.findByRole('heading', { name: firstProduct.name }),
    ).toBeInTheDocument();

    // Navigate back to catalog via breadcrumb link
    await user.click(screen.getByRole('link', { name: /^Catalog$/i }));
    expect(await screen.findByText(firstProduct.name)).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('redirects legacy /product/1 route to canonical /:category/:slug PDP', async () => {
    const repository = new MockProductRepository();
    renderApp(repository, ['/product/1']);

    expect(
      await screen.findByRole('heading', {
        name: FIXTURE_PRODUCTS_DETAIL[0].name,
      }),
    ).toBeInTheDocument();
  });

  it('renders 404 NotFoundPage when API returns 404 NOT_FOUND for product slug', async () => {
    const repository = new MockProductRepository();
    renderApp(repository, ['/audio/produto-inexistente']);

    expect(
      await screen.findByRole('heading', { name: /not found/i }),
    ).toBeInTheDocument();
  });

  it('shows Try Again on error and recovers when refetched', async () => {
    const repository = new MockProductRepository();
    const listSpy = vi.spyOn(repository, 'listProducts');
    listSpy.mockRejectedValueOnce(
      new ApiError({
        status: 503,
        code: 'CHAOS_FAILURE',
        message: 'Simulated chaos failure',
        requestId: 'req-chaos-1',
      }),
    );

    const queryClient = createStorefrontQueryClient();
    queryClient.setDefaultOptions({
      queries: { retry: false },
    });
    const store = createAppStore();
    const user = userEvent.setup();

    render(
      <HelmetProvider>
        <ProductRepositoryProvider repository={repository}>
          <QueryClientProvider client={queryClient}>
            <Provider store={store}>
              <MemoryRouter initialEntries={['/']}>
                <AppRoutes />
              </MemoryRouter>
            </Provider>
          </QueryClientProvider>
        </ProductRepositoryProvider>
      </HelmetProvider>,
    );

    expect(await screen.findByText(/Simulated chaos failure/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();
  });

  it('applies optimistic favorite update and rolls back on mutation failure', async () => {
    const repository = new MockProductRepository();
    vi.spyOn(repository, 'addFavorite').mockRejectedValueOnce(
      new ApiError({
        status: 503,
        code: 'CHAOS_FAILURE',
        message: 'Favorite chaos failure',
        requestId: 'req-fav-1',
      }),
    );

    const user = userEvent.setup();
    renderApp(repository, ['/']);

    const firstProduct = FIXTURE_PRODUCTS_DETAIL[0];
    expect(await screen.findByText(firstProduct.name)).toBeInTheDocument();

    const favButton = screen.getByRole('button', {
      name: new RegExp(`Add ${firstProduct.name} to favorites`, 'i'),
    });
    expect(favButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(favButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Favorite chaos failure/i,
    );
    expect(favButton).toHaveAttribute('aria-pressed', 'false');
  });
});
