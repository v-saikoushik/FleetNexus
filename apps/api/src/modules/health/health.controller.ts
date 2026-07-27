import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@fleetnexus/shared';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.getStatus();
  }

  @Get('info')
  info() {
    return {
      success: true,
      data: {
        name: APP_NAME,
        service: 'api',
      },
    };
  }
}
