import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { SeasonalityController } from './seasonality.controller';
import { SeasonalityRepository } from './seasonality.repository';
import { SeasonalityService } from './seasonality.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeasonalityController],
  providers: [SeasonalityService, SeasonalityRepository],
  exports: [SeasonalityService],
})
export class SeasonalityModule {}
