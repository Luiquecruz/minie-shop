import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProductRepositoryProvider } from '../../../context/ProductRepositoryProvider';
import { I18nProvider } from '../../../i18n';
import { MockProductRepository } from '../../../infrastructure/repositories/MockProductRepository';
import { createAppStore } from '../../../store';
import { FIXTURE_PRODUCT_CARDS } from '../../../test/fixtures/catalogFixture';
import RecommendationCarousel, {
  type RecommendationCarouselProps,
} from '../RecommendationCarousel';

function renderCarousel(
  props: Partial<RecommendationCarouselProps> = {},
  locale: 'en' | 'pt-BR' = 'pt-BR',
) {
  const repository = new MockProductRepository();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createAppStore();

  return render(
    <I18nProvider initialLocale={locale}>
      <ProductRepositoryProvider repository={repository}>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <MemoryRouter>
              <main>
                <h1>Produto Demo</h1>
                <RecommendationCarousel
                  title="Você também pode gostar"
                  items={FIXTURE_PRODUCT_CARDS}
                  {...props}
                />
              </main>
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </ProductRepositoryProvider>
    </I18nProvider>,
  );
}

describe('RecommendationCarousel R05.4 & R05.5', () => {
  it('renders loading skeleton with aria-busy and collapses silently when empty', () => {
    const { container, rerender } = renderCarousel({
      items: [],
      isLoading: true,
      skeletonCount: 4,
      testId: 'rec-loading',
    });

    const section = screen.getByTestId('rec-loading');
    expect(section).toHaveAttribute('aria-busy', 'true');
    expect(section.querySelectorAll('.rec-skeleton-card')).toHaveLength(4);

    // Silent collapse on empty resolved data
    const repo = new MockProductRepository();
    const qc = new QueryClient();
    const store = createAppStore();
    rerender(
      <I18nProvider initialLocale="pt-BR">
        <ProductRepositoryProvider repository={repo}>
          <QueryClientProvider client={qc}>
            <Provider store={store}>
              <MemoryRouter>
                <main>
                  <h1>Produto Demo</h1>
                  <RecommendationCarousel
                    title="Você também pode gostar"
                    items={[]}
                    isLoading={false}
                    testId="rec-empty"
                  />
                </main>
              </MemoryRouter>
            </Provider>
          </QueryClientProvider>
        </ProductRepositoryProvider>
      </I18nProvider>,
    );

    expect(screen.queryByTestId('rec-empty')).not.toBeInTheDocument();
    expect(
      container.querySelector('.rec-carousel'),
    ).not.toBeInTheDocument();
  });

  it('logs warning on error without breaking host layout', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderCarousel({
      items: [],
      isError: true,
      errorCode: 'CHAOS_FAILURE',
      testId: 'rec-err',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Você também pode gostar'),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Produto Demo' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('rec-err-dev-error')).toHaveTextContent(
      'CHAOS_FAILURE',
    );
  });

  it('disables Prev/Next at scroll boundaries and redirects focus when focused control disables', async () => {
    const user = userEvent.setup();
    const { container } = renderCarousel({
      items: FIXTURE_PRODUCT_CARDS.slice(0, 5),
    });

    const track = container.querySelector(
      '.rec-carousel__track',
    ) as HTMLUListElement;
    expect(track).toBeTruthy();

    let currentScrollLeft = 0;
    Object.defineProperty(track, 'scrollWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(track, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(track, 'scrollLeft', {
      configurable: true,
      get: () => currentScrollLeft,
      set: (val: number) => {
        currentScrollLeft = val;
      },
    });
    track.scrollTo = vi.fn((options?: ScrollToOptions | number, _y?: number) => {
      if (typeof options === 'object' && typeof options?.left === 'number') {
        currentScrollLeft = options.left;
      }
      fireEvent.scroll(track);
    }) as typeof track.scrollTo;

    // Trigger resize so overflow controls appear
    fireEvent(window, new Event('resize'));

    const prevBtn = await screen.findByRole('button', {
      name: /Produtos anteriores em Você também pode gostar/i,
    });
    const nextBtn = screen.getByRole('button', {
      name: /Próximos produtos em Você também pode gostar/i,
    });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Scroll to end using Next until Next disables -> focus redirects to Prev
    await user.click(nextBtn);
    await user.click(nextBtn);

    expect(currentScrollLeft).toBe(600);
    expect(nextBtn).toBeDisabled();
    expect(prevBtn).toBeEnabled();
    expect(prevBtn).toHaveFocus();

    // Scroll back to start using Prev -> Prev disables & redirects focus back to Next
    await user.click(prevBtn);
    await user.click(prevBtn);

    expect(currentScrollLeft).toBe(0);
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();
    expect(nextBtn).toHaveFocus();
  });

  it('scrolls horizontally (never vertically) when a slide control receives focus and respects prefers-reduced-motion', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const { container } = renderCarousel({
        items: FIXTURE_PRODUCT_CARDS.slice(0, 4),
      });

      const track = container.querySelector(
        '.rec-carousel__track',
      ) as HTMLUListElement;
      const slides = track.querySelectorAll('.rec-carousel__slide');
      const fourthSlide = slides[3] as HTMLLIElement;

      Object.defineProperty(track, 'scrollWidth', {
        configurable: true,
        value: 1200,
      });
      Object.defineProperty(track, 'clientWidth', {
        configurable: true,
        value: 400,
      });
      Object.defineProperty(track, 'scrollLeft', {
        configurable: true,
        writable: true,
        value: 0,
      });

      track.getBoundingClientRect = () =>
        ({
          left: 0,
          right: 400,
          width: 400,
          top: 100,
          bottom: 500,
          height: 400,
          x: 0,
          y: 100,
          toJSON: () => {},
        }) as DOMRect;
      fourthSlide.getBoundingClientRect = () =>
        ({
          left: 700,
          right: 1000,
          width: 300,
          top: 100,
          bottom: 500,
          height: 400,
          x: 700,
          y: 100,
          toJSON: () => {},
        }) as DOMRect;

      const scrollToSpy = vi.fn();
      track.scrollTo = scrollToSpy;

      const focusTarget = fourthSlide.querySelector('a') as HTMLAnchorElement;
      fireEvent.focus(focusTarget);

      expect(scrollToSpy).toHaveBeenCalledWith({
        left: 608,
        behavior: 'auto',
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('localizes aria-roledescription and clears nav focus ownership on external blur before boundary scroll', async () => {
    const ptView = renderCarousel(
      {
        items: FIXTURE_PRODUCT_CARDS.slice(0, 5),
        testId: 'rec-pt',
      },
      'pt-BR',
    );
    expect(screen.getByTestId('rec-pt')).toHaveAttribute(
      'aria-roledescription',
      'carrossel',
    );

    const track = ptView.container.querySelector(
      '.rec-carousel__track',
    ) as HTMLUListElement;
    let currentScrollLeft = 0;
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1000 });
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(track, 'scrollLeft', {
      configurable: true,
      get: () => currentScrollLeft,
      set: (val: number) => {
        currentScrollLeft = val;
      },
    });
    fireEvent(window, new Event('resize'));

    const prevBtn = await screen.findByRole('button', {
      name: /Produtos anteriores em Você também pode gostar/i,
    });
    const nextBtn = screen.getByRole('button', {
      name: /Próximos produtos em Você também pode gostar/i,
    });

    // Focus Next, then blur it externally (relatedTarget: null)
    nextBtn.focus();
    expect(nextBtn).toHaveFocus();
    fireEvent.blur(nextBtn, { relatedTarget: null });
    nextBtn.blur();

    // Scroll track manually to the end so Next disables -> Prev must NOT steal focus
    currentScrollLeft = 600;
    fireEvent.scroll(track);

    expect(nextBtn).toBeDisabled();
    expect(prevBtn).toBeEnabled();
    expect(prevBtn).not.toHaveFocus();
    ptView.unmount();

    renderCarousel(
      {
        items: FIXTURE_PRODUCT_CARDS.slice(0, 5),
        testId: 'rec-en',
      },
      'en',
    );
    expect(screen.getByTestId('rec-en')).toHaveAttribute(
      'aria-roledescription',
      'carousel',
    );
  });

  it('passes vitest-axe with zero accessibility violations', async () => {
    const { container } = renderCarousel({
      items: FIXTURE_PRODUCT_CARDS.slice(0, 5),
    });

    const track = container.querySelector(
      '.rec-carousel__track',
    ) as HTMLUListElement;
    Object.defineProperty(track, 'scrollWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(track, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    fireEvent(window, new Event('resize'));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
