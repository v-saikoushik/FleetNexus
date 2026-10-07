import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ForecastQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 3]) horizon?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
}

export class ForecastEvaluationQueryDto {
  @IsUUID() commodityId!: string;
  @IsOptional() @IsUUID() routeId?: string;
}

export class RouteForecastQueryDto extends ForecastQueryDto {
  @IsUUID() commodityId!: string;
}
