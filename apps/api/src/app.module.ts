import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import * as path from 'node:path';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
      validate: validateEnv,
    }),
    // path-to-regexp v8 — NestJS 11 requires named wildcards ({*splat}) instead of the legacy (*) glob.
    LoggerModule.forRoot({
      forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        autoLogging: true,
        quietReqLogger: true,
      },
    }),
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    IdentityModule,
  ],
})
export class AppModule {}
