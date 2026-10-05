import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DRIVER_STATUSES, type DriverStatus } from '@fleetnexus/shared';

export class CreateDriverDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhone?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  licenseNumber!: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsEnum(DRIVER_STATUSES)
  status?: DriverStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
