export { RecommendationsModule } from './recommendations.module.js';
export { RelationsService, RELATION_POOL_SIZES } from './relations.service.js';
export type {
  RecomputeResult,
  RelationsCoverageByType,
  RelationsStatusReport,
} from './relations.service.js';
export { RecommendationsOutboxHandler } from './recommendations.handler.js';
export {
  computeUpsellPriceBounds,
  computeRuleRelatedScore,
  rankRuleRelated,
  rankRuleUpsell,
  selectDiverseCrossSell,
  sortRelationsForReading,
} from './relations-rules.js';
export type {
  RelationType,
  RelationSource,
  RelationMethod,
  RuleCandidate,
  ScoredCandidate,
  UpsellPriceBounds,
  ComplementBucket,
} from './relations-rules.js';
