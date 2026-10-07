import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EXPENSE_TYPES, type ExpenseType } from '@fleetnexus/shared';

export class FilterExpensesDto {
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsEnum(EXPENSE_TYPES)
  type?: ExpenseType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
