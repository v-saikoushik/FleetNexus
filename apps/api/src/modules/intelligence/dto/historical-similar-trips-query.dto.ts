import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { VEHICLE_TYPES } from '@fleetnexus/shared';

export class HistoricalSimilarTripsQueryDto {
  @IsOptional() @IsUUID() tripId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsUUID() commodityId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsEnum(VEHICLE_TYPES) vehicleType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) capacityTons?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) limit = 10;
}
