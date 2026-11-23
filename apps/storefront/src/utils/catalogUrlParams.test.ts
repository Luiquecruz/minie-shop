import { describe, expect, it } from 'vitest';
import {
  hasActiveCatalogFilters,
  parseCatalogUrlParams,
  serializeCatalogUrlParams,
} from './catalogUrlParams';

describe('catalogUrlParams Zod parser & serializer', () => {
  it('parses valid API-compatible query params and round-trips cleanly', () => {
    const input = new URLSearchParams(
      'category=eletronicos&q=fone&minPrice=10000&maxPrice=50000&inStock=true&sort=relevance&attr.connectivity=Bluetooth,USB&attr.battery_hours.min=10&attr.battery_hours.max=40',
    );

    const parsed = parseCatalogUrlParams(input);

    expect(parsed).toEqual({
      category: 'eletronicos',
      q: 'fone',
      minPrice: 10000,
      maxPrice: 50000,
      inStock: true,
      sort: 'relevance',
      attributes: {
        connectivity: ['Bluetooth', 'USB'],
      },
      numericAttributes: {
        battery_hours: { min: 10, max: 40 },
      },
    });
    expect(hasActiveCatalogFilters(parsed)).toBe(true);

    const serialized = serializeCatalogUrlParams(parsed);
    expect(parseCatalogUrlParams(serialized)).toEqual(parsed);
  });

  it('falls back safely to defaults when parameters are invalid or inconsistent', () => {
    const invalid = new URLSearchParams(
      'category=bad/slug!!&minPrice=-50&maxPrice=abc&inStock=maybe&sort=relevance&attr.bad-key=1&attr.battery_hours.min=50&attr.battery_hours.max=10',
    );

    const parsed = parseCatalogUrlParams(invalid);

    expect(parsed).toEqual({
      category: undefined,
      q: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: undefined,
      sort: 'newest',
      attributes: undefined,
      numericAttributes: undefined,
    });
    expect(hasActiveCatalogFilters(parsed)).toBe(false);
  });

  it('drops minPrice and maxPrice when minPrice > maxPrice', () => {
    const parsed = parseCatalogUrlParams(
      new URLSearchParams('minPrice=50000&maxPrice=10000&sort=price_asc'),
    );
    expect(parsed.minPrice).toBeUndefined();
    expect(parsed.maxPrice).toBeUndefined();
    expect(parsed.sort).toBe('price_asc');
  });

  it('preserves inStock=false distinctly from omitted inStock', () => {
    const parsed = parseCatalogUrlParams(new URLSearchParams('inStock=false'));
    expect(parsed.inStock).toBe(false);
    expect(hasActiveCatalogFilters(parsed)).toBe(true);

    const serialized = serializeCatalogUrlParams(parsed);
    expect(serialized.get('inStock')).toBe('false');
    expect(parseCatalogUrlParams(serialized).inStock).toBe(false);
  });
});
