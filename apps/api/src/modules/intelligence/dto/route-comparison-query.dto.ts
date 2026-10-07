import { IsIn } from 'class-validator';

export const ROUTE_COMPARISON_METRICS = [
  'averageProfit',
  'averageMargin',
  'costPerKm',
  'profitPerKm',
  'tollShare',
  'fuelCostPerKm',
  'tripCount',
] as const;

export class RouteComparisonQueryDto {
  @IsIn(ROUTE_COMPARISON_METRICS)
  metric!: (typeof ROUTE_COMPARISON_METRICS)[number];
}
