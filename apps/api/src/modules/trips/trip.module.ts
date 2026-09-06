import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { TripController } from './trip.controller';
import { TripRepository } from './trip.repository';
import { TripService } from './trip.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TripController],
  providers: [TripRepository, TripService],
  exports: [TripService, TripRepository],
})
export class TripModule {}
