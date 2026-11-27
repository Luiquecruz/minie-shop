import type {
  CartCrossSellResponseDTO,
  CategoriesResponseDTO,
  FacetsDTO,
  FavoriteCreatedResponseDTO,
  FavoritesListResponseDTO,
  PricingQuoteRequestDTO,
  PricingQuoteResponseDTO,
  ProductDetailDTO,
  ProductListResponseDTO,
  ProductRecommendationsResponseDTO,
  SearchResponseDTO,
  SearchSuggestResponseDTO,
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
  clientCartCrossSellResponseSchema,
  clientProductRecommendationsResponseSchema,
} from '@minieshop/contracts/recommendations/client';
import {
  clientSearchResponseSchema,
  clientSearchSuggestResponseSchema,
} from '@minieshop/contracts/search/client';
import {
  quotePricingInBatches,
  type CrossSellParams,
  type FacetsParams,
  type ListProductsParams,
  type ProductRecommendationsParams,
  type ProductRepository,
  type SearchProductsParams,
  type SuggestProductsParams,
} from '../../domain/repositories/ProductRepository';
import { createHttpClient, type HttpClient } from '../http/httpClient';
import {
  buildCatalogQueryString,
  buildCrossSellQueryString,
  buildProductRecommendationsQueryString,
  buildSearchQueryString,
  buildSuggestQueryString,
} from './queryStrings';

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

  searchProducts(
    params: SearchProductsParams,
    signal?: AbortSignal,
  ): Promise<SearchResponseDTO> {
    const query = buildSearchQueryString(params);
    return this.httpClient.get<SearchResponseDTO>(
      `/search${query}`,
      clientSearchResponseSchema,
      { signal },
    );
  }

  suggestProducts(
    params: SuggestProductsParams,
    signal?: AbortSignal,
  ): Promise<SearchSuggestResponseDTO> {
    const query = buildSuggestQueryString(params);
    return this.httpClient.get<SearchSuggestResponseDTO>(
      `/search/suggest${query}`,
      clientSearchSuggestResponseSchema,
      { signal },
    );
  }

  getProductRecommendations(
    params: ProductRecommendationsParams,
    signal?: AbortSignal,
  ): Promise<ProductRecommendationsResponseDTO> {
    const encodedSlug = encodeURIComponent(params.slug);
    const query = buildProductRecommendationsQueryString({
      types: params.types,
      limit: params.limit,
      currency: params.currency,
    });
    return this.httpClient.get<ProductRecommendationsResponseDTO>(
      `/products/${encodedSlug}/recommendations${query}`,
      clientProductRecommendationsResponseSchema,
      { signal },
    );
  }

  getCrossSell(
    params: CrossSellParams,
    signal?: AbortSignal,
  ): Promise<CartCrossSellResponseDTO> {
    const query = buildCrossSellQueryString(params);
    return this.httpClient.get<CartCrossSellResponseDTO>(
      `/recommendations/cross-sell${query}`,
      clientCartCrossSellResponseSchema,
      { signal },
    );
  }
}
