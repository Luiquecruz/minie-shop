import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { SearchSuggestResponseDTO } from '@minieshop/contracts';
import { ProductRepositoryProvider } from '../../../context/ProductRepositoryProvider';
import { I18nProvider } from '../../../i18n';
import { ApiError } from '../../../infrastructure/http/errors';
import { MockProductRepository } from '../../../infrastructure/repositories/MockProductRepository';
import { createAppStore } from '../../../store';
import { FIXTURE_PRODUCTS_DETAIL } from '../../../test/fixtures/catalogFixture';
import Navbar from '../../Navbar/Navbar';
import SearchBar from '../SearchBar';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-probe">{`${location.pathname}${location.search}`}</output>;
}

function renderSearchBar(
  repository: MockProductRepository,
  initialEntries: string[] = ['/'],
  locale: 'en' | 'pt-BR' = 'pt-BR',
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const store = createAppStore();

  return render(
    <I18nProvider initialLocale={locale}>
      <ProductRepositoryProvider repository={repository}>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <MemoryRouter initialEntries={initialEntries}>
              <LocationProbe />
              <Navbar />
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </ProductRepositoryProvider>
    </I18nProvider>,
  );
}

describe('SearchBar S08.2 — Accessible WAI-ARIA APG Combobox', () => {
  it('renders the global SearchBar across catalog, PDP, and /search routes while syncing ?q=', () => {
    const repository = new MockProductRepository();
    const searchView = renderSearchBar(repository, ['/search?q=fone']);
    const searchRouteInput = screen.getByRole('combobox', {
      name: /Buscar produtos/i,
    });
    expect(searchRouteInput).toHaveValue('fone');
    searchView.unmount();

    const trailingSlash = renderSearchBar(repository, ['/search/?q=teclado']);
    expect(
      screen.getByRole('combobox', { name: /Buscar produtos/i }),
    ).toHaveValue('teclado');
    trailingSlash.unmount();

    renderSearchBar(repository, ['/audio/fone-de-ouvido-bluetooth-over-ear-pro']);
    expect(screen.getByRole('combobox', { name: /Buscar produtos/i })).toBeInTheDocument();
  });

  it('debounces ~200ms from 2 trimmed chars, cancels previous AbortSignal on term change, and announces suggestions', async () => {
    const repository = new MockProductRepository();
    const abortedSignals: boolean[] = [];
    const suggestSpy = vi
      .spyOn(repository, 'suggestProducts')
      .mockImplementation((params, signal) => {
        if (params.q === 'fo') {
          return new Promise<SearchSuggestResponseDTO>((resolve, reject) => {
            signal?.addEventListener('abort', () => {
              abortedSignals.push(true);
              reject(new DOMException('Aborted', 'AbortError'));
            });
            setTimeout(() => {
              resolve({
                suggestions: [
                  {
                    slug: FIXTURE_PRODUCTS_DETAIL[0].slug,
                    name: FIXTURE_PRODUCTS_DETAIL[0].name,
                    categoryName: FIXTURE_PRODUCTS_DETAIL[0].category.name,
                    categorySlug: FIXTURE_PRODUCTS_DETAIL[0].category.slug,
                  },
                ],
                mode: 'keyword',
              });
            }, 300);
          });
        }
        return Promise.resolve({
          suggestions: [
            {
              slug: FIXTURE_PRODUCTS_DETAIL[0].slug,
              name: FIXTURE_PRODUCTS_DETAIL[0].name,
              categoryName: FIXTURE_PRODUCTS_DETAIL[0].category.name,
              categorySlug: FIXTURE_PRODUCTS_DETAIL[0].category.slug,
            },
          ],
          mode: 'keyword',
        });
      });

    renderSearchBar(repository, ['/']);
    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });

    // 1 char (or whitespace + 1 char) must NOT call suggestProducts
    fireEvent.change(input, { target: { value: ' f ' } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 240));
    });
    expect(suggestSpy).not.toHaveBeenCalled();

    // Typing 'fo' fires after ~200ms debounce
    fireEvent.change(input, { target: { value: 'fo' } });
    await waitFor(() => {
      expect(suggestSpy).toHaveBeenCalledWith(
        { q: 'fo', limit: 8 },
        expect.any(AbortSignal),
      );
    });

    // Rapidly typing 'fone' cancels 'fo' request and loads 'fone'
    fireEvent.change(input, { target: { value: 'fone' } });
    await waitFor(() => {
      expect(suggestSpy).toHaveBeenCalledWith(
        { q: 'fone', limit: 8 },
        expect.any(AbortSignal),
      );
    });
    expect(abortedSignals.length).toBeGreaterThanOrEqual(1);

    // Displays suggestion, secondary category, "Ver todos", and announces live count
    expect(
      await screen.findByRole('option', {
        name: /Fone de Ouvido Bluetooth Over-Ear Pro/i,
      }),
    ).toBeInTheDocument();
    const seeAllOption = screen.getByRole('option', {
      name: /Ver todos os resultados para fone/i,
    });
    expect(seeAllOption).toBeInTheDocument();
    expect(seeAllOption.querySelector('strong')).toHaveTextContent('fone');
    expect(seeAllOption.textContent).not.toContain('«');
    expect(screen.getByTestId('search-suggestions-live')).toHaveTextContent(
      '1 sugestão disponível',
    );
  });

  it('supports keyboard navigation (ArrowDown/ArrowUp/Home/End/Escape), keeps focus on input, and closes on outside click', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'aluminio');

    await screen.findByRole('option', {
      name: /Teclado Mecânico RGB Compacto Alumínio/i,
    });
    const listbox = screen.getByRole('listbox', {
      name: /Sugestões de busca/i,
    });
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2); // suggestions + "Ver todos"
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    // ArrowDown highlights first option while keeping DOM focus on input
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveFocus();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    // End jumps to last option ("Ver todos os resultados")
    await user.keyboard('{End}');
    const lastOption = options[options.length - 1];
    expect(lastOption).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', lastOption.id);

    // Home jumps back to first option
    await user.keyboard('{Home}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // Escape closes listbox while keeping focus on input
    await user.keyboard('{Escape}');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    // Re-open with ArrowDown, then outside pointerdown closes
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(document.body);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('navigates to PDP on Enter with active option, and to /search?q= on Enter without active option or "See all"', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });

    // Empty query Enter must NOT navigate
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(/^\/$/);

    // Enter without active option -> /search?q=fone
    await user.type(input, 'fone');
    await screen.findByRole('option', {
      name: /Fone de Ouvido Bluetooth Over-Ear Pro/i,
    });
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/search?q=fone',
    );
  });

  it('navigates directly to PDP when selecting an option via Enter and via clicking "Ver todos"', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    const { unmount } = renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'fone');
    await screen.findByRole('option', {
      name: /Fone de Ouvido Bluetooth Over-Ear Pro/i,
    });

    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/audio/fone-de-ouvido-bluetooth-over-ear-pro',
    );
    unmount();

    // Clicking "Ver todos os resultados" navigates to /search?q=
    renderSearchBar(repository, ['/']);
    const input2 = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input2, 'fone');
    const seeAllOption = await screen.findByRole('option', {
      name: /Ver todos os resultados para fone/i,
    });
    await user.click(seeAllOption);
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/search?q=fone',
    );
  });

  it('shows empty and error states cleanly and still submits on Enter when suggest fails', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'zzzzinexistente');
    expect(
      await screen.findByText('Nenhuma sugestão', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('search-suggestions-live')).toHaveTextContent(
      'Nenhuma sugestão',
    );

    // Simulate API error on suggest
    repository.setErrorOn({
      suggest: new ApiError({
        status: 503,
        code: 'CHAOS_FAILURE',
        message: 'Suggest unavailable',
        requestId: 'req-err',
      }),
    });

    await user.clear(input);
    await user.type(input, 'teclado');
    expect(
      await screen.findByText('Não foi possível carregar sugestões', {
        selector: 'p',
      }),
    ).toBeInTheDocument();

    // Enter still navigates to /search?q=teclado
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/search?q=teclado',
    );
  });

  it('ignores keyboard navigation and Enter selection during IME composition', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'fone');
    await screen.findByRole('option', {
      name: /Fone de Ouvido Bluetooth Over-Ear Pro/i,
    });

    // ArrowDown during IME composition must not highlight an option
    fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true });
    expect(input).not.toHaveAttribute('aria-activedescendant');

    // Highlight normally, then press Enter while composing -> must not select/navigate
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.getByTestId('location-probe')).toHaveTextContent(/^\/$/);
  });

  it('clears the highlighted suggestion when input changes so Enter within debounce submits the new term', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'fone');
    await screen.findByRole('option', {
      name: /Fone de Ouvido Bluetooth Over-Ear Pro/i,
    });

    // Highlight the first suggestion for 'fone'
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant');

    // Immediately change input to 'teclado' and press Enter before the 200ms debounce settles
    fireEvent.change(input, { target: { value: 'teclado' } });
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/search?q=teclado',
    );
  });

  it('hides stale placeholder suggestions while the new debounced query is in flight', async () => {
    const repository = new MockProductRepository();
    let resolveTeclado!: (res: SearchSuggestResponseDTO) => void;
    const tecladoPromise = new Promise<SearchSuggestResponseDTO>((resolve) => {
      resolveTeclado = resolve;
    });

    vi.spyOn(repository, 'suggestProducts').mockImplementation((params) => {
      if (params.q === 'teclado') {
        return tecladoPromise;
      }
      return Promise.resolve({
        suggestions: [
          {
            slug: FIXTURE_PRODUCTS_DETAIL[0].slug,
            name: FIXTURE_PRODUCTS_DETAIL[0].name,
            categoryName: FIXTURE_PRODUCTS_DETAIL[0].category.name,
            categorySlug: FIXTURE_PRODUCTS_DETAIL[0].category.slug,
          },
        ],
        mode: 'keyword',
      });
    });

    const user = userEvent.setup();
    renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'fone');
    expect(
      await screen.findByRole('option', {
        name: new RegExp(FIXTURE_PRODUCTS_DETAIL[0].name, 'i'),
      }),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'teclado');

    // Once the 200ms debounce settles and 'teclado' is in flight (`isPlaceholderData`),
    // previous 'fone' suggestions must NOT remain selectable.
    await waitFor(() => {
      expect(
        screen.queryByRole('option', {
          name: new RegExp(FIXTURE_PRODUCTS_DETAIL[0].name, 'i'),
        }),
      ).not.toBeInTheDocument();
    });

    await act(async () => {
      resolveTeclado({
        suggestions: [
          {
            slug: FIXTURE_PRODUCTS_DETAIL[2].slug,
            name: FIXTURE_PRODUCTS_DETAIL[2].name,
            categoryName: FIXTURE_PRODUCTS_DETAIL[2].category.name,
            categorySlug: FIXTURE_PRODUCTS_DETAIL[2].category.slug,
          },
        ],
        mode: 'keyword',
      });
    });

    expect(
      await screen.findByRole('option', {
        name: new RegExp(FIXTURE_PRODUCTS_DETAIL[2].name, 'i'),
      }),
    ).toBeInTheDocument();
  });

  it('passes vitest-axe with zero accessibility violations when combobox is open', async () => {
    const repository = new MockProductRepository();
    const user = userEvent.setup();
    const { container } = renderSearchBar(repository, ['/']);

    const input = screen.getByRole('combobox', { name: /Buscar produtos/i });
    await user.type(input, 'fone');
    await screen.findByRole('option', {
      name: /Fone de Ouvido Bluetooth Over-Ear Pro/i,
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('keeps SearchBar standalone render accessible', async () => {
    const repository = new MockProductRepository();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <I18nProvider initialLocale="pt-BR">
        <ProductRepositoryProvider repository={repository}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <SearchBar />
            </MemoryRouter>
          </QueryClientProvider>
        </ProductRepositoryProvider>
      </I18nProvider>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
