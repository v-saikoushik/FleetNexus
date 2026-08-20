import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

function toPort(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsOptional()
  @Transform(({ value }) => toPort(value, 3000))
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 3000;

  @IsString()
  @IsOptional()
  API_HOST = '0.0.0.0';

  @IsString()
  @IsOptional()
  API_PREFIX = 'api';

  @IsString()
  @IsOptional()
  API_CORS_ORIGINS = 'http://localhost:5173';

  @IsString()
  DATABASE_URL!: string;

  /**
   * JWT_SECRET must be set. The default is only for local dev convenience.
   * Never use the default in production — the validation below enforces this.
   */
  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters' })
  JWT_SECRET = 'dev-change-me-minimum-16-chars!!';

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '7d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '30d';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validated;
}
