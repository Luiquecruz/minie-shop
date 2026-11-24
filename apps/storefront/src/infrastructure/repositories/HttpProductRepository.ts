import type {
  CategoriesResponseDTO,
  FacetsDTO,
  FavoriteCreatedResponseDTO,
  FavoritesListResponseDTO,
  PricingQuoteRequestDTO,
  PricingQuoteResponseDTO,
  ProductDetailDTO,
  ProductListResponseDTO,
  SupportedCurrency,
} from '@minieshop/contracts';
import {
  clientCategoriesResponseSchema,
  clientFacetsDtoSchema,
  clientFavoriteCreatedResponseSchema,
  clientFavoritesListResponseSchema,
  clientPricingQuoteResponseSchema,
  clientProductDetailDtoSchema,
  clientProductListResponseSchema,
} from '@minieshop/contracts/catalog/client';
import {
  buildCatalogQueryString,
  quotePricingInBatches,
  type FacetsParams,
  type ListProductsParams,
  type ProductRepository,
} from '../../domain/repositories/ProductRepository';
import { createHttpClient, type HttpClient } from '../http/httpClient';

export class HttpProductRepository implements ProductRepository {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient = createHttpClient()) {
    this.httpClient = httpClient;
  }

  listProducts(
    params: ListProductsParams = {},
    signal?: AbortSignal,
  ): Promise<ProductListResponseDTO> {
    const query = buildCatalogQueryString(params, 'list');
    return this.httpClient.get<ProductListResponseDTO>(
      `/products${query}`,
      clientProductListResponseSchema,
      { signal },
    );
  }

  getProductBySlug(
    slug: string,
    signal?: AbortSignal,
    currency: SupportedCurrency = 'BRL',
  ): Promise<ProductDetailDTO> {
    const encodedSlug = encodeURIComponent(slug);
    const query = currency !== 'BRL' ? `?currency=${encodeURIComponent(currency)}` : '';
    return this.httpClient.get<ProductDetailDTO>(
      `/products/${encodedSlug}${query}`,
      clientProductDetailDtoSchema,
      { signal },
    );
  }

  getCategories(signal?: AbortSignal): Promise<CategoriesResponseDTO> {
    return this.httpClient.get<CategoriesResponseDTO>(
      '/categories',
      clientCategoriesResponseSchema,
      { signal },
    );
  }

  getFacets(
    params: FacetsParams = {},
    signal?: AbortSignal,
  ): Promise<FacetsDTO> {
    const query = buildCatalogQueryString(params, 'facets');
    return this.httpClient.get<FacetsDTO>(
      `/products/facets${query}`,
      clientFacetsDtoSchema,
      { signal },
    );
  }

  quotePricing(
    request: PricingQuoteRequestDTO,
    signal?: AbortSignal,
  ): Promise<PricingQuoteResponseDTO> {
    return quotePricingInBatches(
      request.currency ?? 'BRL',
      request.productIds,
      (batchRequest) =>
        this.httpClient.post<PricingQuoteResponseDTO>(
          '/pricing/quote',
          clientPricingQuoteResponseSchema,
          { body: batchRequest, signal },
        ),
    );
  }

  getFavorites(signal?: AbortSignal): Promise<FavoritesListResponseDTO> {
    return this.httpClient.get<FavoritesListResponseDTO>(
      '/favorites',
      clientFavoritesListResponseSchema,
      { signal },
    );
  }

  addFavorite(
    productId: string,
    signal?: AbortSignal,
  ): Promise<FavoriteCreatedResponseDTO> {
    const encodedId = encodeURIComponent(productId);
    return this.httpClient.post<FavoriteCreatedResponseDTO>(
      `/favorites/${encodedId}`,
      clientFavoriteCreatedResponseSchema,
      { signal },
    );
  }

  removeFavorite(productId: string, signal?: AbortSignal): Promise<void> {
    const encodedId = encodeURIComponent(productId);
    return this.httpClient.delete(`/favorites/${encodedId}`, { signal });
  }
}
