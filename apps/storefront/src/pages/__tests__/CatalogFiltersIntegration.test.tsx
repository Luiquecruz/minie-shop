import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import type { ProductListResponseDTO } from '@minieshop/contracts';
import { AppRoutes } from '../../App';
import { ProductRepositoryProvider } from '../../context/ProductRepositoryProvider';
import { MockProductRepository } from '../../infrastructure/repositories/MockProductRepository';
import { createStorefrontQueryClient } from '../../query/queryClient';
import { createAppStore } from '../../store';
import {
  FIXTURE_PRODUCT_CARDS,
  FIXTURE_PRODUCTS_DETAIL,
} from '../../test/fixtures/catalogFixture';

function HistoryControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <output data-testid="current-url">{`${location.pathname}${location.search}`}</output>
      <button type="button" onClick={() => navigate(-1)}>
        History Back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        History Forward
      </button>
    </div>
  );
}

function renderCatalog(
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
              <HistoryControls />
              <AppRoutes />
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </ProductRepositoryProvider>
    </HelmetProvider>,
  );
}

describe('Catalog URL Filters, Facets Parity, History Back/Forward & Out-of-order Search', () => {
  it('reproduces filter state from shareable URL and supports Back/Forward navigation', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();

    renderCatalog(repository, ['/?category=audio&inStock=true']);

    // Audio has 2 in-stock products in fixture
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();
    expect(
      screen.getByText(FIXTURE_PRODUCTS_DETAIL[1].name),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).not.toBeInTheDocument();

    const inStockCheckbox = screen.getByLabelText(/In stock only/i);
    expect(inStockCheckbox).toBeChecked();

    // Apply a confirmed category filter push: Periféricos
    await user.click(screen.getByRole('button', { name: /Periféricos/i }));
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent(
        '/?category=perifericos&inStock=true',
      );
    });
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).toBeInTheDocument();

    // Navigate Back -> restores audio
    await user.click(screen.getByRole('button', { name: 'History Back' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent(
        '/?category=audio&inStock=true',
      );
    });
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();

    // Navigate Forward -> restores perifericos
    await user.click(screen.getByRole('button', { name: 'History Forward' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent(
        '/?category=perifericos&inStock=true',
      );
    });
  });

  it('matches disjunctive facet option count with exact rendered product count when applied', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();

    renderCatalog(repository, ['/']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();

    // Check facet option "Bluetooth" (2 products in fixture)
    const bluetoothCheckbox = await screen.findByRole('checkbox', {
      name: /Bluetooth/i,
    });
    const bluetoothRow = bluetoothCheckbox.closest('label');
    expect(bluetoothRow).toHaveTextContent('2');

    await user.click(bluetoothCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent(
        'attr.connectivity=Bluetooth',
      );
    });

    await waitFor(() => {
      const renderedCards = document.querySelectorAll('article.product-card');
      expect(renderedCards).toHaveLength(2);
    });
  });

  it('never displays stale search results when an earlier slow query resolves after a newer fast query', async () => {
    const repository = new MockProductRepository();

    let resolveSlowRequest!: (value: ProductListResponseDTO) => void;
    const slowPromise = new Promise<ProductListResponseDTO>((resolve) => {
      resolveSlowRequest = resolve;
    });

    const originalList = repository.listProducts.bind(repository);
    vi.spyOn(repository, 'listProducts').mockImplementation((params, signal) => {
      if (params?.q === 'lento') {
        return new Promise<ProductListResponseDTO>((resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The request was aborted.', 'AbortError'));
          });
          void slowPromise.then(resolve, reject);
        });
      }
      if (params?.q === 'teclado') {
        return Promise.resolve({
          items: [FIXTURE_PRODUCT_CARDS[2]],
          nextCursor: null,
        });
      }
      return originalList(params, signal);
    });

    const user = userEvent.setup();
    renderCatalog(repository, ['/']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole('searchbox', {
      name: /Search products/i,
    });

    // Submit slow search "lento"
    await user.clear(searchInput);
    await user.type(searchInput, 'lento{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent('q=lento');
    });

    // Immediately submit fast search "teclado" before "lento" finishes
    await user.clear(searchInput);
    await user.type(searchInput, 'teclado{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent('q=teclado');
    });

    // Fast result appears
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(FIXTURE_PRODUCTS_DETAIL[5].name),
    ).not.toBeInTheDocument();

    // Now resolve the stale slow request with a completely different product
    resolveSlowRequest({
      items: [FIXTURE_PRODUCT_CARDS[5]],
      nextCursor: null,
    });

    await new Promise((r) => setTimeout(r, 40));

    // UI MUST still display "teclado" result and NEVER the stale "lento" result
    expect(
      screen.getByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(FIXTURE_PRODUCTS_DETAIL[5].name),
    ).not.toBeInTheDocument();
  });

  it('clears price range and search filters cleanly without stale debounce bounce-back', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();

    renderCatalog(repository, ['/?minPrice=10000&maxPrice=50000&q=Fone']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();

    // Categories outside matching facets must show 0 rather than unfiltered productCount
    const perifericosBtn = screen.getByRole('button', { name: /Periféricos/i });
    expect(perifericosBtn).toHaveTextContent('0');

    // Click Clear all -> URL resets to '/' and MUST NOT bounce back after debounce window
    await user.click(screen.getByRole('button', { name: /Clear all/i }));

    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent('/');
    });

    // Wait longer than the 350ms debounce window to confirm zero bounce-back
    await new Promise((r) => setTimeout(r, 450));

    expect(screen.getByTestId('current-url')).toHaveTextContent(/^\/$/);
    expect(screen.getByLabelText(/Min price/i)).toHaveValue(null);
    expect(screen.getByLabelText(/Max price/i)).toHaveValue(null);
    expect(
      screen.getByRole('searchbox', { name: /Search products/i }),
    ).toHaveValue('');
  });

  it('restores SearchBar input value on Clear -> History Back navigation', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();

    renderCatalog(repository, ['/?q=Fone']);

    const searchInput = screen.getByRole('searchbox', {
      name: /Search products/i,
    });
    expect(searchInput).toHaveValue('Fone');

    await user.click(screen.getByRole('button', { name: /Clear search input/i }));
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent(/^\/$/);
    });
    expect(searchInput).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'History Back' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent('/?q=Fone');
    });
    expect(searchInput).toHaveValue('Fone');
  });
});
