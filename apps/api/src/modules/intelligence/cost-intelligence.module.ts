import { Module } from '@nestjs/common';
import { FinanceModule } from '@/modules/finance/finance.module';
import { BusinessMemoryModule } from './business-memory.module';
import { CostIntelligenceController } from './cost-intelligence.controller';
import { CostIntelligenceRepository } from './cost-intelligence.repository';
import { CostIntelligenceService } from './cost-intelligence.service';

@Module({
  imports: [FinanceModule, BusinessMemoryModule],
  controllers: [CostIntelligenceController],
  providers: [CostIntelligenceService, CostIntelligenceRepository],
  exports: [CostIntelligenceService],
})
export class CostIntelligenceModule {}
