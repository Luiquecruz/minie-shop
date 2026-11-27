import { RecommendationCarousel } from '../../../components/RecommendationCarousel/RecommendationCarousel';
import { getErrorCode } from '../../../domain/errors';
import { useInView } from '../../../hooks/useInView';
import { useProductRecommendationsQuery } from '../../../hooks/useRecommendations';
import { useI18n } from '../../../i18n';

export interface PdpRecommendationsSectionProps {
  slug: string;
}

const PDP_RECOMMENDATION_TYPES = ['related', 'upsell'] as const;

/**
 * Lazy-loaded PDP recommendation blocks (`R05.2`).
 * Fetches `related` and `upsell` in a single API call only once the section enters
 * (or approaches within 200px of) the viewport via `IntersectionObserver`.
 */
export function PdpRecommendationsSection({
  slug,
}: PdpRecommendationsSectionProps) {
  const { t } = useI18n();
  const { ref, hasIntersected } = useInView<HTMLDivElement>({
    rootMargin: '200px 0px',
    threshold: 0,
  });

  const recsQuery = useProductRecommendationsQuery({
    slug,
    types: PDP_RECOMMENDATION_TYPES,
    enabled: hasIntersected,
  });

  const relatedItems = recsQuery.data?.related ?? [];
  const upsellItems = recsQuery.data?.upsell ?? [];
  const isInitialLoading = hasIntersected && recsQuery.isPending;
  const isSettled = hasIntersected && !recsQuery.isPending;
  const hasVisibleRecommendations =
    !recsQuery.isError && (relatedItems.length > 0 || upsellItems.length > 0);
  const showDevErrorBadge = import.meta.env.DEV && hasIntersected && recsQuery.isError;
  const errorCode = getErrorCode(recsQuery.error);

  if (isSettled && !hasVisibleRecommendations && !showDevErrorBadge) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="pdp-recommendations"
      data-testid="pdp-recommendations-section"
      style={
        !isSettled
          ? { minHeight: '690px' }
          : undefined
      }
    >
      <RecommendationCarousel
        title={t('recommendations.relatedTitle')}
        items={relatedItems}
        isLoading={isInitialLoading}
        isError={hasIntersected && recsQuery.isError}
        errorCode={errorCode}
        showErrorDebug={import.meta.env.DEV}
        skeletonCount={4}
        testId="pdp-related-carousel"
      />

      {!isInitialLoading && !recsQuery.isError && upsellItems.length > 0 && (
        <RecommendationCarousel
          title={t('recommendations.upsellTitle')}
          items={upsellItems}
          testId="pdp-upsell-carousel"
        />
      )}
    </div>
  );
}

export default PdpRecommendationsSection;
