import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  PricingQuoteRequestDTO,
  PricingQuoteResponseDTO,
  QuotedShippingOptionDTO,
  SupportedCurrency,
} from '@minieshop/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { exchangeRates, products } from '../../database/schema/index.js';
import { effectivePriceSql } from './catalog-filters.js';

const DEFAULT_FALLBACK_RATES: Record<SupportedCurrency, number> = {
  BRL: 1,
  USD: 0.2,
  EUR: 0.185,
};

const SHIPPING_PRICING_BY_CURRENCY: Record<
  SupportedCurrency,
  {
    freeShippingThresholdCents: number;
    shippingOptions: QuotedShippingOptionDTO[];
  }
> = {
  BRL: {
    freeShippingThresholdCents: 50_000,
    shippingOptions: [
      { id: 'standard', basePriceCents: 1_990 },
      { id: 'express', basePriceCents: 4_990 },
      { id: 'pickup', basePriceCents: 0 },
    ],
  },
  USD: {
    freeShippingThresholdCents: 10_000,
    shippingOptions: [
      { id: 'standard', basePriceCents: 490 },
      { id: 'express', basePriceCents: 990 },
      { id: 'pickup', basePriceCents: 0 },
    ],
  },
  EUR: {
    freeShippingThresholdCents: 9_500,
    shippingOptions: [
      { id: 'standard', basePriceCents: 450 },
      { id: 'express', basePriceCents: 890 },
      { id: 'pickup', basePriceCents: 0 },
    ],
  },
};

@Injectable()
export class PricingService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async resolveExchangeRate(currency: SupportedCurrency): Promise<number> {
    if (currency === 'BRL') {
      return 1;
    }

    const rows = await this.databaseService.db
      .select({ rateFromBrl: exchangeRates.rateFromBrl })
      .from(exchangeRates)
      .where(eq(exchangeRates.currency, currency))
      .limit(1);

    const rawRate = rows[0]?.rateFromBrl;
    const parsed = rawRate !== undefined ? Number(rawRate) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return DEFAULT_FALLBACK_RATES[currency];
  }

  buildEffectivePriceSql(currency: SupportedCurrency, rateFromBrl: number): SQL<number> {
    if (currency === 'BRL') {
      return effectivePriceSql;
    }

    return sql<number>`COALESCE(
      (
        SELECT COALESCE(pp.special_price_cents, pp.regular_price_cents)
        FROM "catalog"."product_prices" AS pp
        WHERE pp.product_id = "catalog"."products"."id"
          AND pp.currency = ${currency}
      ),
      ROUND((${effectivePriceSql})::numeric * ${rateFromBrl}::numeric)::integer
    )`;
  }

  async resolveEffectivePriceSql(currency: SupportedCurrency): Promise<SQL<number>> {
    const rate = await this.resolveExchangeRate(currency);
    return this.buildEffectivePriceSql(currency, rate);
  }

  getShippingPricing(currency: SupportedCurrency): {
    freeShippingThresholdCents: number;
    shippingOptions: QuotedShippingOptionDTO[];
  } {
    const config = SHIPPING_PRICING_BY_CURRENCY[currency];
    return {
      freeShippingThresholdCents: config.freeShippingThresholdCents,
      shippingOptions: config.shippingOptions.map((option) => ({ ...option })),
    };
  }

  async quoteCart(request: PricingQuoteRequestDTO): Promise<PricingQuoteResponseDTO> {
    const { currency } = request;
    const uniqueIds = Array.from(new Set(request.productIds));
    const shipping = this.getShippingPricing(currency);

    if (uniqueIds.length === 0) {
      return {
        currency,
        items: [],
        freeShippingThresholdCents: shipping.freeShippingThresholdCents,
        shippingOptions: shipping.shippingOptions,
      };
    }

    const effectivePriceExpr = await this.resolveEffectivePriceSql(currency);

    const rows = await this.databaseService.db
      .select({
        id: products.id,
        effectivePrice: effectivePriceExpr,
        inStock: products.inStock,
      })
      .from(products)
      .where(and(inArray(products.id, uniqueIds), eq(products.status, 'published')));

    const rowById = new Map(rows.map((row) => [row.id, row]));

    const items = uniqueIds
      .map((productId) => {
        const row = rowById.get(productId);
        if (!row) {
          return null;
        }
        return {
          productId: row.id,
          price: {
            amount: Number(row.effectivePrice),
            currency,
          },
          inStock: row.inStock,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      currency,
      items,
      freeShippingThresholdCents: shipping.freeShippingThresholdCents,
      shippingOptions: shipping.shippingOptions,
    };
  }
}
