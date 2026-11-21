import type { AppliedCoupon, ShippingOption } from '../../types';

export const FREE_SHIPPING_THRESHOLD_BRL = 500;
export const MAX_ORDER_NOTE_LENGTH = 200;
export const DEFAULT_FALLBACK_STOCK = 99;

export const SHIPPING_OPTIONS: readonly ShippingOption[] = [
  {
    id: 'standard',
    name: 'Standard Delivery',
    eta: '5-7 business days',
    basePriceBrl: 19.9,
  },
  {
    id: 'express',
    name: 'Express Courier',
    eta: '1-2 business days',
    basePriceBrl: 49.9,
  },
  {
    id: 'pickup',
    name: 'Store Pickup',
    eta: 'Ready in 2 hours',
    basePriceBrl: 0,
  },
];

export const PROMO_COUPONS: Record<string, AppliedCoupon> = {
  MINIE10: {
    code: 'MINIE10',
    label: '10% off items subtotal',
    discountPercent: 10,
  },
  MINIE20: {
    code: 'MINIE20',
    label: '20% off items subtotal',
    discountPercent: 20,
  },
  FREESHIP: {
    code: 'FREESHIP',
    label: 'Free Standard or Express shipping',
    freeShipping: true,
  },
};
