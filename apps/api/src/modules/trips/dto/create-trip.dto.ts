import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TRIP_STATUSES, type TripStatus } from '@fleetnexus/shared';

export class CreateTripDto {
  @IsUUID()
  vehicleId!: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  commodityId?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TRIP_STATUSES)
  status?: TripStatus;

  @IsString()
  @MaxLength(200)
  originName!: string;

  @IsString()
  @MaxLength(200)
  destinationName!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  estimatedDistanceKm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  actualDistanceKm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000)
  loadWeightTons?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedFreight?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualFreight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  driverName?: string;

  @IsOptional()
  @IsUUID()
  driverUserId?: string;

  @IsOptional()
  @IsBoolean()
  isEmptyReturn?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
