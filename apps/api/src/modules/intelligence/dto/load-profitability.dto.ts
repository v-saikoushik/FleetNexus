import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class LoadProfitabilityDto {
  @IsUUID() routeId!: string;
  @IsUUID() commodityId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  offeredFreight?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  expectedDistanceKm?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  loadWeightTons?: number;
  @IsDateString() proposedPickupDate!: string;
  @IsOptional() @IsDateString() proposedDeliveryDate?: string;
}
