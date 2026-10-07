import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { FINANCE_PERIODS, type FinancePeriodType } from '@fleetnexus/shared';

export class FinancePeriodQueryDto {
  @IsOptional()
  @IsEnum(FINANCE_PERIODS)
  period?: FinancePeriodType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
