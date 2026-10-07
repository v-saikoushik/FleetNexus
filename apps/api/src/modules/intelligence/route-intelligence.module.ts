import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { RouteIntelligenceController } from './route-intelligence.controller';
import { RouteIntelligenceRepository } from './route-intelligence.repository';
import { RouteIntelligenceService } from './route-intelligence.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RouteIntelligenceController],
  providers: [RouteIntelligenceService, RouteIntelligenceRepository],
  exports: [RouteIntelligenceService],
})
export class RouteIntelligenceModule {}
