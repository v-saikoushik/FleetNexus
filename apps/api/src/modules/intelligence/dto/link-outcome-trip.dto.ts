import { IsUUID } from 'class-validator';

export class LinkOutcomeTripDto {
  @IsUUID() tripId!: string;
}
