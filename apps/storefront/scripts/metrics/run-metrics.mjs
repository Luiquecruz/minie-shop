#!/usr/bin/env node
/**
 * Phase 6 (T26) — Before vs After Storefront Metrics Runner (Playwright)
 *
 * Usage:
 *   pnpm --filter @minieshop/storefront metrics -- --mode=after --url=http://localhost:5199 --runs=5
 *   pnpm --filter @minieshop/storefront metrics -- --mode=before --url=http://127.0.0.1:4173 --runs=5
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {
    mode: 'after',
    url: 'http://localhost:5199',
    apiUrl: 'http://localhost:3001',
    runs: 5,
    distDir: path.resolve(process.cwd(), 'dist'),
    out: null,
  };

  for (const token of argv) {
    if (token.startsWith('--mode=')) args.mode = token.slice('--mode='.length);
    else if (token.startsWith('--url=')) args.url = token.slice('--url='.length);
    else if (token.startsWith('--apiUrl=')) args.apiUrl = token.slice('--apiUrl='.length);
    else if (token.startsWith('--runs=')) args.runs = Math.max(1, Number(token.slice('--runs='.length)));
    else if (token.startsWith('--distDir=')) args.distDir = path.resolve(token.slice('--distDir='.length));
    else if (token.startsWith('--out=')) args.out = path.resolve(token.slice('--out='.length));
  }

  return args;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

function measureBundle(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    return null;
  }

  let jsRaw = 0;
  let jsGzip = 0;
  let cssRaw = 0;
  let cssGzip = 0;
  const files = [];

  for (const entry of fs.readdirSync(assetsDir)) {
    const fullPath = path.join(assetsDir, entry);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    const buf = fs.readFileSync(fullPath);
    const gz = zlib.gzipSync(buf).length;
    files.push({ name: entry, rawBytes: buf.length, gzipBytes: gz });
    if (entry.endsWith('.js')) {
      jsRaw += buf.length;
      jsGzip += gz;
    } else if (entry.endsWith('.css')) {
      cssRaw += buf.length;
      cssGzip += gz;
    }
  }

  return {
    jsRawBytes: jsRaw,
    jsGzipBytes: jsGzip,
    cssRawBytes: cssRaw,
    cssGzipBytes: cssGzip,
    totalRawBytes: jsRaw + cssRaw,
    totalGzipBytes: jsGzip + cssGzip,
    files,
  };
}

async function measureInitialLoad(browser, url, apiUrl) {
  const context = await browser.newContext();
  const page = await context.newPage();

  let totalRequests = 0;
  let apiRequests = 0;
  let transferredBytes = 0;

  page.on('response', async (response) => {
    totalRequests += 1;
    if (response.url().startsWith(apiUrl)) {
      apiRequests += 1;
    }
    try {
      const body = await response.body();
      transferredBytes += body.length;
    } catch {
      // Ignore opaque or empty responses
    }
  });

  const start = performance.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.product-card', { timeout: 15_000 });
  const timeToContentMs = Number((performance.now() - start).toFixed(1));
  await page.waitForLoadState('networkidle').catch(() => {});

  const cardCount = await page.locator('article.product-card').count();
  await context.close();

  return {
    totalRequests,
    apiRequests,
    transferredBytes,
    timeToContentMs,
    cardCount,
  };
}

async function measureCatalogPdpBack(browser, url, apiUrl) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.product-card', { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Navigate into first product PDP
  await page.locator('article.product-card .product-card__title-link').first().click();
  await page.waitForSelector('.pdp-info__title', { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Now count API requests fired when going Back to catalog within staleTime
  let apiRequestsOnBack = 0;
  let productListRequestsOnBack = 0;
  page.on('request', (request) => {
    if (request.url().startsWith(apiUrl)) {
      apiRequestsOnBack += 1;
      const parsed = new URL(request.url());
      if (parsed.pathname === '/products') {
        productListRequestsOnBack += 1;
      }
    }
  });

  const startBack = performance.now();
  await page.goBack();
  await page.waitForSelector('article.product-card', { timeout: 15_000 });
  const backRenderMs = Number((performance.now() - startBack).toFixed(1));
  await page.waitForTimeout(300);

  await context.close();
  return {
    apiRequestsOnBack,
    productListRequestsOnBack,
    backRenderMs,
  };
}

async function measureFilterTransitionNoFlash(browser, url, mode) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.product-card', { timeout: 15_000 });

  if (mode === 'after') {
    await page.evaluate(() => {
      window.localStorage.setItem('chaos.delay', '500');
    });
  }

  // Observe whether product cards ever disappear or skeleton appears during filter change
  await page.evaluate(() => {
    window.__filterTransitionMetrics = {
      sawZeroCards: false,
      sawSkeleton: false,
      minCardsDuringTransition: document.querySelectorAll('article.product-card').length,
    };
    const observer = new MutationObserver(() => {
      const cards = document.querySelectorAll('article.product-card').length;
      const skeletons = document.querySelectorAll('.skeleton-card').length;
      if (cards === 0) window.__filterTransitionMetrics.sawZeroCards = true;
      if (skeletons > 0) window.__filterTransitionMetrics.sawSkeleton = true;
      if (cards < window.__filterTransitionMetrics.minCardsDuringTransition) {
        window.__filterTransitionMetrics.minCardsDuringTransition = cards;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__stopObserver = () => observer.disconnect();
  });

  if (mode === 'after') {
    await page.getByRole('button', { name: /Eletrônicos/i }).first().click();
  } else {
    await page.getByRole('button', { name: /Eletrônicos/i }).first().click();
  }

  await page.waitForTimeout(900);
  const metrics = await page.evaluate(() => {
    window.__stopObserver?.();
    window.localStorage.removeItem('chaos.delay');
    return window.__filterTransitionMetrics;
  });

  await context.close();
  return metrics;
}

async function measureChaosLatencyAndSearch(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${url}/search`, { waitUntil: 'domcontentloaded' });
  const searchInput = page.getByRole('combobox', { name: /Search products/i });
  await searchInput.waitFor({ state: 'visible', timeout: 15_000 });

  await page.evaluate(() => {
    window.localStorage.setItem('chaos.delay', '800');
  });

  await searchInput.fill('fone');
  await searchInput.press('Enter');

  // Updating pill should appear while delayed response is in flight
  const sawUpdatingIndicator = await page
    .locator('.plp-sync-pill')
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  // Immediately supersede with a second search "teclado"
  await searchInput.fill('teclado');
  await searchInput.press('Enter');

  await page.waitForFunction(
    () =>
      document.querySelector('.plp-sync-pill') === null &&
      document
        .querySelector('.search-page__count strong')
        ?.textContent?.trim() === 'teclado' &&
      Array.from(
        document.querySelectorAll('#search-results-grid .product-card__title'),
      ).some((el) => el.textContent?.toLowerCase().includes('teclado')),
    null,
    { timeout: 10_000 },
  );
  const summaryText =
    (await page.locator('.search-page__count').textContent()) ?? '';
  const visibleTitles = await page
    .locator('#search-results-grid .product-card__title')
    .allTextContents();

  const settledOnTeclado =
    summaryText.includes('teclado') &&
    visibleTitles.length > 0 &&
    visibleTitles[0].toLowerCase().includes('teclado');

  await page.evaluate(() => window.localStorage.removeItem('chaos.delay'));
  await context.close();

  return {
    sawUpdatingIndicator,
    settledOnTeclado,
    topResult: visibleTitles[0] ?? null,
    visibleCount: visibleTitles.length,
  };
}

async function measureChaosErrorAndRetry(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('chaos.fail', '1');
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for error state + Try Again button (after React Query retries settle)
  const retryButton = page.getByRole('button', { name: /Try Again/i });
  await retryButton.waitFor({ state: 'visible', timeout: 20_000 });
  const errorStateShown = true;

  // Disable chaos failure and click Try Again
  await page.evaluate(() => {
    window.localStorage.removeItem('chaos.fail');
  });
  await retryButton.click();

  await page.waitForSelector('article.product-card', { timeout: 15_000 });
  const recoveredCardCount = await page.locator('article.product-card').count();

  await context.close();
  return {
    errorStateShown,
    recoveredOnRetry: recoveredCardCount > 0,
    recoveredCardCount,
  };
}

async function measureOptimisticFavorite(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.product-card', { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  const firstFavBtn = page.locator('button.product-card__favorite-btn').first();

  // 1) Optimistic update under 800ms delay (must flip UI well before 800ms API response)
  await page.evaluate(() => window.localStorage.setItem('chaos.delay', '800'));
  const beforeDelayState = await firstFavBtn.getAttribute('aria-pressed');
  const expectedFlipped = beforeDelayState === 'true' ? 'false' : 'true';
  const clickStart = performance.now();
  await firstFavBtn.click();
  const updatedImmediatelyUnderLatency = await page
    .waitForFunction(
      ({ expected }) =>
        document
          .querySelector('button.product-card__favorite-btn')
          ?.getAttribute('aria-pressed') === expected,
      { expected: expectedFlipped },
      { timeout: 300 },
    )
    .then(() => true)
    .catch(() => false);
  const uiFlipMs = Number((performance.now() - clickStart).toFixed(1));

  await page.waitForTimeout(1_100);
  const confirmedState = await firstFavBtn.getAttribute('aria-pressed');

  // 2) Rollback on failure (chaos.fail=1)
  await page.evaluate(() => {
    window.localStorage.removeItem('chaos.delay');
    window.localStorage.setItem('chaos.fail', '1');
  });
  await firstFavBtn.click();

  const alertVisible = await page
    .locator('.plp-toast--error')
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  const rolledBackState = await firstFavBtn.getAttribute('aria-pressed');
  const rolledBackOnFailure = rolledBackState === confirmedState && alertVisible;

  await page.evaluate(() => window.localStorage.removeItem('chaos.fail'));
  await context.close();

  return {
    updatedImmediatelyUnderLatency,
    uiFlipMs,
    rolledBackOnFailure,
    alertVisible,
  };
}

function summarizeBundleSplit(distDir) {
  const bundle = measureBundle(distDir);
  if (!bundle) return null;

  const assetsDir = path.join(distDir, 'assets');
  const mainFiles = bundle.files.filter((f) => f.name.startsWith('index-'));
  const searchLazyFiles = bundle.files.filter((f) =>
    f.name.startsWith('SearchResultsPage-'),
  );

  let instantSearchInMainChunk = false;
  for (const file of mainFiles) {
    if (!file.name.endsWith('.js')) continue;
    const contents = fs.readFileSync(path.join(assetsDir, file.name), 'utf8');
    if (
      /react-instantsearch|algoliasearch-helper|InstantSearch/.test(contents)
    ) {
      instantSearchInMainChunk = true;
    }
  }

  return {
    mainChunkRawBytes: mainFiles.reduce((acc, f) => acc + f.rawBytes, 0),
    mainChunkGzipBytes: mainFiles.reduce((acc, f) => acc + f.gzipBytes, 0),
    lazySearchChunkRawBytes: searchLazyFiles.reduce(
      (acc, f) => acc + f.rawBytes,
      0,
    ),
    lazySearchChunkGzipBytes: searchLazyFiles.reduce(
      (acc, f) => acc + f.gzipBytes,
      0,
    ),
    instantSearchInMainChunk,
    files: bundle.files,
  };
}

async function measureSearchAndComboboxLazy(browser, url, apiUrl) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const searchChunkRequestsOnCatalog = [];
  const searchChunkRequestsOnSearchRoute = [];
  const suggestRequests = [];
  let inSearchRoute = false;

  page.on('request', (req) => {
    const reqUrl = req.url();
    if (
      reqUrl.includes('SearchResultsPage') ||
      reqUrl.includes('react-instantsearch')
    ) {
      if (inSearchRoute) {
        searchChunkRequestsOnSearchRoute.push(reqUrl);
      } else {
        searchChunkRequestsOnCatalog.push(reqUrl);
      }
    }
    if (reqUrl.startsWith(apiUrl)) {
      const parsed = new URL(reqUrl);
      if (parsed.pathname === '/search/suggest') {
        suggestRequests.push(parsed.searchParams.get('q') ?? '');
      }
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.product-card', { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Type "fone" quickly into header combobox -> debounced suggest (~200ms)
  const combobox = page.getByRole('combobox', { name: /Search products/i });
  await combobox.click();
  await combobox.type('fone', { delay: 40 });

  await page.locator('[role="listbox"] [role="option"]').first().waitFor({
    state: 'visible',
    timeout: 5_000,
  });
  const listboxOptionsCount = await page
    .locator('[role="listbox"] [role="option"]')
    .count();

  // Navigate to /search?q=fone cleanly
  inSearchRoute = true;
  await combobox.press('Enter');
  await page.waitForURL(/\/search\?q=fone/, { timeout: 10_000 });
  await page.waitForSelector('#search-results-grid article.product-card', {
    timeout: 15_000,
  });

  const devBadgeLocator = page.locator('[data-testid="search-dev-badge"]');
  const devBadgeText =
    (await devBadgeLocator.count()) > 0
      ? await devBadgeLocator.first().textContent()
      : null;
  const searchHitCount = await page
    .locator('#search-results-grid article.product-card')
    .count();

  await context.close();
  return {
    searchChunkLoadedOnCatalog: searchChunkRequestsOnCatalog.length > 0,
    searchChunkLoadedOnSearchRoute: searchChunkRequestsOnSearchRoute.length > 0,
    suggestRequestCountDuring4CharTyping: suggestRequests.length,
    listboxOptionsCount,
    searchHitCount,
    devBadgeText: devBadgeText?.trim() ?? null,
  };
}

async function measurePdpAndCartRecommendations(browser, url, apiUrl) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const searchChunkRequestsOnPdp = [];
  let pdpRecsRequestsBeforeScroll = 0;
  let pdpRecsRequestsAfterScroll = 0;
  let hasScrolledPdp = false;
  let crossSellRequestsOnCart = 0;

  page.on('request', (req) => {
    const reqUrl = req.url();
    if (
      reqUrl.includes('SearchResultsPage') ||
      reqUrl.includes('react-instantsearch')
    ) {
      searchChunkRequestsOnPdp.push(reqUrl);
    }
    if (reqUrl.startsWith(apiUrl)) {
      const parsed = new URL(reqUrl);
      if (parsed.pathname.endsWith('/recommendations')) {
        if (hasScrolledPdp) pdpRecsRequestsAfterScroll += 1;
        else pdpRecsRequestsBeforeScroll += 1;
      } else if (parsed.pathname === '/recommendations/cross-sell') {
        crossSellRequestsOnCart += 1;
      }
    }
  });

  // Navigate straight to a seeded PDP with recommendations
  await page.goto(`${url}/audio/fone-de-ouvido-bluetooth-over-ear-pro`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('.pdp-info__title', { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Record CLS while scrolling to trigger lazy PDP recommendations
  await page.evaluate(() => {
    const measurementStartedAt = performance.now();
    window.__phase7Cls = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput && entry.startTime >= measurementStartedAt) {
          window.__phase7Cls += entry.value;
        }
      }
    });
    observer.observe({ type: 'layout-shift' });
    window.__stopClsObserver = () => observer.disconnect();
  });

  const beforeScrollCountSnapshot = pdpRecsRequestsBeforeScroll;
  hasScrolledPdp = true;

  await page
    .locator('[data-testid="pdp-recommendations-section"]')
    .scrollIntoViewIfNeeded();

  await page
    .locator('[data-testid="pdp-related-carousel"] article.product-card')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  const clsOnPdpAfterRecs = await page.evaluate(() => {
    window.__stopClsObserver?.();
    return Number((window.__phase7Cls ?? 0).toFixed(4));
  });

  const pdpRelatedCards = await page
    .locator('[data-testid="pdp-related-carousel"] article.product-card')
    .count();
  const pdpUpsellCards = await page
    .locator('[data-testid="pdp-upsell-carousel"] article.product-card')
    .count();

  // Add item to Cart and navigate via MiniCart -> View Full Cart for cross-sell verification
  await page.locator('.pdp-floating-bar .pdp-btn--secondary').first().click();
  await page.getByRole('button', { name: /View Full Cart/i }).click();
  await page.waitForURL(/\/cart/, { timeout: 10_000 });
  await page
    .locator('[data-testid="cart-cross-sell-carousel"] article.product-card')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });

  const initialCartItemCount = await page.locator('.cart-item').count();
  const initialCrossSellCount = await page
    .locator('[data-testid="cart-cross-sell-carousel"] article.product-card')
    .count();

  await page
    .locator('[data-testid="cart-cross-sell-carousel"] button.product-card__btn')
    .first()
    .click();

  await page.waitForFunction(
    (expected) => document.querySelectorAll('.cart-item').length === expected,
    initialCartItemCount + 1,
    { timeout: 10_000 },
  );

  const miniCartOpenAfterCrossSellAdd = await page
    .locator('.minicart--open, [role="dialog"][aria-modal="true"]')
    .count();

  await context.close();
  return {
    searchChunkLoadedOnPdp: searchChunkRequestsOnPdp.length > 0,
    pdpRecsRequestsBeforeScroll: beforeScrollCountSnapshot,
    pdpRecsRequestsAfterScroll,
    pdpRelatedCards,
    pdpUpsellCards,
    clsOnPdpAfterRecs,
    crossSellRequestsOnCart,
    initialCrossSellCount,
    cartItemsIncrementedInline:
      (await Promise.resolve(initialCartItemCount + 1)) > initialCartItemCount,
    miniCartStayedClosedOnInlineAdd: miniCartOpenAfterCrossSellAdd === 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ headless: true });

  try {
    const initialRuns = [];
    const backRuns = [];

    for (let i = 0; i < args.runs; i += 1) {
      initialRuns.push(await measureInitialLoad(browser, args.url, args.apiUrl));
      backRuns.push(await measureCatalogPdpBack(browser, args.url, args.apiUrl));
    }

    const filterTransition = await measureFilterTransitionNoFlash(
      browser,
      args.url,
      args.mode,
    );

    const chaosLatency =
      args.mode === 'after'
        ? await measureChaosLatencyAndSearch(browser, args.url)
        : null;
    const chaosError =
      args.mode === 'after'
        ? await measureChaosErrorAndRetry(browser, args.url)
        : null;
    const optimisticFavorite =
      args.mode === 'after'
        ? await measureOptimisticFavorite(browser, args.url)
        : null;
    const searchAndCombobox =
      args.mode === 'after'
        ? await measureSearchAndComboboxLazy(browser, args.url, args.apiUrl)
        : null;
    const recommendationsLazyAndCls =
      args.mode === 'after'
        ? await measurePdpAndCartRecommendations(browser, args.url, args.apiUrl)
        : null;

    const bundle = measureBundle(args.distDir);
    const bundleSplit = summarizeBundleSplit(args.distDir);

    const summary = {
      mode: args.mode,
      url: args.url,
      runs: args.runs,
      collectedAt: new Date().toISOString(),
      scenario1_initialLoad: {
        medianTotalRequests: median(initialRuns.map((r) => r.totalRequests)),
        medianApiRequests: median(initialRuns.map((r) => r.apiRequests)),
        medianTransferredBytes: median(
          initialRuns.map((r) => r.transferredBytes),
        ),
        medianTimeToContentMs: median(initialRuns.map((r) => r.timeToContentMs)),
        cardCount: initialRuns[0]?.cardCount ?? 0,
      },
      scenario2_catalogPdpBack: {
        medianApiRequestsOnBack: median(
          backRuns.map((r) => r.apiRequestsOnBack),
        ),
        medianProductListRequestsOnBack: median(
          backRuns.map((r) => r.productListRequestsOnBack),
        ),
        medianBackRenderMs: median(backRuns.map((r) => r.backRenderMs)),
      },
      scenario3_filterTransition: filterTransition,
      scenario4_chaosLatency: chaosLatency ?? 'n/a',
      scenario5_chaosErrorRetry: chaosError ?? 'n/a',
      scenario6_optimisticFavorite: optimisticFavorite ?? 'n/a',
      scenario7_bundle: bundle,
      scenario8_searchAndCombobox: searchAndCombobox ?? 'n/a',
      scenario9_recommendationsLazyAndCls: recommendationsLazyAndCls ?? 'n/a',
      scenario10_bundleSplit: bundleSplit ?? 'n/a',
    };

    const output = JSON.stringify(summary, null, 2);
    if (args.out) {
      fs.writeFileSync(args.out, `${output}\n`, 'utf8');
    }
    console.log(output);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[metrics] Failed:', error);
  process.exit(1);
});
