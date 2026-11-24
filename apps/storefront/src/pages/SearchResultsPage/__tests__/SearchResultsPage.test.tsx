import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import type { ProductCardDTO, SearchResponseDTO } from '@minieshop/contracts';
import { ProductRepositoryProvider } from '../../../context/ProductRepositoryProvider';
import { I18nProvider } from '../../../i18n';
import { ApiError } from '../../../infrastructure/http/errors';
import { MockProductRepository } from '../../../infrastructure/repositories/MockProductRepository';
import { createAppStore } from '../../../store';
import {
  FIXTURE_PRODUCT_CARDS,
  FIXTURE_PRODUCTS_DETAIL,
} from '../../../test/fixtures/catalogFixture';
import SearchResultsPage from '../SearchResultsPage';

function UrlTracker() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output data-testid="search-url">{`${location.pathname}${location.search}`}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  );
}

function makeSyntheticCard(index: number): ProductCardDTO {
  const base = FIXTURE_PRODUCT_CARDS[index % FIXTURE_PRODUCT_CARDS.length];
  return {
    ...base,
    id: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slug: `produto-busca-${index}`,
    name: `Produto Busca ${index}`,
  };
}

function renderSearchPage(
  repository: MockProductRepository,
  initialEntries: string[] = ['/search'],
  locale: 'en' | 'pt-BR' = 'pt-BR',
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const store = createAppStore();

  return render(
    <HelmetProvider>
      <I18nProvider initialLocale={locale}>
        <ProductRepositoryProvider repository={repository}>
          <QueryClientProvider client={queryClient}>
            <Provider store={store}>
              <MemoryRouter initialEntries={initialEntries}>
                <UrlTracker />
                <Routes>
                  <Route path="/search" element={<SearchResultsPage />} />
                </Routes>
              </MemoryRouter>
            </Provider>
          </QueryClientProvider>
        </ProductRepositoryProvider>
      </I18nProvider>
    </HelmetProvider>,
  );
}

describe('SearchResultsPage S08.3 & S08.4 — InstantSearch /search route', () => {
  it('renders empty-query prompt without calling API when ?q= is absent', () => {
    const repository = new MockProductRepository();
    const searchSpy = vi.spyOn(repository, 'searchProducts');

    renderSearchPage(repository, ['/search']);

    expect(screen.getByText('Digite para buscar produtos')).toBeInTheDocument();
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('reproduces results from shareable URL ?q=, announces count, and updates URL on typing (replace) vs Enter (push)', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();

    renderSearchPage(repository, ['/search?q=fone']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();
    expect(screen.getByTestId('search-results-live')).toHaveTextContent(
      '1 resultado para «fone»',
    );

    const searchInput = screen.getByRole('searchbox', { name: /Buscar produtos/i });
    expect(searchInput).toHaveValue('fone');

    // Live typing updates URL with replace (so Back still goes to before /search?q=fone, not intermediate keystrokes)
    await user.clear(searchInput);
    await user.type(searchInput, 'tecl');
    await waitFor(
      () => {
        expect(screen.getByTestId('search-url')).toHaveTextContent('/search?q=tecl');
      },
      { timeout: 2000 },
    );

    // Explicit Enter uses push so Back returns to /search?q=tecl
    await user.clear(searchInput);
    await user.type(searchInput, 'caixa{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('search-url')).toHaveTextContent('/search?q=caixa');
    });
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[1].name),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => {
      expect(screen.getByTestId('search-url')).toHaveTextContent('/search?q=tecl');
    });
  });

  it('loads more results via "Carregar mais" and enforces the offset=200 limit notice', async () => {
    const repository = new MockProductRepository();
    const allItems = Array.from({ length: 240 }, (_, i) => makeSyntheticCard(i));

    const searchSpy = vi
      .spyOn(repository, 'searchProducts')
      .mockImplementation(async (params) => {
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 24;
        return {
          items: allItems.slice(offset, offset + limit),
          estimatedTotal: allItems.length,
          mode: 'hybrid',
        };
      });

    const user = userEvent.setup();
    renderSearchPage(repository, ['/search?q=produto']);

    // Page 0 -> 24 items + Load more button
    expect(await screen.findByText('Produto Busca 0')).toBeInTheDocument();
    expect(screen.getByText('Produto Busca 23')).toBeInTheDocument();

    // Load pages 1..8 (reaching offset=192, items 0..215)
    for (let page = 1; page <= 8; page += 1) {
      const loadMoreBtn = screen.getByRole('button', { name: 'Carregar mais' });
      await user.click(loadMoreBtn);
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ offset: page * 24, limit: 24 }),
          expect.any(AbortSignal),
        );
      });
    }

    // After offset=192, nextOffset would be 216 > 200 -> button hides, refinement notice appears
    expect(
      await screen.findByText(
        'Refine sua busca para ver resultados mais específicos',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
    ).not.toBeInTheDocument();
  });

  it('renders empty results state and recovers from errors via "Tentar novamente"', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();

    renderSearchPage(repository, ['/search?q=inexistente']);
    expect(
      await screen.findByText('Nenhum resultado para «inexistente»'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('search-results-live')).toHaveTextContent(
      'Nenhum resultado',
    );

    // Trigger error then recover
    vi.spyOn(repository, 'searchProducts').mockRejectedValueOnce(
      new ApiError({
        status: 503,
        code: 'CHAOS_FAILURE',
        message: 'Simulated search error',
        requestId: 'req-1',
      }),
    );

    const searchInput = screen.getByRole('searchbox', { name: /Buscar produtos/i });
    await user.clear(searchInput);
    await user.type(searchInput, 'fone{Enter}');

    expect(
      await screen.findByText('Simulated search error'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();
  });

  it('never displays stale out-of-order responses when an earlier query settles after a newer one', async () => {
    const repository = new MockProductRepository();
    let resolveSlow!: (res: SearchResponseDTO) => void;
    const slowPromise = new Promise<SearchResponseDTO>((resolve) => {
      resolveSlow = resolve;
    });

    vi.spyOn(repository, 'searchProducts').mockImplementation((params) => {
      if (params.q === 'lento') {
        return slowPromise;
      }
      return Promise.resolve({
        items: [FIXTURE_PRODUCT_CARDS[2]], // Teclado
        estimatedTotal: 1,
        mode: 'hybrid',
      });
    });

    const user = userEvent.setup();
    renderSearchPage(repository, ['/search?q=lento']);

    const searchInput = screen.getByRole('searchbox', { name: /Buscar produtos/i });
    await user.clear(searchInput);
    await user.type(searchInput, 'teclado{Enter}');

    // Fast response appears
    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).toBeInTheDocument();

    // Now resolve slow 'lento' request with a completely different product
    resolveSlow({
      items: [FIXTURE_PRODUCT_CARDS[5]], // Vela
      estimatedTotal: 1,
      mode: 'hybrid',
    });

    await new Promise((r) => setTimeout(r, 40));

    // Must still display Teclado and NEVER Vela
    expect(
      screen.getByText(FIXTURE_PRODUCTS_DETAIL[2].name),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(FIXTURE_PRODUCTS_DETAIL[5].name),
    ).not.toBeInTheDocument();
  });

  it('renders identical user-facing layout across hybrid, keyword, and postgres modes', async () => {
    for (const mode of ['hybrid', 'keyword', 'postgres'] as const) {
      const repository = new MockProductRepository({ searchMode: mode });
      const { unmount } = renderSearchPage(repository, ['/search?q=fone']);

      expect(
        await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
      ).toBeInTheDocument();
      expect(screen.getByTestId('search-dev-badge')).toHaveTextContent(
        `mode: ${mode}`,
      );
      unmount();
    }
  });

  it('does not fire a duplicate search request when submitting an already-active query', async () => {
    const repository = new MockProductRepository();
    const searchSpy = vi.spyOn(repository, 'searchProducts');
    const user = userEvent.setup();

    renderSearchPage(repository, ['/search?q=fone']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();
    expect(searchSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await new Promise((r) => setTimeout(r, 30));

    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves trailing spaces across debounced URL syncs so consecutive words never merge', async () => {
    const repository = new MockProductRepository();
    const searchSpy = vi.spyOn(repository, 'searchProducts');
    const user = userEvent.setup();

    renderSearchPage(repository, ['/search']);

    const searchInput = screen.getByRole('searchbox', { name: /Buscar produtos/i });

    // Type first word plus trailing space and wait for the debounced URL sync to land
    await user.type(searchInput, 'tenis ');
    await waitFor(
      () => {
        expect(screen.getByTestId('search-url')).toHaveTextContent('/search?q=tenis');
      },
      { timeout: 2000 },
    );

    // Trailing space must remain in the input instead of being clobbered by trimmed urlQuery
    expect(searchInput).toHaveValue('tenis ');

    // Continue typing the rest of the phrase
    await user.type(searchInput, 'para correr');
    expect(searchInput).toHaveValue('tenis para correr');

    await waitFor(
      () => {
        expect(screen.getByTestId('search-url')).toHaveTextContent(
          '/search?q=tenis+para+correr',
        );
      },
      { timeout: 2000 },
    );
    expect(searchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'tenis para correr' }),
      expect.any(AbortSignal),
    );
  });

  it('ignores 1-character live input and debounces multi-word typing into a single request', async () => {
    const repository = new MockProductRepository();
    const searchSpy = vi.spyOn(repository, 'searchProducts');
    const user = userEvent.setup();

    renderSearchPage(repository, ['/search']);

    const searchInput = screen.getByRole('searchbox', { name: /Buscar produtos/i });

    // Single character should not trigger live search after debounce
    await user.type(searchInput, 'f');
    await new Promise((r) => setTimeout(r, 750));
    expect(searchSpy).not.toHaveBeenCalled();

    // Typing a multi-word phrase continuously fires only a single debounced request
    await user.type(searchInput, 'ones de ouvido');
    await waitFor(
      () => {
        expect(searchSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'fones de ouvido' }),
      expect.any(AbortSignal),
    );
  });

  it('passes vitest-axe with zero accessibility violations on SearchResultsPage', async () => {
    const repository = new MockProductRepository();
    const { container } = renderSearchPage(repository, ['/search?q=fone']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
