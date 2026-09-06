import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FUEL_TYPES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type FuelType,
  type VehicleStatus,
  type VehicleType,
} from '@fleetnexus/shared';

export class CreateVehicleDto {
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{4,20}$/, {
    message: 'registrationNumber must be 4-20 letters, digits, spaces, or hyphens',
  })
  registrationNumber!: string;

  @IsEnum(VEHICLE_TYPES)
  vehicleType!: VehicleType;

  @IsString()
  @MaxLength(100)
  manufacturer!: string;

  @IsString()
  @MaxLength(100)
  model!: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  manufactureYear!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  chassisNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  engineNumber?: string;

  @IsEnum(FUEL_TYPES)
  fuelType!: FuelType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  capacityTons!: number;

  @IsOptional()
  @IsEnum(VEHICLE_STATUSES)
  status?: VehicleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
