import { RecommendationCarousel } from '../../../components/RecommendationCarousel/RecommendationCarousel';
import { useInView } from '../../../hooks/useInView';
import { useProductRecommendationsQuery } from '../../../hooks/useRecommendations';
import { ApiError } from '../../../infrastructure/http/errors';
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
  const errorCode =
    recsQuery.error instanceof ApiError ? recsQuery.error.code : null;

  return (
    <div
      ref={ref}
      className="pdp-recommendations"
      data-testid="pdp-recommendations-section"
    >
      <RecommendationCarousel
        title={t('recommendations.relatedTitle')}
        items={relatedItems}
        isLoading={isInitialLoading}
        isError={hasIntersected && recsQuery.isError}
        errorCode={errorCode}
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
