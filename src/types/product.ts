/**
 * Raw price input before precedence and discount calculation.
 */
export interface RawPriceInput {
  regular_price?: number;
  special_price?: number | null | '';
}

/**
 * Normalized price structure produced by `calculatePrice`.
 */
export interface CalculatedPrice {
  regular_price: number;
  special_price: number | null;
  final_price: number;
  discount_percentage: number;
  has_discount: boolean;
}

/**
 * Product rating summary.
 */
export interface ProductRating {
  rate: number;
  count: number;
}

/**
 * Key-value technical specification entry.
 */
export interface ProductSpec {
  label: string;
  value: string;
}

/**
 * Manufacturer and warranty information displayed on PDP.
 */
export interface ManufacturerInfo {
  brand: string;
  origin: string;
  warrantyText: string;
  sustainability: string;
  support: string;
}

/**
 * Raw catalog product entry prior to enrichment.
 */
export interface RawProduct {
  id: number;
  name: string;
  price: RawPriceInput;
  category: string;
  image: string;
  rating: ProductRating;
  stock: number;
  description: string;
}

/**
 * Enriched product model consumed across catalog, search, PDP, and cart.
 */
export interface Product extends Omit<RawProduct, 'price'> {
  price: CalculatedPrice;
  images: string[];
  specs: ProductSpec[];
  manufacturer: ManufacturerInfo;
}

/**
 * Supported sort keys for catalog queries and dropdown selection.
 */
export type ProductSortOption = '' | 'price-asc' | 'price-desc' | 'rating' | 'name';
