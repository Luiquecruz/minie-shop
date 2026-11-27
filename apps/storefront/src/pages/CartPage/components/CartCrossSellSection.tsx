import { memo, useCallback, useMemo } from 'react';
import type { ProductCardDTO } from '@minieshop/contracts';
import { RecommendationCarousel } from '../../../components/RecommendationCarousel/RecommendationCarousel';
import { getErrorCode } from '../../../domain/errors';
import {
  useCartActions,
  useCartItemIds,
  useRecentCartProductIds,
} from '../../../hooks/useCart';
import { useCartCrossSellQuery } from '../../../hooks/useRecommendations';
import { useI18n } from '../../../i18n';

const CROSS_SELL_LIMIT = 8;

/**
 * Memoized Cart cross-sell recommendations section (`R05.3`).
 * - Queries up to 20 most recent distinct cart item IDs (`selectRecentCartProductIds`).
 * - Keeps previous items visible (`keepPreviousData`) while filtering out products
 *   already present in the cart so additions never cause flicker or duplicate offers.
 * - Inline Add to Cart invokes frozen `addToCart` + `closeCart` without opening MiniCart.
 */
export const CartCrossSellSection = memo(function CartCrossSellSection() {
  const { t } = useI18n();
  const recentProductIds = useRecentCartProductIds();
  const allCartIds = useCartItemIds();
  const { addToCart, closeCart } = useCartActions();

  const crossSellQuery = useCartCrossSellQuery({
    productIds: recentProductIds,
    limit: CROSS_SELL_LIMIT,
    enabled: recentProductIds.length > 0,
  });

  const cartIdsSet = useMemo(
    () => new Set(allCartIds.map((id) => id.toLowerCase())),
    [allCartIds],
  );

  const visibleItems = useMemo(() => {
    const rawItems = crossSellQuery.data?.items ?? [];
    return rawItems.filter((item) => !cartIdsSet.has(item.id.toLowerCase()));
  }, [crossSellQuery.data, cartIdsSet]);

  const handleAddToCart = useCallback(
    (product: ProductCardDTO): void => {
      addToCart(product);
      closeCart();
    },
    [addToCart, closeCart],
  );

  if (recentProductIds.length === 0) {
    return null;
  }

  const errorCode = getErrorCode(crossSellQuery.error);

  return (
    <div
      className="cart-cross-sell"
      data-testid="cart-cross-sell-section"
    >
      <RecommendationCarousel
        title={t('recommendations.crossSellTitle')}
        items={visibleItems}
        isLoading={crossSellQuery.isPending && visibleItems.length === 0}
        isError={crossSellQuery.isError && visibleItems.length === 0}
        errorCode={errorCode}
        showErrorDebug={import.meta.env.DEV}
        skeletonCount={4}
        onAddToCart={handleAddToCart}
        testId="cart-cross-sell-carousel"
      />
    </div>
  );
});

export default CartCrossSellSection;
