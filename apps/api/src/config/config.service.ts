import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get apiPort(): number {
    return this.config.get<number>('API_PORT', 3000);
  }

  get apiPrefix(): string {
    return this.config.get<string>('API_PREFIX', 'api');
  }

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get corsOrigins(): string[] {
    return this.config
      .get<string>('API_CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}
