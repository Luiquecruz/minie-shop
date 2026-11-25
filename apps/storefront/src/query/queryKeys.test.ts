import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys.recommendations', () => {
  it('preserves source recency order in crossSell keys while normalizing case and deduplicating first occurrences', () => {
    const idA = '20000000-0000-4000-8000-00000000000A';
    const idB = '20000000-0000-4000-8000-00000000000B';

    const keyRecentFirst = queryKeys.recommendations.crossSell(
      [idB, idA.toLowerCase(), idB.toLowerCase()],
      6,
      'BRL',
    );
    const keyReversed = queryKeys.recommendations.crossSell([idA, idB], 6, 'BRL');

    expect(keyRecentFirst[3]).toEqual([idB.toLowerCase(), idA.toLowerCase()]);
    expect(keyReversed[3]).toEqual([idA.toLowerCase(), idB.toLowerCase()]);
    expect(keyRecentFirst).not.toEqual(keyReversed);
  });

  it('scopes recommendation and cross-sell keys by currency', () => {
    const brlProductKey = queryKeys.recommendations.product(
      'fone',
      ['related', 'upsell'],
      undefined,
      'BRL',
    );
    const usdProductKey = queryKeys.recommendations.product(
      'fone',
      ['related', 'upsell'],
      undefined,
      'USD',
    );
    expect(brlProductKey).not.toEqual(usdProductKey);

    const brlCrossKey = queryKeys.recommendations.crossSell(['id-1'], 6, 'BRL');
    const usdCrossKey = queryKeys.recommendations.crossSell(['id-1'], 6, 'USD');
    expect(brlCrossKey).not.toEqual(usdCrossKey);
  });
});
