import { Module } from '@nestjs/common';
import { BusinessMemoryModule } from './business-memory.module';
import { LoadProfitabilityController } from './load-profitability.controller';
import { LoadProfitabilityService } from './load-profitability.service';

@Module({
  imports: [BusinessMemoryModule],
  controllers: [LoadProfitabilityController],
  providers: [LoadProfitabilityService],
  exports: [LoadProfitabilityService],
})
export class LoadProfitabilityModule {}
