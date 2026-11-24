export const enMessages = {
  // Navigation & Global
  'nav.brandAria': 'Minie Shop Home',
  'nav.currencyLabel': 'Currency',
  'nav.currencyAria': 'Select display currency',
  'nav.cartAria': 'Shopping cart with {count} items',
  'nav.cartLabel': 'Cart',
  'search.placeholder': 'Search products...',
  'search.ariaLabel': 'Search products',
  'search.clearAria': 'Clear search input',
  'search.submitAria': 'Submit search',

  // Catalog / PLP
  'plp.metaTitle': 'Product Catalog | Minie Shop',
  'plp.metaDescription':
    'Explore curated products in Minie Shop with real-time catalog filters, transparent pricing, and fast delivery.',
  'plp.badge': 'Complete Collection',
  'plp.title': 'Product Catalog',
  'plp.subtitle':
    'Explore our curated collection with structured filters, live availability, and transparent pricing.',
  'plp.sortLabel': 'Sort by:',
  'plp.sortAria': 'Sort products',
  'plp.sort.newest': 'Newest',
  'plp.sort.price_asc': 'Lowest Price',
  'plp.sort.price_desc': 'Highest Price',
  'plp.sort.name_asc': 'Name (A - Z)',
  'plp.sort.relevance': 'Relevance',
  'plp.resultsUpdated': 'Results updated',
  'plp.resultsUpdatedWithCount': 'Results updated: {count} products available',
  'plp.showingLoaded': 'Showing {count} loaded products',
  'plp.showingLoadedOf': 'Showing {loaded} of {total} products',
  'plp.updating': 'Updating results...',
  'plp.loadMore': 'Load more',
  'plp.loadingMore': 'Loading more...',
  'plp.errorTitle': 'Could not load products',
  'plp.errorFallback': 'Could not load products. Please try again.',
  'plp.retry': 'Try Again',
  'plp.retrying': 'Retrying...',
  'plp.emptyTitle': 'No products found',
  'plp.emptyText': 'Try adjusting your filters or search terms.',
  'plp.clearFilters': 'Clear filters',
  'plp.dismissNotification': 'Dismiss notification',

  // Filters Sidebar / Panel
  'filters.formAria': 'Catalog filters',
  'filters.heading': 'Filters',
  'filters.clearAll': 'Clear all',
  'filters.categoriesLegend': 'Categories',
  'filters.allCategories': 'All categories',
  'filters.priceLegend': 'Price range',
  'filters.minPriceLabel': 'Min price ({currency})',
  'filters.maxPriceLabel': 'Max price ({currency})',
  'filters.availabilityLegend': 'Availability',
  'filters.inStockOnly': 'In stock only',
  'filters.yes': 'Yes',
  'filters.no': 'No',
  'filters.minValue': 'Min',
  'filters.maxValue': 'Max',

  // Product Card
  'card.viewDetails': 'View {name} details',
  'card.inStock': 'In stock',
  'card.outOfStock': 'Out of stock',
  'card.addToCart': 'Add to Cart',
  'card.addToCartAria': 'Add {name} to cart',
  'card.saveFavorite': 'Save to favorites',
  'card.removeFavorite': 'Remove from favorites',
  'card.addFavoriteAria': 'Add {name} to favorites',
  'card.removeFavoriteAria': 'Remove {name} from favorites',

  // Product Image
  'image.unavailable': 'Image unavailable',

  // PDP
  'pdp.breadcrumbAria': 'Breadcrumb',
  'pdp.breadcrumbCatalog': 'Catalog',
  'pdp.galleryAria': 'Product Image Gallery',
  'pdp.detailsAria': 'Product Details',
  'pdp.saved': 'Saved',
  'pdp.save': 'Save',
  'pdp.inStock': 'In Stock',
  'pdp.outOfStock': 'Out of Stock',
  'pdp.addToCart': 'Add to Cart',
  'pdp.buyNow': 'Buy Now',
  'pdp.addedToCart': '"{name}" added to cart!',
  'pdp.proceedingToCheckout': 'Proceeding to checkout with "{name}"!',
  'pdp.tabDescription': 'Description',
  'pdp.tabSpecs': 'Specifications',
  'pdp.noSpecs': 'No technical attributes registered for this product.',
  'pdp.errorTitle': 'Could Not Load Product',
  'pdp.errorFallback': 'We could not load this product right now.',
  'pdp.backToCatalog': 'Back to Catalog',
  'pdp.swipeHint': 'Swipe to explore views',
  'pdp.assuranceShipping': 'Fast express shipping',
  'pdp.assuranceWarranty': '12-Month Official Warranty',
  'pdp.assuranceReturn': '30-Day Free Return Policy',

  // 404 Page
  'notFound.metaTitle': 'Page Not Found | Minie Shop',
  'notFound.metaDescription': 'The requested page or product could not be found.',
  'notFound.badge': '404',
  'notFound.title': 'Product or Page Not Found',
  'notFound.description':
    'We could not find the resource you were looking for. It may have been removed or moved to another address.',
  'notFound.backToCatalog': 'Back to Catalog',

  // Favorites error
  'favorites.toggleError': 'Could not update favorite status. Your change has been reverted.',
} as const;

export type MessageKey = keyof typeof enMessages;
