import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AppRoutes } from '../../App';
import Dropdown from '../../components/Dropdown/Dropdown';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import { ProductRepositoryProvider } from '../../context/ProductRepositoryProvider';
import { I18nProvider } from '../../i18n';
import { MockProductRepository } from '../../infrastructure/repositories/MockProductRepository';
import { createAppStore } from '../../store';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';

function renderFullApp(initialEntries: string[] = ['/']) {
  const repository = new MockProductRepository();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const store = createAppStore();

  return {
    store,
    repository,
    ...render(
      <HelmetProvider>
        <I18nProvider initialLocale="en">
          <ProductRepositoryProvider repository={repository}>
            <QueryClientProvider client={queryClient}>
              <Provider store={store}>
                <MemoryRouter initialEntries={initialEntries}>
                  <AppRoutes />
                </MemoryRouter>
              </Provider>
            </QueryClientProvider>
          </ProductRepositoryProvider>
        </I18nProvider>
      </HelmetProvider>,
    ),
  };
}

describe('RootLayout Landmarks, Skip Link, ErrorBoundary & WCAG Keyboard Controls', () => {
  it.each([
    { label: 'PLP', path: '/' },
    {
      label: 'PDP',
      path: `/${FIXTURE_PRODUCTS_DETAIL[0].category.slug}/${FIXTURE_PRODUCTS_DETAIL[0].slug}`,
    },
    { label: 'Search', path: '/search?q=fone' },
    { label: 'Cart', path: '/cart' },
    { label: 'NotFound', path: '/missing/does-not-exist' },
  ])(
    'mounts $label inside RootLayout with a single <main>, skip link, and 0 vitest-axe violations',
    async ({ path }) => {
      const { container } = renderFullApp([path]);

      await waitFor(() => {
        expect(screen.getAllByRole('main')).toHaveLength(1);
      });

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');

      const skipLink = screen.getByRole('link', {
        name: /Skip to main content/i,
      });
      expect(skipLink).toHaveAttribute('href', '#main-content');

      // Wait for async route content (PLP/PDP/lazy SearchResultsPage) to settle before running axe
      if (path === '/') {
        expect(
          await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
        ).toBeInTheDocument();
      } else if (path.startsWith('/search')) {
        expect(
          await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
        ).toBeInTheDocument();
      } else if (path === '/cart') {
        expect(
          await screen.findByRole('heading', { level: 1 }),
        ).toBeInTheDocument();
      } else if (path.startsWith('/missing')) {
        expect(
          await screen.findByRole('heading', { name: /not found/i }),
        ).toBeInTheDocument();
      } else {
        expect(
          await screen.findByRole('heading', {
            level: 1,
            name: FIXTURE_PRODUCTS_DETAIL[0].name,
          }),
        ).toBeInTheDocument();
      }

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
  );

  it('catches render errors in ErrorBoundary and recovers on Retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    function FlakyHarness() {
      const [shouldThrow, setShouldThrow] = useState(true);

      function MaybeExplode() {
        if (shouldThrow) {
          throw new Error('Boom during render');
        }
        return <p>Recovered content</p>;
      }

      return (
        <div>
          <button type="button" onClick={() => setShouldThrow(false)}>
            Fix state
          </button>
          <ErrorBoundary>
            <MaybeExplode />
          </ErrorBoundary>
        </div>
      );
    }

    render(
      <I18nProvider initialLocale="en">
        <FlakyHarness />
      </I18nProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Something went wrong/i);
    await user.click(screen.getByRole('button', { name: 'Fix state' }));
    await user.click(screen.getByRole('button', { name: /Try again/i }));
    expect(screen.getByText('Recovered content')).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('preserves healthy child state when ErrorBoundary resetKey changes without an active error', async () => {
    const user = userEvent.setup();

    function StatefulChild() {
      const [draft, setDraft] = useState('');
      return (
        <input
          aria-label="Draft note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      );
    }

    function Harness() {
      const [routeKey, setRouteKey] = useState('route-1');
      return (
        <div>
          <button type="button" onClick={() => setRouteKey('route-2')}>
            Navigate
          </button>
          <ErrorBoundary resetKey={routeKey}>
            <StatefulChild />
          </ErrorBoundary>
        </div>
      );
    }

    render(
      <I18nProvider initialLocale="en">
        <Harness />
      </I18nProvider>,
    );

    const input = screen.getByRole('textbox', { name: 'Draft note' });
    await user.type(input, 'keep me');
    await user.click(screen.getByRole('button', { name: 'Navigate' }));
    expect(input).toHaveValue('keep me');
  });

  it('supports WAI-ARIA APG keyboard navigation and focus restoration in Dropdown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function DropdownHarness() {
      const [value, setValue] = useState('newest');
      return (
        <Dropdown
          ariaLabel="Sort products"
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'price_asc', label: 'Price: Low to High' },
            { value: 'price_desc', label: 'Price: High to Low' },
          ]}
        />
      );
    }

    const { container } = render(<DropdownHarness />);
    const trigger = screen.getByRole('button', { name: 'Sort products' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const listbox = screen.getByRole('listbox', { name: 'Sort products' });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Newest' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(
      screen.getByRole('option', { name: 'Price: High to Low' }),
    ).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('option', { name: 'Newest' })).toHaveFocus();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('price_asc');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    // Open again and dismiss with Escape -> restores focus to trigger
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('manages focus, Escape dismissal, and native dialog semantics in MiniCart', async () => {
    const user = userEvent.setup();
    const { container } = renderFullApp(['/']);

    expect(
      await screen.findByText(FIXTURE_PRODUCTS_DETAIL[0].name),
    ).toBeInTheDocument();

    const cartTrigger = screen.getByRole('button', {
      name: /Shopping cart/i,
    });
    cartTrigger.focus();
    await user.click(cartTrigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('aria-labelledby');

    const closeBtn = screen.getByRole('button', { name: /Close cart/i });
    expect(closeBtn).toHaveFocus();

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cartTrigger).toHaveFocus();
  });

  it('supports WAI-ARIA APG roving tabindex and Arrow/Home/End navigation on PDP Tabs', async () => {
    const user = userEvent.setup();
    const product = FIXTURE_PRODUCTS_DETAIL[0];
    renderFullApp([`/${product.category.slug}/${product.slug}`]);

    expect(
      await screen.findByRole('heading', { level: 1, name: product.name }),
    ).toBeInTheDocument();

    const descTab = screen.getByRole('tab', { name: /Description/i });
    const specsTab = screen.getByRole('tab', { name: /Spec/i });

    expect(descTab).toHaveAttribute('aria-selected', 'true');
    expect(descTab).toHaveAttribute('tabindex', '0');
    expect(specsTab).toHaveAttribute('tabindex', '-1');

    descTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(specsTab).toHaveFocus();
    expect(specsTab).toHaveAttribute('aria-selected', 'true');
    expect(specsTab).toHaveAttribute('tabindex', '0');
    expect(descTab).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{Home}');
    expect(descTab).toHaveFocus();
    expect(descTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(specsTab).toHaveFocus();
    expect(specsTab).toHaveAttribute('aria-selected', 'true');
  });
});
