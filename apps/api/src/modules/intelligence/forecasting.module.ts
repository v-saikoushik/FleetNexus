import { Module } from '@nestjs/common';
import { SeasonalityModule } from './seasonality.module';
import { ForecastingController } from './forecasting.controller';
import { ForecastingService } from './forecasting.service';

@Module({
  imports: [SeasonalityModule],
  controllers: [ForecastingController],
  providers: [ForecastingService],
})
export class ForecastingModule {}
