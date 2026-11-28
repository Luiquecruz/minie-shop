import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  CategoryDTO,
  FacetAttributeDTO,
  FacetsDTO,
} from '@minieshop/contracts';
import { useI18n } from '../../i18n';
import { useCurrency } from '../../hooks/useCurrency';
import { cn } from '@minieshop/ui/tokens';
import {
  hasActiveCatalogFilters,
  type CatalogUrlState,
} from '../../utils/catalogUrlParams';

export interface CatalogFiltersProps {
  categories: CategoryDTO[];
  facets: FacetsDTO | undefined;
  state: CatalogUrlState;
  onUpdate: (
    updater: (prev: CatalogUrlState) => CatalogUrlState,
    options?: { replace?: boolean },
  ) => void;
  onClearAll: () => void;
}

function centsToInputValue(cents: number | undefined): string {
  if (cents === undefined) return '';
  return String(cents / 100);
}

function inputValueToCents(raw: string): number | undefined {
  const normalized = raw.trim().replace(',', '.');
  if (normalized.length === 0) return undefined;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.round(num * 100);
}

interface NumericAttrDraftProps {
  facet: FacetAttributeDTO;
  currentMin: number | undefined;
  currentMax: number | undefined;
  resetSignal: number;
  onCommit: (min: number | undefined, max: number | undefined) => void;
}

function NumericAttributeFacet({
  facet,
  currentMin,
  currentMax,
  resetSignal,
  onCommit,
}: NumericAttrDraftProps) {
  const { t } = useI18n();
  const idPrefix = useId();
  const urlSig = `${currentMin ?? ''}:${currentMax ?? ''}`;
  const [prevSyncKey, setPrevSyncKey] = useState(`${urlSig}|${resetSignal}`);
  const [minText, setMinText] = useState(
    currentMin !== undefined ? String(currentMin) : '',
  );
  const [maxText, setMaxText] = useState(
    currentMax !== undefined ? String(currentMax) : '',
  );

  const syncKey = `${urlSig}|${resetSignal}`;
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    setMinText(currentMin !== undefined ? String(currentMin) : '');
    setMaxText(currentMax !== undefined ? String(currentMax) : '');
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [urlSig, resetSignal]);

  const scheduleCommit = (nextMinText: string, nextMaxText: string): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const parsedMin =
        nextMinText.trim() === '' ? undefined : Number(nextMinText.trim());
      const parsedMax =
        nextMaxText.trim() === '' ? undefined : Number(nextMaxText.trim());

      const safeMin =
        parsedMin !== undefined && Number.isFinite(parsedMin)
          ? parsedMin
          : undefined;
      const safeMax =
        parsedMax !== undefined && Number.isFinite(parsedMax)
          ? parsedMax
          : undefined;

      if (
        safeMin !== undefined &&
        safeMax !== undefined &&
        safeMin > safeMax
      ) {
        return;
      }

      if (safeMin !== currentMin || safeMax !== currentMax) {
        onCommitRef.current(safeMin, safeMax);
      }
    }, 350);
  };

  return (
    <fieldset className="m-0 border-0 border-t border-border-subtle p-0 pt-4">
      <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-fg-heading">
        {facet.label}
        {facet.unit ? ` (${facet.unit})` : ''}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-min`}
            className="text-xs font-medium text-fg-muted"
          >
            {t('filters.minValue')}
          </label>
          <input
            id={`${idPrefix}-min`}
            type="number"
            inputMode="decimal"
            value={minText}
            placeholder={
              facet.range ? String(facet.range.min) : t('filters.minValue')
            }
            onChange={(e) => {
              const nextMinText = e.target.value;
              setMinText(nextMinText);
              scheduleCommit(nextMinText, maxText);
            }}
            className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-max`}
            className="text-xs font-medium text-fg-muted"
          >
            {t('filters.maxValue')}
          </label>
          <input
            id={`${idPrefix}-max`}
            type="number"
            inputMode="decimal"
            value={maxText}
            placeholder={
              facet.range ? String(facet.range.max) : t('filters.maxValue')
            }
            onChange={(e) => {
              const nextMaxText = e.target.value;
              setMaxText(nextMaxText);
              scheduleCommit(minText, nextMaxText);
            }}
            className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>
    </fieldset>
  );
}

/**
 * Accessible faceted catalog filters form synced with URL search params.
 */
export function CatalogFilters({
  categories,
  facets,
  state,
  onUpdate,
  onClearAll,
}: CatalogFiltersProps) {
  const minPriceId = useId();
  const maxPriceId = useId();
  const inStockId = useId();
  const { currentCurrency, formatPrice } = useCurrency();
  const { t } = useI18n();
  const prevCurrencyRef = useRef(currentCurrency);

  const [resetSignal, setResetSignal] = useState(0);
  const priceUrlSignature = `${state.minPrice ?? ''}:${state.maxPrice ?? ''}`;
  const priceSyncKey = `${currentCurrency}|${priceUrlSignature}`;
  const [prevPriceSig, setPrevPriceSig] = useState(priceSyncKey);
  const [minPriceText, setMinPriceText] = useState(
    centsToInputValue(state.minPrice),
  );
  const [maxPriceText, setMaxPriceText] = useState(
    centsToInputValue(state.maxPrice),
  );

  if (prevPriceSig !== priceSyncKey) {
    setPrevPriceSig(priceSyncKey);
    setMinPriceText(centsToInputValue(state.minPrice));
    setMaxPriceText(centsToInputValue(state.maxPrice));
  }

  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    return () => {
      if (priceTimerRef.current !== null) {
        clearTimeout(priceTimerRef.current);
        priceTimerRef.current = null;
      }
    };
  }, [priceUrlSignature, resetSignal, currentCurrency]);

  useEffect(() => {
    if (prevCurrencyRef.current !== currentCurrency) {
      prevCurrencyRef.current = currentCurrency;
      if (priceTimerRef.current !== null) {
        clearTimeout(priceTimerRef.current);
        priceTimerRef.current = null;
      }
      if (state.minPrice !== undefined || state.maxPrice !== undefined) {
        onUpdateRef.current(
          (prev) => ({
            ...prev,
            minPrice: undefined,
            maxPrice: undefined,
          }),
          { replace: true },
        );
      }
    }
  }, [currentCurrency, state.minPrice, state.maxPrice]);

  const handleClearAllClick = (): void => {
    if (priceTimerRef.current !== null) {
      clearTimeout(priceTimerRef.current);
      priceTimerRef.current = null;
    }
    setMinPriceText('');
    setMaxPriceText('');
    setResetSignal((prev) => prev + 1);
    onClearAll();
  };

  const schedulePriceCommit = (nextMinText: string, nextMaxText: string): void => {
    if (priceTimerRef.current !== null) {
      clearTimeout(priceTimerRef.current);
    }
    priceTimerRef.current = setTimeout(() => {
      priceTimerRef.current = null;
      const nextMin = inputValueToCents(nextMinText);
      const nextMax = inputValueToCents(nextMaxText);

      if (nextMin !== undefined && nextMax !== undefined && nextMin > nextMax) {
        return;
      }

      if (nextMin !== state.minPrice || nextMax !== state.maxPrice) {
        onUpdateRef.current(
          (prev) => ({
            ...prev,
            minPrice: nextMin,
            maxPrice: nextMax,
          }),
          { replace: true },
        );
      }
    }, 350);
  };

  const facetCategoryCountBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of facets?.categories ?? []) {
      map.set(item.slug, item.count);
    }
    return map;
  }, [facets]);

  const handleCategorySelect = (slug: string | undefined): void => {
    if (slug === state.category) return;
    onUpdate((prev) => ({ ...prev, category: slug }), { replace: false });
  };

  const handleInStockToggle = (checked: boolean): void => {
    onUpdate(
      (prev) => ({ ...prev, inStock: checked ? true : undefined }),
      { replace: false },
    );
  };

  const handleDiscreteAttributeToggle = (
    code: string,
    optionValue: string,
    checked: boolean,
  ): void => {
    onUpdate(
      (prev) => {
        const currentAttrs = { ...(prev.attributes ?? {}) };
        const existing = new Set(currentAttrs[code] ?? []);
        if (checked) {
          existing.add(optionValue);
        } else {
          existing.delete(optionValue);
        }
        if (existing.size === 0) {
          delete currentAttrs[code];
        } else {
          currentAttrs[code] = Array.from(existing);
        }
        return {
          ...prev,
          attributes:
            Object.keys(currentAttrs).length > 0 ? currentAttrs : undefined,
        };
      },
      { replace: false },
    );
  };

  const activeFilters = hasActiveCatalogFilters(state);

  return (
    <aside
      className="h-fit rounded-2xl border border-border bg-surface p-4 shadow-card-sm lg:sticky lg:top-20 lg:p-5"
      aria-label={t('filters.heading')}
    >
      <form
        className="flex flex-col gap-4"
        aria-label={t('filters.formAria')}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-base font-extrabold text-fg-heading">
            {t('filters.heading')}
          </h2>
          {activeFilters && (
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-brand-border bg-brand-subtle px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-subtle-hover focus-visible:outline-2 focus-visible:outline-brand"
              onClick={handleClearAllClick}
            >
              {t('filters.clearAll')}
            </button>
          )}
        </div>

        {/* Category Tree */}
        <fieldset className="m-0 border-0 border-t border-border-subtle p-0 pt-4">
          <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-fg-heading">
            {t('filters.categoriesLegend')}
          </legend>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li>
              <button
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                  !state.category
                    ? 'bg-brand-subtle font-semibold text-brand'
                    : 'font-medium text-fg hover:bg-surface-chip hover:text-fg-heading',
                )}
                aria-pressed={!state.category}
                onClick={() => handleCategorySelect(undefined)}
              >
                <span>{t('filters.allCategories')}</span>
              </button>
            </li>
            {categories.map((cat) => {
              const rootCount = facets
                ? (facetCategoryCountBySlug.get(cat.slug) ?? 0)
                : cat.productCount;
              const isRootActive = state.category === cat.slug;
              return (
                <li key={cat.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                      isRootActive
                        ? 'bg-brand-subtle font-semibold text-brand'
                        : 'font-medium text-fg hover:bg-surface-chip hover:text-fg-heading',
                    )}
                    aria-pressed={isRootActive}
                    onClick={() => handleCategorySelect(cat.slug)}
                  >
                    <span>{cat.name}</span>
                    <span className="rounded-full bg-surface-chip px-2 py-0.5 text-xs font-semibold tabular-nums text-fg-muted">
                      {rootCount}
                    </span>
                  </button>

                  {cat.children.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-1 pl-3">
                      {cat.children.map((child) => {
                        const childCount = facets
                          ? (facetCategoryCountBySlug.get(child.slug) ?? 0)
                          : child.productCount;
                        const isChildActive = state.category === child.slug;
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              className={cn(
                                'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                                isChildActive
                                  ? 'bg-brand-subtle font-semibold text-brand'
                                  : 'font-medium text-fg hover:bg-surface-chip hover:text-fg-heading',
                              )}
                              aria-pressed={isChildActive}
                              onClick={() => handleCategorySelect(child.slug)}
                            >
                              <span>{child.name}</span>
                              <span className="rounded-full bg-surface-chip px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
                                {childCount}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>

        {/* Availability */}
        <fieldset className="m-0 border-0 border-t border-border-subtle p-0 pt-4">
          <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-fg-heading">
            {t('filters.availabilityLegend')}
          </legend>
          <label
            htmlFor={inStockId}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm text-fg transition-colors hover:bg-surface-chip"
          >
            <input
              id={inStockId}
              type="checkbox"
              checked={state.inStock === true}
              onChange={(e) => handleInStockToggle(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-brand"
            />
            <span>{t('filters.inStockOnly')}</span>
          </label>
        </fieldset>

        {/* Price Range */}
        <fieldset className="m-0 border-0 border-t border-border-subtle p-0 pt-4">
          <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-fg-heading">
            {t('filters.priceLegend')}
          </legend>
          {facets?.price.min !== null &&
            facets?.price.max !== null &&
            facets?.price.min !== undefined &&
            facets?.price.max !== undefined && (
              <p className="mb-2.5 text-xs font-medium tabular-nums text-fg-muted">
                {formatPrice(facets.price.min, currentCurrency)} –{' '}
                {formatPrice(facets.price.max, currentCurrency)}
              </p>
            )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={minPriceId}
                className="text-xs font-medium text-fg-muted"
              >
                {t('filters.minPriceLabel', { currency: currentCurrency })}
              </label>
              <input
                id={minPriceId}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={minPriceText}
                placeholder={
                  facets?.price.min !== null && facets?.price.min !== undefined
                    ? String(Math.floor(facets.price.min / 100))
                    : '0'
                }
                onChange={(e) => {
                  const nextMinText = e.target.value;
                  setMinPriceText(nextMinText);
                  schedulePriceCommit(nextMinText, maxPriceText);
                }}
                className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={maxPriceId}
                className="text-xs font-medium text-fg-muted"
              >
                {t('filters.maxPriceLabel', { currency: currentCurrency })}
              </label>
              <input
                id={maxPriceId}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={maxPriceText}
                placeholder={
                  facets?.price.max !== null && facets?.price.max !== undefined
                    ? String(Math.ceil(facets.price.max / 100))
                    : '9999'
                }
                onChange={(e) => {
                  const nextMaxText = e.target.value;
                  setMaxPriceText(nextMaxText);
                  schedulePriceCommit(minPriceText, nextMaxText);
                }}
                className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Disjunctive Attribute Facets */}
        {(facets?.attributes ?? []).map((attrFacet) => {
          if (attrFacet.type === 'number') {
            const currentRange = state.numericAttributes?.[attrFacet.code];
            return (
              <NumericAttributeFacet
                key={attrFacet.code}
                facet={attrFacet}
                currentMin={currentRange?.min}
                currentMax={currentRange?.max}
                resetSignal={resetSignal}
                onCommit={(nextMin, nextMax) => {
                  onUpdate(
                    (prev) => {
                      const nextNumeric = { ...(prev.numericAttributes ?? {}) };
                      if (nextMin === undefined && nextMax === undefined) {
                        delete nextNumeric[attrFacet.code];
                      } else {
                        nextNumeric[attrFacet.code] = {
                          min: nextMin,
                          max: nextMax,
                        };
                      }
                      return {
                        ...prev,
                        numericAttributes:
                          Object.keys(nextNumeric).length > 0
                            ? nextNumeric
                            : undefined,
                      };
                    },
                    { replace: true },
                  );
                }}
              />
            );
          }

          const options = attrFacet.options ?? [];
          if (options.length === 0) return null;
          const activeValues = state.attributes?.[attrFacet.code] ?? [];

          return (
            <fieldset
              key={attrFacet.code}
              className="m-0 border-0 border-t border-border-subtle p-0 pt-4"
            >
              <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-fg-heading">
                {attrFacet.label}
              </legend>
              <div className="flex flex-col gap-1">
                {options.map((opt) => {
                  const checkboxId = `facet-${attrFacet.code}-${opt.value}`;
                  const checked = activeValues.includes(opt.value);
                  const displayLabel =
                    opt.label ??
                    (attrFacet.type === 'boolean'
                      ? opt.value === 'true'
                        ? t('filters.yes')
                        : t('filters.no')
                      : opt.value);

                  return (
                    <label
                      key={opt.value}
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-fg transition-colors hover:bg-surface-chip"
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          handleDiscreteAttributeToggle(
                            attrFacet.code,
                            opt.value,
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 cursor-pointer rounded accent-brand"
                      />
                      <span className="flex-1 truncate">{displayLabel}</span>
                      <span className="rounded-full bg-surface-chip px-2 py-0.5 text-xs font-semibold tabular-nums text-fg-muted">
                        {opt.count}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </form>
    </aside>
  );
}

export default CatalogFilters;
