import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { DriverController } from './driver.controller';
import { DriverRepository } from './driver.repository';
import { DriverService } from './driver.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DriverController],
  providers: [DriverRepository, DriverService],
  exports: [DriverService, DriverRepository],
})
export class DriverModule {}
