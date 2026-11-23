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

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.product-card', { timeout: 15_000 });

  await page.evaluate(() => {
    window.localStorage.setItem('chaos.delay', '800');
  });

  const searchInput = page.getByRole('searchbox', { name: /Search products/i });
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

  await page.waitForTimeout(1_400);
  const visibleTitles = await page
    .locator('.product-card__title')
    .allTextContents();

  const onlyTecladoVisible =
    visibleTitles.length > 0 &&
    visibleTitles.every((title) => title.toLowerCase().includes('teclado'));

  await page.evaluate(() => window.localStorage.removeItem('chaos.delay'));
  await context.close();

  return {
    sawUpdatingIndicator,
    onlyTecladoVisible,
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

    const bundle = measureBundle(args.distDir);

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
