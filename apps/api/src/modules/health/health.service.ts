import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
