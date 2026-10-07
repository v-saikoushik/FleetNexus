import { IsIn } from 'class-validator';
import { SeasonalityFilterQueryDto } from './seasonality-filter-query.dto';

export const SEASONALITY_ENTITY_TYPES = ['commodity', 'routeCommodity', 'customer'] as const;
export const SEASONALITY_COMPARISON_METRICS = [
  'tripCount',
  'averageProfitPerTrip',
  'averageMarginPct',
] as const;

export class SeasonalityComparisonQueryDto extends SeasonalityFilterQueryDto {
  @IsIn(SEASONALITY_ENTITY_TYPES)
  entityType!: (typeof SEASONALITY_ENTITY_TYPES)[number];

  @IsIn(SEASONALITY_COMPARISON_METRICS)
  metric!: (typeof SEASONALITY_COMPARISON_METRICS)[number];
}
