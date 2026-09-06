import { Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleRepository } from './vehicle.repository';
import { VehicleService } from './vehicle.service';

@Module({
  controllers: [VehicleController],
  providers: [VehicleService, VehicleRepository],
})
export class VehicleModule {}
