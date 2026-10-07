import { Module } from '@nestjs/common';
import { LoadProfitabilityModule } from './load-profitability.module';
import { DecisionSupportController } from './decision-support.controller';
import { DecisionSupportService } from './decision-support.service';

@Module({
  imports: [LoadProfitabilityModule],
  controllers: [DecisionSupportController],
  providers: [DecisionSupportService],
})
export class DecisionSupportModule {}
