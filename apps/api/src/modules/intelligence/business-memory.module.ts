import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { BusinessMemoryController } from './business-memory.controller';
import { BusinessMemoryRepository } from './business-memory.repository';
import { BusinessMemoryService } from './business-memory.service';
import { HistoricalIntelligenceController } from './historical-intelligence.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [BusinessMemoryController, HistoricalIntelligenceController],
  providers: [BusinessMemoryService, BusinessMemoryRepository],
  exports: [BusinessMemoryService],
})
export class BusinessMemoryModule {}
