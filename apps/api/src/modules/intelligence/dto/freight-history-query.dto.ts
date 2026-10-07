import { IsOptional, IsUUID } from 'class-validator';

export class FreightHistoryQueryDto {
  @IsUUID()
  routeId!: string;

  @IsUUID()
  commodityId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
